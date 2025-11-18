import React, { useEffect, useState, useMemo } from 'react';
import { Message, MessageSender } from '../../types';
import { FiUser, FiRefreshCw, FiEdit3, FiCheck, FiX, FiMaximize2, FiCode } from 'react-icons/fi';
import { CodeBlock } from './CodeBlock';
import { Table } from './Table';
import { VibeCodingCanvas } from './VibeCodingCanvas';
import { ReactPreviewCanvas } from './ReactPreviewCanvas';
import { useLocalization } from '../contexts/LocalizationContext';

interface ChatMessageProps {
  message: Message;
  isLoading: boolean;
  onResendMessage: (message: string) => void;
  onEditMessage?: (messageId: string, newText: string) => void;
  shouldHideButtons?: boolean;
}

interface CodeFile {
  language: string;
  content: string;
}

interface ParsedCodeBlock {
  language: string;
  code: string;
  index: number;
}

// ✅ Global edit manager
let __globalEditingId: string | null = null;
const EMIT_EDIT_CHANGE = (id: string | null) =>
  window.dispatchEvent(new CustomEvent('chat-edit-change', { detail: id }));

// ✅ Global canvas manager
let __globalActiveCanvasId: string | null = null;
const EMIT_CANVAS_CHANGE = (id: string | null, width: number = 0) => {
  __globalActiveCanvasId = id;
  window.dispatchEvent(new CustomEvent('canvas-state-change', { detail: { isOpen: !!id, width, messageId: id } }));
};

// ✅ Helper function to get random loading message from localization
const getRandomLoadingMessage = (loadingMessages: string[]): string => {
  if (!loadingMessages || loadingMessages.length === 0) {
    return "Loading...";
  }
  return loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
};


