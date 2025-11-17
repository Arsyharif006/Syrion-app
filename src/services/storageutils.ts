// src/utils/storageUtils.ts

import { getStorageStats as getSupabaseStats } from '../services/supabaseStorageService';

export interface StorageStats {
  totalConversations: number;
  totalMessages: number;
  usedStorageBytes: number;
  usedStorageMB: number;
  maxStorageMB: number;
  usagePercentage: number;
}

/**
 * Calculate storage statistics from Supabase
 */
export const calculateStorageStats = async (): Promise<StorageStats> => {
  try {
    return await getSupabaseStats();
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

/**
 * Wrapper function for getting storage stats
 */
export const getStorageStats = async (): Promise<StorageStats> => {
  return await calculateStorageStats();
};