import { Info } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';

const Disclaimer = () => {
  const { t } = useLanguage();

  return (
    <div className="w-full max-w-3xl mx-auto bg-[#fef3c7]/60 border border-[#fde68a] rounded-2xl px-5 py-4">
      <div className="flex items-start gap-3 text-left">
        <Info size={18} className="text-[#b45309] mt-0.5 shrink-0" />
        <p className="text-xs sm:text-sm text-[#7c5210] leading-relaxed">
          <span className="font-semibold">{t('layout.disclaimerTitle')}</span>{' '}
          {t('layout.disclaimer')}
        </p>
      </div>
    </div>
  );
};

export default Disclaimer;
