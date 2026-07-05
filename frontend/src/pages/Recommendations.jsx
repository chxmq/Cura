import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, AlertCircle } from 'lucide-react';
import { getLatestRecommendation, getSuggestions } from '../services/recommendationService.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useLanguage } from '../context/LanguageContext.jsx';

function SuggestionsBlock({ recommendation }) {
  const { t } = useLanguage();
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const fetchSuggestions = async () => {
    setLoading(true);
    setErr('');
    try {
      const symptoms =
        recommendation?.symptomAnalysisId &&
        typeof recommendation.symptomAnalysisId === 'object' &&
        Array.isArray(recommendation.symptomAnalysisId.symptoms)
          ? recommendation.symptomAnalysisId.symptoms
          : [];
      const res = await getSuggestions({
        medicines: (recommendation?.medicines || []).map((m) => m.name),
        symptoms,
        query: 'Follow-up and self-care for my current medications'
      });
      if (res.success && res.data) setSuggestions(res.data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Couldn\'t load suggestions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-xl font-semibold text-[#0f1f2e] mb-4 flex items-center gap-2">
        <Sparkles className="text-[#0f766e]" size={18} /> {t('recommendations.aiSuggestions')}
      </h2>

      {suggestions ? (
        <div className="space-y-4 animate-fade-in">
          <ul className="space-y-2.5">
            {(suggestions.suggestions || []).map((s, i) => (
              <li
                key={i}
                className="flex gap-3 items-start bg-[#f0eee6]/40 border border-[#e6e2d6] rounded-xl px-4 py-3"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#0f766e] mt-2 shrink-0" />
                <span className="text-sm text-[#0f1f2e] leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
          {suggestions.followUpAdvice && (
            <div className="bg-[#d6f1ec]/40 border border-[#0f766e]/15 rounded-xl px-4 py-3">
              <p className="text-sm text-[#0f1f2e] leading-relaxed">
                <span className="font-semibold text-[#0f766e]">{t('recommendations.whenToSeeDoctor')} </span>
                {suggestions.followUpAdvice}
              </p>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={fetchSuggestions}>
            Re-generate suggestions
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[#3e4c5b]">
            Get personalised guidance — what to monitor, what to avoid, and when to follow up.
          </p>
          {err && (
            <p className="text-xs text-[#dc2626] flex items-center gap-1.5">
              <AlertCircle size={13} /> {err}
            </p>
          )}
          <Button onClick={fetchSuggestions} disabled={loading} isLoading={loading}>
            Generate suggestions
          </Button>
        </div>
      )}
    </Card>
  );
}

const Recommendations = () => {
  const { t } = useLanguage();
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRecommendation();
  }, []);

  const fetchRecommendation = async () => {
    try {
      const response = await getLatestRecommendation();
      if (response.success) {
        setRecommendation(response.data);
        if (!response.data) {
          setError(t('recommendations.noRecommendations'));
        }
      } else {
        setError(response.error || 'No recommendations available.');
      }
    } catch (err) {
      if (err.code === 'ERR_NETWORK' || err.message?.includes('ERR_CONNECTION_REFUSED')) {
        setError('Can\'t reach the server. Make sure the backend is running on port 5050.');
      } else {
        setError(err.response?.data?.error || t('recommendations.loadError'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
        <p className="mt-5 text-sm text-[#7b8593]">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="text-center mb-10 space-y-3">
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[#0f1f2e] tracking-tight">
          {t('recommendations.title')}
        </h1>
        <p className="text-[#3e4c5b] max-w-2xl mx-auto">
          {t('recommendations.subtitle')}
        </p>
      </div>

      <ErrorMessage message={error} onDismiss={() => setError('')} />

      {recommendation ? (
        <div className="space-y-6 animate-slide-up">
          {recommendation.medicines && recommendation.medicines.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#e6e2d6]">
                <h2 className="font-display text-xl font-semibold text-[#0f1f2e]">Medicines</h2>
                <span className="text-xs font-medium text-[#7b8593] bg-[#f0eee6] px-3 py-1 rounded-full">
                  {recommendation.medicines.length} item{recommendation.medicines.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="space-y-3">
                {recommendation.medicines.map((medicine, idx) => (
                  <div
                    key={idx}
                    className="bg-[#f0eee6]/50 border border-[#e6e2d6] rounded-2xl p-5 flex flex-col sm:flex-row justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-[#0f1f2e]">{medicine.name}</h3>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2.5 py-1 bg-white border border-[#d4cfbf] rounded-full text-[#3e4c5b]">
                          Dose: {medicine.dosage}
                        </span>
                        <span className="px-2.5 py-1 bg-white border border-[#d4cfbf] rounded-full text-[#3e4c5b]">
                          Duration: {medicine.duration}
                        </span>
                      </div>
                    </div>
                    {medicine.timing?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {medicine.timing.map((t, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 rounded-full bg-[#d6f1ec] text-[#0f766e] text-xs font-medium"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {recommendation.followUpDate && (
            <Card className="bg-[#f0eee6]/50 border-[#e6e2d6] text-center py-8">
              <p className="text-xs uppercase tracking-wide text-[#0f766e] font-semibold">Follow up</p>
              <p className="mt-3 font-display text-3xl font-semibold text-[#0f1f2e]">
                {new Date(recommendation.followUpDate).toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
              <p className="mt-2 text-sm text-[#3e4c5b] max-w-md mx-auto">
                Re-evaluate how you're feeling on or before this date.
              </p>
            </Card>
          )}

          <SuggestionsBlock recommendation={recommendation} />

          <Card className="bg-[#fef3c7]/40 border-[#fde68a]">
            <h3 className="text-sm font-semibold text-[#854d0e] mb-3">Things to keep in mind</h3>
            <ul className="space-y-2 text-sm text-[#7c5210]">
              <li className="flex gap-2"><span>•</span> Stick to the dose and timing above.</li>
              <li className="flex gap-2"><span>•</span> Don't stop early just because you feel better.</li>
              <li className="flex gap-2"><span>•</span> If symptoms get worse, talk to a doctor right away.</li>
              <li className="flex gap-2"><span>•</span> Note any side effects to share at your next visit.</li>
            </ul>
          </Card>
        </div>
      ) : (
        <Card className="text-center py-16 border-dashed">
          <p className="text-[#3e4c5b]">
            You haven't run a symptom check yet.{' '}
            <Link to="/symptoms" className="text-[#0f766e] hover:text-[#115e59] font-medium underline-offset-4 hover:underline">
              Start one now
            </Link>
            .
          </p>
        </Card>
      )}
    </div>
  );
};

export default Recommendations;
