import React from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import icon from './images/icon.png';

interface WelcomeProps {
    onPromptClick: (prompt: string) => void;
}

const ExamplePrompt: React.FC<{text: string, onClick: (text:string) => void}> = ({text, onClick}) => (
    <button 
      onClick={() => onClick(text)}
      className="bg-gray-800 p-4 rounded-lg text-left w-full hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
        <p className="text-sm font-medium text-white">{text}</p>
    </button>
)

export const Welcome: React.FC<WelcomeProps> = ({ onPromptClick }) => {
  const { t } = useLocalization();
  const appName = t('appName');
  const examplePrompts = t('examplePrompts') as unknown as string[];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="mb-8">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 ring-4 ring-gray-700 overflow-hidden">
                <img  src={icon} alt={appName} className="w-full h-full object-cover" />
            </div>
            <h1 className="text-4xl font-bold text-white">{t('welcomeTitle', { appName })}</h1>
            <p className="text-gray-400 mt-2">{t('welcomeSubtitle')}</p>
        </div>

        <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4">
            {examplePrompts.map(prompt => (
                <ExamplePrompt key={prompt} text={prompt} onClick={onPromptClick} />
            ))}
        </div>
    </div>
  );
};
