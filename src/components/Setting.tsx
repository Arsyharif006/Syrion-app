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
      // For now, we'll store nickname and preferences in metadata
      // You can extend the user_profiles table to include these fields
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

      // Update local state
      setUserProfile(prev => prev ? { ...prev, full_name: fullName } : null);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile: ' + error.message);
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
        return 'Email (Magic Link)';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
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
            {/* Profile Section */}
            <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-white">{t('generalTitle')}</h3>
                </div>
                <p className="text-sm text-gray-400 mb-6">{t('generalDescription')}</p>
                
                {isLoadingProfile ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Profile Picture */}
                    {userProfile?.avatar_url && (
                      <div className="flex items-center gap-4">
                        <img 
                          src={userProfile.avatar_url} 
                          alt="Profile"
                          className="w-16 h-16 rounded-full border-2 border-gray-700"
                        />
                        <div>
                          <p className="text-sm font-medium text-white">{userProfile.email}</p>
                          <p className="text-xs text-gray-400">
                            Signed in with {getProviderDisplay(userProfile.provider)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Name Fields */}
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
                              placeholder="How AI should call you"
                              className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" 
                            />
                            <p className="text-xs text-gray-500 mt-1">Coming soon</p>
                        </div>
                    </div>

                    {/* Preferences */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('generalPreferences')}</label>
                        <textarea 
                          rows={4}
                          value={preferences}
                          onChange={(e) => setPreferences(e.target.value)}
                          placeholder={t('generalPreferencesPlaceholder')} 
                          className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">Coming soon</p>
                    </div>

                    {/* Save Success Message */}
                    {saveSuccess && (
                      <div className="p-3 bg-green-600/20 border border-green-500/50 rounded-md">
                        <p className="text-sm text-green-400">✓ Profile saved successfully!</p>
                      </div>
                    )}

                    {/* Save Button */}
                    <div className="flex justify-end">
                      <button 
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
                      >
                        {isSaving ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          'Save Changes'
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
            {/* Account Info */}
            <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">{t('accountTitle')}</h3>
              </div>
              <p className="text-sm text-gray-400 mb-6">{t('accountDescription')}</p>
              
              {isLoadingProfile ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : userProfile ? (
                <div className="space-y-6">
                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                    <input 
                      type="email" 
                      value={userProfile.email}
                      disabled
                      className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2.5 px-3 text-gray-400 text-sm cursor-not-allowed" 
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed at this time</p>
                  </div>

                  {/* Account Details */}
                  <div className="p-4 bg-gray-900 rounded-lg border border-gray-700/50 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Sign-in Method:</span>
                      <span className="text-white font-medium">{getProviderDisplay(userProfile.provider)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Account Created:</span>
                      <span className="text-white font-medium">{formatDate(userProfile.created_at)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Last Login:</span>
                      <span className="text-white font-medium">{formatDate(userProfile.last_login)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">User ID:</span>
                      <span className="text-white font-mono text-xs">{userProfile.id.substring(0, 8)}...</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400">Failed to load account information</p>
              )}
            </div>

            {/* Notifications */}
            <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">Notifications</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Email Notifications</p>
                    <p className="text-xs text-gray-400">Receive updates via email</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ToggleSwitch enabled={emailNotifications} onChange={setEmailNotifications} />
                    <span className="text-xs text-gray-500">Coming soon</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Push Notifications</p>
                    <p className="text-xs text-gray-400">Get notified in your browser</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ToggleSwitch enabled={pushNotifications} onChange={setPushNotifications} />
                    <span className="text-xs text-gray-500">Coming soon</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

       case 'storage':
        return (
          <div className="space-y-6">
            {/* Storage Stats */}
            <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Storage Usage</h3>
                {!isLoadingStats && (
                  <button
                    onClick={loadStorageStats}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Refresh
                  </button>
                )}
              </div>
              
              {isLoadingStats ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : storageStats ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Conversations Data</span>
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
                      {storageStats.usagePercentage.toFixed(1)}% of storage used
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="p-4 bg-gray-900 rounded-lg border border-gray-700/50">
                      <p className="text-xs text-gray-400 mb-1">Total Conversations</p>
                      <p className="text-2xl font-bold text-white">{storageStats.totalConversations}</p>
                    </div>
                    <div className="p-4 bg-gray-900 rounded-lg border border-gray-700/50">
                      <p className="text-xs text-gray-400 mb-1">Total Messages</p>
                      <p className="text-2xl font-bold text-white">{storageStats.totalMessages}</p>
                    </div>
                  </div>

                  {/* Storage Details */}
                  <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700/30">
                    <p className="text-xs font-medium text-gray-400 mb-2">Storage Details</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Raw Size:</span>
                        <span className="text-gray-300">{formatBytes(storageStats.usedStorageBytes)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Available:</span>
                        <span className="text-gray-300">
                          {(storageStats.maxStorageMB - storageStats.usedStorageMB).toFixed(2)} MB
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Warning if storage is getting full */}
                  {storageStats.usagePercentage > 80 && (
                    <div className="p-4 bg-yellow-600/10 border border-yellow-500/30 rounded-lg">
                      <p className="text-sm text-yellow-400 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>Storage is {storageStats.usagePercentage.toFixed(0)}% full. Consider deleting old conversations.</span>
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>Failed to load storage statistics</p>
                  <button
                    onClick={loadStorageStats}
                    className="mt-2 text-sm text-blue-400 hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>

            {/* Danger Zone */}
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
                <label className="block text-sm font-medium text-gray-300 mb-3">Display Language</label>
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
                 <p className="text-xs text-gray-500 mt-4">{t('aboutVersion')}: 4.1.8</p>
                
                {/* User Info */}
                {userProfile && (
                  <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-700/50">
                    <p className="text-xs font-medium text-gray-400 mb-2">Your Account</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Email:</span>
                        <span className="text-gray-300">{userProfile.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Member since:</span>
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
            <p className="text-sm text-gray-400 mb-6">Sign out from your account. You can always sign back in anytime.</p>
            
            {userProfile && (
              <div className="p-4 bg-gray-900 rounded-lg border border-gray-700/50 mb-6">
                <p className="text-sm text-gray-400 mb-2">Currently signed in as:</p>
                <div className="flex items-center gap-3">
                  {userProfile.avatar_url && (
                    <img 
                      src={userProfile.avatar_url} 
                      alt="Profile"
                      className="w-10 h-10 rounded-full border border-gray-700"
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">{userProfile.email}</p>
                    <p className="text-xs text-gray-400">
                      via {getProviderDisplay(userProfile.provider)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 bg-blue-600/10 border border-blue-500/30 rounded-lg mb-6">
              <p className="text-sm text-blue-400">
                ✓ Your conversations will remain saved and will be available when you sign back in.
              </p>
            </div>

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
        <div className="flex-1 flex flex-col bg-gray-900">
          <header className="p-4 border-b border-gray-700/50 flex items-center justify-between flex-shrink-0">
             <h1 className="text-xl font-semibold text-white">{t('settingsTitle')}</h1>
             <button onClick={onClose} className="text-sm text-blue-400 hover:underline flex items-center gap-2">
                {t('backToChat')}
             </button>
          </header>
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            <aside className="flex-shrink-0 bg-gray-900 md:p-4 border-b md:border-r md:border-b-0 border-gray-700/50 md:w-64">
                <nav className="flex flex-row md:flex-col md:space-y-1 overflow-x-auto md:overflow-x-visible px-4 md:px-0 -mx-4 md:mx-0">
                    <NavItem tab="general" label={t('settingsGeneral')} />
                    <NavItem tab="account" label={t('settingsAccount')} />
                    <NavItem tab="storage" label={t('settingsStorage')} />
                    <NavItem tab="language" label={t('settingsLanguage')} />
                    <NavItem tab="about" label={t('settingsAbout')} />
                    <NavItem tab="logout" label={t('logout')} />
                </nav>
            </aside>
            <main className="flex-1 overflow-y-auto p-6 md:p-8">
                {renderContent()}
            </main>
          </div>
        </div>
        
        {/* Delete All Modal */}
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
            <p className="text-gray-400">You will be signed out of your account.</p>
        </Modal>
    </>
  );
};