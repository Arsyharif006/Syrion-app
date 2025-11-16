import React, { useState, useRef, useEffect } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { FiX, FiMaximize2, FiCode } from 'react-icons/fi';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

interface CodeBlock {
  id: string;
  content: string;
  language?: string;
  lineCount: number;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading }) => {
  const [text, setText] = useState('');
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>([]);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useLocalization();

  // Deteksi bahasa pemrograman dari content
  const detectLanguage = (content: string): string | undefined => {
    const patterns: Record<string, RegExp[]> = {
      c: [
        /#include\s*<stdio\.h>/,
        /#include\s*<stdlib\.h>/,
        /#include\s*<string\.h>/,
        /int\s+main\s*\(\s*(void)?\s*\)/,
        /printf\s*\(/,
        /scanf\s*\(/,
        /void\s+\w+\s*\(/,
      ],
      cpp: [
        /#include\s*<iostream>/,
        /#include\s*<vector>/,
        /#include\s*<string>/,
        /std::/,
        /cout\s*<</,
        /cin\s*>>/,
        /namespace\s+/,
        /class\s+\w+/,
      ],
      java: [
        /public\s+class\s+\w+/,
        /private\s+(static\s+)?\w+/,
        /public\s+static\s+void\s+main/,
        /System\.out\.println/,
        /import\s+java\./,
      ],
      python: [
        /def\s+\w+\s*\(/,
        /import\s+\w+/,
        /from\s+\w+\s+import/,
        /print\s*\(/,
        /if\s+__name__\s*==\s*['"]__main__['"]/,
        /class\s+\w+\s*:/,
      ],
      javascript: [
        /function\s+\w+\s*\(/,
        /const\s+\w+\s*=/,
        /let\s+\w+\s*=/,
        /var\s+\w+\s*=/,
        /=>\s*{/,
        /console\.log\(/,
        /import\s+.*from\s+['"]/,
        /export\s+(default|const|function)/,
      ],
      typescript: [
        /interface\s+\w+/,
        /type\s+\w+\s*=/,
        /:\s*(string|number|boolean|any)\s*[;,)]/,
        /import\s+.*from\s+['"].*['"]\s*;/,
        /<\w+>/,
        /enum\s+\w+/,
      ],
      pascal: [
        /program\s+\w+\s*;/i,
        /begin\s*$/mi,
        /end\s*\./mi,
        /writeln\s*\(/i,
        /readln\s*\(/i,
        /var\s+\w+\s*:\s*(integer|string|real|boolean)/i,
        /procedure\s+\w+/i,
        /function\s+\w+.*:\s*\w+/i,
      ],
      html: [
        /<!DOCTYPE\s+html>/i,
        /<html[^>]*>/,
        /<head>/,
        /<body>/,
        /<div[^>]*>/,
      ],
      css: [
        /\{\s*[^}]*:\s*[^}]*;/,
        /\.[\w-]+\s*\{/,
        /@media\s+/,
        /background(-color)?:/,
        /\.[\w-]+:hover/,
      ],
      json: [
        /^\s*\{[\s\S]*\}\s*$/,
        /^\s*\[[\s\S]*\]\s*$/,
        /"[\w]+"\s*:\s*(".*"|[\d.]+|true|false|null)/,
      ],
      sql: [
        /SELECT\s+/i,
        /FROM\s+\w+/i,
        /WHERE\s+/i,
        /INSERT\s+INTO/i,
        /CREATE\s+TABLE/i,
        /UPDATE\s+\w+\s+SET/i,
      ],
    };

    // Hitung skor untuk setiap bahasa
    const scores: Record<string, number> = {};
    
    for (const [lang, regexes] of Object.entries(patterns)) {
      scores[lang] = 0;
      for (const regex of regexes) {
        if (regex.test(content)) {
          scores[lang]++;
        }
      }
    }

    // Cari bahasa dengan skor tertinggi
    let maxScore = 0;
    let detectedLang: string | undefined;

    for (const [lang, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedLang = lang;
      }
    }

    // Hanya return jika skor minimal 2 (untuk menghindari false positive)
    return maxScore >= 2 ? detectedLang : undefined;
  };

  // Deteksi apakah text adalah code (multi-line atau punya syntax tertentu)
  const isLikelyCode = (content: string): boolean => {
    const lines = content.split('\n');
    
    // Minimal 3 baris untuk dianggap code block
    if (lines.length < 3) return false;

    // Cek indikator code yang lebih spesifik
    const codeIndicators = [
      // Control structures
      /^\s*(if|else|for|while|do|switch|case)\s*[\(\{]/,
      // Function/method declarations
      /^\s*(function|def|void|int|float|double|char|string|boolean|public|private|protected)\s+\w+/,
      // Variable declarations
      /^\s*(const|let|var|int|float|double|char|string|auto)\s+\w+/,
      // Preprocessor directives
      /^\s*#(include|define|ifdef|ifndef|endif|pragma)/,
      // Common programming symbols
      /[{}\[\]();]/,
      // Indentasi konsisten (2+ spasi atau tab)
      /^\s{2,}[\w\S]/,
      // Comments
      /^\s*(\/\/|\/\*|\*\/|#|<!--)/,
      // Arrow functions
      /=>\s*[{(]/,
      // Colon at end (Python, Pascal)
      /:\s*$/,
      // Assignment operators
      /\s*[=+\-*\/]=?\s*/,
      // Semicolons (C-style languages)
      /;\s*$/,
      // Imports/includes
      /^\s*(import|from|using|include|require)\s+/,
    ];

    // Hitung berapa banyak baris yang cocok dengan indikator code
    const codeLineCount = lines.filter(line => 
      codeIndicators.some(pattern => pattern.test(line))
    ).length;

    // Minimal 40% baris harus cocok dengan indikator code, atau minimal 3 baris
    const threshold = Math.max(Math.ceil(lines.length * 0.4), 3);
    
    return codeLineCount >= threshold;
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    
    if (pastedText.length > 150 && isLikelyCode(pastedText)) {
      e.preventDefault();
      
      const newBlock: CodeBlock = {
        id: Date.now().toString(),
        content: pastedText,
        language: detectLanguage(pastedText),
        lineCount: pastedText.split('\n').length
      };

      setCodeBlocks(prev => [...prev, newBlock]);
      
      // Tambahkan placeholder di textarea
      const placeholder = `[Code Block ${codeBlocks.length + 1}]`;
      const newText = text + (text ? '\n\n' : '') + placeholder;
      setText(newText);
    }
  };

  const removeCodeBlock = (id: string) => {
    setCodeBlocks(prev => prev.filter(block => block.id !== id));
    // Remove placeholder from text
    const blockIndex = codeBlocks.findIndex(b => b.id === id);
    if (blockIndex !== -1) {
      const placeholder = `[Code Block ${blockIndex + 1}]`;
      setText(text.replace(placeholder, '').trim());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((text.trim() || codeBlocks.length > 0) && !isLoading) {
      let finalMessage = text;
      
      // Gabungkan code blocks ke dalam message
      codeBlocks.forEach((block, index) => {
        const codeSection = `\n\n\`\`\`${block.language || ''}\n${block.content}\n\`\`\``;
        const placeholder = `[Code Block ${index + 1}]`;
        finalMessage = finalMessage.replace(placeholder, codeSection);
      });

      onSendMessage(finalMessage);
      setText('');
      setCodeBlocks([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 160); // Max 160px (~5 lines)
      textareaRef.current.style.height = newHeight + 'px';
    }
  }, [text]);

  const expandedBlockData = codeBlocks.find(b => b.id === expandedBlock);

  return (
    <>
      <form onSubmit={handleSubmit} className="relative">
        {/* Code Block Previews */}
        {codeBlocks.length > 0 && (
          <div className="mb-2 space-y-2">
            {codeBlocks.map((block, index) => (
              <div
                key={block.id}
                className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 relative group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                      <FiCode className="text-blue-400" size={20} />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-300">
                        {t('codeBlock')} {index + 1}
                      </span>
                      {block.language && (
                        <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded">
                          {block.language}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {block.lineCount} {t('lines')}
                      </span>
                    </div>
                    
                    <pre className="text-xs text-gray-400 font-mono overflow-hidden max-h-16 line-clamp-3">
                      {block.content}
                    </pre>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setExpandedBlock(block.id)}
                      className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                      title={t('expandCodeBlock')}
                    >
                      <FiMaximize2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCodeBlock(block.id)}
                      className="p-1.5 rounded hover:bg-red-600/20 text-gray-400 hover:text-red-400 transition-colors"
                      title={t('removeCodeBlock')}
                    >
                      <FiX size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Text Input */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={t('sendMessagePlaceholder', { appName: t('appName') })}
            className="w-full bg-gray-800 text-white rounded-xl py-3 pl-4 pr-14 border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none transition-shadow overflow-hidden"
            rows={1}
            disabled={isLoading}
            style={{ minHeight: '48px', maxHeight: '160px' }}
          />
          <button
            type="submit"
            disabled={isLoading || (!text.trim() && codeBlocks.length === 0)}
            className="absolute right-3 top-6 -translate-y-1/2 p-2 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-white">
              <path d="M3.105 3.105a.75.75 0 01.956-.042l13.5 8.25a.75.75 0 010 1.372l-13.5 8.25a.75.75 0 01-1.11-.849L4.852 12.5H9.25a.75.75 0 000-1.5H4.852l-1.9-4.34a.75.75 0 01.153-.956z" />
            </svg>
          </button>
        </div>
      </form>

      {/* Expanded Modal */}
      {expandedBlock && expandedBlockData && (
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
                    {t('codePreview')}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {expandedBlockData.language && (
                      <span className="px-2 py-0.5 bg-gray-800 rounded">
                        {expandedBlockData.language}
                      </span>
                    )}
                    <span>{expandedBlockData.lineCount} {t('lines')}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setExpandedBlock(null)}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-words bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                {expandedBlockData.content}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-700 bg-gray-800/30">
              <button
                onClick={() => {
                  removeCodeBlock(expandedBlockData.id);
                  setExpandedBlock(null);
                }}
                className="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 transition-colors text-sm font-medium"
              >
                {t('remove')}
              </button>
              <button
                onClick={() => setExpandedBlock(null)}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors text-sm font-medium"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};