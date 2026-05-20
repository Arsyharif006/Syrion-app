// src/services/supabaseStorageService.ts

import { supabase } from '../lib/supabaseClient';
import { Conversation, Message, MessageSender, MessageAttachment } from '../../types';
import { hydrateAttachmentUrls, StoredAttachment } from './attachmentService';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Sanitasi teks pesan — handle kasus response Gemini yang tersimpan
 * sebagai JSON object (bukan plain string) di database.
 */
const sanitizeMessageText = (raw: any): string => {
  if (!raw) return '';

  // Sudah string biasa
  if (typeof raw !== 'string') return JSON.stringify(raw);

  // Coba parse — mungkin JSON dari Gemini
  try {
    const parsed = JSON.parse(raw);

    // Format: { parts: [{ text }] }
    if (parsed?.parts && Array.isArray(parsed.parts)) {
      return parsed.parts.map((p: any) => p.text || '').join('');
    }

    // Format: { candidates: [{ content: { parts: [{ text }] } }] }
    if (parsed?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return parsed.candidates[0].content.parts[0].text;
    }

    // Format: { output | text | message | response | answer | content }
    const direct =
      parsed?.output || parsed?.text || parsed?.message ||
      parsed?.response || parsed?.answer || parsed?.content;
    if (direct && typeof direct === 'string') return direct;
  } catch {
    // Bukan JSON — gunakan apa adanya
  }

  return raw;
};

/**
 * Parse kolom attachments dari DB → array StoredAttachment.
 * Kolom bisa berupa string JSON atau objek JSONB langsung dari Supabase.
 */
const parseAttachments = (raw: any): StoredAttachment[] | null => {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Mapping row DB → Message, termasuk sanitasi text + hydrate signed URL.
 */
const mapRowToMessage = async (msg: any): Promise<Message> => {
  const text = sanitizeMessageText(msg.text);
  const sender = msg.sender === 'user' ? MessageSender.User : MessageSender.AI;

  const rawAttachments = parseAttachments(msg.attachments);
  const attachments: MessageAttachment[] | undefined = rawAttachments
    ? await hydrateAttachmentUrls(rawAttachments)
    : undefined;

  return { id: msg.id, text, sender, attachments };
};

/**
 * Serialisasi Message → row untuk di-insert ke tabel messages.
 * signedUrl sengaja dibuang — expired, tidak perlu disimpan.
 */
const serializeMessage = (msg: Message, conversationId: string) => {
  const text = sanitizeMessageText(msg.text);

  const attachments = msg.attachments?.length
    ? JSON.stringify(msg.attachments.map(({ signedUrl, ...rest }) => rest))
    : null;

  return {
    id: msg.id,
    conversation_id: conversationId,
    text,
    sender: msg.sender === MessageSender.User ? 'user' : 'ai',
    attachments,
  };
};

// ─────────────────────────────────────────────────────────────
// Race-condition guard untuk saveConversation
// ─────────────────────────────────────────────────────────────
const savingInProgress = new Set<string>();

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Ambil semua conversation milik user yang sedang login,
 * beserta seluruh pesan dan attachment-nya.
 */
export const getConversations = async (): Promise<Conversation[]> => {
  try {
    const { data: conversationsData, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .order('created_at', { ascending: false });

    if (convError) throw convError;
    if (!conversationsData?.length) return [];

    const result = await Promise.all(
      conversationsData.map(async (conv) => {
        const { data: messagesData, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true });

        if (msgError) {
          console.error(`[getConversations] Error fetching messages for ${conv.id}:`, msgError);
          return { id: conv.id, title: conv.title, messages: [], createdAt: conv.created_at };
        }

        const messages = await Promise.all((messagesData || []).map(mapRowToMessage));

        return { id: conv.id, title: conv.title, messages, createdAt: conv.created_at };
      })
    );

    return result;
  } catch (error) {
    console.error('[getConversations] Error:', error);
    return [];
  }
};

/**
 * Ambil satu conversation berdasarkan ID.
 */
export const getConversation = async (id: string): Promise<Conversation | null> => {
  try {
    const { data: convData, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (convError || !convData) return null;

    const { data: messagesData, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (msgError) {
      console.error(`[getConversation] Error fetching messages for ${id}:`, msgError);
      return null;
    }

    const messages = await Promise.all((messagesData || []).map(mapRowToMessage));

    return { id: convData.id, title: convData.title, messages, createdAt: convData.created_at };
  } catch (error) {
    console.error('[getConversation] Error:', error);
    return null;
  }
};

/**
 * Simpan (insert/update) conversation ke Supabase.
 * Menggunakan upsert untuk mencegah duplicate key error.
 * Skip jika conversation yang sama sedang dalam proses save.
 */
export const saveConversation = async (conversation: Conversation): Promise<void> => {
  if (savingInProgress.has(conversation.id)) return;
  savingInProgress.add(conversation.id);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Upsert conversation
    const { error: convError } = await supabase
      .from('conversations')
      .upsert(
        {
          id: conversation.id,
          user_id: user.id,
          title: conversation.title,
          created_at: conversation.createdAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    if (convError) throw convError;

    // Hapus messages lama lalu insert ulang
    await supabase.from('messages').delete().eq('conversation_id', conversation.id);

    if (conversation.messages.length > 0) {
      const rows = conversation.messages.map((msg) => serializeMessage(msg, conversation.id));

      const { error: msgError } = await supabase
        .from('messages')
        .upsert(rows, { onConflict: 'id' });
      if (msgError) throw msgError;
    }
  } catch (error) {
    console.error('[saveConversation] Error:', error);
    throw error;
  } finally {
    savingInProgress.delete(conversation.id);
  }
};

/**
 * Hapus satu conversation (messages terhapus otomatis via CASCADE di DB).
 */
export const deleteConversation = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase.from('conversations').delete().eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('[deleteConversation] Error:', error);
    throw error;
  }
};

/**
 * Hapus semua conversation milik user yang sedang login.
 */
export const deleteAllConversations = async (): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('user_id', user.id);
    if (error) throw error;
  } catch (error) {
    console.error('[deleteAllConversations] Error:', error);
    throw error;
  }
};

/**
 * Statistik pemakaian storage untuk ditampilkan di Settings.
 */
export const getStorageStats = async () => {
  const defaultStats = {
    totalConversations: 0,
    totalMessages: 0,
    usedStorageBytes: 0,
    usedStorageMB: 0,
    maxStorageMB: 100,
    usagePercentage: 0,
  };

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return defaultStats;

    const { count: convCount } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', user.id);

    let totalMessages = 0;
    if (conversations?.length) {
      const convIds = conversations.map((c) => c.id);
      const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convIds);
      totalMessages = msgCount || 0;
    }

    const AVG_MESSAGE_BYTES = 500;
    const usedStorageBytes = totalMessages * AVG_MESSAGE_BYTES;
    const usedStorageMB = usedStorageBytes / (1024 * 1024);
    const maxStorageMB = 100;

    return {
      totalConversations: convCount || 0,
      totalMessages,
      usedStorageBytes,
      usedStorageMB,
      maxStorageMB,
      usagePercentage: Math.min((usedStorageMB / maxStorageMB) * 100, 100),
    };
  } catch (error) {
    console.error('[getStorageStats] Error:', error);
    return defaultStats;
  }
};