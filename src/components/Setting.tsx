import React, { useState, useEffect } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Modal } from './Modal';
import { getStorageStats, formatBytes, getStorageColor, StorageStats } from '../services/storageutils';
import { supabase } from '../lib/supabaseClient';

interface SettingsProps {
  onClose: () => void;
  onDeleteAll: () => void;
  onLogout: () => void;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  provider: string | null;
  created_at: string;
  last_login: string | null;
}

type SettingsTab = 'general' | 'account' | 'storage' | 'language' | 'about' | 'logout';

// Skeleton Loading Components
const SkeletonLine: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-700 rounded ${className}`}></div>
);

const SkeletonCircle: React.FC<{ size?: string }> = ({ size = 'w-16 h-16' }) => (
  <div className={`animate-pulse bg-gray-700 rounded-full ${size}`}></div>
);

const ProfileSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-4">
      <SkeletonCircle />
      <div className="flex-1 space-y-2">
        <SkeletonLine className="h-4 w-48" />
        <SkeletonLine className="h-3 w-32" />
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <SkeletonLine className="h-4 w-24 mb-2" />
        <SkeletonLine className="h-10 w-full" />
      </div>
      <div>
        <SkeletonLine className="h-4 w-24 mb-2" />
        <SkeletonLine className="h-10 w-full" />
      </div>
    </div>

    <div>
      <SkeletonLine className="h-4 w-32 mb-2" />
      <SkeletonLine className="h-24 w-full" />
    </div>
  </div>
);

const AccountSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div>
      <SkeletonLine className="h-4 w-24 mb-2" />
      <SkeletonLine className="h-10 w-full" />
      <SkeletonLine className="h-3 w-48 mt-1" />
    </div>

    <div className="p-4 bg-gray-900 rounded-lg border border-gray-700/50 space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex justify-between">
          <SkeletonLine className="h-4 w-24" />
          <SkeletonLine className="h-4 w-32" />
        </div>
      ))}
    </div>
  </div>
);

const StorageSkeleton: React.FC = () => (
  <div className="space-y-4">
    <div>
      <div className="flex justify-between mb-2">
        <SkeletonLine className="h-4 w-32" />
        <SkeletonLine className="h-4 w-24" />
      </div>
      <SkeletonLine className="h-2.5 w-full rounded-full" />
      <SkeletonLine className="h-3 w-20 mt-1" />
    </div>

    <div className="grid grid-cols-2 gap-4 pt-4">
      {[1, 2].map((i) => (
        <div key={i} className="p-4 bg-gray-900 rounded-lg border border-gray-700/50">
          <SkeletonLine className="h-3 w-24 mb-2" />
          <SkeletonLine className="h-8 w-16" />
        </div>
      ))}
    </div>

    <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/30">
      <SkeletonLine className="h-3 w-24 mb-2" />
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="flex justify-between">
            <SkeletonLine className="h-3 w-16" />
            <SkeletonLine className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const Settings: React.FC<SettingsProps> = ({ onClose, onDeleteAll, onLogout }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isLogoutModalOpen, setLogoutModalOpen] = useState(false);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const { t } = useLocalization();
  
  // Form states for general settings
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [preferences, setPreferences] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Notification states
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);

  // Load user profile on mount
  useEffect(() => {
    loadUserProfile();
  }, []);

  // Load storage stats when storage tab is active
  useEffect(() => {
    if (activeTab === 'storage') {
      loadStorageStats();
    }
  }, [activeTab]);

  // Reload stats when returning from delete action
  useEffect(() => {
    if (activeTab === 'storage' && !isDeleteModalOpen) {
      loadStorageStats();
    }
  }, [isDeleteModalOpen, activeTab]);

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

  const handleDelete = () => {
    setDeleteModalOpen(true);
  };
  
  const confirmDeleteAll = () => {
    onDeleteAll();
    setDeleteModalOpen(false);
    setTimeout(() => {
      loadStorageStats();
    }, 100);
  };

  const handleLogoutClick = () => {
    setLogoutModalOpen(true);
  };

  const confirmLogout = () => {
    onLogout();
    setLogoutModalOpen(false);
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

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
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
                            <label className="block text-sm font-medium text-gray-300 mb-2">{t('generalFullName')}</label>
                            <input 
                              type="text" 
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              placeholder="John Doe"
                              className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">{t('generalNickname')}</label>
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
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('generalPreferences')}</label>
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

      case 'account':
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

       case 'storage':
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
                onClick={handleDelete}
                className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-md transition-colors"
              >
                {t('deleteAllConversations')}
              </button>
            </div>
          </div>
        );

        case 'language':
        return (
          <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">{t('languageTitle')}</h3>
            </div>
            <p className="text-sm text-gray-400 mb-6">{t('languageDescription')}</p>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">{t('displayLanguage')}</label>
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        );

      case 'about':
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

      case 'logout':
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
              onClick={handleLogoutClick}
              className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-md transition-colors"
            >
              {t('logout')}
            </button>
          </div>
        );

      default:
        return null;
    }
  };
  
  const NavItem: React.FC<{tab: SettingsTab; label: string}> = ({ tab, label }) => (
     <button 
        onClick={() => setActiveTab(tab)}
        className={`
            flex items-center gap-3 text-sm font-medium transition-colors whitespace-nowrap
            px-4 py-3 border-b-2
            md:w-full md:text-left md:px-3 md:py-2 md:rounded-md md:border-b-0
            ${activeTab === tab
                ? 'border-blue-500 text-white md:bg-gray-700'
                : 'border-transparent text-gray-400 hover:text-white md:text-gray-300 md:hover:bg-gray-800'
            }
        `}
    >
        <span>{label}</span>
    </button>
  );

  return (
    <>
        <div className="flex-1 flex flex-col bg-gray-900 h-full overflow-hidden">
          <header className="p-4 border-b border-gray-700/50 flex items-center justify-between flex-shrink-0">
             <h1 className="text-xl font-semibold text-white">{t('settingsTitle')}</h1>
             <button onClick={onClose} className="text-sm text-blue-400 hover:underline flex items-center gap-2">
                {t('backToChat')}
             </button>
          </header>
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            {/* Sidebar dengan scroll */}
            <aside className="flex-shrink-0 bg-gray-900 md:p-4 border-b md:border-r md:border-b-0 border-gray-700/50 md:w-64 overflow-y-auto">
                <nav className="flex flex-row md:flex-col md:space-y-1 overflow-x-auto md:overflow-x-visible px-4 md:px-0 -mx-4 md:mx-0">
                    <NavItem tab="general" label={t('settingsGeneral')} />
                    <NavItem tab="account" label={t('settingsAccount')} />
                    <NavItem tab="storage" label={t('settingsStorage')} />
                    <NavItem tab="language" label={t('settingsLanguage')} />
                    <NavItem tab="about" label={t('settingsAbout')} />
                    <NavItem tab="logout" label={t('logout')} />
                </nav>
            </aside>
            {/* Main content dengan scroll - FIXED */}
            <main className="flex-1 overflow-y-auto p-6 md:p-8 min-h-0">
                {renderContent()}
            </main>
          </div>
        </div>
        
        <Modal
            isOpen={isDeleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            onConfirm={confirmDeleteAll}
            title={t('deleteAllConversationsConfirm')}
            confirmText={t('deleteAllConversations')}
            isDestructive
        >
            <p>{t('storageDescription')}</p>
        </Modal>

        {/* Logout Modal */}
        <Modal
            isOpen={isLogoutModalOpen}
            onClose={() => setLogoutModalOpen(false)}
            onConfirm={confirmLogout}
            title={t('logoutConfirm')}
            confirmText={t('logout')}
            isDestructive
        >
            <p className="text-gray-400">{t('alertlogoutconfirm')}</p>
        </Modal>
    </>
  );
};