import React, { useState, useMemo, useEffect } from 'react';
import { FiCode, FiEye, FiX, FiChevronDown, FiCopy, FiCheck, FiPlay, FiLoader, FiAlertCircle, FiInfo, FiEyeOff } from 'react-icons/fi';
import { useLocalization } from '../contexts/LocalizationContext';

interface CodeFile {
  language: string;
  content: string;
}

interface VibeCodingCanvasProps {
  files: CodeFile[];
  onClose: () => void;
  onWidthChange?: (width: number) => void;
}

const SUPPORTED_LANGUAGES = {
  python: { runtime: 'python', version: '3.10.0', name: 'Python' },
  cpp: { runtime: 'c++', version: '10.2.0', name: 'C++', alias: ['c++'] },
  c: { runtime: 'c', version: '10.2.0', name: 'C' },
  java: { runtime: 'java', version: '15.0.2', name: 'Java' },
  javascript: { runtime: 'javascript', version: '18.15.0', name: 'JavaScript', alias: ['js'] },
  typescript: { runtime: 'typescript', version: '5.0.3', name: 'TypeScript', alias: ['ts'] },
  php: { runtime: 'php', version: '8.2.3', name: 'PHP' },
  ruby: { runtime: 'ruby', version: '3.0.1', name: 'Ruby' },
  go: { runtime: 'go', version: '1.16.2', name: 'Go' },
  rust: { runtime: 'rust', version: '1.68.2', name: 'Rust' },
  csharp: { runtime: 'csharp', version: '6.12.0', name: 'C#' },
  swift: { runtime: 'swift', version: '5.3.3', name: 'Swift' },
  kotlin: { runtime: 'kotlin', version: '1.8.20', name: 'Kotlin' }
};

