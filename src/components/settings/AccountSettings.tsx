// src/components/settings/AccountSettings.tsx

import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { supabase } from '../../lib/supabaseClient';
import { AccountSkeleton } from './SettingsSkeletons';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  provider: string | null;
  created_at: string;
  last_login: string | null;
}

export const AccountSettings: React.FC = () => {
  const { t } = useLocalization();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);

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
        .select('*')
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('never');
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (value: boolean) => void }> = ({ enabled, onChange }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-blue-600' : 'bg-gray-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">{t('accountTitle')}</h3>
        </div>
        <p className="text-sm text-gray-400 mb-6">{t('accountDescription')}</p>
        
        {isLoadingProfile ? (
          <AccountSkeleton />
        ) : userProfile ? (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('emailAddress')}</label>
              <input 
                type="email" 
                value={userProfile.email}
                disabled
                className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2.5 px-3 text-gray-400 text-sm cursor-not-allowed" 
              />
              <p className="text-xs text-gray-500 mt-1">{t('emailCannotChange')}</p>
            </div>

            <div className="p-4 bg-gray-900 rounded-lg border border-gray-700/50 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{t('signInMethod')}:</span>
                <span className="text-white font-medium">{getProviderDisplay(userProfile.provider)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{t('accountCreated')}:</span>
                <span className="text-white font-medium">{formatDate(userProfile.created_at)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{t('lastLogin')}:</span>
                <span className="text-white font-medium">{formatDate(userProfile.last_login)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{t('userId')}:</span>
                <span className="text-white font-mono text-xs">{userProfile.id.substring(0, 8)}...</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-400">{t('failedToLoadAccount')}</p>
        )}
      </div>

      <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">{t('notifications')}</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">{t('emailNotifications')}</p>
              <p className="text-xs text-gray-400">{t('emailNotificationsDesc')}</p>
            </div>
            <div className="flex items-center gap-2">
              <ToggleSwitch enabled={emailNotifications} onChange={setEmailNotifications} />
              <span className="text-xs text-gray-500">{t('comingSoon')}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">{t('pushNotifications')}</p>
              <p className="text-xs text-gray-400">{t('pushNotificationsDesc')}</p>
            </div>
            <div className="flex items-center gap-2">
              <ToggleSwitch enabled={pushNotifications} onChange={setPushNotifications} />
              <span className="text-xs text-gray-500">{t('comingSoon')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};