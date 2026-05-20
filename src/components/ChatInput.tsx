import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { FiX, FiMaximize2, FiCode, FiPlus, FiUpload, FiCamera, FiFile, FiImage } from 'react-icons/fi';

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: UploadedFile[]) => void;
  isLoading: boolean;
}

interface CodeBlock {
  id: string;
  content: string;
  language?: string;
  lineCount: number;
}

interface UploadedFile {
  id: string;
  file: File;
  previewUrl?: string; // for images
  type: 'image' | 'file';
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading }) => {
  const [text, setText] = useState('');
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>([]);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { t } = useLocalization();

  // Computed once as a stable ref — avoids recalculating on every re-render
  const isMobile = useRef(/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)).current;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Stop camera stream on modal close
  useEffect(() => {
    if (!showCameraModal && cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
  }, [showCameraModal]);

  // Start camera when modal opens
  useEffect(() => {
    if (showCameraModal) {
      setCameraError(null);
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .then(stream => {
          setCameraStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          setCameraError('Tidak dapat mengakses kamera. Pastikan izin kamera diaktifkan.');
        });
    }
  }, [showCameraModal]);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const isImage = file.type.startsWith('image/');
      const newFile: UploadedFile = {
        id: Date.now().toString() + Math.random(),
        file,
        type: isImage ? 'image' : 'file',
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
      };
      setUploadedFiles(prev => [...prev, newFile]);
    });
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  // Capture photo from desktop camera modal
  const handleCapturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const previewUrl = URL.createObjectURL(blob);
      setUploadedFiles(prev => [
        ...prev,
        { id: Date.now().toString(), file, type: 'image', previewUrl },
      ]);
      setShowCameraModal(false);
    }, 'image/jpeg', 0.92);
  }, []);

  const removeUploadedFile = (id: string) => {
    setUploadedFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
      return prev.filter(f => f.id !== id);
    });
  };

  // ─── Language detection (unchanged) ──────────────────────────────────────
  const detectLanguage = (content: string): string | undefined => {
    const patterns: Record<string, RegExp[]> = {
      c: [/#include\s*<stdio\.h>/, /#include\s*<stdlib\.h>/, /int\s+main\s*\(/, /printf\s*\(/, /scanf\s*\(/],
      cpp: [/#include\s*<iostream>/, /std::/, /cout\s*<</, /cin\s*>>/, /namespace\s+/],
      java: [/public\s+class\s+\w+/, /public\s+static\s+void\s+main/, /System\.out\.println/, /import\s+java\./],
      python: [/def\s+\w+\s*\(/, /import\s+\w+/, /print\s*\(/, /if\s+__name__\s*==/, /class\s+\w+\s*:/],
      javascript: [/function\s+\w+\s*\(/, /const\s+\w+\s*=/, /let\s+\w+\s*=/, /=>\s*{/, /console\.log\(/],
      typescript: [/interface\s+\w+/, /type\s+\w+\s*=/, /:\s*(string|number|boolean|any)\s*[;,)]/, /enum\s+\w+/],
      pascal: [/program\s+\w+\s*;/i, /begin\s*$/mi, /end\s*\./mi, /writeln\s*\(/i, /readln\s*\(/i],
      html: [/<!DOCTYPE\s+html>/i, /<html[^>]*>/, /<head>/, /<body>/],
      css: [/\{\s*[^}]*:\s*[^}]*;/, /\.[\w-]+\s*\{/, /@media\s+/],
      sql: [/SELECT\s+/i, /FROM\s+\w+/i, /WHERE\s+/i, /INSERT\s+INTO/i],
    };
    const scores: Record<string, number> = {};
    for (const [lang, regexes] of Object.entries(patterns)) {
      scores[lang] = regexes.filter(r => r.test(content)).length;
    }
    const [best] = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return best && best[1] >= 2 ? best[0] : undefined;
  };

  const isLikelyCode = (content: string): boolean => {
    const lines = content.split('\n');
    if (lines.length < 3) return false;
    const indicators = [
      /^\s*(if|else|for|while|do|switch|case)\s*[\(\{]/,
      /^\s*(function|def|void|int|float|double|char|string|boolean|public|private|protected)\s+\w+/,
      /^\s*(const|let|var|int|float|double|char|string|auto)\s+\w+/,
      /^\s*#(include|define|ifdef|ifndef|endif|pragma)/,
      /[{}\[\]();]/, /^\s{2,}[\w\S]/, /^\s*(\/\/|\/\*|\*\/|#|<!--)/,
      /=>\s*[{(]/, /:\s*$/, /;\s*$/, /^\s*(import|from|using|include|require)\s+/,
    ];
    const count = lines.filter(l => indicators.some(p => p.test(l))).length;
    return count >= Math.max(Math.ceil(lines.length * 0.4), 3);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText.length > 150 && isLikelyCode(pastedText)) {
      e.preventDefault();
      const newBlock: CodeBlock = {
        id: Date.now().toString(),
        content: pastedText,
        language: detectLanguage(pastedText),
        lineCount: pastedText.split('\n').length,
      };
      setCodeBlocks(prev => [...prev, newBlock]);
      setText(t => t + (t ? '\n\n' : '') + `[Code Block ${codeBlocks.length + 1}]`);
    }
  };

  const removeCodeBlock = (id: string) => {
    const blockIndex = codeBlocks.findIndex(b => b.id === id);
    setCodeBlocks(prev => prev.filter(b => b.id !== id));
    if (blockIndex !== -1) {
      setText(t => t.replace(`[Code Block ${blockIndex + 1}]`, '').trim());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((text.trim() || codeBlocks.length > 0 || uploadedFiles.length > 0) && !isLoading) {
      let finalMessage = text;
      codeBlocks.forEach((block, i) => {
        finalMessage = finalMessage.replace(
          `[Code Block ${i + 1}]`,
          `\n\n\`\`\`${block.language || ''}\n${block.content}\n\`\`\``
        );
      });
      onSendMessage(finalMessage, uploadedFiles);
      setText('');
      setCodeBlocks([]);
      uploadedFiles.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
      setUploadedFiles([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [text]);

  const expandedBlockData = codeBlocks.find(b => b.id === expandedBlock);

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="relative">

        {/* ── Uploaded Files Preview (above input) ───────────────────── */}
        {uploadedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {uploadedFiles.map(uf => (
              <div
                key={uf.id}
                className="relative group flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden"
                style={{ maxWidth: '160px' }}
              >
                {uf.type === 'image' && uf.previewUrl ? (
                  /* Image thumbnail */
                  <div className="relative w-20 h-20 flex-shrink-0">
                    <img
                      src={uf.previewUrl}
                      alt={uf.file.name}
                      className="w-full h-full object-cover"
                    />
                    {/* Remove button overlay */}
                    <button
                      type="button"
                      onClick={() => removeUploadedFile(uf.id)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-900/80 flex items-center justify-center text-gray-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <FiX size={11} />
                    </button>
                  </div>
                ) : (
                  /* Non-image file pill */
                  <div className="flex items-center gap-2 px-3 py-2 w-full">
                    <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FiFile className="text-gray-300" size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white truncate font-medium">{uf.file.name}</p>
                      <p className="text-xs text-gray-500">{formatSize(uf.file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeUploadedFile(uf.id)}
                      className="p-1 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                    >
                      <FiX size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Code Block Previews ────────────────────────────────────── */}
        {codeBlocks.length > 0 && (
          <div className="mb-2 space-y-2">
            {codeBlocks.map((block, index) => (
              <div key={block.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 relative group">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                      <FiCode className="text-gray-300" size={20} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-300">{t('codeBlock')} {index + 1}</span>
                      {block.language && (
                        <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded">{block.language}</span>
                      )}
                      <span className="text-xs text-gray-500">{block.lineCount} {t('lines')}</span>
                    </div>
                    <pre className="text-xs text-gray-400 font-mono overflow-hidden max-h-16 line-clamp-3">{block.content}</pre>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setExpandedBlock(block.id)}
                      className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                      <FiMaximize2 size={16} />
                    </button>
                    <button type="button" onClick={() => removeCodeBlock(block.id)}
                      className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                      <FiX size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Text Input row ─────────────────────────────────────────── */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={t('sendMessagePlaceholder', { appName: t('appName') })}
            className="w-full bg-gray-800 text-white rounded-xl py-3 pl-12 pr-14 border border-gray-700 focus:ring-2 focus:ring-gray-500 focus:outline-none resize-none transition-shadow overflow-hidden"
            rows={1}
            disabled={isLoading}
            style={{ minHeight: '48px', maxHeight: '160px' }}
          />

          {/* + button & dropdown */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2" ref={attachMenuRef}>
            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-20 animate-[fadeSlideUp_0.15s_ease-out]">
                {/* Upload File */}
                <button
                  type="button"
                  onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FiUpload className="text-gray-300" size={16} />
                  </div>
                  <span>Upload File</span>
                </button>

                <div className="h-px bg-gray-700 mx-3" />

                {/* Camera */}
                <button
                  type="button"
                  onClick={() => {
                    // Close menu first, then trigger after a tick so the
                    // hidden input stays mounted when .click() fires on mobile
                    setShowAttachMenu(false);
                    setTimeout(() => {
                      if (isMobile) {
                        cameraInputRef.current?.click();
                      } else {
                        setShowCameraModal(true);
                      }
                    }, 50);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FiCamera className="text-gray-300" size={16} />
                  </div>
                  <span>Kamera</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowAttachMenu(prev => !prev)}
              className={`w-7 h-7 rounded-full mb-1 flex items-center justify-center transition-all duration-200
                ${showAttachMenu ? 'bg-gray-500 text-white rotate-45' : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'}`}
              title="Tambah lampiran"
            >
              <FiPlus size={16} />
            </button>
          </div>

          {/* Hidden inputs — always mounted outside the dropdown so .click() works reliably on mobile */}
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

          {/* Send button */}
          <button
            type="submit"
            disabled={isLoading || (!text.trim() && codeBlocks.length === 0 && uploadedFiles.length === 0)}
            className="absolute right-3 top-6 -translate-y-1/2 p-2 rounded-full bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-white">
              <path d="M3.105 3.105a.75.75 0 01.956-.042l13.5 8.25a.75.75 0 010 1.372l-13.5 8.25a.75.75 0 01-1.11-.849L4.852 12.5H9.25a.75.75 0 000-1.5H4.852l-1.9-4.34a.75.75 0 01.153-.956z" />
            </svg>
          </button>
        </div>
      </form>

      {/* ── Desktop Camera Modal ───────────────────────────────────── */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg border border-gray-700 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <FiCamera className="text-gray-300" size={18} />
                <h3 className="text-sm font-medium text-white">Ambil Foto</h3>
              </div>
              <button
                onClick={() => setShowCameraModal(false)}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Camera view */}
            <div className="relative bg-black aspect-video flex items-center justify-center">
              {cameraError ? (
                <div className="text-center px-6">
                  <FiCamera className="text-gray-600 mx-auto mb-3" size={40} />
                  <p className="text-sm text-gray-400">{cameraError}</p>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-center gap-3 px-4 py-4 bg-gray-900">
              <button
                type="button"
                onClick={() => setShowCameraModal(false)}
                className="px-5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors text-sm"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCapturePhoto}
                disabled={!!cameraError}
                className="px-6 py-2 rounded-xl bg-white hover:bg-gray-200 text-gray-900 font-medium transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <FiCamera size={15} />
                Ambil Foto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Code Block Expand Modal ────────────────────────────────── */}
      {expandedBlock && expandedBlockData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-gray-700 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                  <FiCode className="text-gray-300" size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">{t('codePreview')}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {expandedBlockData.language && (
                      <span className="px-2 py-0.5 bg-gray-800 rounded">{expandedBlockData.language}</span>
                    )}
                    <span>{expandedBlockData.lineCount} {t('lines')}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setExpandedBlock(null)}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-words bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                {expandedBlockData.content}
              </pre>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-700 bg-gray-800/30">
              <button onClick={() => { removeCodeBlock(expandedBlockData.id); setExpandedBlock(null); }}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors text-sm font-medium">
                {t('remove')}
              </button>
              <button onClick={() => setExpandedBlock(null)}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors text-sm font-medium">
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};