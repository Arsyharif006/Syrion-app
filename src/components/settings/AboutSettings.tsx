// src/components/settings/AboutSettings.tsx

import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { supabase } from '../../lib/supabaseClient';
import { SkeletonLine } from './SettingsSkeletons';

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
}

export const AboutSettings: React.FC = () => {
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
        .select('id, email, created_at')
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

  return (
    <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
      <h3 className="text-lg font-semibold text-white">{t('aboutTitle', { appName: t('appName') })}</h3>
      <p className="text-sm text-gray-400 mt-4">{t('aboutDescription')}</p>
      <p className="text-xs text-gray-500 mt-4">{t('aboutVersion')}: 4.2.2</p>
      
      {isLoadingProfile ? (
        <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-700/50">
          <SkeletonLine className="h-3 w-24 mb-2" />
          <div className="space-y-2">
            <div className="flex justify-between">
              <SkeletonLine className="h-3 w-16" />
              <SkeletonLine className="h-3 w-32" />
            </div>
            <div className="flex justify-between">
              <SkeletonLine className="h-3 w-20" />
              <SkeletonLine className="h-3 w-24" />
            </div>
          </div>
        </div>
      ) : userProfile && (
        <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-700/50">
          <p className="text-xs font-medium text-gray-400 mb-2">{t('yourAccount')}</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('email')}:</span>
              <span className="text-gray-300">{userProfile.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('memberSince')}:</span>
              <span className="text-gray-300">
                {new Date(userProfile.created_at).toLocaleDateString('en-US', { 
                  month: 'short', 
                  year: 'numeric' 
                })}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-700/50">
        <h4 className="text-sm font-medium text-gray-300">{t('createdBy')}</h4>
        <p className="mt-1 text-white">Muhammad Arya Ramadhan</p>
        
        <h4 className="text-sm font-medium text-gray-300 mt-4">{t('contactTitle')}</h4>
        <div className="mt-2 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-20 text-gray-400">{t('instagram')}</span>
            <a href="https://www.instagram.com/yaseo.n" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              @yaseo.n
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 text-gray-400">{t('emailSupport')}</span>
            <a href="mailto:syrion.support@gmail.com" className="text-blue-400 hover:underline">
              syrion.support@gmail.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};