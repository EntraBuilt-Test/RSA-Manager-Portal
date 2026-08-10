import React, { createContext, useContext, useMemo, useState } from 'react';
import translations from '../i18n/translations.js';

const LanguageContext = createContext(null);

function getNested(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function interpolate(str, vars) {
  if (!vars) return str;
  return Object.keys(vars).reduce((acc, key) => acc.replace(`{${key}}`, vars[key]), str);
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => localStorage.getItem('rsa_language') || 'en');

  const setLanguage = (lang) => {
    localStorage.setItem('rsa_language', lang);
    setLanguageState(lang);
  };

  const t = useMemo(() => {
    return (key, vars) => {
      const value = getNested(translations[language], key) ?? getNested(translations.en, key) ?? key;
      return interpolate(value, vars);
    };
  }, [language]);

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
