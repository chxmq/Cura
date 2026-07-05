import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translate, SUPPORTED_LANGUAGES } from '../i18n/index.js';

const STORAGE_KEY = 'cura_language';

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [locale, setLocaleState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGUAGES.some((l) => l.code === saved) ? saved : 'en';
  });

  const setLocale = useCallback((code) => {
    if (!SUPPORTED_LANGUAGES.some((l) => l.code === code)) return;
    setLocaleState(code);
    localStorage.setItem(STORAGE_KEY, code);
    document.documentElement.lang = code;
  }, []);

  const t = useCallback((key, params) => translate(locale, key, params), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate(locale, 'app.title');
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t, languages: SUPPORTED_LANGUAGES }), [locale, setLocale, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
