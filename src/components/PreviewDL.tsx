import React, { useState, useMemo, useEffect } from 'react';
import { FiPlay, FiLoader, FiAlertCircle, FiInfo, FiEye, FiEyeOff } from 'react-icons/fi';
import { useLocalization } from '../contexts/LocalizationContext';

interface PreviewProps {
    html?: string;
    css?: string;
    js?: string;
    language?: string;
    code?: string;
}

const SUPPORTED_LANGUAGES = {
    python: { runtime: 'python', version: '3.10.0', name: 'Python' },
    cpp: { runtime: 'c++', version: '10.2.0', name: 'C++' },
    c: { runtime: 'c', version: '10.2.0', name: 'C' },
    java: { runtime: 'java', version: '15.0.2', name: 'Java' },
    javascript: { runtime: 'javascript', version: '18.15.0', name: 'JavaScript' },
    typescript: { runtime: 'typescript', version: '5.0.3', name: 'TypeScript' },
    php: { runtime: 'php', version: '8.2.3', name: 'PHP' },
    ruby: { runtime: 'ruby', version: '3.0.1', name: 'Ruby' },
    go: { runtime: 'go', version: '1.16.2', name: 'Go' },
    rust: { runtime: 'rust', version: '1.68.2', name: 'Rust' },
    csharp: { runtime: 'csharp', version: '6.12.0', name: 'C#' },
    swift: { runtime: 'swift', version: '5.3.3', name: 'Swift' },
    kotlin: { runtime: 'kotlin', version: '1.8.20', name: 'Kotlin' }
};

export const Preview: React.FC<PreviewProps> = ({ 
    html = '', 
    css = '', 
    js = '', 
    language = 'html', 
    code = '' 
}) => {
    const [output, setOutput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState('');
    const [hasRun, setHasRun] = useState(false);
    const [userInput, setUserInput] = useState('');
    const [showInput, setShowInput] = useState(false);
    const [needsInput, setNeedsInput] = useState(false);
    const { t } = useLocalization();

    const normalizedLang = language.toLowerCase();
    const isCompiledLanguage = Object.keys(SUPPORTED_LANGUAGES).includes(normalizedLang);

    // Deteksi apakah code memerlukan input
    useEffect(() => {
        const codeToCheck = code || html;
        const inputPatterns = [
            /scanf/i,           // C
            /cin\s*>>/i,        // C++
            /input\s*\(/i,      // Python
            /Scanner/i,         // Java
            /readLine/i,        // Kotlin
            /gets/i,            // Ruby, C
            /readline/i,        // PHP
            /Console\.ReadLine/i, // C#
        ];
        
        const hasInputPattern = inputPatterns.some(pattern => pattern.test(codeToCheck));
        setNeedsInput(hasInputPattern);
        
        // Auto-show input jika terdeteksi memerlukan input
        if (hasInputPattern && !hasRun) {
            setShowInput(true);
        }
    }, [code, html, hasRun]);

    const srcDoc = useMemo(() => {
        if (!isCompiledLanguage) {
            return `
                <!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <style>${css}</style>
                    </head>
                    <body>${html || code}</body>
                    <script>${js}</script>
                </html>
            `;
        }
        return '';
    }, [html, css, js, code, isCompiledLanguage]);

    const runCode = async () => {
        setIsRunning(true);
        setError('');
        setOutput('');
        setHasRun(true);

        const langConfig = SUPPORTED_LANGUAGES[normalizedLang as keyof typeof SUPPORTED_LANGUAGES];
        
        if (!langConfig) {
            setError(`Language "${language}" is not supported`);
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
                            content: code || html
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
                setError(data.message || 'Failed to execute code');
            }
        } catch (err) {
            setError(`Error: ${err instanceof Error ? err.message : 'Unknown error occurred'}`);
        } finally {
            setIsRunning(false);
        }
    };

    const getFileName = (lang: string): string => {
        const extensions: Record<string, string> = {
            python: 'main.py',
            cpp: 'main.cpp',
            c: 'main.c',
            java: 'Main.java',
            javascript: 'main.js',
            typescript: 'main.ts',
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
            c: 'Example for scanf("%d %d", &a, &b):\n5 10\n\nOr one per line:\n5\n10',
            cpp: 'Example for cin >> a >> b:\n5 10\n\nOr one per line:\n5\n10',
            python: 'Example for input():\nJohn\n25\nNew York',
            java: 'Example for Scanner:\n42\nHello World',
        };
        return examples[normalizedLang] || t('enterInput');
    };

    // Render untuk bahasa pemrograman
    if (isCompiledLanguage) {
        return (
            <div className="w-full h-full bg-gray-900 text-white flex flex-col">
                <div className="bg-gray-800 px-3 sm:px-4 py-3 border-b border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 flex-shrink-0">
                    <div className="flex items-center justify-between sm:justify-start gap-2">
                        <span className="text-sm text-gray-400">
                            {SUPPORTED_LANGUAGES[normalizedLang as keyof typeof SUPPORTED_LANGUAGES]?.name || language} {t('output')}
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
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-medium w-full sm:w-auto"
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

                <div className="flex-1 overflow-auto p-3 sm:p-4">
                    {showInput && (
                        <div className="bg-gray-800 rounded-lg p-3 sm:p-4 mb-4 border-2 border-blue-500/30">
                            <div className="flex items-start gap-2 mb-3">
                                <FiInfo className="text-blue-400 flex-shrink-0 mt-1" size={18} />
                                <div className="flex-1">
                                    <label className="block text-sm font-semibold text-blue-400 mb-1">
                                        {t('prepareAllInputs')}
                                    </label>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        {t('inputInstruction')}
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
                                    {t('howItWorks')}
                                </p>
                                <ul className="text-xs text-gray-500 space-y-1.5 ml-3">
                                    <li>• {t('inputTip1')}</li>
                                    <li>• {t('inputTip2')}</li>
                                    <li>• {t('inputTip3')}</li>
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
                            <div className="text-center px-4">
                                <FiPlay className="mx-auto mb-2" size={32} />
                                <p className="text-sm sm:text-base">{t('clickToRun')}</p>
                            </div>
                        </div>
                    )}

                    {!hasRun && showInput && (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            <div className="text-center px-4">
                                <FiPlay className="mx-auto mb-2" size={32} />
                                <p className="text-sm sm:text-base">{t('enterInputsAndRun')}</p>
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
                        <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 sm:p-4 mb-4">
                            <div className="flex items-start gap-2">
                                <FiAlertCircle className="text-red-400 flex-shrink-0 mt-1" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-red-400 mb-1">{t('error')}</p>
                                    <pre className="text-sm text-red-300 whitespace-pre-wrap font-mono break-words">
                                        {error}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    )}

                    {output && !isRunning && (
                        <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
                            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">{t('output')}:</p>
                            <pre className="text-sm text-green-400 whitespace-pre-wrap font-mono leading-relaxed break-words">
                                {output}
                            </pre>
                        </div>
                    )}
                </div>

                <div className="bg-gray-800 px-3 sm:px-4 py-2 border-t border-gray-700 text-xs text-gray-500 flex-shrink-0">
                   {t('poweredByPiston')}
                </div>
            </div>
        );
    }

    // Render untuk HTML/CSS/JS
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