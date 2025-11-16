// src/utils/storageUtils.ts

import { getConversations } from './storageService';

export interface StorageStats {
  totalConversations: number;
  totalMessages: number;
  usedStorageBytes: number;
  usedStorageMB: number;
  maxStorageMB: number;
  usagePercentage: number;
}

const CONVERSATIONS_KEY = 'vibe-ai-conversations';

/**
 * Calculate storage statistics from localStorage
 * TODO: Replace with backend API call when available
 */
export const calculateStorageStats = (): StorageStats => {
  try {
    // Use existing service to get conversations
    const conversations = getConversations();

    // Calculate total messages
    const totalMessages = conversations.reduce(
      (sum, conv) => sum + conv.messages.length, 
      0
    );

    // Calculate storage size in bytes using the actual localStorage key
    const conversationsData = localStorage.getItem(CONVERSATIONS_KEY) || '';
    const usedStorageBytes = new Blob([conversationsData]).size;
    const usedStorageMB = usedStorageBytes / (1024 * 1024);

    // Set max storage (can be adjusted based on plan/tier)
    const maxStorageMB = 100;

    // Calculate percentage
    const usagePercentage = (usedStorageMB / maxStorageMB) * 100;

    return {
      totalConversations: conversations.length,
      totalMessages,
      usedStorageBytes,
      usedStorageMB,
      maxStorageMB,
      usagePercentage: Math.min(usagePercentage, 100),
    };
  } catch (error) {
    console.error('Error calculating storage stats:', error);
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

/**
 * Format bytes to human-readable format
 */
export const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Get storage color based on usage percentage
 */
export const getStorageColor = (percentage: number): string => {
  if (percentage < 50) return 'bg-green-600';
  if (percentage < 75) return 'bg-yellow-600';
  if (percentage < 90) return 'bg-orange-600';
  return 'bg-red-600';
};

// ============================================
// Backend Integration (TODO)
// ============================================
/**
 * Fetch storage stats from backend API
 * Uncomment and modify when backend is ready
 */
/*
export const fetchStorageStatsFromBackend = async (): Promise<StorageStats> => {
  try {
    const response = await fetch('/api/storage/stats', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth-token')}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch storage stats');
    }

    const data = await response.json();
    return {
      totalConversations: data.total_conversations,
      totalMessages: data.total_messages,
      usedStorageBytes: data.used_storage_bytes,
      usedStorageMB: data.used_storage_mb,
      maxStorageMB: data.max_storage_mb,
      usagePercentage: data.usage_percentage,
    };
  } catch (error) {
    console.error('Error fetching storage stats from backend:', error);
    // Fallback to localStorage calculation
    return calculateStorageStats();
  }
};
*/

/**
 * Wrapper function that can switch between localStorage and backend
 * Modify this when migrating to backend
 */
export const getStorageStats = async (): Promise<StorageStats> => {
  // For now, use localStorage calculation
  return calculateStorageStats();
  
  // TODO: When backend is ready, uncomment this:
  // return await fetchStorageStatsFromBackend();
};