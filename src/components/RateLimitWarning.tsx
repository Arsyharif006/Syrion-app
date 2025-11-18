// src/components/RateLimitWarning.tsx

import React, { useState, useEffect } from 'react';
import { FiClock, FiZap } from 'react-icons/fi';
import { useLocalization } from '../contexts/LocalizationContext';

interface RateLimitWarningProps {
  messagesRemaining: number;
  maxMessages: number;
  resetTime: Date | null;
  isLimited: boolean;
  onUpgradeClick?: () => void;
}

export const RateLimitWarning: React.FC<RateLimitWarningProps> = ({
  messagesRemaining,
  maxMessages,
  resetTime,
  isLimited,
  onUpgradeClick,
}) => {
  const { t } = useLocalization();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time setiap menit untuk countdown yang akurat
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update setiap 1 menit

    return () => clearInterval(interval);
  }, []);

  const formatResetTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  const getTimeUntilReset = (date: Date) => {
    const diff = date.getTime() - currentTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleUpgradeClick = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    }
  };

  // Alert ketika limit tercapai
  if (isLimited && resetTime) {
    return (
      <div className="mb-4 p-4 bg-gray-800 border border-gray-700 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
            <FiClock className="text-gray-300" size={18} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-1">
              {t('youveReachedLimit')}
            </h3>
            <p className="text-sm text-gray-400">
              {t('freeMessagesResetAt')} <span className="font-medium text-white">{formatResetTime(resetTime)}</span> 
            </p>
          </div>
          <button 
            onClick={handleUpgradeClick}
            className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap flex-shrink-0"
          >
            <FiZap size={16} />
            {t('upgradeToPro')}
          </button>
        </div>
      </div>
    );
  }

  // Subtle indicator ketika belum limit
  if (!isLimited && resetTime) {
    return (
      <div className="mb-3 flex items-center justify-center gap-2 text-xs text-gray-500">
        <FiClock size={12} />
        <span>
          {messagesRemaining} {messagesRemaining === 1 ? t('message') : t('messages')} {t('remaining')} · {t('resetsAt')} {formatResetTime(resetTime)}
        </span>
      </div>
    );
  }

  return null;
};