import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzePrescription } from '../services/prescriptionService.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import {
  UploadCloud,
  ShieldCheck,
  AlertTriangle,
  Pill,
  RefreshCw,
  ArrowRight,
  MapPin
} from 'lucide-react';

const PrescriptionAnalyzer = () => {
  const { t } = useLanguage();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const navigate = useNavigate();

  const processFile = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith('image/')) {
      setError(t('prescription.imageOnly'));
      return;
    }
    setFile(selectedFile);
    setError('');
    setAnalysis(null);

    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(selectedFile);
  };

  const handleFileChange = (e) => processFile(e.target.files?.[0]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError(t('prescription.chooseImage'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await analyzePrescription(file);
      if (response.success) {
        setAnalysis(response.data);
      } else {
        setError(response.error || t('prescription.analyzeFailed'));
      }
    } catch (err) {
      if (err.code === 'ERR_NETWORK' || err.message?.includes('ERR_CONNECTION_REFUSED')) {
        setError(t('prescription.serverDown'));
      } else {
        setError(err.response?.data?.error || t('prescription.analyzeError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setAnalysis(null);
    setError('');
  };

  const isSafe = analysis?.safetyStatus?.status === 'safe';

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="text-center mb-10 space-y-3">
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[#0f1f2e] tracking-tight">
          {t('prescription.title')}
        </h1>
        <p className="text-[#3e4c5b] max-w-2xl mx-auto">
          {t('prescription.subtitle')}
        </p>
      </div>

      <ErrorMessage message={error} onDismiss={() => setError('')} />

      {!analysis ? (
        <Card className="max-w-2xl mx-auto p-8">
          <form onSubmit={handleSubmit}>
            <div
              className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
                dragActive
                  ? 'border-[#0f766e] bg-[#d6f1ec]/40'
                  : preview
                  ? 'border-[#d4cfbf] bg-[#f0eee6]/40'
                  : 'border-[#d4cfbf] hover:border-[#0f766e]/50 hover:bg-[#f0eee6]/30'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="prescription"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />

              {preview ? (
                <div className="relative z-0">
                  <img
                    src={preview}
                    alt={t('prescription.altPreview')}
                    className="max-h-[360px] mx-auto rounded-xl border border-[#e6e2d6] shadow-[0_4px_16px_rgba(15,31,46,0.08)]"
                  />
                  <p className="mt-4 text-sm font-medium text-[#0f766e]">{t('prescription.imageReady')}</p>
                  <p className="text-xs text-[#7b8593] mt-1">{t('prescription.clickReplace')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-14 h-14 bg-[#d6f1ec] text-[#0f766e] rounded-2xl flex items-center justify-center mx-auto">
                    <UploadCloud size={26} />
                  </div>
                  <div>
                    <p className="text-base font-medium text-[#0f1f2e]">{t('prescription.dropzone')}</p>
                    <p className="text-sm text-[#7b8593] mt-1">{t('prescription.formats')}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                type="submit"
                disabled={!file}
                isLoading={loading}
                size="lg"
                className="sm:min-w-[200px]"
              >
                {loading ? t('prescription.analyzing') : t('prescription.analyze')}
              </Button>
              {preview && (
                <Button type="button" variant="ghost" onClick={handleReset} size="lg">
                  {t('prescription.discard')}
                </Button>
              )}
            </div>
          </form>
        </Card>
      ) : (
        <div className="space-y-8 animate-slide-up">
          {/* Safety banner */}
          <Card className={`p-7 ${isSafe ? 'bg-[#f0fdf4] border-[#bbf7d0]' : 'bg-[#fef2f2] border-[#fecaca]'}`}>
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <div className={`shrink-0 ${isSafe ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                {isSafe ? <ShieldCheck size={42} strokeWidth={1.6} /> : <AlertTriangle size={42} strokeWidth={1.6} />}
              </div>
              <div className="flex-1">
                <h2 className="font-display text-2xl font-semibold text-[#0f1f2e]">
                  {isSafe ? t('prescription.safe') : t('prescription.headsUpReview')}
                </h2>
                <p className="text-sm text-[#3e4c5b] mt-1">
                  {isSafe
                    ? t('prescription.looksSafeDesc')
                    : t('prescription.reviewNeededDesc')}
                </p>
                {!isSafe && analysis.safetyStatus.issues?.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {analysis.safetyStatus.issues.map((issue, idx) => (
                      <li key={idx} className="text-sm text-[#7f1d1d] flex gap-2">
                        <span className="text-[#dc2626]">•</span>
                        <span>{issue.description || issue}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {analysis.safetyStatus.warnings?.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {analysis.safetyStatus.warnings.map((warn, idx) => (
                      <li key={idx} className="text-sm text-[#854d0e] flex gap-2">
                        <span className="text-[#d97706]">•</span>
                        <span>{warn}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Extracted medicines */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#e6e2d6]">
                  <h2 className="font-display text-xl font-semibold text-[#0f1f2e] flex items-center gap-2">
                    <Pill className="text-[#0f766e]" size={20} /> {t('prescription.medicinesFound')}
                  </h2>
                  <span className="text-xs font-medium text-[#7b8593] bg-[#f0eee6] px-3 py-1 rounded-full">
                    {analysis.extractedData.medicines.length}{' '}
                    {analysis.extractedData.medicines.length === 1
                      ? t('prescription.item')
                      : t('prescription.items')}
                  </span>
                </div>

                <div className="space-y-3">
                  {analysis.extractedData.medicines.map((medicine, idx) => (
                    <div
                      key={idx}
                      className="p-5 bg-[#f0eee6]/40 border border-[#e6e2d6] rounded-2xl"
                    >
                      <div className="flex flex-col sm:flex-row justify-between gap-4">
                        <div className="space-y-1.5">
                          <h3 className="text-lg font-semibold text-[#0f1f2e]">{medicine.name}</h3>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="px-2.5 py-1 bg-white border border-[#d4cfbf] rounded-full text-[#3e4c5b]">
                              {medicine.dosage}
                            </span>
                            <span className="px-2.5 py-1 bg-[#d6f1ec] text-[#0f766e] rounded-full">
                              {medicine.frequency}
                            </span>
                          </div>
                        </div>
                        {medicine.timing?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {medicine.timing.map((time, i) => (
                              <span
                                key={i}
                                className="px-2.5 py-1 bg-white border border-[#e6e2d6] rounded-full text-xs font-medium text-[#3e4c5b]"
                              >
                                {time}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Side rail */}
            <div className="space-y-4">
              <Card>
                <h3 className="text-sm font-semibold text-[#0f1f2e]">{t('prescription.prescriptionDetails')}</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-[#7b8593] uppercase tracking-wide">{t('prescription.doctor')}</p>
                    <p className="font-medium text-[#0f1f2e] mt-0.5">
                      {analysis.extractedData.doctorName || t('prescription.notDetected')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7b8593] uppercase tracking-wide">{t('prescription.date')}</p>
                    <p className="font-medium text-[#0f1f2e] mt-0.5">
                      {analysis.extractedData.date
                        ? new Date(analysis.extractedData.date).toLocaleDateString()
                        : t('prescription.notDetected')}
                    </p>
                  </div>
                </div>
              </Card>

              {isSafe ? (
                <Card className="bg-[#d6f1ec]/40 border-[#0f766e]/20">
                  <p className="text-xs uppercase tracking-wide text-[#0f766e] font-semibold">{t('prescription.step4Final')}</p>
                  <h3 className="text-sm font-semibold text-[#0f1f2e] mt-1">{t('prescription.pickUpMedicines')}</h3>
                  <p className="text-sm text-[#3e4c5b] mt-2">
                    {t('prescription.pickUpDesc')}
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-4 w-full"
                    onClick={() => navigate('/care-near-me')}
                  >
                    <MapPin size={14} /> {t('prescription.findPharmacies')}
                  </Button>
                </Card>
              ) : (
                <>
                  <Card className="bg-[#fef2f2] border-[#fecaca]">
                    <p className="text-xs uppercase tracking-wide text-[#dc2626] font-semibold">{t('prescription.step4TalkFirst')}</p>
                    <h3 className="text-sm font-semibold text-[#0f1f2e] mt-1">{t('prescription.dontFill')}</h3>
                    <p className="text-sm text-[#7f1d1d] mt-2">
                      {t('prescription.dontFillDesc')}
                    </p>
                    <div className="space-y-2 mt-4">
                      <Button
                        variant="accent"
                        size="sm"
                        className="w-full"
                        onClick={() => navigate('/teleconsultation')}
                      >
                        {t('symptoms.openHealthAssistant')} <ArrowRight size={14} />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => navigate('/care-near-me')}
                      >
                        <MapPin size={14} /> {t('prescription.findClinicInstead')}
                      </Button>
                    </div>
                  </Card>

                  <Card className="bg-[#f0eee6]/50 border-[#e6e2d6]">
                    <p className="text-xs uppercase tracking-wide text-[#7b8593] font-semibold">{t('prescription.afterConsult')}</p>
                    <p className="text-sm text-[#3e4c5b] mt-2">
                      {t('prescription.afterConsultDesc')}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => navigate('/care-near-me')}
                    >
                      <MapPin size={14} /> {t('prescription.pharmaciesNearby')}
                    </Button>
                  </Card>
                </>
              )}

              <Button variant="ghost" className="w-full" onClick={handleReset}>
                <RefreshCw size={14} /> {t('prescription.processNew')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionAnalyzer;
