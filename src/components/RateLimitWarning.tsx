// src/components/RateLimitWarning.tsx

import React from 'react';
import { FiClock, FiAlertCircle } from 'react-icons/fi';
import { useLocalization } from '../contexts/LocalizationContext';

interface RateLimitWarningProps {
  messagesRemaining: number;
  maxMessages: number;
  resetTime: Date | null;
  isLimited: boolean;
}

export const RateLimitWarning: React.FC<RateLimitWarningProps> = ({
  messagesRemaining,
  maxMessages,
  resetTime,
  isLimited,
}) => {
  const { t } = useLocalization();

  const formatResetTime = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours} ${t('hours')} ${minutes} ${t('minutes')}`;
    }
    return `${minutes} ${t('minutes')}`;
  };

  if (isLimited && resetTime) {
    return (
      <div className="mb-4 p-4 bg-red-600/20 border border-red-500/50 rounded-lg">
        <div className="flex items-start gap-3">
          <FiAlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-400 mb-1">
              {t('rateLimitReached')}
            </h3>
            <p className="text-sm text-red-300 mb-2">
              {t('rateLimitMessage', { max: maxMessages })}
            </p>
            <div className="flex items-center gap-2 text-xs text-red-300">
              <FiClock size={14} />
              <span>
                {t('rateLimitReset')}: {formatResetTime(resetTime)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (messagesRemaining <= 10) {
    return (
      <div className="mb-4 p-3 bg-yellow-600/20 border border-yellow-500/50 rounded-lg">
        <div className="flex items-start gap-3">
          <FiAlertCircle className="text-yellow-400 flex-shrink-0 mt-0.5" size={18} />
          <div className="flex-1">
            <p className="text-sm text-yellow-300">
              {t('rateLimitWarning', { remaining: messagesRemaining, max: maxMessages })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};