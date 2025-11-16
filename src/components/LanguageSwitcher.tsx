
import React from 'react';
import { useLocalization } from '../contexts/LocalizationContext';

export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale } = useLocalization();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocale(e.target.value);
  };

  return (
    <div className="relative">
      <select
        value={locale}
        onChange={handleLanguageChange}
        className="w-full appearance-none bg-gray-800 border border-gray-700 text-white py-2 px-3 pr-8 rounded-md leading-tight focus:outline-none focus:bg-gray-700 focus:border-gray-500 text-sm"
      >
        <option value="en">English</option>
        <option value="id">Bahasa Indonesia</option>
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
      </div>
    </div>
  );
};
