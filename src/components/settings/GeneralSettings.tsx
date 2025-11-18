// src/components/settings/GeneralSettings.tsx

import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { supabase } from '../../lib/supabaseClient';
import { ProfileSkeleton } from './SettingsSkeletons';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  provider: string | null;
  created_at: string;
  last_login: string | null;
}

export const GeneralSettings: React.FC = () => {
  const { t } = useLocalization();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [preferences, setPreferences] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
      setFullName(profile.full_name || '');
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: fullName || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setUserProfile(prev => prev ? { ...prev, full_name: fullName } : null);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      alert(t('failedToSaveProfile') + ': ' + error.message);
    } finally {
      setIsSaving(false);
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
    <div className="space-y-6">
      <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">{t('generalTitle')}</h3>
        </div>
        <p className="text-sm text-gray-400 mb-6">{t('generalDescription')}</p>
        
        {isLoadingProfile ? (
          <ProfileSkeleton />
        ) : (
          <div className="space-y-6">
            {userProfile?.avatar_url && (
              <div className="flex items-center gap-4">
                <img 
                  src={userProfile.avatar_url} 
                  alt={t('profilePicture')}
                  className="w-16 h-16 rounded-full border-2 border-gray-700"
                />
                <div>
                  <p className="text-sm font-medium text-white">{userProfile.email}</p>
                  <p className="text-xs text-gray-400">
                    {t('signedInWith')} {getProviderDisplay(userProfile.provider)}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('generalFullName')}
                </label>
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('generalNickname')}
                </label>
                <input 
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={t('nicknamePlaceholder')}
                  className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" 
                />
                <p className="text-xs text-gray-500 mt-1">{t('comingSoon')}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('generalPreferences')}
              </label>
              <textarea 
                rows={4}
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                placeholder={t('generalPreferencesPlaceholder')} 
                className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">{t('comingSoon')}</p>
            </div>

            {saveSuccess && (
              <div className="p-3 bg-green-600/20 border border-green-500/50 rounded-md">
                <p className="text-sm text-green-400">✓ {t('profileSavedSuccess')}</p>
              </div>
            )}

            <div className="flex justify-end">
              <button 
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>{t('saving')}</span>
                  </>
                ) : (
                  t('saveChanges')
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};