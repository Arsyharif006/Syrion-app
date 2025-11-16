import React, { useState } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import {
  FiChevronDown,
  FiChevronUp,
  FiCopy,
  FiCheck
} from 'react-icons/fi';

interface CodeBlockProps {
  language: string;
  code: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);
  const [isCodeCollapsed, setIsCodeCollapsed] = useState(true);
  const { t } = useLocalization();

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const toggleCodeCollapse = () => {
    setIsCodeCollapsed(prev => !prev);
  };

  // Get first few lines for preview
  const getCodePreview = () => {
    const lines = code.split('\n');
    const previewLines = lines.slice(0, 3);
    return previewLines.join('\n') + (lines.length > 3 ? '\n...' : '');
  };

  return (
    <div className="bg-gray-900 rounded-lg my-2 text-sm border border-gray-700/50">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 rounded-t-lg flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-gray-400 capitalize">{language || 'code'}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Code Collapse Toggle */}
          <button 
            onClick={toggleCodeCollapse} 
            title={isCodeCollapsed ? 'Expand Code' : 'Collapse Code'} 
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs border-r border-gray-700 pr-2 mr-1"
          >
            {isCodeCollapsed ? <FiChevronDown size={16} /> : <FiChevronUp size={16} />}
          </button>

          {/* Copy Button */}
          <button 
            onClick={handleCopy} 
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs" 
            aria-label={t('copy')}
          >
            {copied ? (
              <>
                <FiCheck aria-hidden />
                {t('copied')}
              </>
            ) : (
              <>
                <FiCopy aria-hidden />
                {t('copy')}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="overflow-hidden transition-all duration-300">
        <pre 
          className={`overflow-x-auto p-4 bg-gray-900/50 rounded-b-lg transition-all duration-300 ${
            isCodeCollapsed ? 'max-h-24' : 'max-h-[600px]'
          }`}
          style={{ 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none' 
          }}
        >
          <style>{`
            pre::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          <code className="text-white">
            {isCodeCollapsed ? getCodePreview() : code}
          </code>
        </pre>
        
        {/* Click to expand hint */}
        {isCodeCollapsed && (
          <div 
            className="text-center py-2 bg-gray-800/30 cursor-pointer hover:bg-gray-800/50 transition-colors text-xs text-gray-500"
            onClick={toggleCodeCollapse}
          >
            Click to expand full code ({code.split('\n').length} lines)
          </div>
        )}
      </div>
    </div>
  );
};