export const SYMPTOM_ALIASES = {
  Fever: {
    en: ['fever', 'temperature', 'high temp'],
    hi: ['बुखार', 'ताप', 'ज्वर', 'bukhar', 'bukhaar', 'fever'],
    kn: ['ಜ್ವರ', 'ಉಷ್ಣ', 'jvara', 'jwara', 'fever']
  },
  'Common Cold': {
    en: ['cold', 'runny nose', 'blocked nose', 'sneezing'],
    hi: ['सर्दी', 'जुकाम', 'नाक बहना', 'sardi', 'jukaam', 'cold'],
    kn: ['ಜಲದೂಸರು', 'ಶೀತ', 'ನೆಗಡಿ', 'jala doosaru', 'cold']
  },
  Cough: {
    en: ['cough', 'coughing', 'dry cough', 'wet cough'],
    hi: ['खांसी', 'कफ', 'khaansi', 'khansi', 'cough'],
    kn: ['ಕೆಮ್ಮು', 'ಕೆಮ್ಮುವಿಕೆ', 'kemmu', 'cough']
  },
  'Body Pain': {
    en: ['body pain', 'body ache', 'muscle pain', 'joint pain'],
    hi: ['शरीर दर्द', 'मांसपेशियों में दर्द', 'body pain', 'dard'],
    kn: ['ದೇಹ ನೋವು', 'ಅಂಗ ನೋವು', 'deha novu', 'body pain']
  },
  Headache: {
    en: ['headache', 'head ache', 'migraine', 'head pain'],
    hi: ['सिरदर्द', 'सिर दर्द', 'sir dard', 'headache'],
    kn: ['ತಲೆನೋವು', 'ತಲೆ ನೋವು', 'talenovu', 'headache']
  },
  'Menstrual Cramps': {
    en: ['period pain', 'menstrual cramps', 'menstrual pain', 'cramps'],
    hi: ['पीरियड दर्द', 'मासिक धर्म दर्द', 'period pain', 'cramps'],
    kn: ['ಮುಟ್ಟಿನ ನೋವು', 'ಋತುಚಕ್ರ ನೋವು', 'period pain']
  },
  Sprain: {
    en: ['sprain', 'twisted ankle', 'ligament pain'],
    hi: ['मोच', 'मोच आना', 'sprain', 'moch'],
    kn: ['ಮುರಿತ', 'ಸ್ನಾಯು ನೋವು', 'sprain']
  },
  Indigestion: {
    en: ['indigestion', 'acidity', 'gas', 'bloating', 'stomach upset'],
    hi: ['अपच', 'गैस', 'एसिडिटी', 'पेट खराब', 'apach', 'gas'],
    kn: ['ಅಜೀರ್ಣ', 'ಅಮ್ಲತೆ', 'gas', 'indigestion']
  },
  Toothache: {
    en: ['toothache', 'tooth pain', 'dental pain'],
    hi: ['दांत दर्द', 'दंत दर्द', 'daant dard', 'toothache'],
    kn: ['ಹಲ್ಲು ನೋವು', 'hallu novu', 'toothache']
  }
};

export const getAliasesForLocale = (symptom, locale = 'en') => {
  const entry = SYMPTOM_ALIASES[symptom];
  if (!entry) return [symptom.toLowerCase()];
  const langs = locale === 'en' ? ['en'] : [locale, 'en'];
  const aliases = new Set();
  langs.forEach((lang) => {
    (entry[lang] || []).forEach((a) => aliases.add(a.toLowerCase()));
  });
  return Array.from(aliases);
};

export const matchSymptomsFromText = (text, locale = 'en') => {
  const raw = String(text || '').toLowerCase();
  const normalizedLatin = raw.replace(/[^a-z\s]/g, ' ');
  const tokenSet = new Set(normalizedLatin.split(/\s+/).filter(Boolean));

  return Object.keys(SYMPTOM_ALIASES).filter((symptom) => {
    const aliases = getAliasesForLocale(symptom, locale);
    return aliases.some((alias) => {
      const key = alias.toLowerCase();
      if (/[^\x00-\x7F]/.test(key)) {
        return raw.includes(key);
      }
      if (key.includes(' ')) return normalizedLatin.includes(key) || raw.includes(key);
      return tokenSet.has(key) || raw.includes(key);
    });
  });
};
