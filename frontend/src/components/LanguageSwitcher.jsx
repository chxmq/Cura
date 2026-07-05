import { Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';

const LanguageSwitcher = ({ className = '' }) => {
  const { locale, setLocale, languages, t } = useLanguage();

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Globe size={15} className="text-[#7b8593] shrink-0" aria-hidden />
      <label htmlFor="cura-lang-select" className="sr-only">{t('language.label')}</label>
      <select
        id="cura-lang-select"
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        className="text-sm font-medium text-[#3e4c5b] bg-transparent border border-[#e6e2d6] rounded-lg px-2 py-1.5 cursor-pointer hover:border-[#0f766e]/40 focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20"
        aria-label={t('language.label')}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {t(`language.${lang.code}`)}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSwitcher;
