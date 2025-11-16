import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FiCode, FiEye, FiX, FiCopy, FiCheck, FiAlertCircle, FiRefreshCw, FiPackage, FiTerminal, FiChevronDown } from 'react-icons/fi';

interface CodeFile {
  language: string;
  content: string;
}

interface ReactPreviewCanvasProps {
  files: CodeFile[];
  onClose: () => void;
  onWidthChange?: (width: number) => void;
}

const isReactCode = (files: CodeFile[]): boolean => {
  return files.some(f => {
    const lang = f.language.toLowerCase();
    const isReactLang = ['jsx', 'tsx', 'react', 'typescript-react'].includes(lang);
    const hasReactImport = /import\s+.*from\s+['"]react['"]/i.test(f.content);
    return isReactLang || hasReactImport;
  });
};

const extractComponentName = (code: string): string | null => {
  const funcMatch = code.match(/function\s+([A-Z]\w+)/);
  if (funcMatch) return funcMatch[1];
  
  const constMatch = code.match(/const\s+([A-Z]\w+)\s*=/);
  if (constMatch) return constMatch[1];
  
  const exportMatch = code.match(/export\s+default\s+([A-Z]\w+)/);
  if (exportMatch) return exportMatch[1];
  
  return null;
};

const extractImports = (code: string): string[] => {
  const imports: string[] = [];
  const importRegex = /import\s+(?:(?:\*\s+as\s+\w+)|(?:\{[^}]+\})|(?:\w+))\s+from\s+['"]([^'"]+)['"]/g;
  
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const packageName = match[1];
    if (!packageName.startsWith('.') && !packageName.startsWith('/') && 
        packageName !== 'react' && packageName !== 'react-dom') {
      imports.push(packageName);
    }
  }
  
  return [...new Set(imports)];
};