const parseAiResponse = (text: string) => {
  if (!text) return [];

  const components: { type: 'text' | 'code' | 'table'; content: any }[] = [];
  
  interface Block {
    type: 'code' | 'table';
    start: number;
    end: number;
    data: any;
  }
  
  const blocks: Block[] = [];
  
  // Find all code blocks - Use simple iteration instead of exec
  const codeBlockMatches = [...text.matchAll(/```(\w*)\n([\s\S]*?)```/g)];
  
  for (const match of codeBlockMatches) {
    if (match.index !== undefined) {
      blocks.push({
        type: 'code',
        start: match.index,
        end: match.index + match[0].length,
        data: {
          language: match[1] || 'text',
          code: match[2].trim()
        }
      });
    }
  }
  
  // Find all tables
  const tableMatches = [...text.matchAll(/(\|[^\n]+\|\n\|[\s:|-]+\|\n(?:\|[^\n]+\|\n?)+)/g)];
  
  for (const match of tableMatches) {
    if (match.index !== undefined) {
      const tableStart = match.index;
      const tableEnd = match.index + match[0].length;
      
      // Check if inside code block
      const isInsideCodeBlock = blocks.some(
        block => block.type === 'code' && tableStart >= block.start && tableEnd <= block.end
      );
      
      if (!isInsideCodeBlock) {
        try {
          const tableText = match[1];
          const lines = tableText.trim().split('\n').filter(line => line.trim());
          
          if (lines.length >= 2) {
            const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean);
            const rows = lines.slice(2)
              .map(row => row.split('|').map(c => c.trim()).filter(Boolean))
              .filter(row => row.length > 0);
            
            if (headers.length > 0 && rows.length > 0) {
              blocks.push({
                type: 'table',
                start: tableStart,
                end: tableEnd,
                data: { headers, rows }
              });
            }
          }
        } catch (error) {
          console.error('Error parsing table:', error);
        }
      }
    }
  }
  
  // Sort blocks
  blocks.sort((a, b) => a.start - b.start);
  
  // Extract components
  let currentPosition = 0;
  
  for (const block of blocks) {
    // Text before block
    if (currentPosition < block.start) {
      const textContent = text.substring(currentPosition, block.start).trim();
      if (textContent) {
        const cleanedText = textContent
          .replace(/^(#+)\s/gm, '')
          .replace(/\*\*/g, '')
          .replace(/`/g, '')
          .replace(/^\s*[-*]\s/gm, '• ');
        
        if (cleanedText.trim()) {
          components.push({ type: 'text', content: cleanedText });
        }
      }
    }
    
    // Add block
    components.push({
      type: block.type,
      content: block.data
    });
    
    currentPosition = block.end;
  }
  
  // Remaining text
  if (currentPosition < text.length) {
    const textContent = text.substring(currentPosition).trim();
    if (textContent) {
      const cleanedText = textContent
        .replace(/^(#+)\s/gm, '')
        .replace(/\*\*/g, '')
        .replace(/`/g, '')
        .replace(/^\s*[-*]\s/gm, '• ');
      
      if (cleanedText.trim()) {
        components.push({ type: 'text', content: cleanedText });
      }
    }
  }
  
  // Fallback
  if (components.length === 0 && text.trim()) {
    const cleanedText = text
      .replace(/^(#+)\s/gm, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/^\s*[-*]\s/gm, '• ');
    
    if (cleanedText.trim()) {
      components.push({ type: 'text', content: cleanedText });
    }
  }
  
  return components;
};

const extractCodeFiles = (text: string): CodeFile[] => {
  const files: CodeFile[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const language = match[1] || 'text';
    const content = match[2].trim();

    const canvasLanguages = [
      'html', 'css', 'javascript', 'js', 'typescript', 'ts',
      'jsx', 'tsx', 'react', 'typescript-react',
      'python', 'cpp', 'c', 'java', 'php', 'ruby', 'go', 'rust',
      'csharp', 'swift', 'kotlin', 'c++'
    ];

    if (canvasLanguages.includes(language.toLowerCase())) {
      files.push({ language, content });
    }
  }

  return files;
};

const isReactCode = (files: CodeFile[]): boolean => {
  return files.some(f => {
    const lang = f.language.toLowerCase();
    const isReactLang = ['jsx', 'tsx', 'react', 'typescript-react'].includes(lang);
    const hasReactImport = /import\s+.*from\s+['"]react['"]/i.test(f.content);
    return isReactLang || hasReactImport;
  });
};

// ✅ NEW: Extract all code blocks from user message for preview
const extractUserCodeBlocks = (text: string): ParsedCodeBlock[] => {
  const blocks: ParsedCodeBlock[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let match;
  let index = 0;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
      index: index++
    });
  }

  return blocks;
};

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isLoading,
  onResendMessage,
  onEditMessage,
  shouldHideButtons = false,
}) => {
  const [isEditingLocal, setIsEditingLocal] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [globalEditingId, setGlobalEditingId] = useState<string | null>(__globalEditingId);
  const [showCanvas, setShowCanvas] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(50);
  const [globalActiveCanvas, setGlobalActiveCanvas] = useState<string | null>(__globalActiveCanvasId);
  
  // ✅ NEW: State for code block modal in user messages
  const [expandedUserBlock, setExpandedUserBlock] = useState<ParsedCodeBlock | null>(null);
  
  // ✅ State untuk loading message
  const { t } = useLocalization();
  const [loadingMessage, setLoadingMessage] = useState<string>('Loading...');

  // ✅ FIXED: Update loading message setiap 3 detik saat loading
  useEffect(() => {
    if (isLoading) {
      // Set initial message
      const messages = t('loadingMessages');
      const loadingMessagesArray = Array.isArray(messages) ? messages : ['Loading...'];
      setLoadingMessage(getRandomLoadingMessage(loadingMessagesArray));
      
      // Update message every 18 seconds
      const interval = setInterval(() => {
        const messagesUpdate = t('loadingMessages');
        const loadingMessagesArrayUpdate = Array.isArray(messagesUpdate) ? messagesUpdate : ['Loading...'];
        setLoadingMessage(getRandomLoadingMessage(loadingMessagesArrayUpdate));
      }, 18000);
      
      return () => clearInterval(interval);
    }
  }, [isLoading, t]);

  useEffect(() => {
    setEditText(message.text);
  }, [message.text]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string | null;
      __globalEditingId = detail;
      setGlobalEditingId(detail);

      if (detail !== message.id && isEditingLocal) {
        setIsEditingLocal(false);
        setEditText(message.text);
      }
    };

    window.addEventListener('chat-edit-change', handler);
    return () => window.removeEventListener('chat-edit-change', handler);
  }, [isEditingLocal, message.id, message.text]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const activeMessageId = detail.messageId as string | null;

      setGlobalActiveCanvas(activeMessageId);

      if (activeMessageId && activeMessageId !== message.id && showCanvas) {
        setShowCanvas(false);
      }
    };

    window.addEventListener('canvas-state-change', handler);
    return () => window.removeEventListener('canvas-state-change', handler);
  }, [message.id, showCanvas]);

  useEffect(() => {
    const handler = () => {
      if (showCanvas) {
        setShowCanvas(false);
        EMIT_CANVAS_CHANGE(null, 0);
      }
    };

    window.addEventListener('settings-opened', handler);
    return () => window.removeEventListener('settings-opened', handler);
  }, [showCanvas]);

  useEffect(() => {
    const handler = () => {
      if (showCanvas) {
        setShowCanvas(false);
        EMIT_CANVAS_CHANGE(null, 0);
      }
    };

    window.addEventListener('conversation-changed', handler);
    return () => window.removeEventListener('conversation-changed', handler);
  }, [showCanvas]);

  const codeFiles = message.sender === MessageSender.AI
    ? extractCodeFiles(message.text)
    : [];

  const hasCanvasContent = codeFiles.length > 0;
  const isReact = useMemo(() => isReactCode(codeFiles), [codeFiles]);

  useEffect(() => {
    if (hasCanvasContent && !isLoading && message.sender === MessageSender.AI && !__globalActiveCanvasId) {
      setShowCanvas(false);
      const timer = setTimeout(() => {
        setShowCanvas(true);
        EMIT_CANVAS_CHANGE(message.id, canvasWidth);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [message.text, hasCanvasContent, isLoading, message.sender, message.id, canvasWidth]);

  const startEditing = () => {
    __globalEditingId = message.id;
    EMIT_EDIT_CHANGE(message.id);
    setIsEditingLocal(true);
  };

  const stopEditing = (shouldReset = true) => {
    __globalEditingId = null;
    EMIT_EDIT_CHANGE(null);
    setIsEditingLocal(false);
    if (shouldReset) setEditText(message.text);
  };

  const handleSaveEdit = () => {
    if (onEditMessage && editText.trim() !== '') {
      onEditMessage(message.id, editText.trim());
    }
    stopEditing(false);
  };

  const handleOpenCanvas = () => {
    if (__globalActiveCanvasId && __globalActiveCanvasId !== message.id) {
      EMIT_CANVAS_CHANGE(null, 0);
    }

    setShowCanvas(true);
    EMIT_CANVAS_CHANGE(message.id, canvasWidth);
  };

  const handleCloseCanvas = () => {
    setShowCanvas(false);
    EMIT_CANVAS_CHANGE(null, 0);
  };

  const handleWidthChange = (width: number) => {
    setCanvasWidth(width);
    EMIT_CANVAS_CHANGE(message.id, width);
  };

  const anyEditingActive = Boolean(globalEditingId);
  const isThisCanvasActive = globalActiveCanvas === message.id;

  // ✅ NEW: Parse user message for code blocks
  const userCodeBlocks = message.sender === MessageSender.User 
    ? extractUserCodeBlocks(message.text)
    : [];

  // ✅ NEW: Function to render user message text only (without code blocks)
  const renderUserMessageText = () => {
    if (userCodeBlocks.length === 0) {
      return message.text;
    }

    // Remove all code blocks from text
    let textOnly = message.text.replace(/```(\w*)\n([\s\S]*?)```/g, '').trim();
    return textOnly;
  };

  if (message.sender === MessageSender.User) {
    return (
      <>
        <div className="flex flex-col items-end gap-2">
 {/* ✅ Code Blocks Grid - Di atas bubble chat */}
          {userCodeBlocks.length > 0 && !isEditingLocal && (
            <div className="w-full flex justify-end">
              <div className={`grid gap-2 mb-2 ${
                userCodeBlocks.length === 1 
                  ? 'grid-cols-1 w-auto min-w-[200px] max-w-[85%] sm:max-w-md' 
                  : 'grid-cols-2 lg:grid-cols-3 w-full max-w-[85%] sm:max-w-xl lg:max-w-3xl'
              } ${userCodeBlocks.length % 2 !== 0 && userCodeBlocks.length > 1 ? '[&>*:last-child]:col-start-2 lg:[&>*:last-child]:col-start-auto' : ''}`}>
                {userCodeBlocks.map((block, idx) => {
                  const lineCount = block.code.split('\n').length;
                  return (
                    <div
                      key={`code-${idx}`}
                      className="bg-gray-700/50 border border-gray-600 rounded-lg p-3 group cursor-pointer hover:border-blue-500/50 transition-colors"
                      onClick={() => setExpandedUserBlock(block)}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center">
                              <FiCode className="text-blue-400" size={12} />
                            </div>
                            {block.language && (
                              <span className="text-xs px-1.5 py-0.5 bg-gray-600 text-gray-300 rounded">
                                {block.language}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedUserBlock(block);
                            }}
                            className="p-1 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <FiMaximize2 size={12} />
                          </button>
                        </div>
                        
                        <pre className="text-xs text-gray-400 font-mono overflow-hidden line-clamp-3">
                          {block.code}
                        </pre>
                        
                        <span className="text-xs text-gray-500">
                          {lineCount} {lineCount === 1 ? 'line' : 'lines'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 sm:gap-4 justify-end w-full">
            <div
              className={`transition-all duration-200 ${isEditingLocal
                ? 'w-full sm:w-3/4 bg-blue-700/70'
                : 'max-w-[85%] sm:max-w-xl lg:max-w-3xl bg-blue-600'
                } px-4 sm:px-5 py-3 rounded-2xl rounded-br-none relative overflow-hidden`}
            >
              {isEditingLocal ? (
                <div className="flex flex-col gap-3">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full bg-blue-800/50 text-white rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none min-h-[90px] text-sm sm:text-base"
                    rows={4}
                    aria-label="Edit message"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 text-sm">
                    <button
                      onClick={() => stopEditing(true)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-gray-700/50 hover:bg-gray-600 text-gray-200 transition"
                    >
                      <FiX size={14} />
                      {t('cancel')}
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white text-blue-600 hover:brightness-95 transition"
                    >
                      <FiCheck size={14} />
                      {t('save')}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words overflow-wrap-anywhere text-white text-sm sm:text-base leading-relaxed">
                  {renderUserMessageText()}
                </p>
              )}
            </div>

            <div className="hidden md:flex w-8 h-8 rounded-full bg-gray-700 items-center justify-center overflow-hidden flex-shrink-0">
              <FiUser size={18} />
            </div>
          </div>

          {!isEditingLocal && !shouldHideButtons && (
            <div className="flex text-xs md:mr-10">
              <button
                onClick={() => onResendMessage(message.text)}
                disabled={anyEditingActive}
                className={`flex items-center px-2.5 py-1.5 rounded-lg transition ${anyEditingActive
                  ? 'opacity-40 cursor-not-allowed text-gray-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                title={t('running')}
              >
                <FiRefreshCw size={13} />
              </button>
              <button
                onClick={startEditing}
                disabled={anyEditingActive}
                className={`flex items-center px-2.5 py-1.5 rounded-lg transition ${anyEditingActive
                  ? 'opacity-40 cursor-not-allowed text-gray-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                title={t('editingNote')}
              >
                <FiEdit3 size={13} />
              </button>
            </div>
          )}
        </div>

        {/* ✅ NEW: User Code Block Modal */}
        {expandedUserBlock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-gray-700 shadow-2xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                    <FiCode className="text-blue-400" size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">
                      Code Preview
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {expandedUserBlock.language && (
                        <span className="px-2 py-0.5 bg-gray-800 rounded">
                          {expandedUserBlock.language}
                        </span>
                      )}
                      <span>{expandedUserBlock.code.split('\n').length} lines</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedUserBlock(null)}
                  className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                >
                  <FiX size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-auto p-4">
                <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-words bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  {expandedUserBlock.code}
                </pre>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-700 bg-gray-800/30">
                <button
                  onClick={() => setExpandedUserBlock(null)}
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ✅ FIXED: Loading state dengan pesan variatif
  if (isLoading) {
    return (
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="max-w-[85%] sm:max-w-xl lg:max-w-3xl px-4 sm:px-5 py-3 rounded-2xl bg-gray-700 rounded-bl-none">
          <div className="flex flex-col gap-2">
            <p className="text-gray-400 text-sm animate-pulse">
              {loadingMessage}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const aiResponseParts = parseAiResponse(message.text);

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="max-w-[100%] sm:max-w-xl lg:max-w-3xl w-full py-3 rounded-bl-none">
            <div className="flex flex-col gap-4 text-white text-sm sm:text-base">
              {aiResponseParts.map((part, index) => {
                if (part.type === 'text') {
                  return (
                    <p key={index} className="whitespace-pre-wrap break-words overflow-wrap-anywhere leading-relaxed">
                      {part.content as string}
                    </p>
                  );
                }
                if (part.type === 'code') {
                  const { language, code } = part.content as { language: string; code: string };
                  return <CodeBlock key={index} language={language} code={code} />;
                }
                if (part.type === 'table') {
                  const { headers, rows } = part.content as { headers: string[]; rows: (string | number)[][] };
                  return <Table key={index} headers={headers} rows={rows} />;
                }
                return null;
              })}
            </div>
          </div>
        </div>

        {hasCanvasContent && !shouldHideButtons && !isThisCanvasActive && (
          <div className="flex text-xs">
            <button
              onClick={handleOpenCanvas}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition text-gray-400 hover:text-white hover:bg-gray-700/50"
              title={t('openCanvas')}
            >
              <FiMaximize2 size={13} />
              {t('openCanvas')}
            </button>
          </div>
        )}
      </div>

      {isThisCanvasActive && hasCanvasContent && (
        <>
          {isReact ? (
            <ReactPreviewCanvas
              files={codeFiles}
              onClose={handleCloseCanvas}
              onWidthChange={handleWidthChange}
            />
          ) : (
            <VibeCodingCanvas
              files={codeFiles}
              onClose={handleCloseCanvas}
              onWidthChange={handleWidthChange}
            />
          )}
        </>
      )}
    </>
  );
};