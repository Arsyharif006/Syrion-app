import React, { useState } from 'react';
import { Conversation } from '../../types';
import { useLocalization } from '../contexts/LocalizationContext';
import { HiOutlineMenuAlt3, HiTrash } from 'react-icons/hi';
import { IoClose, IoAddSharp } from 'react-icons/io5';
import { BsChatDots } from "react-icons/bs";
import { IoChatbubblesOutline } from "react-icons/io5";
import { FiSettings } from 'react-icons/fi';
import { Modal } from './Modal';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onOpenSettings: () => void;
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onOpenSettings,
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapse,
}) => {
  const { t } = useLocalization();
  const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteModalState({ isOpen: true, id });
  };
  
  const confirmDelete = () => {
    if (deleteModalState.id) {
      onDeleteConversation(deleteModalState.id);
    }
    setDeleteModalState({ isOpen: false, id: null });
  };

  const handleSelectConv = (id: string) => {
    // ✅ Emit event untuk close canvas sebelum pindah conversation
    window.dispatchEvent(new CustomEvent('conversation-changed', { detail: { conversationId: id } }));
    
    onSelectConversation(id);
    onClose();
  };

  const handleNewChat = () => {
    // ✅ Emit event untuk close canvas ketika buat chat baru
    window.dispatchEvent(new CustomEvent('canvas-state-change', { detail: { isOpen: false, width: 0, messageId: null } }));
    
    onNewConversation();
    onClose();
  };

  const handleSettings = () => {
    // ✅ Emit event untuk close semua canvas
    window.dispatchEvent(new CustomEvent('settings-opened'));
    
    onOpenSettings();
    onClose();
  };

  return (
    <>
      <aside
        className={`
        bg-gray-900 text-white flex flex-col h-full
        transition-transform duration-300 ease-in-out
        fixed md:relative z-30
        w-4/6 sm:w-64
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        md:transition-all
        ${isCollapsed ? 'md:w-16' : 'md:w-64'}
      `}
      >
        <div className="p-4 border-b border-gray-700/50 flex items-center justify-end md:justify-between">
          {!isCollapsed && (
            <h2 className="text-lg font-semibold flex-1 text-left">{t('appName')}</h2>
          )}
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex items-center justify-center p-2 rounded-md hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
            title={t(isCollapsed ? 'expandSidebar' : 'collapseSidebar')}
          >
            <HiOutlineMenuAlt3  />
          </button>
           <button
            onClick={onClose}
            className="md:hidden flex items-center justify-center p-2 rounded-md hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
            title={t('closeMenu')}
          >
            <IoClose  />
          </button>
        </div>

        <div className="p-2">
          <button
            onClick={handleNewChat}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title={t('newChat')}
          >
            <IoAddSharp  />
            {!isCollapsed && <span className="font-medium">{t('newChat')}</span>}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto">
          {!isCollapsed && (
            <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase">{t('history')}</p>
          )}
          <ul className="p-2 space-y-1">
            {conversations.map((conv) => (
              <li key={conv.id} className="group">
                <button
                  onClick={() => handleSelectConv(conv.id)}
                  className={`w-full text-left text-sm px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
                    activeConversationId === conv.id ? 'bg-gray-700' : 'hover:bg-gray-800'
                  }`}
                  title={isCollapsed ? conv.title : ''}
                >
                  {isCollapsed ? (
                    <IoChatbubblesOutline/>
                  ) : (
                    <>
                      <span className="truncate flex-1">{conv.title}</span>
                      <button
                        onClick={(e) => handleDeleteClick(e, conv.id)}
                        className="p-1 rounded-full hover:bg-gray-600 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <HiTrash />
                      </button>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-2 border-t border-gray-700/50 space-y-2">
          <button
            onClick={handleSettings}
            className={`w-full flex items-center gap-3 text-sm px-3 py-2 text-gray-300 rounded-md hover:bg-gray-700 transition-colors ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title={t('settings')}
          >
            <FiSettings  />
            {!isCollapsed && <span>{t('settings')}</span>}
          </button>
        </div>
      </aside>

      {isOpen && <div onClick={onClose} className="fixed inset-0 bg-black/50 z-20 md:hidden" />}

      <Modal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title={t('deleteSingleConversationTitle')}
        confirmText={t('delete')}
        isDestructive
      >
        <p>{t('deleteSingleConversationDescription')}</p>
      </Modal>
    </>
  );
};