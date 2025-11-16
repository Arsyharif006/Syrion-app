
export enum MessageSender {
  User = 'user',
  AI = 'ai',
}

export interface Message {
  id: string;
  text: string;
  sender: MessageSender;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}
