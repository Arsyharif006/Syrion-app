import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Conversation, Message, MessageSender, MessageAttachment } from '../types';
import { Toaster } from 'react-hot-toast';
import { HiOutlineMenuAlt3 } from 'react-icons/hi';
import { FiArrowDown } from 'react-icons/fi';
import { supabase } from './lib/supabaseClient';
import * as supabaseStorage from './services/supabaseStorageService';
import { sendMessageToWebhook, UploadedFile } from './services/n8nService';
import { uploadAttachment } from './services/attachmentService';
import { checkRateLimit, incrementMessageCount, getRateLimitStatus, RateLimitInfo } from './services/rateLimitServices';
import { Sidebar } from './components/Sidebar';
import { ChatInput } from './components/ChatInput';
import { ChatMessage } from './components/ChatMessage';
import { Welcome } from './components/Welcome';
import { SettingsLayout } from './components/settings/SettingsLayout';
import { UpdateModal } from './components/Update';
import { Auth } from './components/Auth';
import { RateLimitWarning } from './components/RateLimitWarning';
import { useLocalization } from './contexts/LocalizationContext';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const DEFAULT_RATE_LIMIT: RateLimitInfo = {
  messagesRemaining: 50,
  maxMessages: 50,
  resetTime: null,
  isLimited: false,
  waitTimeMinutes: 0,
};

const RATE_LIMIT_REFRESH_INTERVAL = 30_000; // 30 detik

// ─────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────

