import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Message, MessageSender, MessageAttachment } from '../../types';
import {
  FiUser, FiRefreshCw, FiEdit3, FiCheck, FiX,
  FiMaximize2, FiCode, FiFile, FiImage,
} from 'react-icons/fi';
import { CodeBlock } from './CodeBlock';
import { Table } from './Table';
import { VibeCodingCanvas } from './VibeCodingCanvas';
import { ReactPreviewCanvas } from './ReactPreviewCanvas';
import { useLocalization } from '../contexts/LocalizationContext';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

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

interface ImagePreview {
  name: string;
  url: string;
}

// ─────────────────────────────────────────────────────────────
// Global managers (edit + canvas)
// ─────────────────────────────────────────────────────────────

let __globalEditingId: string | null = null;
const EMIT_EDIT_CHANGE = (id: string | null) =>
  window.dispatchEvent(new CustomEvent('chat-edit-change', { detail: id }));

let __globalActiveCanvasId: string | null = null;
const EMIT_CANVAS_CHANGE = (id: string | null, width = 0) => {
  __globalActiveCanvasId = id;
  window.dispatchEvent(
    new CustomEvent('canvas-state-change', { detail: { isOpen: !!id, width, messageId: id } })
  );
};

// ─────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────

/** Pastikan value selalu string — handle semua format response Gemini */
const ensureString = (value: any): string => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (value.parts && Array.isArray(value.parts))
      return value.parts.map((p: any) => p.text || '').join('');
    if (typeof value.text === 'string') return value.text;
    if (typeof value.output === 'string') return value.output;
    return JSON.stringify(value);
  }
  return String(value);
};

const getRandomItem = (arr: string[]): string =>
  arr.length ? arr[Math.floor(Math.random() * arr.length)] : 'Loading...';

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ─────────────────────────────────────────────────────────────
// Text parsers
// ─────────────────────────────────────────────────────────────

const CANVAS_LANGUAGES = new Set([
  'html', 'css', 'javascript', 'js', 'typescript', 'ts',
  'jsx', 'tsx', 'react', 'typescript-react',
  'python', 'cpp', 'c', 'java', 'php', 'ruby',
  'go', 'rust', 'csharp', 'swift', 'kotlin', 'c++',
]);

/** Ekstrak semua code block dari teks markdown */
const extractCodeBlocks = (raw: any): { language: string; code: string; start: number; end: number }[] => {
  const text = ensureString(raw);
  const blocks: { language: string; code: string; start: number; end: number }[] = [];
  let pos = 0;

  while (pos < text.length) {
    const codeStart = text.indexOf('```', pos);
    if (codeStart === -1) break;

    const langStart = codeStart + 3;
    const langEnd = text.indexOf('\n', langStart);
    if (langEnd === -1) { pos = codeStart + 3; continue; }

    const language = text.slice(langStart, langEnd).trim();
    const contentStart = langEnd + 1;
    let codeEnd = -1;
    let search = contentStart;

    while (search < text.length) {
      const end = text.indexOf('```', search);
      if (end === -1) break;
      if (end === 0 || text[end - 1] === '\n') { codeEnd = end; break; }
      search = end + 3;
    }

    if (codeEnd === -1) break;
    blocks.push({ language: language || 'text', code: text.slice(contentStart, codeEnd).trim(), start: codeStart, end: codeEnd + 3 });
    pos = codeEnd + 3;
  }

  return blocks;
};

