// src/components/settings/SettingsLayout.tsx

import React, { useState } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { Modal } from '../Modal';
import { GeneralSettings } from './GeneralSettings';
import { AccountSettings } from './AccountSettings';
import { BillingSettings } from './BillingSettings';
import { StorageSettings } from './StorageSettings';
import { LanguageSettings } from './LanguageSettings';
import { AboutSettings } from './AboutSettings';
import { LogoutSettings } from './LogoutSettings';

interface SettingsLayoutProps {
  onClose: () => void;
  onDeleteAll: () => void;
  onLogout: () => void;
  initialTab?: SettingsTab;
}

export type SettingsTab = 'general' | 'account' | 'billing' | 'storage' | 'language' | 'about' | 'logout';

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({ 
  onClose, 
  onDeleteAll, 
  onLogout,
  initialTab = 'general'
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isLogoutModalOpen, setLogoutModalOpen] = useState(false);
  const { t } = useLocalization();

  const handleDelete = () => {
    setDeleteModalOpen(true);
  };
  
  const confirmDeleteAll = () => {
    onDeleteAll();
    setDeleteModalOpen(false);
  };

  const handleLogoutClick = () => {
    setLogoutModalOpen(true);
  };

  const confirmLogout = () => {
    onLogout();
    setLogoutModalOpen(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettings />;
      case 'account':
        return <AccountSettings />;
      case 'billing':
        return <BillingSettings />;
      case 'storage':
        return <StorageSettings onDelete={handleDelete} />;
      case 'language':
        return <LanguageSettings />;
      case 'about':
        return <AboutSettings />;
      case 'logout':
        return <LogoutSettings onLogoutClick={handleLogoutClick} />;
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
          <aside className="flex-shrink-0 bg-gray-900 md:p-4 border-b md:border-r md:border-b-0 border-gray-700/50 md:w-64 overflow-y-auto scrollbar-hide">
            <nav className="flex flex-row md:flex-col md:space-y-1 overflow-x-auto scrollbar-hide md:overflow-x-visible px-4 md:px-0 -mx-4 md:mx-0">
              <NavItem tab="general" label={t('settingsGeneral')} />
              <NavItem tab="account" label={t('settingsAccount')} />
              <NavItem tab="billing" label={t('settingsBilling')} />
              <NavItem tab="storage" label={t('settingsStorage')} />
              <NavItem tab="language" label={t('settingsLanguage')} />
              <NavItem tab="about" label={t('settingsAbout')} />
              <NavItem tab="logout" label={t('logout')} />
            </nav>
          </aside>
          
          {/* Main content dengan scroll */}
          <main className="flex-1 overflow-y-auto scrollbar-hide p-6 md:p-8 min-h-0">
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