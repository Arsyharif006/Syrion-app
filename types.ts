
export enum MessageSender {
  User = 'user',
  AI = 'ai',
}


export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

export interface MessageAttachment {
  name: string;
  type: 'image' | 'file';
  size: number;
  storagePath: string;  // path permanen di Supabase Storage
  signedUrl?: string;   // URL sementara untuk render (di-refresh tiap load)
}

export interface Message {
  id: string;
  text: string;
  sender: MessageSender;
  attachments?: MessageAttachment[];
}