import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Check, ArrowRight, ArrowLeft, RefreshCw, Stethoscope, MapPin, Sparkles, AlertTriangle } from 'lucide-react';
import { analyzeSymptoms } from '../services/symptomService.js';
import { SYMPTOMS_LIST } from '../utils/constants.js';
import { matchSymptomsFromText } from '../utils/symptomAliases.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { getSpeechLang } from '../i18n/index.js';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import {
  isVoiceSupported,
  startSpeechRecognition,
  stopSpeechRecognition,
  checkMicrophonePermission
} from '../services/voiceService.js';

const STEPS = [
  { id: 1, labelKey: 'symptoms.stepAbout' },
  { id: 2, labelKey: 'symptoms.stepSymptoms' },
  { id: 3, labelKey: 'symptoms.stepFollowUp' },
  { id: 4, labelKey: 'symptoms.stepResult' }
];

const FOLLOW_UP_QUESTIONS = [
  { key: 'feverAbove104', labelKey: 'symptoms.followUp.feverAbove104' },
  { key: 'fatigueWeakness', labelKey: 'symptoms.followUp.fatigueWeakness' },
  { key: 'durationMoreThan3Days', labelKey: 'symptoms.followUp.durationMoreThan3Days' },
  { key: 'takenOtherMedicine', labelKey: 'symptoms.followUp.takenOtherMedicine' }
];

const SEX_OPTIONS = [
  { value: 'Male', labelKey: 'symptoms.male' },
  { value: 'Female', labelKey: 'symptoms.female' },
  { value: 'Other', labelKey: 'symptoms.other' }
];

const YES_NO_OPTIONS = [
  { value: 'Yes', labelKey: 'common.yes' },
  { value: 'No', labelKey: 'common.no' }
];

const VOICE_ERROR_KEYS = {
  'not-allowed': 'voice.notAllowed',
  'service-not-allowed': 'voice.serviceNotAllowed',
  'no-speech': 'voice.noSpeech',
  'audio-capture': 'voice.audioCapture',
  network: 'voice.network',
  aborted: 'voice.aborted',
  'bad-grammar': 'voice.badGrammar',
  'language-not-supported': 'voice.languageNotSupported',
  'start-failed': 'voice.startFailed'
};

const getSeverityStyle = (t, severity) => {
  const styles = {
    Mild: {
      badge: 'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]',
      labelKey: 'symptoms.severity.mild'
    },
    Moderate: {
      badge: 'bg-[#fef3c7] text-[#854d0e] border-[#fde68a]',
      labelKey: 'symptoms.severity.moderate'
    },
    High: {
      badge: 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]',
      labelKey: 'symptoms.severity.high'
    }
  };
  const style = styles[severity];
  if (!style) return { badge: '', label: severity };
  return { badge: style.badge, label: t(style.labelKey) };
};

const getSymptomLabel = (t, symptom) => {
  const key = `symptoms.symptomNames.${symptom}`;
  const translated = t(key);
  return translated === key ? symptom : translated;
};

const getVoiceErrorMessage = (t, { code }) => {
  const key = VOICE_ERROR_KEYS[code];
  if (key) return t(key);
  if (code) return t('voice.genericError', { code });
  return t('symptoms.voiceError');
};

