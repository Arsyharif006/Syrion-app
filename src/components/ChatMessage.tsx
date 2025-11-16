import React, { useEffect, useState, useMemo } from 'react';
import { Message, MessageSender } from '../../types';
import { FiUser, FiRefreshCw, FiEdit3, FiCheck, FiX, FiMaximize2 } from 'react-icons/fi';
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

  const tableRegex = /(\|[^\n]+\|\n\|[\s:|-]+\|\n(?:\|[^\n]+\|\n?)+)/g;
  let lastIndex = 0;
  let match;

  while ((match = tableRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const beforeText = text.substring(lastIndex, match.index).trim();
      if (beforeText) {
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
        let codeMatch;
        let textLastIndex = 0;

        while ((codeMatch = codeBlockRegex.exec(beforeText)) !== null) {
          if (codeMatch.index > textLastIndex) {
            const textPart = beforeText.substring(textLastIndex, codeMatch.index).trim();
            if (textPart) {
              const cleanedText = textPart
                .replace(/^(#+)\s/gm, '')
                .replace(/\*\*/g, '')
                .replace(/`/g, '')
                .replace(/^\s*[-*]\s/gm, '• ');
              if (cleanedText) {
                components.push({ type: 'text', content: cleanedText });
              }
            }
          }

          components.push({
            type: 'code',
            content: { language: codeMatch[1], code: codeMatch[2].trim() },
          });

          textLastIndex = codeMatch.index + codeMatch[0].length;
        }

        if (textLastIndex < beforeText.length) {
          const textPart = beforeText.substring(textLastIndex).trim();
          if (textPart) {
            const cleanedText = textPart
              .replace(/^(#+)\s/gm, '')
              .replace(/\*\*/g, '')
              .replace(/`/g, '')
              .replace(/^\s*[-*]\s/gm, '• ');
            if (cleanedText) {
              components.push({ type: 'text', content: cleanedText });
            }
          }
        }
      }
    }

    try {
      const tableText = match[1];
      const lines = tableText.trim().split('\n').filter(line => line.trim());

      if (lines.length >= 2) {
        const headers = lines[0]
          .split('|')
          .map(h => h.trim())
          .filter(Boolean);

        const rows = lines.slice(2)
          .map(row =>
            row.split('|')
              .map(c => c.trim())
              .filter(Boolean)
          )
          .filter(row => row.length > 0);

        if (headers.length > 0 && rows.length > 0) {
          components.push({ type: 'table', content: { headers, rows } });
        }
      }
    } catch (error) {
      console.error('Error parsing table:', error);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const afterText = text.substring(lastIndex).trim();
    if (afterText) {
      const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
      let codeMatch;
      let textLastIndex = 0;

      while ((codeMatch = codeBlockRegex.exec(afterText)) !== null) {
        if (codeMatch.index > textLastIndex) {
          const textPart = afterText.substring(textLastIndex, codeMatch.index).trim();
          if (textPart) {
            const cleanedText = textPart
              .replace(/^(#+)\s/gm, '')
              .replace(/\*\*/g, '')
              .replace(/`/g, '')
              .replace(/^\s*[-*]\s/gm, '• ');
            if (cleanedText) {
              components.push({ type: 'text', content: cleanedText });
            }
          }
        }

        components.push({
          type: 'code',
          content: { language: codeMatch[1], code: codeMatch[2].trim() },
        });

        textLastIndex = codeMatch.index + codeMatch[0].length;
      }

      if (textLastIndex < afterText.length) {
        const textPart = afterText.substring(textLastIndex).trim();
        if (textPart) {
          const cleanedText = textPart
            .replace(/^(#+)\s/gm, '')
            .replace(/\*\*/g, '')
            .replace(/`/g, '')
            .replace(/^\s*[-*]\s/gm, '• ');
          if (cleanedText) {
            components.push({ type: 'text', content: cleanedText });
          }
        }
      }
    }
  }

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
      
      // Update message every 3 seconds
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

  if (message.sender === MessageSender.User) {
    return (
      <div className="flex flex-col items-end gap-2">
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
                {message.text}
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