const getFileName = (file: CodeFile, index: number): string => {
  const componentName = extractComponentName(file.content);
  const lang = file.language.toLowerCase();
  const ext = ['tsx', 'typescript-react'].includes(lang) ? 'tsx' : 'jsx';
  
  if (componentName) {
    return `${componentName}.${ext}`;
  }
  
  const extensions: Record<string, string> = {
    jsx: 'App.jsx',
    tsx: 'App.tsx',
    react: 'App.jsx',
    'typescript-react': 'App.tsx',
    css: 'styles.css'
  };
  
  return extensions[lang] || `Component${index + 1}.${ext}`;
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
        <span className="max-w-[200px] truncate">{files[activeIndex]?.name}</span>
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

// Console Output Component
const ConsoleOutput: React.FC<{ logs: Array<{ type: string; message: string; timestamp: number }> }> = ({ logs }) => {
  return (
    <div className="bg-gray-950 border-t border-gray-700 h-48 overflow-auto">
      <div className="sticky top-0 bg-gray-900 px-4 py-2 border-b border-gray-700 flex items-center gap-2 text-xs text-gray-400">
        <FiTerminal size={14} />
        <span>Console</span>
        <span className="text-gray-600">({logs.length})</span>
      </div>
      <div className="p-3 space-y-1 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-gray-600 italic">No console output</div>
        ) : (
          logs.map((log, index) => (
            <div 
              key={index} 
              className={`flex items-start gap-2 ${
                log.type === 'error' ? 'text-red-400' :
                log.type === 'warn' ? 'text-yellow-400' :
                log.type === 'info' ? 'text-blue-400' :
                'text-gray-300'
              }`}
            >
              <span className="text-gray-600 select-none min-w-[60px]">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className="break-all">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// React Preview Component
const ReactPreview: React.FC<{ files: CodeFile[] }> = ({ files }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string>('');
  const [consoleLogs, setConsoleLogs] = useState<Array<{ type: string; message: string; timestamp: number }>>([]);
  const [detectedPackages, setDetectedPackages] = useState<string[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [key, setKey] = useState(0);

  const bundledCode = useMemo(() => {
    try {
      setError('');
      setConsoleLogs([]);
      
      const jsxFiles = files.filter(f => 
        ['jsx', 'tsx', 'react', 'typescript-react', 'javascript', 'typescript'].includes(f.language.toLowerCase())
      );
      
      const cssFiles = files.filter(f => f.language.toLowerCase() === 'css');
      const styles = cssFiles.map(f => f.content).join('\n\n');
      
      if (jsxFiles.length === 0) {
        throw new Error('No React component found.');
      }
      
      // Extract external imports
      const allImports: string[] = [];
      jsxFiles.forEach(file => {
        allImports.push(...extractImports(file.content));
      });
      setDetectedPackages([...new Set(allImports)]);
      
      // Sort: components first, then App
      const sortedFiles = [...jsxFiles].sort((a, b) => {
        const aHasApp = /function\s+App|const\s+App\s*=|export\s+default\s+App/.test(a.content);
        const bHasApp = /function\s+App|const\s+App\s*=|export\s+default\s+App/.test(b.content);
        if (aHasApp && !bHasApp) return 1;
        if (!aHasApp && bHasApp) return -1;
        return 0;
      });
      
      let combinedCode = '';
      let hasAppComponent = false;
      const componentNames: string[] = [];
      
      sortedFiles.forEach((file, index) => {
        let code = file.content;
        const componentName = extractComponentName(code);
        
        if (componentName) {
          componentNames.push(componentName);
        }
        
        // Remove all types of imports
        code = code.replace(/import\s+(?:(?:\*\s+as\s+\w+)|(?:\{[^}]+\})|(?:\w+(?:\s*,\s*\{[^}]+\})?)|(?:type\s+\{[^}]+\}))\s+from\s+['"][^'"]+['"];?\s*\n?/g, '');
        code = code.replace(/import\s+['"][^'"]+['"];?\s*\n?/g, '');
        
        const isAppComponent = componentName === 'App' || /function\s+App|const\s+App\s*=/.test(code);
        if (isAppComponent) hasAppComponent = true;
        
        // Remove TypeScript annotations
        code = code.replace(/:\s*React\.FC<[^>]+>/g, '');
        code = code.replace(/:\s*FC<[^>]+>/g, '');
        code = code.replace(/:\s*React\.ReactElement/g, '');
        code = code.replace(/:\s*JSX\.Element/g, '');
        
        // Remove interface and type definitions
        code = code.replace(/export\s+interface\s+\w+\s*\{[^}]*\}/gs, '');
        code = code.replace(/interface\s+\w+\s*\{[^}]*\}/gs, '');
        code = code.replace(/export\s+type\s+\w+\s*=\s*\{[^}]*\};?/gs, '');
        code = code.replace(/type\s+\w+\s*=\s*\{[^}]*\};?/gs, '');
        code = code.replace(/type\s+\w+\s*=\s*[^;]+;/g, '');
        
        // Remove type annotations from variables
        code = code.replace(/:\s*\w+(\[\])?(?=\s*[,\)\=\{])/g, '');
        code = code.replace(/:\s*\w+<[^>]+>(?=\s*[,\)\=\{])/g, '');
        
        // Clean function parameter types
        code = code.replace(/\(([^)]+)\):\s*\w+(\[\])?\s*=>/g, '($1) =>');
        code = code.replace(/\(([^)]+)\)\s*:\s*\w+\s*\{/g, '($1) {');
        
        // Remove React event types
        code = code.replace(/:\s*React\.\w+(<[^>]+>)?/g, '');
        
        // Remove export statements
        code = code.replace(/export\s+default\s+(\w+);?\s*/g, '');
        code = code.replace(/export\s+default\s+/g, '');
        code = code.replace(/export\s+\{[^}]+\};?\s*/g, '');
        code = code.replace(/export\s+(const|function|class|interface|type)\s+/g, '$1 ');
        
        // Clean empty lines
        code = code.replace(/\n\s*\n\s*\n/g, '\n\n');
        
        if (index > 0) combinedCode += '\n\n';
        if (componentName) combinedCode += `// ${componentName}\n`;
        combinedCode += code.trim() + '\n';
      });
      
      // Auto-generate App if missing
      if (!hasAppComponent) {
        const firstComponent = componentNames[0];
        if (firstComponent && firstComponent !== 'App') {
          combinedCode += `\n\n// Auto-generated App\nfunction App() {\n  return <${firstComponent} />;\n}\n`;
        } else if (!firstComponent) {
          throw new Error('No valid component found.');
        }
      }
      
      return { code: combinedCode.trim(), styles, imports: [...new Set(allImports)] };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to bundle';
      setError(errorMsg);
      return { code: '', styles: '', imports: [] };
    }
  }, [files]);

  const srcDoc = useMemo(() => {
    if (error || !bundledCode.code) return '';
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <base target="_self">
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7.24.4/babel.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: system-ui, -apple-system, sans-serif;
      background: white;
      color: #1f2937;
    }
    #root { width: 100%; min-height: 100vh; }
    ${bundledCode.styles}
  </style>
  <script>
    (function() {
      window.addEventListener('DOMContentLoaded', function() {
        document.addEventListener('click', function(e) {
          const target = e.target.closest('a');
          if (target && target.href) {
            const href = target.getAttribute('href');
            if (href && href.startsWith('#')) {
              e.preventDefault();
              e.stopPropagation();
              const targetId = href.slice(1);
              const element = document.getElementById(targetId);
              
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else {
                // If element not found, try scrolling to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
              
              return false;
            }
            // If it's an external or absolute link, open in new tab
            else if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//'))) {
              e.preventDefault();
              window.open(href, '_blank', 'noopener,noreferrer');
              return false;
            }
          }
        });
      });
    })();
  </script>
</head>
<body>
  <div id="root"></div>
  
  <script>
    (function() {
      const sendLog = (level, ...args) => {
        const msg = args.map(a => {
          try {
            return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a);
          } catch { return String(a); }
        }).join(' ');
        
        try {
          window.parent.postMessage({ type: 'console', level, message: msg }, '*');
        } catch (e) {}
      };
      
      const origLog = console.log, origErr = console.error, origWarn = console.warn;
      console.log = function(...a) { origLog.apply(console, a); sendLog('log', ...a); };
      console.error = function(...a) { origErr.apply(console, a); sendLog('error', ...a); };
      console.warn = function(...a) { origWarn.apply(console, a); sendLog('warn', ...a); };
      
      window.addEventListener('error', function(e) {
        console.error('Error: ' + e.message);
        e.preventDefault();
      });
      
      window.addEventListener('unhandledrejection', function(e) {
        console.error('Promise rejected: ' + (e.reason?.message || e.reason));
      });
    })();
  </script>
  
  <script type="text/babel">
    (function() {
      const { useState, useEffect, useRef, useMemo, useCallback, useContext, useReducer, createContext, Fragment } = React;
      
      try {
        ${bundledCode.code}
        
        const rootElement = document.getElementById('root');
        const root = ReactDOM.createRoot(rootElement);
        
        root.render(<App />);
        
        console.log('✓ Component rendered successfully');
      } catch (err) {
        console.error('Render error: ' + err.message);
        
        const rootElement = document.getElementById('root');
        rootElement.innerHTML = \`
          <div style="position: fixed; inset: 0; background: #1d1d1d; overflow: auto; z-index: 9999;">
            <div style="background: #e11d48; color: white; padding: 24px; display: flex; align-items: center; gap: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <h3 style="font-size: 18px; font-weight: 700; margin: 0;">Failed to compile</h3>
            </div>
            
            <div style="padding: 24px; max-width: 1200px;">
              <pre style="color: #fecdd3; font-family: 'Courier New', Consolas, Monaco, monospace; font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; margin: 0;">\${err.message}</pre>
              
              ${bundledCode.imports.length > 0 ? `
              <div style="margin-top: 24px; padding: 16px; background: #292929; border-left: 4px solid #fb923c; border-radius: 4px;">
                <p style="color: #fb923c; font-weight: 600; margin: 0 0 8px 0; font-size: 14px;">⚠️ External packages detected</p>
                <p style="color: #fdba74; font-size: 13px; margin: 0; font-family: 'Courier New', monospace;">${bundledCode.imports.join(', ')}</p>
                <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">These packages may not be available in the preview environment.</p>
              </div>
              ` : ''}
            </div>
            
            <div style="background: #292929; padding: 12px 24px; font-size: 12px; color: #9ca3af; border-top: 1px solid #3f3f3f; position: sticky; bottom: 0;">
              This error occurred during the build process and cannot be dismissed.
            </div>
          </div>
        \`;
      }
    })();
  </script>
</body>
</html>`;
  }, [bundledCode, error]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'console') {
        setConsoleLogs(prev => [...prev, {
          type: event.data.level,
          message: event.data.message,
          timestamp: Date.now()
        }]);
        
        if (event.data.level === 'error') {
          setShowConsole(true);
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);


  if (error) {
    return (
      <div className="w-full h-full bg-[#1d1d1d] flex flex-col overflow-auto">
        <div className="bg-[#e11d48] text-white px-6 py-4 flex items-center gap-3 shadow-lg">
          <FiAlertCircle className="flex-shrink-0" size={24} />
          <div className="flex-1">
            <h3 className="text-lg font-bold">Failed to compile</h3>
          </div>
        </div>
        
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-4xl">
            <pre className="text-[#fecdd3] font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
              {error}
            </pre>
          </div>
        </div>
        
        <div className="bg-[#292929] px-6 py-3 text-xs text-gray-400 border-t border-gray-700">
          This error occurred during the build process and cannot be dismissed.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white flex flex-col">
      {detectedPackages.length > 0 && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2 text-xs flex-wrap">
          <FiPackage className="text-yellow-600 flex-shrink-0" size={14} />
          <span className="text-yellow-700 font-medium">External packages:</span>
          <div className="flex gap-2 flex-wrap">
            {detectedPackages.map((pkg, i) => (
              <span key={i} className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-mono">
                {pkg}
              </span>
            ))}
          </div>
        </div>
      )}
      
      <div className="flex-1 relative overflow-hidden">
      
        <iframe
          key={key}
          ref={iframeRef}
          srcDoc={srcDoc}
          title="React Preview"
          sandbox="allow-scripts allow-same-origin"
          className="w-full h-full border-0"
        />
      </div>
      
      <button
        onClick={() => setShowConsole(!showConsole)}
        className={`absolute bottom-10 right-5 z-20 px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium transition ${
          consoleLogs.some(l => l.type === 'error')
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-gray-800 text-white hover:bg-gray-700'
        }`}
      >
        <FiTerminal size={16} />
        Console {consoleLogs.length > 0 && `(${consoleLogs.length})`}
      </button>
      
      {showConsole && <ConsoleOutput logs={consoleLogs} />}
    </div>
  );
};

// Code View Component
const CodeView: React.FC<{ file: { name: string; content: string; language: string } }> = ({ file }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="sticky top-0 bg-gray-800 px-4 py-2 border-b border-gray-700 text-sm text-gray-400 flex items-center justify-between z-10">
        <span>{file.name}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs transition-colors"
        >
          {copied ? <><FiCheck size={14} /><span>Copied!</span></> : <><FiCopy size={14} /><span>Copy</span></>}
        </button>
      </div>
      
      <pre className="flex-1 overflow-auto p-4 text-sm">
        <code className="text-white whitespace-pre-wrap break-words leading-relaxed">
          {file.content}
        </code>
      </pre>
    </div>
  );
};

