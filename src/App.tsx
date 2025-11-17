import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Conversation, Message, MessageSender } from '../types';
import { HiOutlineMenuAlt3 } from 'react-icons/hi';
import { FiArrowDown } from 'react-icons/fi';
import { supabase } from './lib/supabaseClient';
import * as supabaseStorage from './services/supabaseStorageService';
import { sendMessageToWebhook } from './services/n8nService';
import { checkRateLimit, incrementMessageCount, getRateLimitStatus, RateLimitInfo } from './services/rateLimitServices';
import { Sidebar } from './components/Sidebar';
import { ChatInput } from './components/ChatInput';
import { ChatMessage } from './components/ChatMessage';
import { Welcome } from './components/Welcome';
import { Settings } from './components/Setting';
import { UpdateModal } from './components/Update';
import { Auth } from './components/Auth';
import { RateLimitWarning } from './components/RateLimitWarning';
import { useLocalization } from './contexts/LocalizationContext';

function App() {
  const { t } = useLocalization();
  
  // ALL STATE DECLARATIONS MUST BE AT THE TOP
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [view, setView] = useState<'chat' | 'settings'>('chat');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo>({
    messagesRemaining: 50,
    maxMessages: 50,
    resetTime: null,
    isLimited: false,
    waitTimeMinutes: 0,
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
      } catch (error) {
        console.error('Error checking auth:', error);
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Load conversations from Supabase
  useEffect(() => {
    const loadConversations = async () => {
      if (isAuthenticated) {
        try {
          const convs = await supabaseStorage.getConversations();
          setConversations(convs);
        } catch (error) {
          console.error('Error loading conversations:', error);
        }
      }
    };

    loadConversations();
  }, [isAuthenticated]);

  // Load and refresh rate limit info
  useEffect(() => {
    const loadRateLimit = async () => {
      if (isAuthenticated) {
        try {
          const info = await getRateLimitStatus();
          setRateLimitInfo(info);
        } catch (error) {
          console.error('Error loading rate limit:', error);
        }
      }
    };

    loadRateLimit();
    
    // Refresh rate limit info setiap 30 detik
    const interval = setInterval(() => {
      if (isAuthenticated) {
        loadRateLimit();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);

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
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
      setShowScrollButton(!isNearBottom && scrollTop > 300);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const handleCanvasChange = ((e: CustomEvent) => {
      setCanvasWidth(e.detail.isOpen ? e.detail.width : 0);
    }) as EventListener;

    window.addEventListener('canvas-state-change', handleCanvasChange);
    return () => window.removeEventListener('canvas-state-change', handleCanvasChange);
  }, [isAuthenticated]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === activeConversationId) || null;
  }, [conversations, activeConversationId]);

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setView('chat');
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setView('chat');
  }, []);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await supabaseStorage.deleteConversation(id);
        const updatedConversations = conversations.filter((c) => c.id !== id);
        setConversations(updatedConversations);
        if (activeConversationId === id) {
          setActiveConversationId(null);
        }
      } catch (error) {
        console.error('Error deleting conversation:', error);
      }
    },
    [conversations, activeConversationId]
  );

  const handleDeleteAllConversations = useCallback(async () => {
    try {
      await supabaseStorage.deleteAllConversations();
      setConversations([]);
      setActiveConversationId(null);
      setView('chat');
    } catch (error) {
      console.error('Error deleting all conversations:', error);
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
      setRateLimitInfo({
        messagesRemaining: 50,
        maxMessages: 50,
        resetTime: null,
        isLimited: false,
        waitTimeMinutes: 0,
      });
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }, []);

  const handleSendMessage = useCallback(
    async (text: string) => {
      // Check rate limit first
      try {
        const limitInfo = await checkRateLimit();
        setRateLimitInfo(limitInfo);
        
        if (limitInfo.isLimited) {
          // Tidak bisa kirim pesan, sudah kena limit
          console.log('Rate limit reached. Please wait.');
          return;
        }
      } catch (error) {
        console.error('Error checking rate limit:', error);
        return;
      }

      setIsLoading(true);

      const userMessage: Message = {
        id: crypto.randomUUID(),
        text,
        sender: MessageSender.User,
      };

      let conversationId = activeConversationId;
      let currentConversation = activeConversation;

      if (!currentConversation) {
        const newConv: Conversation = {
          id: crypto.randomUUID(),
          title: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
          messages: [],
          createdAt: new Date().toISOString(),
        };
        currentConversation = newConv;
        conversationId = newConv.id;
        setActiveConversationId(newConv.id);
      }

      const aiLoadingMessage: Message = {
        id: crypto.randomUUID(),
        text: '...',
        sender: MessageSender.AI,
      };

      const updatedMessages = [...currentConversation.messages, userMessage, aiLoadingMessage];

      setConversations((prev) => {
        const existing = prev.find((c) => c.id === conversationId);
        if (existing) {
          return prev.map((c) => (c.id === conversationId ? { ...c, messages: updatedMessages } : c));
        } else {
          return [{ ...currentConversation!, messages: updatedMessages }, ...prev];
        }
      });

      try {
        const aiResponseText = await sendMessageToWebhook(text);
        
        // Increment message count after successful response
        await incrementMessageCount();
        
        // Update rate limit info
        const updatedLimitInfo = await getRateLimitStatus();
        setRateLimitInfo(updatedLimitInfo);

        setConversations((prev) => {
          const finalConvs = prev.map((c) => {
            if (c.id === conversationId) {
              const finalMessages = c.messages.map((m) =>
                m.id === aiLoadingMessage.id ? { ...m, text: aiResponseText } : m
              );
              const finalConversation = { ...c, messages: finalMessages };
              
              // Save to Supabase
              supabaseStorage.saveConversation(finalConversation).catch(err => {
                console.error('Error saving conversation:', err);
              });
              
              return finalConversation;
            }
            return c;
          });
          return finalConvs;
        });
      } catch (error) {
        console.error('Error sending message:', error);
      }

      setIsLoading(false);
    },
    [activeConversation, activeConversationId]
  );

  const handleEditMessage = useCallback(async (messageId: string, newText: string) => {
    // Check rate limit before editing
    try {
      const limitInfo = await checkRateLimit();
      setRateLimitInfo(limitInfo);
      
      if (limitInfo.isLimited) {
        console.log('Rate limit reached. Cannot edit message.');
        return;
      }
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return;
    }

    const conversationId = activeConversationId;
    if (!conversationId || !activeConversation) return;

    const messageIndex = activeConversation.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) {
      console.error("Could not find the message to edit.");
      return;
    }

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

    const updatedMessages = [...truncatedMessages, editedUserMessage, aiLoadingMessage];
    const previousConversations = conversations;

    setConversations(prev =>
      prev.map(conv =>
        conv.id === conversationId ? { ...conv, messages: updatedMessages } : conv
      )
    );
    setIsLoading(true);

    try {
      const aiResponseText = await sendMessageToWebhook(newText);
      
      // Increment message count after successful edit response
      await incrementMessageCount();
      
      // Update rate limit info
      const updatedLimitInfo = await getRateLimitStatus();
      setRateLimitInfo(updatedLimitInfo);
      
      setConversations(prev => {
        const finalConvs = prev.map(conv => {
          if (conv.id === conversationId) {
            const finalMessages = conv.messages.map(m =>
              m.id === aiLoadingMessage.id ? { ...m, text: aiResponseText } : m
            );
            const finalConversation = { ...conv, messages: finalMessages };
            
            // Save to Supabase
            supabaseStorage.saveConversation(finalConversation).catch(err => {
              console.error('Error saving conversation:', err);
            });
            
            return finalConversation;
          }
          return conv;
        });
        return finalConvs;
      });

    } catch (error) {
      console.error("Failed to get AI response after editing:", error);
      setConversations(previousConversations);
    } finally {
      setIsLoading(false);
    }
  }, [activeConversationId, activeConversation, conversations]);

  const handleResendMessage = useCallback(
    (text: string) => {
      handleSendMessage(text);
    },
    [handleSendMessage]
  );

  const handlePromptClick = useCallback(
    (prompt: string) => {
      handleSendMessage(prompt);
    },
    [handleSendMessage]
  );

  const mainContentStyle = useMemo(() => {
    if (window.innerWidth < 768) return {};
    
    const sidebarWidth = isSidebarCollapsed ? 64 : 256;
    const rightSpace = canvasWidth;
    
    return {
      marginRight: `${rightSpace}%`,
      transition: 'margin-right 0.2s ease-in-out'
    };
  }, [isSidebarCollapsed, canvasWidth]);

  const handleAuthSuccess = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="flex h-screen bg-gray-800 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  // Show auth page if not authenticated
  if (!isAuthenticated) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  // Main App Render (only when authenticated)
  return (
    <div className="flex h-screen bg-gray-800 font-sans overflow-hidden">
      <UpdateModal 
        version="4.2.2" 
        updateDate="November 2025"
      />

      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onOpenSettings={() => {
          setView('settings');
        }}
        isOpen={isSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />

      <div className="flex-1 flex flex-col bg-gray-900 text-white overflow-hidden" style={mainContentStyle}>
        <header className="md:hidden flex items-center justify-between p-4 bg-gray-900 text-white border-b border-gray-700/50 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-gray-300 hover:text-white">
              <HiOutlineMenuAlt3 />
          </button>
          <h1 className="text-lg font-semibold truncate">{activeConversation?.title || t('newChat')}</h1>
          <div className="w-6"></div>
        </header>

        {view === 'settings' ? (
          <Settings 
            onClose={() => setView('chat')} 
            onDeleteAll={handleDeleteAllConversations}
            onLogout={handleLogout}
          />
        ) : (
          <>
            <main ref={mainContainerRef} className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-6 lg:p-8 relative">
              <div className="max-w-4xl mx-auto h-full flex flex-col">
                {activeConversation && activeConversation.messages.length > 0 ? (
                  <div className="flex flex-col gap-6">
                    {activeConversation.messages.map((msg, index) => (
                      <ChatMessage
                        key={msg.id}
                        message={msg}
                        isLoading={isLoading && msg.sender === MessageSender.AI && msg.text === '...'}
                        onResendMessage={handleResendMessage}
                        onEditMessage={handleEditMessage}
                        shouldHideButtons={activeConversation.messages.length - index > 10}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <Welcome onPromptClick={handlePromptClick} />
                )}
              </div>

              {showScrollButton && (
                <button
                  onClick={scrollToBottom}
                  className="fixed bottom-24 right-8 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all duration-300 z-50"
                  style={{ 
                    right: canvasWidth > 0 ? `calc(${canvasWidth}% + 2rem)` : '2rem',
                    transition: 'right 0.2s ease-in-out'
                  }}
                  aria-label="Scroll to bottom"
                >
                  <FiArrowDown size={20} />
                </button>
              )}
            </main>
            <div className="px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8 bg-gray-900">
              <div className="max-w-4xl mx-auto">
                <RateLimitWarning
                  messagesRemaining={rateLimitInfo.messagesRemaining}
                  maxMessages={rateLimitInfo.maxMessages}
                  resetTime={rateLimitInfo.resetTime}
                  isLimited={rateLimitInfo.isLimited}
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