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
  { key: 'feverAbove104', label: 'Has your fever gone above 104°F (40°C)?' },
  { key: 'fatigueWeakness', label: 'Are you feeling unusually weak or fatigued?' },
  { key: 'durationMoreThan3Days', label: 'Have symptoms lasted more than 3 days?' },
  { key: 'takenOtherMedicine', label: 'Have you taken any other medication recently?' }
];

const severityStyles = {
  Mild: {
    badge: 'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]',
    label: 'Mild — keep an eye on it'
  },
  Moderate: {
    badge: 'bg-[#fef3c7] text-[#854d0e] border-[#fde68a]',
    label: 'Moderate — consider a check-in'
  },
  High: {
    badge: 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]',
    label: 'High — please see a doctor soon'
  }
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
        setError('Please enter your age and weight before continuing.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (selectedSymptoms.length === 0) {
        setError('Please pick at least one symptom.');
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
        setError(response.error || 'We couldn\'t analyze your symptoms right now.');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Analysis service unavailable.';
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
      setError(
        'Microphone is blocked for this site. Click the lock/camera icon next to the address bar and allow microphone access.'
      );
      return;
    }

    // Force a real permission prompt on browsers where Permissions API reports
    // "prompt" but speech recognition silently fails without getUserMedia.
    try {
      const stream = await navigator.mediaDevices?.getUserMedia?.({ audio: true });
      stream?.getTracks?.().forEach((track) => track.stop());
    } catch {
      setError('Microphone access is required for voice input.');
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
        onError: ({ message }) => {
          setError(message);
          setIsListening(false);
        },
        onEnd: () => {
          setIsListening(false);
          recognitionRef.current = null;
        }
      });
    } catch (err) {
      setError(err.message || 'Voice recognition isn\'t available.');
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

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-10 text-center space-y-3">
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[#0f1f2e] tracking-tight">
          {t('symptoms.title')}
        </h1>
        <p className="text-[#3e4c5b]">
          Walk through four quick steps. We'll classify the severity and suggest next steps.
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
              <h2 className="font-display text-2xl font-semibold text-[#0f1f2e]">A little about you</h2>
              <p className="text-sm text-[#7b8593] mt-1">
                Helps us calibrate severity. We don't share this with anyone.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <Input
                label="Age"
                type="number"
                placeholder="e.g. 28"
                value={personalData.age}
                onChange={(e) => setPersonalData({ ...personalData, age: e.target.value })}
                required
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#0f1f2e]">Sex</label>
                <select
                  value={personalData.sex}
                  onChange={(e) => setPersonalData({ ...personalData, sex: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-[#d4cfbf] rounded-xl text-[#0f1f2e] outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#0f766e]/10 transition-all"
                >
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <Input
                label="Weight (kg)"
                type="number"
                placeholder="e.g. 70"
                value={personalData.weight}
                onChange={(e) => setPersonalData({ ...personalData, weight: e.target.value })}
                className="sm:col-span-2"
                required
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={nextStep} size="lg">
                Continue <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Symptoms */}
        {step === 2 && (
          <div className="space-y-8">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#0f1f2e]">What's bothering you?</h2>
              <p className="text-sm text-[#7b8593] mt-1">
                Tap everything that applies. You can also speak — we'll match symptoms automatically.
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
                    {symptom}
                  </button>
                );
              })}
            </div>

            <div className="bg-[#f0eee6] border border-[#e6e2d6] rounded-2xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#0f1f2e]">Voice input</h3>
                  <p className="text-xs text-[#7b8593] mt-0.5">
                    Try saying "I have a fever and a cough" — matched symptoms get added.
                  </p>
                </div>
                {voiceSupported ? (
                  <Button
                    type="button"
                    variant={isListening ? 'danger' : 'secondary'}
                    size="sm"
                    onClick={isListening ? stopVoiceCapture : startVoiceCapture}
                  >
                    {isListening ? <><MicOff size={14} /> Stop</> : <><Mic size={14} /> Start</>}
                  </Button>
                ) : (
                  <span className="text-xs text-[#7b8593]">Voice isn't supported in this browser.</span>
                )}
              </div>
              <textarea
                value={voiceInput}
                onChange={(e) => {
                  setVoiceInput(e.target.value);
                  applySymptomsFromText(e.target.value);
                }}
                rows={2}
                placeholder="Voice transcript will appear here, or type freely…"
                className="w-full px-4 py-3 bg-white border border-[#d4cfbf] rounded-xl text-sm text-[#0f1f2e] focus:outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#0f766e]/10"
              />
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={prevStep}>
                <ArrowLeft size={16} /> Back
              </Button>
              <Button onClick={nextStep} size="lg">
                Continue <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — Follow-ups */}
        {step === 3 && (
          <div className="space-y-8">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#0f1f2e]">A few more questions</h2>
              <p className="text-sm text-[#7b8593] mt-1">
                These help the model decide whether you need a doctor.
              </p>
            </div>

            <div className="space-y-3">
              {FOLLOW_UP_QUESTIONS.map((q) => (
                <div
                  key={q.key}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#f0eee6]/60 border border-[#e6e2d6] rounded-2xl px-5 py-4"
                >
                  <span className="text-sm text-[#0f1f2e]">{q.label}</span>
                  <div className="flex gap-2 shrink-0">
                    {['Yes', 'No'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFollowUpAnswers({ ...followUpAnswers, [q.key]: opt })}
                        className={`px-5 py-2 rounded-full text-sm font-medium border transition-all ${
                          followUpAnswers[q.key] === opt
                            ? 'bg-[#0f766e] text-white border-[#0f766e]'
                            : 'bg-white text-[#3e4c5b] border-[#d4cfbf] hover:border-[#0f766e] hover:text-[#0f766e]'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={prevStep} disabled={loading}>
                <ArrowLeft size={16} /> Back
              </Button>
              <Button onClick={nextStep} isLoading={loading} size="lg">
                Analyze symptoms
              </Button>
            </div>
          </div>
        )}

        {/* Step 4 — Results */}
        {step === 4 && analysis && (
          <div className="space-y-8 animate-slide-up">
            <div className="text-center space-y-3">
              <span
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border ${severityStyles[analysis.severity]?.badge || ''}`}
              >
                <Stethoscope size={14} />
                {severityStyles[analysis.severity]?.label || analysis.severity}
              </span>
              <h2 className="font-display text-3xl font-semibold text-[#0f1f2e]">
                Here's what we recommend
              </h2>
              {analysis.mlPrediction && (
                <p className="text-xs text-[#7b8593]">
                  Predicted by{' '}
                  <span className="font-semibold text-[#3e4c5b]">{analysis.mlPrediction.model}</span> ·{' '}
                  confidence {(analysis.mlPrediction.confidence * 100).toFixed(1)}%
                </p>
              )}
            </div>

            {analysis.severity !== 'High' && analysis.recommendations.medicines?.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0f766e] uppercase tracking-wide">
                  <Sparkles size={13} /> {analysis.aiPowered ? 'AI-suggested combination' : 'Recommended combination'}
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
                        {med.timing.map((t, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 rounded-full bg-white border border-[#d4cfbf] text-xs font-medium text-[#3e4c5b]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {analysis.aiWarnings?.length > 0 && (
                  <div className="bg-[#fef3c7]/60 border border-[#fde68a] rounded-2xl px-4 py-3">
                    <p className="flex items-center gap-2 text-xs font-semibold text-[#854d0e] uppercase tracking-wide mb-2">
                      <AlertTriangle size={13} /> Safety notes
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
                  <AlertTriangle size={15} /> No OTC suggestion this time
                </p>
                <p className="text-sm text-[#7f1d1d] mt-1.5 leading-relaxed">
                  Your symptoms look serious enough that we'd rather you talk to a clinician
                  before taking anything new. Use the buttons below to book a consultation or
                  find a hospital nearby.
                </p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <Card className="bg-[#f0eee6]/60 border-[#e6e2d6] p-5">
                <p className="text-xs uppercase tracking-wide text-[#0f766e] font-semibold">Follow up</p>
                <p className="mt-2 text-[#0f1f2e] font-medium">
                  Check in by{' '}
                  {new Date(analysis.recommendations.followUpDate).toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short'
                  })}
                </p>
                <p className="mt-1 text-sm text-[#3e4c5b]">
                  Re-evaluate if symptoms haven't improved by then.
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
                    {analysis.severity === 'High' ? 'See a doctor' : 'Optional consult'}
                  </p>
                  <p className="mt-2 text-[#0f1f2e] font-medium">
                    {analysis.severity === 'High'
                      ? 'Book a consultation as soon as you can.'
                      : 'Talk to a clinician if you\'re unsure.'}
                  </p>
                  <Button
                    variant={analysis.severity === 'High' ? 'accent' : 'primary'}
                    size="sm"
                    className="mt-4"
                    onClick={() => navigate('/teleconsultation')}
                  >
                    Open health assistant <ArrowRight size={14} />
                  </Button>
                </Card>
              )}
            </div>

            {analysis.severity === 'High' && (
              <Card className="bg-white border-[#fecaca] p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#0f1f2e]">Need someone in person?</p>
                    <p className="text-sm text-[#3e4c5b]">
                      Find clinics and hospitals around you, sorted by distance.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => navigate('/care-near-me')}
                  >
                    <MapPin size={14} /> Find nearby care
                  </Button>
                </div>
              </Card>
            )}

            <div className="pt-2 flex justify-center">
              <Button variant="ghost" onClick={handleReset}>
                <RefreshCw size={14} /> Start over
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SymptomChecker;