/** Parse AI response → komponen render (text | code | table) */
const parseAiResponse = (rawText: any) => {
  const text = ensureString(rawText);
  if (!text) return [];

  const components: { type: 'text' | 'code' | 'table'; content: any }[] = [];
  const rawCodeBlocks = extractCodeBlocks(text);
  const blocks: { type: 'code' | 'table'; start: number; end: number; data: any }[] = rawCodeBlocks.map(
    (b) => ({ type: 'code' as const, start: b.start, end: b.end, data: { language: b.language, code: b.code } })
  );

  // Tabel
  const tableRegex = /(\|[^\n]+\|\n\|[\s:|-]+\|\n(?:\|[^\n]+\|\n?)*)/g;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRegex.exec(text)) !== null) {
    const tStart = tableMatch.index;
    const tEnd = tStart + tableMatch[0].length;
    const insideCode = blocks.some((b) => b.type === 'code' && tStart >= b.start && tEnd <= b.end);
    if (insideCode) continue;

    try {
      const lines = tableMatch[1].trim().split('\n').filter(Boolean);
      if (lines.length < 2) continue;
      const headers = lines[0].split('|').map((h) => h.trim()).filter(Boolean);
      const rows = lines.slice(2).map((r) => r.split('|').map((c) => c.trim()).filter(Boolean)).filter((r) => r.length > 0);
      if (headers.length && rows.length) blocks.push({ type: 'table', start: tStart, end: tEnd, data: { headers, rows } });
    } catch (err) {
      console.error('[ChatMessage] Table parse error:', err);
    }
  }

  blocks.sort((a, b) => a.start - b.start);

  const cleanText = (raw: string) =>
    raw
      .replace(/^(#+)\s/gm, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/^\s*[-*]\s/gm, '• ')
      .trim();

  let cursor = 0;
  for (const block of blocks) {
    if (cursor < block.start) {
      const cleaned = cleanText(text.slice(cursor, block.start));
      if (cleaned) components.push({ type: 'text', content: cleaned });
    }
    components.push({ type: block.type, content: block.data });
    cursor = block.end;
  }

  if (cursor < text.length) {
    const cleaned = cleanText(text.slice(cursor));
    if (cleaned) components.push({ type: 'text', content: cleaned });
  }

  if (!components.length) {
    const cleaned = cleanText(text);
    if (cleaned) components.push({ type: 'text', content: cleaned });
  }

  return components;
};

/** Hanya ambil code files yang bisa di-render di canvas */
const extractCodeFiles = (rawText: any): CodeFile[] =>
  extractCodeBlocks(rawText)
    .filter((b) => CANVAS_LANGUAGES.has(b.language.toLowerCase()))
    .map(({ language, code }) => ({ language, content: code }));

/** Cek apakah ada React code */
const isReactCode = (files: CodeFile[]): boolean =>
  files.some(
    (f) =>
      ['jsx', 'tsx', 'react', 'typescript-react'].includes(f.language.toLowerCase()) ||
      /import\s+.*from\s+['"]react['"]/i.test(f.content)
  );

/** Ekstrak code block dari pesan user */
const extractUserCodeBlocks = (rawText: any): ParsedCodeBlock[] =>
  extractCodeBlocks(rawText).map((b, i) => ({ language: b.language, code: b.code, index: i }));

/** Hapus semua code block dari teks (untuk tampilan bubble user) */
const stripCodeBlocks = (text: string): string => {
  const blocks = extractCodeBlocks(text);
  if (!blocks.length) return text;

  let result = text;
  // Proses dari belakang supaya indeks tidak bergeser
  for (let i = blocks.length - 1; i >= 0; i--) {
    const { start, end } = blocks[i];
    result = result.slice(0, start) + result.slice(end);
  }
  return result.trim();
};

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

/** Modal preview gambar fullscreen */
const ImagePreviewModal: React.FC<{ preview: ImagePreview; onClose: () => void }> = ({
  preview,
  onClose,
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
    onClick={onClose}
  >
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <img
        src={preview.url}
        alt={preview.name}
        className="max-w-[90vw] max-h-[80vh] rounded-xl block shadow-2xl object-contain"
      />
      <button
        onClick={onClose}
        className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-lg hover:bg-gray-100 transition-colors"
        aria-label="Tutup preview"
      >
        <FiX size={15} />
      </button>
      <p className="text-center text-gray-400 text-xs mt-2 truncate max-w-[90vw]">
        {preview.name}
      </p>
    </div>
  </div>
);

/** Grid thumbnail attachment di atas bubble user */
const AttachmentStrip: React.FC<{
  attachments: MessageAttachment[];
  onImageClick: (preview: ImagePreview) => void;
}> = ({ attachments, onImageClick }) => (
  <div className="flex flex-wrap gap-2 justify-end mb-1 max-w-[85%] sm:max-w-2xl lg:max-w-4xl">
    {attachments.map((att, idx) =>
      att.type === 'image' && att.signedUrl ? (
        /* ── Thumbnail gambar ── */
        <div
          key={idx}
          className="relative group w-20 h-20 rounded-xl overflow-hidden border border-gray-600 cursor-pointer hover:border-blue-400 transition-colors flex-shrink-0"
          onClick={() => onImageClick({ name: att.name, url: att.signedUrl! })}
          title={att.name}
        >
          <img src={att.signedUrl} alt={att.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <FiMaximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" size={16} />
          </div>
        </div>
      ) : (
        /* ── Pill file non-gambar ── */
        <div
          key={idx}
          className="flex items-center gap-2 bg-gray-700/60 border border-gray-600 rounded-xl px-3 py-2 max-w-[180px]"
          title={att.name}
        >
          <div className="w-7 h-7 bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
            {att.type === 'image' ? (
              <FiImage className="text-gray-300" size={13} />
            ) : (
              <FiFile className="text-gray-300" size={13} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-white truncate font-medium">{att.name}</p>
            {att.size != null && (
              <p className="text-xs text-gray-500">{formatFileSize(att.size)}</p>
            )}
          </div>
        </div>
      )
    )}
  </div>
);

/** Modal expand code block dari pesan user */
const CodeBlockModal: React.FC<{ block: ParsedCodeBlock; onClose: () => void }> = ({
  block,
  onClose,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
    <div className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-gray-700 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
            <FiCode className="text-blue-400" size={16} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Code Preview</h3>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {block.language && (
                <span className="px-2 py-0.5 bg-gray-800 rounded">{block.language}</span>
              )}
              <span>{block.code.split('\n').length} lines</span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          <FiX size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4">
        <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-words bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          {block.code}
        </pre>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end px-4 py-3 border-t border-gray-700 bg-gray-800/30">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors text-sm font-medium"
        >
          Close
        </button>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isLoading,
  onResendMessage,
  onEditMessage,
  shouldHideButtons = false,
}) => {
  const { t } = useLocalization();

  // ── Local state ────────────────────────────────────────────
  const [isEditingLocal, setIsEditingLocal] = useState(false);
  const [editText, setEditText] = useState(() => ensureString(message.text));
  const [globalEditingId, setGlobalEditingId] = useState<string | null>(__globalEditingId);
  const [showCanvas, setShowCanvas] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(50);
  const [globalActiveCanvas, setGlobalActiveCanvas] = useState<string | null>(__globalActiveCanvasId);
  const [expandedUserBlock, setExpandedUserBlock] = useState<ParsedCodeBlock | null>(null);
  const [imagePreview, setImagePreview] = useState<ImagePreview | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');

  const messageText = ensureString(message.text);

  // ── Loading message rotator ────────────────────────────────
  useEffect(() => {
    if (!isLoading) return;
    const pick = () => {
      const msgs = t('loadingMessages');
      return getRandomItem(Array.isArray(msgs) ? msgs : ['Loading...']);
    };
    setLoadingMessage(pick());
    const interval = setInterval(() => setLoadingMessage(pick()), 18_000);
    return () => clearInterval(interval);
  }, [isLoading, t]);

  // ── Sync editText when message changes ────────────────────
  useEffect(() => {
    setEditText(ensureString(message.text));
  }, [message.text]);

  // ── Global edit sync ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<string | null>).detail;
      __globalEditingId = id;
      setGlobalEditingId(id);
      if (id !== message.id && isEditingLocal) {
        setIsEditingLocal(false);
        setEditText(messageText);
      }
    };
    window.addEventListener('chat-edit-change', handler);
    return () => window.removeEventListener('chat-edit-change', handler);
  }, [isEditingLocal, message.id, messageText]);

  // ── Global canvas sync ────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { messageId } = (e as CustomEvent).detail;
      setGlobalActiveCanvas(messageId ?? null);
      if (messageId && messageId !== message.id && showCanvas) setShowCanvas(false);
    };
    window.addEventListener('canvas-state-change', handler);
    return () => window.removeEventListener('canvas-state-change', handler);
  }, [message.id, showCanvas]);

  // ── Close canvas on settings/conversation change ──────────
  useEffect(() => {
    const close = () => { if (showCanvas) { setShowCanvas(false); EMIT_CANVAS_CHANGE(null, 0); } };
    window.addEventListener('settings-opened', close);
    window.addEventListener('conversation-changed', close);
    return () => {
      window.removeEventListener('settings-opened', close);
      window.removeEventListener('conversation-changed', close);
    };
  }, [showCanvas]);

  // ── Reset canvas when message id changes ──────────────────
  useEffect(() => {
    if (showCanvas) { setShowCanvas(false); EMIT_CANVAS_CHANGE(null, 0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id]);

  // ── Auto-open canvas for AI messages with code ────────────
  const codeFiles = useMemo(
    () => message.sender === MessageSender.AI ? extractCodeFiles(messageText) : [],
    [message.sender, messageText]
  );
  const hasCanvasContent = codeFiles.length > 0;
  const isReact = useMemo(() => isReactCode(codeFiles), [codeFiles]);

  useEffect(() => {
    if (!hasCanvasContent || isLoading || message.sender !== MessageSender.AI || __globalActiveCanvasId) return;
    setShowCanvas(false);
    const timer = setTimeout(() => { setShowCanvas(true); EMIT_CANVAS_CHANGE(message.id, canvasWidth); }, 50);
    return () => clearTimeout(timer);
  }, [message.id, hasCanvasContent, isLoading, message.sender, canvasWidth]);

  // ── Editing handlers ──────────────────────────────────────
  const startEditing = useCallback(() => {
    __globalEditingId = message.id;
    EMIT_EDIT_CHANGE(message.id);
    setIsEditingLocal(true);
  }, [message.id]);

  const stopEditing = useCallback((shouldReset = true) => {
    __globalEditingId = null;
    EMIT_EDIT_CHANGE(null);
    setIsEditingLocal(false);
    if (shouldReset) setEditText(messageText);
  }, [messageText]);

  const handleSaveEdit = useCallback(() => {
    if (onEditMessage && editText.trim()) onEditMessage(message.id, editText.trim());
    stopEditing(false);
  }, [onEditMessage, message.id, editText, stopEditing]);

  // ── Canvas handlers ───────────────────────────────────────
  const handleOpenCanvas = useCallback(() => {
    if (__globalActiveCanvasId && __globalActiveCanvasId !== message.id) EMIT_CANVAS_CHANGE(null, 0);
    setShowCanvas(true);
    EMIT_CANVAS_CHANGE(message.id, canvasWidth);
  }, [message.id, canvasWidth]);

  const handleCloseCanvas = useCallback(() => {
    setShowCanvas(false);
    EMIT_CANVAS_CHANGE(null, 0);
  }, []);

  const handleWidthChange = useCallback((width: number) => {
    setCanvasWidth(width);
    EMIT_CANVAS_CHANGE(message.id, width);
  }, [message.id]);

  // ── Derived ───────────────────────────────────────────────
  const anyEditingActive = Boolean(globalEditingId);
  const isThisCanvasActive = globalActiveCanvas === message.id;
  const userCodeBlocks = useMemo(
    () => message.sender === MessageSender.User ? extractUserCodeBlocks(messageText) : [],
    [message.sender, messageText]
  );
  const userDisplayText = useMemo(
    () => userCodeBlocks.length ? stripCodeBlocks(messageText) : messageText,
    [userCodeBlocks, messageText]
  );
  const aiResponseParts = useMemo(
    () => message.sender === MessageSender.AI && !isLoading ? parseAiResponse(messageText) : [],
    [message.sender, isLoading, messageText]
  );
  const hasAttachments = Boolean(message.attachments?.length);

  // ─────────────────────────────────────────────────────────
  // Render — User message
  // ─────────────────────────────────────────────────────────

  if (message.sender === MessageSender.User) {
    return (
      <>
        <div className="flex flex-col items-end gap-2">

          {/* Attachment thumbnails */}
          {hasAttachments && !isEditingLocal && (
            <AttachmentStrip
              attachments={message.attachments!}
              onImageClick={setImagePreview}
            />
          )}

          {/* User code blocks */}
          {userCodeBlocks.length > 0 && !isEditingLocal && (
            <div className="w-full flex justify-end">
              <div className="grid gap-2 mb-2 grid-cols-2 lg:grid-cols-3 max-w-[85%] sm:max-w-2xl lg:max-w-4xl">
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
                            onClick={(e) => { e.stopPropagation(); setExpandedUserBlock(block); }}
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

          {/* Message bubble */}
          <div className="flex items-start gap-3 sm:gap-4 justify-end w-full">
            <div
              className={`transition-all duration-200 ${
                isEditingLocal
                  ? 'w-full sm:w-3/4 bg-blue-700/70'
                  : 'max-w-[85%] sm:max-w-xl lg:max-w-3xl bg-blue-600'
              } px-4 sm:px-5 py-3 rounded-2xl rounded-br-none`}
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
                      <FiX size={14} />{t('cancel')}
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white text-blue-600 hover:brightness-95 transition"
                    >
                      <FiCheck size={14} />{t('save')}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words text-white text-sm sm:text-base leading-relaxed">
                  {userDisplayText}
                </p>
              )}
            </div>

            <div className="hidden md:flex w-8 h-8 rounded-full bg-gray-700 items-center justify-center overflow-hidden flex-shrink-0">
              <FiUser size={18} />
            </div>
          </div>

          {/* Action buttons */}
          {!isEditingLocal && !shouldHideButtons && (
            <div className="flex text-xs md:mr-10">
              <button
                onClick={() => onResendMessage(messageText)}
                disabled={anyEditingActive}
                className={`flex items-center px-2.5 py-1.5 rounded-lg transition ${
                  anyEditingActive
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
                className={`flex items-center px-2.5 py-1.5 rounded-lg transition ${
                  anyEditingActive
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

        {/* Code block expand modal */}
        {expandedUserBlock && (
          <CodeBlockModal block={expandedUserBlock} onClose={() => setExpandedUserBlock(null)} />
        )}

        {/* Image preview modal */}
        {imagePreview && (
          <ImagePreviewModal preview={imagePreview} onClose={() => setImagePreview(null)} />
        )}
      </>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Render — AI loading
  // ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="max-w-[85%] sm:max-w-xl lg:max-w-3xl px-4 sm:px-5 py-3 rounded-2xl bg-gray-700 rounded-bl-none">
          <p className="text-gray-400 text-sm animate-pulse">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Render — AI message
  // ─────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="max-w-[100%] sm:max-w-xl lg:max-w-3xl w-full py-3">
            <div className="flex flex-col gap-4 text-white text-sm sm:text-base">
              {aiResponseParts.map((part, index) => {
                if (part.type === 'text') {
                  return (
                    <p key={index} className="whitespace-pre-wrap break-words leading-relaxed">
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

        {/* Open canvas button */}
        {hasCanvasContent && !shouldHideButtons && !isThisCanvasActive && (
          <div className="flex text-xs">
            <button
              onClick={handleOpenCanvas}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition text-gray-400 hover:text-white hover:bg-gray-700/50"
              title={t('openCanvas')}
            >
              <FiMaximize2 size={13} />{t('openCanvas')}
            </button>
          </div>
        )}
      </div>

      {/* Canvas */}
      {isThisCanvasActive && hasCanvasContent && (
        isReact ? (
          <ReactPreviewCanvas files={codeFiles} onClose={handleCloseCanvas} onWidthChange={handleWidthChange} />
        ) : (
          <VibeCodingCanvas files={codeFiles} onClose={handleCloseCanvas} onWidthChange={handleWidthChange} />
        )
      )}
    </>
  );
};