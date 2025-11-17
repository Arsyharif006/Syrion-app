// src/services/supabaseStorageService.ts

import { supabase } from '../lib/supabaseClient';
import { Conversation, Message, MessageSender } from '../../types';

/**
 * Fetch all conversations for the current user
 */
export const getConversations = async (): Promise<Conversation[]> => {
  try {
    const { data: conversationsData, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .order('created_at', { ascending: false });

    if (convError) throw convError;
    if (!conversationsData) return [];

    // Fetch messages for each conversation
    const conversationsWithMessages = await Promise.all(
      conversationsData.map(async (conv) => {
        const { data: messagesData, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true });

        if (msgError) {
          console.error('Error fetching messages:', msgError);
          return {
            id: conv.id,
            title: conv.title,
            messages: [],
            createdAt: conv.created_at,
          };
        }

        const messages: Message[] = (messagesData || []).map((msg) => ({
          id: msg.id,
          text: msg.text,
          sender: msg.sender === 'user' ? MessageSender.User : MessageSender.AI,
        }));

        return {
          id: conv.id,
          title: conv.title,
          messages,
          createdAt: conv.created_at,
        };
      })
    );

    return conversationsWithMessages;
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return [];
  }
};

/**
 * Get a single conversation by ID
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
      console.error('Error fetching messages:', msgError);
      return null;
    }

    const messages: Message[] = (messagesData || []).map((msg) => ({
      id: msg.id,
      text: msg.text,
      sender: msg.sender === 'user' ? MessageSender.User : MessageSender.AI,
    }));

    return {
      id: convData.id,
      title: convData.title,
      messages,
      createdAt: convData.created_at,
    };
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return null;
  }
};

/**
 * Save or update a conversation
 */
export const saveConversation = async (conversation: Conversation): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check if conversation exists
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversation.id)
      .single();

    if (existing) {
      // Update existing conversation
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          title: conversation.title,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversation.id);

      if (updateError) throw updateError;
    } else {
      // Insert new conversation
      const { error: insertError } = await supabase
        .from('conversations')
        .insert({
          id: conversation.id,
          user_id: user.id,
          title: conversation.title,
          created_at: conversation.createdAt,
        });

      if (insertError) throw insertError;
    }

    // Delete existing messages and insert new ones
    await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversation.id);

    if (conversation.messages.length > 0) {
      const messagesToInsert = conversation.messages.map((msg) => ({
        id: msg.id,
        conversation_id: conversation.id,
        text: msg.text,
        sender: msg.sender === MessageSender.User ? 'user' : 'ai',
      }));

      const { error: msgInsertError } = await supabase
        .from('messages')
        .insert(messagesToInsert);

      if (msgInsertError) throw msgInsertError;
    }
  } catch (error) {
    console.error('Error saving conversation:', error);
    throw error;
  }
};

/**
 * Delete a conversation and its messages
 */
export const deleteConversation = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting conversation:', error);
    throw error;
  }
};

/**
 * Delete all conversations for the current user
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
    console.error('Error deleting all conversations:', error);
    throw error;
  }
};

/**
 * Get storage statistics
 */
export const getStorageStats = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        totalConversations: 0,
        totalMessages: 0,
        usedStorageBytes: 0,
        usedStorageMB: 0,
        maxStorageMB: 100,
        usagePercentage: 0,
      };
    }

    // Count conversations
    const { count: convCount } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Count messages
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', user.id);

    let totalMessages = 0;
    if (conversations && conversations.length > 0) {
      const convIds = conversations.map(c => c.id);
      const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convIds);

      totalMessages = msgCount || 0;
    }

    // Estimate storage (rough approximation)
    const avgMessageSize = 500; // bytes
    const usedStorageBytes = totalMessages * avgMessageSize;
    const usedStorageMB = usedStorageBytes / (1024 * 1024);
    const maxStorageMB = 100;
    const usagePercentage = Math.min((usedStorageMB / maxStorageMB) * 100, 100);

    return {
      totalConversations: convCount || 0,
      totalMessages,
      usedStorageBytes,
      usedStorageMB,
      maxStorageMB,
      usagePercentage,
    };
  } catch (error) {
    console.error('Error getting storage stats:', error);
    return {
      totalConversations: 0,
      totalMessages: 0,
      usedStorageBytes: 0,
      usedStorageMB: 0,
      maxStorageMB: 100,
      usagePercentage: 0,
    };
  }
};