// Main Canvas
export const ReactPreviewCanvas: React.FC<ReactPreviewCanvasProps> = ({ 
  files, 
  onClose, 
  onWidthChange 
}) => {
  const [view, setView] = useState<'preview' | 'code'>('code'); // Default ke code view seperti VibeCodingCanvas
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const isReact = isReactCode(files);

  const fileList = useMemo(() => {
    return files.map((file, index) => ({
      name: getFileName(file, index),
      content: file.content,
      language: file.language
    }));
  }, [files]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const windowWidth = window.innerWidth;
      const newWidth = ((windowWidth - e.clientX) / windowWidth) * 100;
      const clampedWidth = Math.max(25, Math.min(75, newWidth));
      
      setCanvasWidth(clampedWidth);
      onWidthChange?.(clampedWidth);
    };

    const handleMouseUp = () => setIsResizing(false);

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

  return (
    <>
      <div
        className="hidden md:block fixed top-0 bottom-0 w-1.5 z-50 group"
        style={{ left: `${100 - canvasWidth}%` }}
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        onMouseEnter={() => setIsDraggingOver(true)}
        onMouseLeave={() => !isResizing && setIsDraggingOver(false)}
      >
        <div className="absolute inset-0 -left-2 -right-2 cursor-col-resize" />
        <div className={`absolute inset-0 transition-colors ${isDraggingOver || isResizing ? 'bg-blue-500' : 'bg-gray-700/50'}`} />
        {(isDraggingOver || isResizing) && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1">
            <div className="w-1 h-1 bg-white rounded-full" />
            <div className="w-1 h-1 bg-white rounded-full" />
            <div className="w-1 h-1 bg-white rounded-full" />
          </div>
        )}
      </div>

      <div
        className="fixed top-0 h-full bg-gray-900 shadow-2xl z-40 flex flex-col border-l border-gray-700"
        style={{
          right: 0,
          width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${canvasWidth}%` : '100%'
        }}
      >
        <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center text-xs bg-gray-700 rounded-md p-0.5">
              <button
                onClick={() => setView('code')}
                className={`px-3 py-1.5 rounded-sm transition-colors flex items-center gap-1.5 ${
                  view === 'code' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-gray-600/50'
                }`}
              >
                <FiCode size={14} />
                Code
              </button>
              <button
                onClick={() => setView('preview')}
                className={`px-3 py-1.5 rounded-sm transition-colors flex items-center gap-1.5 ${
                  view === 'preview' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-gray-600/50'
                }`}
              >
                <FiEye size={14} />
                Preview
              </button>
            </div>

            {view === 'code' && fileList.length > 1 && (
              <FileDropdown
                files={fileList}
                activeIndex={activeFileIndex}
                onSelect={setActiveFileIndex}
              />
            )}
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-700 rounded"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {view === 'preview' ? (
            <ReactPreview files={files} />
          ) : (
            <CodeView file={fileList[activeFileIndex]} />
          )}
        </div>

        <div className="bg-gray-800 px-4 py-2 border-t border-gray-700 text-xs text-gray-500 flex items-center justify-between flex-shrink-0">
          <span>
            {view === 'preview' 
              ? `Preview: ${fileList.length} file${fileList.length > 1 ? 's' : ''} merged`
              : `Viewing: ${fileList[activeFileIndex]?.name}`
            }
          </span>
          <span className="text-gray-600">React 18</span>
        </div>
      </div>
    </>
  );
};

export default ReactPreviewCanvas;