const SymptomChecker = () => {
  const { locale, t } = useLanguage();
  const [step, setStep] = useState(1);
  const [personalData, setPersonalData] = useState({ age: '', sex: 'Male', weight: '' });
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [followUpAnswers, setFollowUpAnswers] = useState({
    feverAbove104: 'No',
    fatigueWeakness: 'No',
    durationMoreThan3Days: 'No',
    takenOtherMedicine: 'No'
  });
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [voiceInput, setVoiceInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported] = useState(isVoiceSupported());
  const recognitionRef = useRef(null);
  const navigate = useNavigate();

  const toggleSymptom = (symptom) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    );
  };

  const nextStep = () => {
    setError('');
    if (step === 1) {
      if (!personalData.age || !personalData.weight) {
        setError(t('symptoms.ageWeightRequired'));
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (selectedSymptoms.length === 0) {
        setError(t('symptoms.pickSymptom'));
        return;
      }
      setStep(3);
    } else if (step === 3) {
      handleAnalysis();
    }
  };

  const prevStep = () => {
    setError('');
    setStep((s) => Math.max(1, s - 1));
  };

  const handleAnalysis = async () => {
    setLoading(true);
    try {
      const formattedData = {
        symptoms: selectedSymptoms,
        personalData: {
          age: parseInt(personalData.age, 10),
          sex: personalData.sex.toLowerCase(),
          weight: parseFloat(personalData.weight)
        },
        followUpAnswers: {
          feverAbove104: followUpAnswers.feverAbove104 === 'Yes',
          fatigueWeakness: followUpAnswers.fatigueWeakness === 'Yes',
          durationMoreThan3Days: followUpAnswers.durationMoreThan3Days === 'Yes',
          takenOtherMedicine: followUpAnswers.takenOtherMedicine === 'Yes'
        }
      };

      const response = await analyzeSymptoms(formattedData);
      if (response.success) {
        setAnalysis(response.data);
        setStep(4);
      } else {
        setError(response.error || t('symptoms.analyzeFailed'));
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || t('symptoms.serviceUnavailable');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedSymptoms([]);
    setAnalysis(null);
    setError('');
    setPersonalData({ age: '', sex: 'Male', weight: '' });
    setFollowUpAnswers({
      feverAbove104: 'No',
      fatigueWeakness: 'No',
      durationMoreThan3Days: 'No',
      takenOtherMedicine: 'No'
    });
    setVoiceInput('');
    if (recognitionRef.current) {
      stopSpeechRecognition(recognitionRef.current);
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        stopSpeechRecognition(recognitionRef.current);
      }
    };
  }, []);

  const applySymptomsFromText = (text) => {
    const matchedSymptoms = matchSymptomsFromText(text, locale);
    if (matchedSymptoms.length > 0) {
      setSelectedSymptoms((prev) => {
        const merged = new Set(prev);
        matchedSymptoms.forEach((symptom) => merged.add(symptom));
        return Array.from(merged);
      });
    }
  };

  const startVoiceCapture = async () => {
    if (!voiceSupported || isListening) return;
    setError('');

    // Pre-check microphone permission so we can give a clear message
    // *before* the recognition silently fails.
    const permission = await checkMicrophonePermission();
    if (permission === 'denied') {
      setError(t('symptoms.micBlocked'));
      return;
    }

    // Force a real permission prompt on browsers where Permissions API reports
    // "prompt" but speech recognition silently fails without getUserMedia.
    try {
      const stream = await navigator.mediaDevices?.getUserMedia?.({ audio: true });
      stream?.getTracks?.().forEach((track) => track.stop());
    } catch {
      setError(t('symptoms.micRequired'));
      return;
    }

    try {
      recognitionRef.current = startSpeechRecognition({
        lang: getSpeechLang(locale),
        onStart: () => setIsListening(true),
        onResult: (transcript) => {
          setVoiceInput(transcript);
          applySymptomsFromText(transcript);
        },
        onError: ({ code }) => {
          setError(getVoiceErrorMessage(t, { code }));
          setIsListening(false);
        },
        onEnd: () => {
          setIsListening(false);
          recognitionRef.current = null;
        }
      });
    } catch {
      setError(t('voice.notSupported'));
      setIsListening(false);
    }
  };

  const stopVoiceCapture = () => {
    if (recognitionRef.current) {
      stopSpeechRecognition(recognitionRef.current);
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const severityStyle = analysis ? getSeverityStyle(t, analysis.severity) : null;

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-10 text-center space-y-3">
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[#0f1f2e] tracking-tight">
          {t('symptoms.title')}
        </h1>
        <p className="text-[#3e4c5b]">
          {t('symptoms.subtitle')}
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3 text-xs font-medium text-[#7b8593]">
          {STEPS.map((s) => (
            <span key={s.id} className={s.id <= step ? 'text-[#0f766e]' : ''}>
              {s.id}. {t(s.labelKey)}
            </span>
          ))}
        </div>
        <div className="h-1.5 bg-[#e6e2d6] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0f766e] rounded-full transition-all duration-500"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>

      <ErrorMessage message={error} onDismiss={() => setError('')} />

      <Card className="animate-slide-up p-8">
        {/* Step 1 — Personal data */}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#0f1f2e]">{t('symptoms.aboutYou')}</h2>
              <p className="text-sm text-[#7b8593] mt-1">
                {t('symptoms.aboutYouNote')}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <Input
                label={t('symptoms.age')}
                type="number"
                placeholder={t('symptoms.agePlaceholder')}
                value={personalData.age}
                onChange={(e) => setPersonalData({ ...personalData, age: e.target.value })}
                required
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#0f1f2e]">{t('symptoms.sex')}</label>
                <select
                  value={personalData.sex}
                  onChange={(e) => setPersonalData({ ...personalData, sex: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-[#d4cfbf] rounded-xl text-[#0f1f2e] outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#0f766e]/10 transition-all"
                >
                  {SEX_OPTIONS.map(({ value, labelKey }) => (
                    <option key={value} value={value}>
                      {t(labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label={t('symptoms.weight')}
                type="number"
                placeholder={t('symptoms.weightPlaceholder')}
                value={personalData.weight}
                onChange={(e) => setPersonalData({ ...personalData, weight: e.target.value })}
                className="sm:col-span-2"
                required
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={nextStep} size="lg">
                {t('symptoms.continue')} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Symptoms */}
        {step === 2 && (
          <div className="space-y-8">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#0f1f2e]">{t('symptoms.whatsBothering')}</h2>
              <p className="text-sm text-[#7b8593] mt-1">
                {t('symptoms.whatsBotheringNote')}
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {SYMPTOMS_LIST.map((symptom) => {
                const selected = selectedSymptoms.includes(symptom);
                return (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => toggleSymptom(symptom)}
                    className={`px-4 py-2.5 rounded-full text-sm font-medium border transition-all ${
                      selected
                        ? 'bg-[#0f766e] text-white border-[#0f766e] shadow-[0_2px_8px_rgba(15,118,110,0.25)]'
                        : 'bg-white text-[#3e4c5b] border-[#d4cfbf] hover:border-[#0f766e] hover:text-[#0f766e]'
                    }`}
                  >
                    {selected && <Check size={14} className="inline-block mr-1.5 -mt-0.5" />}
                    {getSymptomLabel(t, symptom)}
                  </button>
                );
              })}
            </div>

            <div className="bg-[#f0eee6] border border-[#e6e2d6] rounded-2xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#0f1f2e]">{t('symptoms.voiceInput')}</h3>
                  <p className="text-xs text-[#7b8593] mt-0.5">
                    {t('symptoms.voiceInputHint')}
                  </p>
                </div>
                {voiceSupported ? (
                  <Button
                    type="button"
                    variant={isListening ? 'danger' : 'secondary'}
                    size="sm"
                    onClick={isListening ? stopVoiceCapture : startVoiceCapture}
                  >
                    {isListening ? (
                      <>
                        <MicOff size={14} /> {t('symptoms.voiceStop')}
                      </>
                    ) : (
                      <>
                        <Mic size={14} /> {t('symptoms.voiceStart')}
                      </>
                    )}
                  </Button>
                ) : (
                  <span className="text-xs text-[#7b8593]">{t('symptoms.voiceUnsupported')}</span>
                )}
              </div>
              <textarea
                value={voiceInput}
                onChange={(e) => {
                  setVoiceInput(e.target.value);
                  applySymptomsFromText(e.target.value);
                }}
                rows={2}
                placeholder={t('symptoms.textareaPlaceholder')}
                className="w-full px-4 py-3 bg-white border border-[#d4cfbf] rounded-xl text-sm text-[#0f1f2e] focus:outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#0f766e]/10"
              />
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={prevStep}>
                <ArrowLeft size={16} /> {t('symptoms.back')}
              </Button>
              <Button onClick={nextStep} size="lg">
                {t('symptoms.continue')} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — Follow-ups */}
        {step === 3 && (
          <div className="space-y-8">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#0f1f2e]">{t('symptoms.stepFollowUp')}</h2>
            </div>

            <div className="space-y-3">
              {FOLLOW_UP_QUESTIONS.map((q) => (
                <div
                  key={q.key}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#f0eee6]/60 border border-[#e6e2d6] rounded-2xl px-5 py-4"
                >
                  <span className="text-sm text-[#0f1f2e]">{t(q.labelKey)}</span>
                  <div className="flex gap-2 shrink-0">
                    {YES_NO_OPTIONS.map(({ value, labelKey }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFollowUpAnswers({ ...followUpAnswers, [q.key]: value })}
                        className={`px-5 py-2 rounded-full text-sm font-medium border transition-all ${
                          followUpAnswers[q.key] === value
                            ? 'bg-[#0f766e] text-white border-[#0f766e]'
                            : 'bg-white text-[#3e4c5b] border-[#d4cfbf] hover:border-[#0f766e] hover:text-[#0f766e]'
                        }`}
                      >
                        {t(labelKey)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={prevStep} disabled={loading}>
                <ArrowLeft size={16} /> {t('symptoms.back')}
              </Button>
              <Button onClick={nextStep} isLoading={loading} size="lg">
                {t('symptoms.analyze')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4 — Results */}
        {step === 4 && analysis && (
          <div className="space-y-8 animate-slide-up">
            <div className="text-center space-y-3">
              <span
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border ${severityStyle?.badge || ''}`}
              >
                <Stethoscope size={14} />
                {severityStyle?.label || analysis.severity}
              </span>
              <h2 className="font-display text-3xl font-semibold text-[#0f1f2e]">
                {t('symptoms.resultRecommendTitle')}
              </h2>
              {analysis.mlPrediction && (
                <p className="text-xs text-[#7b8593]">
                  {t('symptoms.predictedBy')}{' '}
                  <span className="font-semibold text-[#3e4c5b]">{analysis.mlPrediction.model}</span> ·{' '}
                  {t('symptoms.confidence')} {(analysis.mlPrediction.confidence * 100).toFixed(1)}%
                </p>
              )}
            </div>

            {analysis.severity !== 'High' && analysis.recommendations.medicines?.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0f766e] uppercase tracking-wide">
                  <Sparkles size={13} />{' '}
                  {analysis.aiPowered ? t('symptoms.aiSuggestedCombination') : t('symptoms.recommendedCombination')}
                </div>

                {analysis.aiRationale && (
                  <div className="bg-[#d6f1ec]/40 border border-[#0f766e]/15 rounded-2xl px-4 py-3">
                    <p className="text-sm text-[#0f1f2e] leading-relaxed">
                      {analysis.aiRationale}
                    </p>
                  </div>
                )}

                {analysis.recommendations.medicines.map((med, idx) => (
                  <div
                    key={idx}
                    className="bg-[#f0eee6]/60 border border-[#e6e2d6] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <h4 className="text-lg font-semibold text-[#0f1f2e]">{med.name}</h4>
                      <p className="text-sm text-[#3e4c5b] mt-0.5">
                        {med.dosage}
                        {med.duration ? ` · ${med.duration}` : ''}
                      </p>
                    </div>
                    {med.timing && med.timing.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {med.timing.map((slot, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 rounded-full bg-white border border-[#d4cfbf] text-xs font-medium text-[#3e4c5b]"
                          >
                            {slot}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {analysis.aiWarnings?.length > 0 && (
                  <div className="bg-[#fef3c7]/60 border border-[#fde68a] rounded-2xl px-4 py-3">
                    <p className="flex items-center gap-2 text-xs font-semibold text-[#854d0e] uppercase tracking-wide mb-2">
                      <AlertTriangle size={13} /> {t('symptoms.safetyNotes')}
                    </p>
                    <ul className="space-y-1 text-sm text-[#7c5210]">
                      {analysis.aiWarnings.map((w, i) => (
                        <li key={i} className="flex gap-2">
                          <span>•</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {analysis.severity === 'High' && (
              <div className="bg-[#fef2f2] border border-[#fecaca] rounded-2xl px-5 py-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#991b1b]">
                  <AlertTriangle size={15} /> {t('symptoms.noOtcSuggestion')}
                </p>
                <p className="text-sm text-[#7f1d1d] mt-1.5 leading-relaxed">
                  {t('symptoms.noOtcBody')}
                </p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <Card className="bg-[#f0eee6]/60 border-[#e6e2d6] p-5">
                <p className="text-xs uppercase tracking-wide text-[#0f766e] font-semibold">{t('common.followUp')}</p>
                <p className="mt-2 text-[#0f1f2e] font-medium">
                  {t('symptoms.followUpCheckIn')}{' '}
                  {new Date(analysis.recommendations.followUpDate).toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short'
                  })}
                </p>
                <p className="mt-1 text-sm text-[#3e4c5b]">
                  {t('symptoms.followUpReEvaluate')}
                </p>
              </Card>

              {(analysis.recommendations.teleconsultationRecommended || analysis.severity === 'High') && (
                <Card
                  className={`p-5 ${
                    analysis.severity === 'High'
                      ? 'bg-[#fef2f2] border-[#fecaca]'
                      : 'bg-[#d6f1ec]/60 border-[#0f766e]/20'
                  }`}
                >
                  <p
                    className={`text-xs uppercase tracking-wide font-semibold ${
                      analysis.severity === 'High' ? 'text-[#dc2626]' : 'text-[#0f766e]'
                    }`}
                  >
                    {analysis.severity === 'High' ? t('symptoms.consultDoctor') : t('symptoms.optionalConsult')}
                  </p>
                  <p className="mt-2 text-[#0f1f2e] font-medium">
                    {analysis.severity === 'High'
                      ? t('symptoms.bookConsultation')
                      : t('symptoms.talkClinician')}
                  </p>
                  <Button
                    variant={analysis.severity === 'High' ? 'accent' : 'primary'}
                    size="sm"
                    className="mt-4"
                    onClick={() => navigate('/teleconsultation')}
                  >
                    {t('symptoms.openHealthAssistant')} <ArrowRight size={14} />
                  </Button>
                </Card>
              )}
            </div>

            {analysis.severity === 'High' && (
              <Card className="bg-white border-[#fecaca] p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#0f1f2e]">{t('symptoms.needInPerson')}</p>
                    <p className="text-sm text-[#3e4c5b]">
                      {t('symptoms.findClinicsNearby')}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => navigate('/care-near-me')}
                  >
                    <MapPin size={14} /> {t('symptoms.findNearbyCare')}
                  </Button>
                </div>
              </Card>
            )}

            <div className="pt-2 flex justify-center">
              <Button variant="ghost" onClick={handleReset}>
                <RefreshCw size={14} /> {t('symptoms.startOver')}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SymptomChecker;
