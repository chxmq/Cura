import { useMemo, useState } from 'react';
import { X, ZoomIn } from 'lucide-react';
import { API_BASE_URL } from '../utils/constants.js';
import { useLanguage } from '../context/LanguageContext.jsx';

const FIGURE_IDS = [
  'fig01_confusion_matrix',
  'fig02_accuracy_vs_loss',
  'fig03_roc_auc',
  'fig04_kpi_suite',
  'fig05_model_comparison',
  'fig06_cross_validation',
  'fig07_loocv_vs_stratified',
  'fig08_sota_comparison',
  'fig09_significance_tests'
];

const figureUrl = (id) => `${API_BASE_URL.replace(/\/api$/, '')}/api/figures/${id}.png`;

const FigureGallery = ({ title, description }) => {
  const { t } = useLanguage();
  const [active, setActive] = useState(null);

  const figures = useMemo(
    () =>
      FIGURE_IDS.map((id, index) => {
        const num = String(index + 1).padStart(2, '0');
        return {
          id,
          title: t(`analytics.fig${num}Title`),
          caption: t(`analytics.fig${num}Caption`)
        };
      }),
    [t]
  );

  return (
    <>
      <div>
        <h2 className="font-display text-lg font-semibold text-[#0f1f2e] mb-1">{title}</h2>
        {description && <p className="text-xs text-[#7b8593] mb-4">{description}</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {figures.map((fig) => (
            <button
              key={fig.id}
              type="button"
              onClick={() => setActive(fig)}
              className="group text-left rounded-xl border border-[#e6e2d6] overflow-hidden hover:border-[#0f766e]/40 hover:shadow-md transition-all bg-white"
            >
              <div className="relative aspect-[4/3] bg-[#f0eee6]/50">
                <img
                  src={figureUrl(fig.id)}
                  alt={fig.title}
                  loading="lazy"
                  className="w-full h-full object-contain p-2"
                />
                <div className="absolute inset-0 bg-[#0f1f2e]/0 group-hover:bg-[#0f1f2e]/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <ZoomIn size={24} className="text-[#0f766e]" />
                </div>
              </div>
              <div className="p-3 border-t border-[#e6e2d6]">
                <p className="text-sm font-semibold text-[#0f1f2e]">{fig.title}</p>
                <p className="text-[11px] text-[#7b8593] mt-0.5 line-clamp-2">{fig.caption}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {active && (
        <div
          className="fixed inset-0 z-[100] bg-[#0f1f2e]/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal="true"
          aria-label={active.title}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActive(null)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/90 border border-[#e6e2d6] hover:bg-[#f0eee6] transition-colors"
              aria-label={t('figures.close')}
            >
              <X size={18} />
            </button>
            <div className="p-4 sm:p-6 overflow-auto max-h-[90vh]">
              <h3 className="font-display text-lg font-semibold text-[#0f1f2e] mb-1">{active.title}</h3>
              <p className="text-sm text-[#7b8593] mb-4">{active.caption}</p>
              <img
                src={figureUrl(active.id)}
                alt={active.title}
                className="w-full h-auto max-h-[70vh] object-contain mx-auto"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FigureGallery;