function App() {
  const { t } = useLocalization();

  // ── Auth ────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // ── Data ────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // ── UI ──────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [view, setView] = useState<'chat' | 'settings'>('chat');
  const [settingsTab, setSettingsTab] = useState<
    'general' | 'account' | 'billing' | 'storage' | 'language' | 'about' | 'logout'
  >('general');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(0);

  // ── Rate limit ──────────────────────────────────────────────
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo>(DEFAULT_RATE_LIMIT);

  // ── Refs ────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  // ─────────────────────────────────────────────────────────────
  // Auth effects
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
      } catch (error) {
        console.error('[Auth] Error checking session:', error);
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Load conversations
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated) return;

    const load = async () => {
      try {
        const convs = await supabaseStorage.getConversations();
        setConversations(convs);
      } catch (error) {
        console.error('[App] Error loading conversations:', error);
      }
    };

    load();
  }, [isAuthenticated]);

  // ─────────────────────────────────────────────────────────────
  // Rate limit
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated) return;

    const load = async () => {
      try {
        const info = await getRateLimitStatus();
        setRateLimitInfo(info);
      } catch (error) {
        console.error('[App] Error loading rate limit:', error);
      }
    };

    load();
    const interval = setInterval(load, RATE_LIMIT_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // ─────────────────────────────────────────────────────────────
  // Scroll effects
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isAuthenticated && view === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversations, activeConversationId, view, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const container = mainContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const nearBottom = scrollHeight - scrollTop - clientHeight < 200;
      setShowScrollButton(!nearBottom && scrollTop > 300);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isAuthenticated]);

  // ─────────────────────────────────────────────────────────────
  // Canvas width sync
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated) return;

    const handler = ((e: CustomEvent) => {
      setCanvasWidth(e.detail.isOpen ? e.detail.width : 0);
    }) as EventListener;

    window.addEventListener('canvas-state-change', handler);
    return () => window.removeEventListener('canvas-state-change', handler);
  }, [isAuthenticated]);

  // ─────────────────────────────────────────────────────────────
  // Derived state
  // ─────────────────────────────────────────────────────────────

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  const mainContentStyle = useMemo(() => {
    if (window.innerWidth < 768) return {};
    return {
      marginRight: `${canvasWidth}%`,
      transition: 'margin-right 0.2s ease-in-out',
    };
  }, [canvasWidth]);

  // ─────────────────────────────────────────────────────────────
  // Handlers — navigation
  // ─────────────────────────────────────────────────────────────

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setView('chat');
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setView('chat');
  }, []);

  const handleOpenBilling = useCallback(() => {
    setSettingsTab('billing');
    setView('settings');
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Handlers — data mutation
  // ─────────────────────────────────────────────────────────────

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await supabaseStorage.deleteConversation(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) setActiveConversationId(null);
      } catch (error) {
        console.error('[App] Error deleting conversation:', error);
      }
    },
    [activeConversationId]
  );

  const handleDeleteAllConversations = useCallback(async () => {
    try {
      await supabaseStorage.deleteAllConversations();
      setConversations([]);
      setActiveConversationId(null);
      setView('chat');
    } catch (error) {
      console.error('[App] Error deleting all conversations:', error);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setIsAuthenticated(false);
      setConversations([]);
      setActiveConversationId(null);
      setView('chat');
      setSidebarOpen(false);
      setSidebarCollapsed(false);
      setRateLimitInfo(DEFAULT_RATE_LIMIT);
    } catch (error) {
      console.error('[App] Error logging out:', error);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Handlers — messaging
  // ─────────────────────────────────────────────────────────────

  /**
   * Upload semua attachment ke Supabase Storage dan kembalikan
   * array MessageAttachment dengan signedUrl sementara untuk render langsung.
   */
  const prepareAttachments = useCallback(
    async (files: UploadedFile[], conversationId: string): Promise<MessageAttachment[]> => {
    const results = await Promise.all(
      files.map(async (uf) => {
        const stored = await uploadAttachment(uf.file, conversationId);
        if (!stored) return null;
            return {
          ...stored,
          signedUrl: stored.signedUrl ?? uf.previewUrl,
        } as MessageAttachment;
        })
      );
      return results.filter(Boolean) as MessageAttachment[];
    },
    []
  );

  /**
   * Persist conversation ke Supabase (fire-and-forget, tidak block UI).
   */
  const persistConversation = useCallback((conv: Conversation) => {
    supabaseStorage.saveConversation(conv).catch((err) =>
      console.error('[App] Error saving conversation:', err)
    );
  }, []);

  const handleSendMessage = useCallback(
    async (text: string, attachments?: UploadedFile[]) => {
      // ── Rate limit check ──────────────────────────────────
      try {
        const limitInfo = await checkRateLimit();
        setRateLimitInfo(limitInfo);
        if (limitInfo.isLimited) return;
      } catch (error) {
        console.error('[App] Rate limit check failed:', error);
        return;
      }

      setIsLoading(true);

      // ── Resolve / create conversation ─────────────────────
      const conversationId = activeConversationId ?? crypto.randomUUID();
      const isNewConversation = !activeConversation;

      let currentConversation: Conversation = activeConversation ?? {
        id: conversationId,
        title: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
        messages: [],
        createdAt: new Date().toISOString(),
      };

      if (isNewConversation) setActiveConversationId(conversationId);

      // ── Upload attachments ────────────────────────────────
      const storedAttachments =
        attachments?.length
          ? await prepareAttachments(attachments, conversationId)
          : undefined;

      // ── Optimistic UI update ──────────────────────────────
      const userMessage: Message = {
        id: crypto.randomUUID(),
        text,
        sender: MessageSender.User,
        attachments: storedAttachments,
      };

      const aiLoadingMessage: Message = {
        id: crypto.randomUUID(),
        text: '...',
        sender: MessageSender.AI,
      };

      const optimisticMessages = [
        ...currentConversation.messages,
        userMessage,
        aiLoadingMessage,
      ];

      setConversations((prev) => {
        const exists = prev.find((c) => c.id === conversationId);
        if (exists) {
          return prev.map((c) =>
            c.id === conversationId ? { ...c, messages: optimisticMessages } : c
          );
        }
        return [{ ...currentConversation, messages: optimisticMessages }, ...prev];
      });

      // ── Fetch AI response ─────────────────────────────────
      try {
        const aiResponseText = await sendMessageToWebhook(text, attachments);

        await incrementMessageCount();
        const updatedLimit = await getRateLimitStatus();
        setRateLimitInfo(updatedLimit);

        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== conversationId) return c;

            const finalMessages = c.messages.map((m) =>
              m.id === aiLoadingMessage.id ? { ...m, text: aiResponseText } : m
            );
            const finalConversation = { ...c, messages: finalMessages };
            persistConversation(finalConversation);
            return finalConversation;
          })
        );
      } catch (error) {
        console.error('[App] Error sending message:', error);
        // Rollback loading bubble on error
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== conversationId) return c;
            return {
              ...c,
              messages: c.messages.filter((m) => m.id !== aiLoadingMessage.id),
            };
          })
        );
      } finally {
        setIsLoading(false);
      }
    },
    [activeConversation, activeConversationId, prepareAttachments, persistConversation]
  );

  const handleEditMessage = useCallback(
    async (messageId: string, newText: string) => {
      // ── Rate limit check ──────────────────────────────────
      try {
        const limitInfo = await checkRateLimit();
        setRateLimitInfo(limitInfo);
        if (limitInfo.isLimited) return;
      } catch (error) {
        console.error('[App] Rate limit check failed:', error);
        return;
      }

      const conversationId = activeConversationId;
      if (!conversationId || !activeConversation) return;

      const messageIndex = activeConversation.messages.findIndex(
        (m) => m.id === messageId
      );
      if (messageIndex === -1) return;

      const truncatedMessages = activeConversation.messages.slice(0, messageIndex);

      const editedUserMessage: Message = {
        id: messageId,
        text: newText,
        sender: MessageSender.User,
      };

      const aiLoadingMessage: Message = {
        id: crypto.randomUUID(),
        text: '...',
        sender: MessageSender.AI,
      };

      const optimisticMessages = [...truncatedMessages, editedUserMessage, aiLoadingMessage];
      const previousConversations = conversations;

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, messages: optimisticMessages } : c
        )
      );
      setIsLoading(true);

      try {
        const aiResponseText = await sendMessageToWebhook(newText);

        await incrementMessageCount();
        const updatedLimit = await getRateLimitStatus();
        setRateLimitInfo(updatedLimit);

        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== conversationId) return c;

            const finalMessages = c.messages.map((m) =>
              m.id === aiLoadingMessage.id ? { ...m, text: aiResponseText } : m
            );
            const finalConversation = { ...c, messages: finalMessages };
            persistConversation(finalConversation);
            return finalConversation;
          })
        );
      } catch (error) {
        console.error('[App] Error editing message:', error);
        setConversations(previousConversations);
      } finally {
        setIsLoading(false);
      }
    },
    [activeConversationId, activeConversation, conversations, persistConversation]
  );

  const handleResendMessage = useCallback(
    (text: string) => handleSendMessage(text),
    [handleSendMessage]
  );

  const handlePromptClick = useCallback(
    (prompt: string) => handleSendMessage(prompt),
    [handleSendMessage]
  );

  const handleAuthSuccess = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Render guards
  // ─────────────────────────────────────────────────────────────

  if (isCheckingAuth) {
    return (
      <div className="flex h-screen bg-gray-800 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  // ─────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-gray-800 font-sans overflow-hidden">

      {/* ── Toast notifications ──────────────────────────── */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#1F2937', color: '#fff', border: '1px solid #374151' },
          success: {
            duration: 3000,
            iconTheme: { primary: '#10B981', secondary: '#fff' },
            style: { background: '#1F2937', border: '1px solid #10B981' },
          },
          error: {
            duration: 4000,
            iconTheme: { primary: '#EF4444', secondary: '#fff' },
            style: { background: '#1F2937', border: '1px solid #EF4444' },
          },
          loading: {
            style: { background: '#1F2937', border: '1px solid #3B82F6' },
          },
        }}
      />

      {/* ── Update modal ──────────────────────────────────── */}
      <UpdateModal version="4.2.2" updateDate="November 2025" />

      {/* ── Sidebar ───────────────────────────────────────── */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onOpenSettings={() => setView('settings')}
        isOpen={isSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />

      {/* ── Main content ──────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col bg-gray-900 text-white overflow-hidden"
        style={mainContentStyle}
      >
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-gray-900 text-white border-b border-gray-700/50 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-gray-300 hover:text-white"
          >
            <HiOutlineMenuAlt3 />
          </button>
          <h1 className="text-lg font-semibold truncate">
            {activeConversation?.title || t('newChat')}
          </h1>
          <div className="w-6" />
        </header>

        {/* Settings view */}
        {view === 'settings' ? (
          <SettingsLayout
            onClose={() => setView('chat')}
            onDeleteAll={handleDeleteAllConversations}
            onLogout={handleLogout}
            initialTab={settingsTab}
          />
        ) : (
          <>
            {/* Chat messages */}
            <main
              ref={mainContainerRef}
              className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-6 lg:p-8 relative"
            >
              <div className="max-w-4xl mx-auto h-full flex flex-col">
                {activeConversation?.messages.length ? (
                  <div className="flex flex-col gap-6">
                    {activeConversation.messages.map((msg, index) => (
                      <ChatMessage
                        key={msg.id}
                        message={msg}
                        isLoading={
                          isLoading &&
                          msg.sender === MessageSender.AI &&
                          msg.text === '...'
                        }
                        onResendMessage={handleResendMessage}
                        onEditMessage={handleEditMessage}
                        shouldHideButtons={
                          activeConversation.messages.length - index > 10
                        }
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <Welcome onPromptClick={handlePromptClick} />
                )}
              </div>

              {/* Scroll-to-bottom button */}
              {showScrollButton && (
                <button
                  onClick={scrollToBottom}
                  className="fixed bottom-24 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all duration-300 z-50"
                  style={{
                    right: canvasWidth > 0 ? `calc(${canvasWidth}% + 2rem)` : '2rem',
                    transition: 'right 0.2s ease-in-out',
                  }}
                  aria-label="Scroll to bottom"
                >
                  <FiArrowDown size={20} />
                </button>
              )}
            </main>

            {/* Chat input */}
            <div className="px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8 bg-gray-900">
              <div className="max-w-4xl mx-auto">
                <RateLimitWarning
                  messagesRemaining={rateLimitInfo.messagesRemaining}
                  maxMessages={rateLimitInfo.maxMessages}
                  resetTime={rateLimitInfo.resetTime}
                  isLimited={rateLimitInfo.isLimited}
                  onUpgradeClick={handleOpenBilling}
                />
                <ChatInput
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading || rateLimitInfo.isLimited}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;