import React, { useState, useEffect } from 'react';
import { FiX, FiCheck, FiZap, FiCode, FiMaximize2, FiDownload } from 'react-icons/fi';
import { useLocalization } from '../contexts/LocalizationContext';
import logo from './images/icon.png';

interface UpdateModalProps {
  version: string;
  updateDate: string;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ version, updateDate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { t } = useLocalization();

  const STORAGE_KEY = `update-modal-dismissed-${version}`;

  useEffect(() => {
    // Check if user has already dismissed this version's update
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      // Show modal after a short delay for better UX
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [STORAGE_KEY]);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const updates = [
    {
      icon: <FiMaximize2 className="text-blue-400" size={18} />,
      title: t('updateCanvasFeature') || 'Interactive Canvas',
      description: t('updateCanvasDescription') || 'Open code in a resizable canvas with live preview and code execution'
    },
    {
      icon: <FiCode className="text-green-400" size={18} />,
      title: t('updateCodeExecution') || 'Multi-Language Code Execution',
      description: t('updateCodeExecutionDescription') || 'Run Python, C++, Java, JavaScript, and 10+ more languages directly in the browser'
    },
    {
      icon: <FiDownload className="text-purple-400" size={18} />,
      title: t('updateTableExport') || 'Table Export to Excel',
      description: t('updateTableExportDescription') || 'Download AI-generated tables directly to Excel files with one click'
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-fadeIn"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full pointer-events-auto animate-slideUp border border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative px-5 pt-5 pb-3 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img src={logo} alt=""  className="md:w-14 md:h-14 h-11 w-11 rounded-full"/>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {t('updateModalTitle') || "What's New"}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t('version')} {version} • {updateDate}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-white transition-colors p-1.5 -mr-1 rounded-lg hover:bg-gray-700"
                aria-label="Close"
              >
                <FiX size={20} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-5 py-4">
            <div className="space-y-3">
              {updates.map((update, index) => (
                <div 
                  key={index}
                  className="flex gap-3 p-3 rounded-lg bg-gray-700/40 hover:bg-gray-700/60 transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {update.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium mb-0.5 text-sm">
                      {update.title}
                    </h3>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      {update.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Additional Info */}
            <div className="mt-3 p-3 bg-blue-600/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-blue-300 leading-relaxed">
                <span className="font-semibold">{t('tip') || 'Tip'}:</span>{' '}
                {t('updateTip') || 'Try asking me to create interactive code examples and open them in the canvas for a better experience!'}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 border-t border-gray-700 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-4 h-4 border-2 border-gray-500 rounded peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all flex items-center justify-center group-hover:border-gray-400">
                  {dontShowAgain && <FiCheck size={12} className="text-white" />}
                </div>
              </div>
              <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                {t('dontShowAgain') || "Don't show this again"}
              </span>
            </label>

            <button
              onClick={handleClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              {t('gotIt') || 'Got it'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px) scale(0.96);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        
        .animate-slideUp {
          animation: slideUp 0.25s ease-out;
        }
      `}</style>
    </>
  );
};