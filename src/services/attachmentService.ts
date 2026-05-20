import { supabase } from '../lib/supabaseClient';

export interface StoredAttachment {
  name: string;
  type: 'image' | 'file';
  size: number;
  storagePath: string;   // path di Supabase Storage
  signedUrl?: string;    // URL sementara untuk tampil di UI
}

/**
 * Upload file ke Supabase Storage
 * Path: {userId}/{conversationId}/{timestamp}_{filename}
 */
export const uploadAttachment = async (
  file: File,
  conversationId: string
): Promise<StoredAttachment | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${user.id}/${conversationId}/${timestamp}_${safeName}`;

    const { error } = await supabase.storage
      .from('chat-attachments')
      .upload(storagePath, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;

    // Langsung fetch signed URL setelah upload
    const signedUrl = await getSignedUrl(storagePath);

    return {
      name: file.name,
      type: file.type.startsWith('image/') ? 'image' : 'file',
      size: file.size,
      storagePath,
      signedUrl: signedUrl ?? undefined,
    };
  } catch (error) {
    console.error('Error uploading attachment:', error);
    return null;
  }
};

/**
 * Ambil signed URL (berlaku 1 jam) untuk menampilkan gambar
 */
export const getSignedUrl = async (storagePath: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from('chat-attachments')
      .createSignedUrl(storagePath, 3600); // 1 jam

    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    return null;
  }
};

/**
 * Ambil signed URL untuk banyak attachment sekaligus
 */
export const hydrateAttachmentUrls = async (
  attachments: StoredAttachment[]
): Promise<StoredAttachment[]> => {
  return Promise.all(
    attachments.map(async (att) => {
      if (!att.storagePath) return att;
      const signedUrl = await getSignedUrl(att.storagePath);
      return { ...att, signedUrl: signedUrl || undefined };
    })
  );
};

/**
 * Hapus attachment dari storage
 */
export const deleteAttachment = async (storagePath: string): Promise<void> => {
  try {
    const { error } = await supabase.storage
      .from('chat-attachments')
      .remove([storagePath]);
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting attachment:', error);
  }
};