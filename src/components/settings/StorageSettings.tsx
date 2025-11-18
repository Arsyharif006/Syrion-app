// src/components/settings/StorageSettings.tsx

import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { getStorageStats, formatBytes, getStorageColor, StorageStats } from '../../services/storageutils';
import { StorageSkeleton } from './SettingsSkeletons';

interface StorageSettingsProps {
  onDelete: () => void;
}

export const StorageSettings: React.FC<StorageSettingsProps> = ({ onDelete }) => {
  const { t } = useLocalization();
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    loadStorageStats();
  }, []);

  const loadStorageStats = async () => {
    setIsLoadingStats(true);
    try {
      const stats = await getStorageStats();
      setStorageStats(stats);
    } catch (error) {
      console.error('Failed to load storage stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{t('storageUsage')}</h3>
          {!isLoadingStats && (
            <button
              onClick={loadStorageStats}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              {t('refresh')}
            </button>
          )}
        </div>
        
        {isLoadingStats ? (
          <StorageSkeleton />
        ) : storageStats ? (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">{t('conversationsData')}</span>
                <span className="text-white font-medium">
                  {storageStats.usedStorageMB.toFixed(2)} MB / {storageStats.maxStorageMB} MB
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div 
                  className={`h-2.5 rounded-full transition-all duration-500 ${getStorageColor(storageStats.usagePercentage)}`}
                  style={{ width: `${Math.min(storageStats.usagePercentage, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {storageStats.usagePercentage.toFixed(1)}% {t('storageUsed')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-4 bg-gray-900 rounded-lg border border-gray-700/50">
                <p className="text-xs text-gray-400 mb-1">{t('totalConversations')}</p>
                <p className="text-2xl font-bold text-white">{storageStats.totalConversations}</p>
              </div>
              <div className="p-4 bg-gray-900 rounded-lg border border-gray-700/50">
                <p className="text-xs text-gray-400 mb-1">{t('totalMessages')}</p>
                <p className="text-2xl font-bold text-white">{storageStats.totalMessages}</p>
              </div>
            </div>

            <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700/30">
              <p className="text-xs font-medium text-gray-400 mb-2">{t('storageDetails')}</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('rawSize')}:</span>
                  <span className="text-gray-300">{formatBytes(storageStats.usedStorageBytes)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('available')}:</span>
                  <span className="text-gray-300">
                    {(storageStats.maxStorageMB - storageStats.usedStorageMB).toFixed(2)} MB
                  </span>
                </div>
              </div>
            </div>

            {storageStats.usagePercentage > 80 && (
              <div className="p-4 bg-yellow-600/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{t('storageWarning', { percentage: storageStats.usagePercentage.toFixed(0) })}</span>
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>{t('failedToLoadStorage')}</p>
            <button
              onClick={loadStorageStats}
              className="mt-2 text-sm text-blue-400 hover:underline"
            >
              {t('tryAgain')}
            </button>
          </div>
        )}
      </div>

      <div className="p-6 bg-gray-800 border border-red-500/30 rounded-lg">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-red-300">{t('storageTitle')}</h3>
        </div>
        <p className="text-sm text-gray-400 mb-6">{t('storageDescription')}</p>
        <button
          onClick={onDelete}
          className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-md transition-colors"
        >
          {t('deleteAllConversations')}
        </button>
      </div>
    </div>
  );
};