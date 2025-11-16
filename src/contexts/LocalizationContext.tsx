import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import en from '../locales/en.json';
import id from '../locales/id.json';

const translations: { [key: string]: any } = { en, id };

interface LocalizationContextType {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string, replacements?: { [key: string]: string }) => string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export const LocalizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocale] = useState(() => localStorage.getItem('locale') || 'en');

  useEffect(() => {
    localStorage.setItem('locale', locale);
  }, [locale]);

  const t = (key: string, replacements?: { [key: string]: string }) => {
    let translation = translations[locale][key] || translations['en'][key] || key;
    
    if (Array.isArray(translation)) {
        return translation; // Return array for prompts
    }

    if (replacements) {
        Object.keys(replacements).forEach(placeholder => {
            translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
        });
    }

    return translation;
  };

  return (
    <LocalizationContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocalizationContext.Provider>
  );
};

export const useLocalization = (): LocalizationContextType => {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
};