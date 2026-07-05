import en from './locales/en.json';
import hi from './locales/hi.json';
import kn from './locales/kn.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', speechCode: 'en-US', ttsCode: 'en-IN' },
  { code: 'hi', label: 'हिन्दी', speechCode: 'hi-IN', ttsCode: 'hi-IN' },
  { code: 'kn', label: 'ಕನ್ನಡ', speechCode: 'kn-IN', ttsCode: 'kn-IN' }
];

const translations = { en, hi, kn };

const getNested = (obj, path) =>
  path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);

export const translate = (locale, key, params = {}) => {
  const dict = translations[locale] || translations.en;
  let text = getNested(dict, key) ?? getNested(translations.en, key) ?? key;
  Object.entries(params).forEach(([k, v]) => {
    text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
  });
  return text;
};

export const getSpeechLang = (locale) =>
  SUPPORTED_LANGUAGES.find((l) => l.code === locale)?.speechCode || 'en-US';

export const getTtsLang = (locale) =>
  SUPPORTED_LANGUAGES.find((l) => l.code === locale)?.ttsCode || 'en-IN';