// Preview Component untuk HTML
const PreviewPane: React.FC<{ html: string; css: string; js: string }> = ({ html, css, js }) => {
  const srcDoc = useMemo(() => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${css}</style>
        </head>
        <body>${html}</body>
        <script>${js}<\/script>
      </html>
    `;
  }, [html, css, js]);

  return (
    <div className="w-full h-full bg-white">
      <iframe
        srcDoc={srcDoc}
        title="preview"
        sandbox="allow-scripts"
        frameBorder="0"
        width="100%"
        height="100%"
        className="w-full h-full"
      />
    </div>
  );
};

// Code Execute Component untuk bahasa pemrograman
const CodeExecutor: React.FC<{ 
  file: { language: string; content: string };
  allFiles?: { language: string; content: string }[];
}> = ({ file, allFiles = [] }) => {
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const [hasRun, setHasRun] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [needsInput, setNeedsInput] = useState(false);
  const { t } = useLocalization();

  const normalizedLang = file.language.toLowerCase();

  // Deteksi apakah code memerlukan input
  useEffect(() => {
    const codeToCheck = file.content;
    const inputPatterns = [
      /scanf/i,
      /cin\s*>>/i,
      /input\s*\(/i,
      /Scanner/i,
      /readLine/i,
      /gets/i,
      /readline/i,
      /Console\.ReadLine/i,
    ];
    
    const hasInputPattern = inputPatterns.some(pattern => pattern.test(codeToCheck));
    setNeedsInput(hasInputPattern);
    
    if (hasInputPattern && !hasRun) {
      setShowInput(true);
    }
  }, [file.content, hasRun]);

  const getFileName = (lang: string): string => {
    const extensions: Record<string, string> = {
      python: 'main.py',
      cpp: 'main.cpp',
      'c++': 'main.cpp',
      c: 'main.c',
      java: 'Main.java',
      javascript: 'main.js',
      js: 'main.js',
      typescript: 'main.ts',
      ts: 'main.ts',
      php: 'main.php',
      ruby: 'main.rb',
      go: 'main.go',
      rust: 'main.rs',
      csharp: 'Main.cs',
      swift: 'main.swift',
      kotlin: 'Main.kt'
    };
    return extensions[lang] || 'main.txt';
  };

  const getInputExample = () => {
    const examples: Record<string, string> = {
      c: t('inputExampleC') || 'Example for scanf("%d %d", &a, &b):\n5 10\n\nOr one per line:\n5\n10',
      cpp: t('inputExampleCpp') || 'Example for cin >> a >> b:\n5 10\n\nOr one per line:\n5\n10',
      'c++': t('inputExampleCpp') || 'Example for cin >> a >> b:\n5 10\n\nOr one per line:\n5\n10',
      python: t('inputExamplePython') || 'Example for input():\nJohn\n25\nNew York',
      java: t('inputExampleJava') || 'Example for Scanner:\n42\nHello World',
    };
    return examples[normalizedLang] || t('enterInput');
  };

  const getLangConfig = (lang: string) => {
    // Cek apakah lang adalah alias
    for (const [key, config] of Object.entries(SUPPORTED_LANGUAGES)) {
      if (key === lang || (config.alias && config.alias.includes(lang))) {
        return config;
      }
    }
    return null;
  };

  const runCode = async () => {
    setIsRunning(true);
    setError('');
    setOutput('');
    setHasRun(true);

    const langConfig = getLangConfig(normalizedLang);
    
    if (!langConfig) {
      setError(t('languageNotSupported') || `Language "${file.language}" is not supported for execution`);
      setIsRunning(false);
      return;
    }

    try {
      const response = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: langConfig.runtime,
          version: langConfig.version,
          files: [
            {
              name: getFileName(normalizedLang),
              content: file.content
            }
          ],
          stdin: userInput,
          args: [],
          compile_timeout: 10000,
          run_timeout: 3000
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.run) {
        const stdout = data.run.stdout || '';
        const stderr = data.run.stderr || '';
        const compile_output = data.compile?.output || '';
        
        if (compile_output && compile_output.trim()) {
          setError(`Compilation Error:\n${compile_output}`);
        } else if (stderr && !stdout) {
          setError(stderr);
        } else {
          const combinedOutput = stdout + (stderr ? '\n' + stderr : '');
          if (combinedOutput.trim()) {
            setOutput(combinedOutput);
          } else {
            setOutput(t('programSuccess'));
          }
        }
      } else {
        setError(data.message || t('failedToExecute') || 'Failed to execute code');
      }
    } catch (err) {
      setError(`${t('error')}: ${err instanceof Error ? err.message : t('unknownError') || 'Unknown error occurred'}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="w-full h-full bg-gray-900 text-white flex flex-col">
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            {getLangConfig(normalizedLang)?.name || file.language} {t('output')}
          </span>
          {needsInput && (
            <button
              onClick={() => setShowInput(!showInput)}
              title={showInput ? t('hideInput') : t('showInput')}
              className={`p-2 rounded-lg transition-colors ${
                showInput 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {showInput ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          )}
        </div>
        <button
          onClick={runCode}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-medium"
        >
          {isRunning ? (
            <>
              <FiLoader className="animate-spin" size={16} />
              {t('running')}
            </>
          ) : (
            <>
              <FiPlay size={16} />
              {t('runCode')}
            </>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {showInput && (
          <div className="bg-gray-800 rounded-lg p-4 mb-4 border-2 border-blue-500/30">
            <div className="flex items-start gap-2 mb-3">
              <FiInfo className="text-blue-400 flex-shrink-0 mt-1" size={18} />
              <div className="flex-1">
                <label className="block text-sm font-semibold text-blue-400 mb-1">
                  Prepare All Inputs Before Running
                </label>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Enter all input data your program needs. Each input should be on a new line.
                </p>
              </div>
            </div>
            
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={getInputExample()}
              className="w-full bg-gray-900 text-white rounded border border-gray-700 p-3 font-mono text-sm resize-y min-h-[100px] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            
            <div className="mt-3 bg-gray-900/50 rounded p-3 border border-gray-700/50">
              <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                How it works
              </p>
              <ul className="text-xs text-gray-500 space-y-1.5 ml-3">
                <li>• All inputs must be entered before clicking "Run Code"</li>
                <li>• Each line will be used sequentially when program asks for input</li>
                <li>• Make sure you provide enough inputs for all prompts</li>
              </ul>
            </div>
          </div>
        )}

        {needsInput && !hasRun && (
          <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-lg p-3 mb-4 flex items-start gap-2">
            <FiInfo className="text-yellow-400 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-sm text-yellow-400">
              {t('thisCodeNeedsInput')}
            </p>
          </div>
        )}

        {!hasRun && !showInput && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <FiPlay className="mx-auto mb-2" size={32} />
              <p>{t('clickToRun')}</p>
            </div>
          </div>
        )}

        {!hasRun && showInput && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <FiPlay className="mx-auto mb-2" size={32} />
              <p>{t('enterInputsAndRun')}</p>
            </div>
          </div>
        )}

        {hasRun && isRunning && (
          <div className="flex items-center gap-2 text-gray-400">
            <FiLoader className="animate-spin" />
            <span>{t('executingCode')}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <FiAlertCircle className="text-red-400 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <p className="font-semibold text-red-400 mb-1">{t('error')}</p>
                <pre className="text-sm text-red-300 whitespace-pre-wrap font-mono break-words">
                  {error}
                </pre>
              </div>
            </div>
          </div>
        )}

        {output && !isRunning && (
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">{t('output')}:</p>
            <pre className="text-sm text-green-400 whitespace-pre-wrap font-mono leading-relaxed break-words">
              {output}
            </pre>
          </div>
        )}
      </div>

      <div className="bg-gray-800 px-4 py-2 border-t border-gray-700 text-xs text-gray-500 flex-shrink-0">
        {t('poweredByPiston')}
      </div>
    </div>
  );
};

// File Dropdown Component
const FileDropdown: React.FC<{
  files: { name: string; content: string; language: string }[];
  activeIndex: number;
  onSelect: (index: number) => void;
}> = ({ files, activeIndex, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.file-dropdown')) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative file-dropdown z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
      >
        <span>{files[activeIndex]?.name}</span>
        <FiChevronDown 
          size={16} 
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-gray-700 rounded shadow-lg border border-gray-600 min-w-[200px] z-10 max-h-64 overflow-y-auto">
          {files.map((file, index) => (
            <button
              key={index}
              onClick={() => {
                onSelect(index);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                index === activeIndex
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-600'
              }`}
            >
              {file.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Code View Component
const CodeView: React.FC<{ file: { name: string; content: string } }> = ({ file }) => {
  const [copied, setCopied] = useState(false);
  const { t } = useLocalization();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="h-full overflow-auto bg-gray-900 flex flex-col">
      <div className="sticky top-0 bg-gray-800 px-4 py-2 border-b border-gray-700 text-sm text-gray-400 flex items-center justify-between z-10">
        <span>{file.name}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs transition-colors"
          title={t('copy_code') || 'Copy code'}
        >
          {copied ? (
            <>
              <FiCheck size={14} />
              <span>{t('copied') || 'Copied!'}</span>
            </>
          ) : (
            <>
              <FiCopy size={14} />
              <span>{t('copy') || 'Copy'}</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 text-sm flex-1">
        <code className="text-white whitespace-pre-wrap break-words">{file.content}</code>
      </pre>
    </div>
  );
};

// Main Canvas Component
export const VibeCodingCanvas: React.FC<VibeCodingCanvasProps> = ({ files, onClose, onWidthChange }) => {
  const [view, setView] = useState<'execute' | 'code'>('code'); // Default ke code view
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const { t } = useLocalization();

  // Gabungkan files berdasarkan tipe untuk HTML preview
  const mergedCode = useMemo(() => {
    const html = files.find(f => 
      f.language.toLowerCase() === 'html'
    )?.content || '';
    
    const css = files.find(f => 
      f.language.toLowerCase() === 'css'
    )?.content || '';
    
    const js = files.find(f => 
      ['javascript', 'js'].includes(f.language.toLowerCase())
    )?.content || '';
    
    return { html, css, js };
  }, [files]);

  // Prepare file list for display
  const fileList = useMemo(() => {
    return files.map((file, index) => {
      const lang = file.language.toLowerCase();
      let name = '';
      
      if (lang === 'html') name = 'index.html';
      else if (lang === 'css') name = 'styles.css';
      else if (lang === 'javascript' || lang === 'js') name = 'script.js';
      else if (lang === 'typescript' || lang === 'ts') name = 'script.ts';
      else if (lang === 'python') name = 'main.py';
      else if (lang === 'cpp' || lang === 'c++') name = 'main.cpp';
      else if (lang === 'c') name = 'main.c';
      else if (lang === 'java') name = 'Main.java';
      else if (lang === 'php') name = 'main.php';
      else if (lang === 'ruby') name = 'main.rb';
      else if (lang === 'go') name = 'main.go';
      else if (lang === 'rust') name = 'main.rs';
      else if (lang === 'csharp') name = 'Main.cs';
      else if (lang === 'swift') name = 'main.swift';
      else if (lang === 'kotlin') name = 'Main.kt';
      else name = `file${index + 1}.${file.language}`;
      
      return {
        name,
        content: file.content,
        language: file.language
      };
    });
  }, [files]);

  // Check if HTML preview is available
  const hasHtmlPreview = useMemo(() => {
    return files.some(f => f.language.toLowerCase() === 'html');
  }, [files]);

  // Check if current file can be executed
  const canExecuteCode = useMemo(() => {
    const currentLang = fileList[activeFileIndex]?.language.toLowerCase();
    // Check direct match or alias
    for (const [key, config] of Object.entries(SUPPORTED_LANGUAGES)) {
      if (key === currentLang || (config.alias && config.alias.includes(currentLang))) {
        return true;
      }
    }
    return false;
  }, [fileList, activeFileIndex]);

  // Determine if we can show execute view
  const canShowExecuteView = hasHtmlPreview || canExecuteCode;

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const windowWidth = window.innerWidth;
      const newWidth = ((windowWidth - e.clientX) / windowWidth) * 100;
      
      const clampedWidth = Math.max(25, Math.min(75, newWidth));
      setCanvasWidth(clampedWidth);
      
      if (onWidthChange) {
        onWidthChange(clampedWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, onWidthChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  // Get button label based on content type
  const getExecuteButtonLabel = () => {
    if (hasHtmlPreview) return 'Preview';
    if (canExecuteCode) return 'Run';
    return 'Execute';
  };

  return (
    <>
      {/* Desktop: Resize Handle */}
      <div
        className="hidden md:block fixed top-0 bottom-0 w-1.5 z-50 group"
        style={{ left: `${100 - canvasWidth}%` }}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsDraggingOver(true)}
        onMouseLeave={() => !isResizing && setIsDraggingOver(false)}
      >
        <div className="absolute inset-0 -left-2 -right-2 cursor-col-resize" />
        
        <div 
          className={`absolute inset-0 transition-colors ${
            isDraggingOver || isResizing 
              ? 'bg-blue-500' 
              : 'bg-gray-700/50'
          }`}
        />
        
        {(isDraggingOver || isResizing) && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1">
            <div className="w-1 h-1 bg-white rounded-full" />
            <div className="w-1 h-1 bg-white rounded-full" />
            <div className="w-1 h-1 bg-white rounded-full" />
          </div>
        )}
      </div>

      {/* Canvas Container */}
      <div
        className="fixed top-0 h-full bg-gray-900 shadow-2xl z-40 flex flex-col border-l border-gray-700"
        style={{
          right: 0,
          width: window.innerWidth >= 768 ? `${canvasWidth}%` : '100%'
        }}
      >
        {/* Header */}
        <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            {canShowExecuteView && (
              <div className="flex items-center text-xs text-gray-400 rounded-md p-0.5 bg-gray-700">
                <button
                  onClick={() => setView('code')}
                  className={`px-3 py-1.5 rounded-sm transition-colors flex items-center gap-1.5 ${
                    view === 'code' ? 'bg-gray-600 text-white' : 'hover:bg-gray-600/50'
                  }`}
                  title={t('code')}
                >
                  <FiCode size={14} />
                  {t('code')}
                </button>
                <button
                  onClick={() => setView('execute')}
                  className={`px-3 py-1.5 rounded-sm transition-colors flex items-center gap-1.5 ${
                    view === 'execute' ? 'bg-gray-600 text-white' : 'hover:bg-gray-600/50'
                  }`}
                >
                  {hasHtmlPreview ? (
                    <>
                      <FiEye size={14} />
                      {t('preview')}
                    </>
                  ) : (
                    <>
                      <FiPlay size={14} />
                      Run
                    </>
                  )}
                </button>
              </div>
            )}

            {/* File Dropdown - Show only in code view and if multiple files */}
            {view === 'code' && fileList.length > 1 && (
              <FileDropdown
                files={fileList}
                activeIndex={activeFileIndex}
                onSelect={setActiveFileIndex}
              />
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title={t('close')}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-hidden">
            {view === 'execute' ? (
              hasHtmlPreview ? (
                <PreviewPane
                  html={mergedCode.html}
                  css={mergedCode.css}
                  js={mergedCode.js}
                />
              ) : canExecuteCode ? (
                <CodeExecutor 
                  file={fileList[activeFileIndex]} 
                  allFiles={fileList}
                />
              ) : (
                <CodeView file={fileList[activeFileIndex]} />
              )
            ) : (
              <CodeView file={fileList[activeFileIndex]} />
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="bg-gray-800 px-4 py-2 border-t border-gray-700 text-xs text-gray-500 flex-shrink-0">
          {view === 'execute' && hasHtmlPreview
            ? `${t('preview')}: ${fileList.length} ${fileList.length > 1 ? t('files') : 'file'} ${t('merged') || 'merged'}`
            : view === 'execute' && canExecuteCode
            ? `${t('execute') || 'Execute'}: ${fileList[activeFileIndex]?.name}`
            : `${t('viewing')}: ${fileList[activeFileIndex]?.name}`
          }
        </div>
      </div>
    </>
  );
};