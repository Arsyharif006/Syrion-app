// src/components/settings/LanguageSettings.tsx

import React from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { LanguageSwitcher } from '../LanguageSwitcher';

export const LanguageSettings: React.FC = () => {
  const { t } = useLocalization();

  return (
    <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">{t('languageTitle')}</h3>
      </div>
      <p className="text-sm text-gray-400 mb-6">{t('languageDescription')}</p>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">{t('displayLanguage')}</label>
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
};