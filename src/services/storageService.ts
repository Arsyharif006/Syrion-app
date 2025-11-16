
import { Conversation } from '../../types';

const CONVERSATIONS_KEY = 'vibe-ai-conversations';

export const getConversations = (): Conversation[] => {
  try {
    const stored = localStorage.getItem(CONVERSATIONS_KEY);
    if (!stored) return [];
    const conversations = JSON.parse(stored) as Conversation[];
    // Sort by most recent
    return conversations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Failed to parse conversations from localStorage", error);
    return [];
  }
};

export const getConversation = (id: string): Conversation | null => {
    const conversations = getConversations();
    return conversations.find(c => c.id === id) || null;
}

export const saveConversation = (conversation: Conversation): void => {
  const conversations = getConversations();
  const index = conversations.findIndex(c => c.id === conversation.id);

  if (index > -1) {
    conversations[index] = conversation;
  } else {
    conversations.push(conversation);
  }

  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
};

export const deleteConversation = (id: string): void => {
    let conversations = getConversations();
    conversations = conversations.filter(c => c.id !== id);
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export const deleteAllConversations = (): void => {
    localStorage.removeItem(CONVERSATIONS_KEY);
}
