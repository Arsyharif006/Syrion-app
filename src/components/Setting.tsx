import React, { useState, useEffect } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Modal } from './Modal';
import { getStorageStats, formatBytes, getStorageColor, StorageStats } from '../services/storageutils';

interface SettingsProps {
  onClose: () => void;
  onDeleteAll: () => void;
  onLogout: () => void;
}

type SettingsTab = 'general' | 'account' | 'storage' | 'language' | 'about' | 'logout';

export const Settings: React.FC<SettingsProps> = ({ onClose, onDeleteAll, onLogout }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isLogoutModalOpen, setLogoutModalOpen] = useState(false);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const { t } = useLocalization();
  
  // Temporary interactive states
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [dataCollection, setDataCollection] = useState(false);

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

  const handleDelete = () => {
    setDeleteModalOpen(true);
  };
  
  const confirmDeleteAll = () => {
    onDeleteAll();
    setDeleteModalOpen(false);
    // Reload stats after deletion
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
                
                <div className="space-y-6">
                  {/* Name Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">{t('generalFullName')}</label>
                          <input 
                            type="text" 
                            placeholder="John Doe"
                            className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" 
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">{t('generalNickname')}</label>
                          <input 
                            type="text"
                            placeholder="How AI should call you"
                            className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" 
                          />
                      </div>
                  </div>

                  {/* Preferences */}
                  <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">{t('generalPreferences')}</label>
                      <textarea 
                        rows={4} 
                        placeholder={t('generalPreferencesPlaceholder')} 
                        className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                      />
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end">
                    <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors">
                      Save Changes
                    </button>
                  </div>
                </div>
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
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <input 
                  type="email" 
                  value="user@example.com"
                  disabled
                  className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2.5 px-3 text-gray-400 text-sm cursor-not-allowed" 
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed at this time</p>
              </div>
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
                  <ToggleSwitch enabled={emailNotifications} onChange={setEmailNotifications} />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Push Notifications</p>
                    <p className="text-xs text-gray-400">Get notified in your browser</p>
                  </div>
                  <ToggleSwitch enabled={pushNotifications} onChange={setPushNotifications} />
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
                 <p className="text-xs text-gray-500 mt-4">{t('aboutVersion')}: 4.1.7</p>
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
            
            <div className="p-4 bg-red-600/10 border border-red-500/30 rounded-lg mb-6">
              <p className="text-sm text-red-400">
                Your conversations will remain saved and will be available when you sign back in.
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