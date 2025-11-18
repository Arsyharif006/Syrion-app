// src/components/settings/LogoutSettings.tsx

import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { supabase } from '../../lib/supabaseClient';
import { SkeletonLine, SkeletonCircle } from './SettingsSkeletons';

interface UserProfile {
  id: string;
  email: string;
  avatar_url: string | null;
  provider: string | null;
}

interface LogoutSettingsProps {
  onLogoutClick: () => void;
}

export const LogoutSettings: React.FC<LogoutSettingsProps> = ({ onLogoutClick }) => {
  const { t } = useLocalization();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    setIsLoadingProfile(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Error getting user:', userError);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, email, avatar_url, provider')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error loading profile:', profileError);
        return;
      }

      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const getProviderDisplay = (provider: string | null) => {
    switch (provider) {
      case 'google':
        return 'Google';
      case 'github':
        return 'GitHub';
      case 'email':
        return t('emailMagicLink');
      default:
        return t('unknown');
    }
  };

  return (
    <div className="p-6 bg-gray-800 border border-red-500/30 rounded-lg">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-red-300">{t('logout')}</h3>
      </div>
      <p className="text-sm text-gray-400 mb-6">{t('logoutDescription')}</p>
      
      {isLoadingProfile ? (
        <div className="p-4 bg-gray-900 rounded-lg border border-gray-700/50 mb-6">
          <SkeletonLine className="h-3 w-32 mb-2" />
          <div className="flex items-center gap-3">
            <SkeletonCircle size="w-10 h-10" />
            <div className="flex-1 space-y-2">
              <SkeletonLine className="h-3 w-40" />
              <SkeletonLine className="h-3 w-24" />
            </div>
          </div>
        </div>
      ) : userProfile && (
        <div className="p-4 bg-gray-900 rounded-lg border border-gray-700/50 mb-6">
          <p className="text-sm text-gray-400 mb-2">{t('currentlySignedIn')}:</p>
          <div className="flex items-center gap-3">
            {userProfile.avatar_url && (
              <img 
                src={userProfile.avatar_url} 
                alt={t('profilePicture')}
                className="w-10 h-10 rounded-full border border-gray-700"
              />
            )}
            <div>
              <p className="text-sm font-medium text-white">{userProfile.email}</p>
              <p className="text-xs text-gray-400">
                {t('via')} {getProviderDisplay(userProfile.provider)}
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onLogoutClick}
        className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-md transition-colors"
      >
        {t('logout')}
      </button>
    </div>
  );
};