import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  FileText,
  ChevronDown,
  Search,
  Trash2,
  Download,
  MapPin,
  MessageSquareHeart,
  RotateCcw,
  Pill,
  Eye
} from 'lucide-react';
import { getSymptomHistory, deleteSymptomHistory } from '../services/symptomService.js';
import { getPrescriptionHistory, deletePrescriptionHistory } from '../services/prescriptionService.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useLanguage } from '../context/LanguageContext.jsx';

const severityBadge = {
  Mild: 'bg-[#dcfce7] text-[#166534]',
  Moderate: 'bg-[#fef3c7] text-[#854d0e]',
  High: 'bg-[#fee2e2] text-[#991b1b]'
};

const History = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('symptoms');
  const [symptomHistory, setSymptomHistory] = useState([]);
  const [prescriptionHistory, setPrescriptionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const [symptomRes, prescriptionRes] = await Promise.all([
        getSymptomHistory(),
        getPrescriptionHistory()
      ]);
      if (symptomRes.success) setSymptomHistory(symptomRes.data || []);
      if (prescriptionRes.success) setPrescriptionHistory(prescriptionRes.data || []);
    } catch {
      setError(t('history.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, type) => {
    if (!window.confirm(t('history.deleteConfirm'))) return;
    try {
      if (type === 'symptoms') {
        await deleteSymptomHistory(id);
        setSymptomHistory((prev) => prev.filter((item) => item._id !== id));
      } else {
        await deletePrescriptionHistory(id);
        setPrescriptionHistory((prev) => prev.filter((item) => item._id !== id));
      }
    } catch {
      setError('Couldn\'t delete that record. Try again.');
    }
  };

  const downloadRecord = (item, type) => {
    const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date(item.createdAt || Date.now()).toISOString().slice(0, 10);
    a.href = url;
    a.download = `cura-${type}-${timestamp}-${item._id || 'record'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getActions = (item) => {
    if (activeTab === 'symptoms') {
      const needsConsult = item.recommendations?.teleconsultationRecommended || item.severity === 'High';
      return [
        {
          label: 'View',
          icon: Eye,
          variant: 'secondary',
          onClick: () => setExpandedId(expandedId === item._id ? null : item._id)
        },
        {
          label: 'Run again',
          icon: RotateCcw,
          variant: 'ghost',
          onClick: () => navigate('/symptoms')
        },
        ...(needsConsult
          ? [{
              label: 'Assistant',
              icon: MessageSquareHeart,
              variant: 'primary',
              onClick: () => navigate('/teleconsultation')
            }]
          : []),
        ...(item.severity === 'High'
          ? [{
              label: 'Nearby care',
              icon: MapPin,
              variant: 'accent',
              onClick: () => navigate('/care-near-me')
            }]
          : []),
        {
          label: 'Download',
          icon: Download,
          variant: 'ghost',
          onClick: () => downloadRecord(item, 'symptom')
        }
      ];
    }

    const unsafe = item.safetyStatus?.status === 'unsafe';
    return [
      {
        label: 'View',
        icon: Eye,
        variant: 'secondary',
        onClick: () => setExpandedId(expandedId === item._id ? null : item._id)
      },
      {
        label: 'New scan',
        icon: RotateCcw,
        variant: 'ghost',
        onClick: () => navigate('/prescription')
      },
      ...(unsafe
        ? [{
            label: 'Assistant',
            icon: MessageSquareHeart,
            variant: 'primary',
            onClick: () => navigate('/teleconsultation')
          }]
        : [{
            label: 'Pharmacies',
            icon: Pill,
            variant: 'primary',
            onClick: () => navigate('/care-near-me')
          }]),
      ...(unsafe
        ? [{
            label: 'Nearby clinic',
            icon: MapPin,
            variant: 'accent',
            onClick: () => navigate('/care-near-me')
          }]
        : []),
      {
        label: 'Download',
        icon: Download,
        variant: 'ghost',
        onClick: () => downloadRecord(item, 'prescription')
      }
    ];
  };

  const list = activeTab === 'symptoms' ? symptomHistory : prescriptionHistory;

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="text-center mb-10 space-y-3">
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[#0f1f2e] tracking-tight">
          {t('history.title')}
        </h1>
        <p className="text-[#3e4c5b]">
          {t('history.subtitle')}
        </p>
      </div>

      <ErrorMessage message={error} onDismiss={() => setError('')} />

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-2">
            <button
              onClick={() => setActiveTab('symptoms')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'symptoms'
                  ? 'bg-[#0f766e] text-white'
                  : 'text-[#3e4c5b] hover:bg-[#f0eee6]'
              }`}
            >
              <Activity size={18} /> {t('history.symptomsTab')}
            </button>
            <button
              onClick={() => setActiveTab('prescriptions')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors mt-1 ${
                activeTab === 'prescriptions'
                  ? 'bg-[#0f766e] text-white'
                  : 'text-[#3e4c5b] hover:bg-[#f0eee6]'
              }`}
            >
              <FileText size={18} /> {t('history.prescriptionsTab')}
            </button>
          </Card>

          <Card className="bg-[#f0eee6]/50">
            <p className="text-xs uppercase tracking-wide text-[#7b8593] font-semibold">Total records</p>
            <p className="mt-2 font-display text-3xl font-semibold text-[#0f1f2e]">
              {symptomHistory.length + prescriptionHistory.length}
            </p>
            <p className="mt-1 text-xs text-[#7b8593]">
              {symptomHistory.length} symptom · {prescriptionHistory.length} prescription
            </p>
          </Card>

          <Card className="bg-white">
            <p className="text-xs uppercase tracking-wide text-[#7b8593] font-semibold">Available actions</p>
            <ul className="mt-3 space-y-2 text-sm text-[#3e4c5b]">
              <li className="flex gap-2"><Eye size={14} className="text-[#0f766e] mt-0.5" /> View full record</li>
              <li className="flex gap-2"><RotateCcw size={14} className="text-[#0f766e] mt-0.5" /> Run the flow again</li>
              <li className="flex gap-2"><MessageSquareHeart size={14} className="text-[#0f766e] mt-0.5" /> Open assistant when needed</li>
              <li className="flex gap-2"><Download size={14} className="text-[#0f766e] mt-0.5" /> Download JSON copy</li>
            </ul>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {loading ? (
            <Card className="p-16 flex flex-col items-center justify-center min-h-[400px]">
              <LoadingSpinner size="lg" />
              <p className="mt-6 text-sm text-[#7b8593]">Loading history…</p>
            </Card>
          ) : list.length > 0 ? (
            <div className="space-y-3 animate-slide-up">
              {list.map((item) => {
                const isExpanded = expandedId === item._id;
                return (
                  <Card key={item._id} className="overflow-hidden p-0">
                    <div className="flex items-center justify-between gap-4 p-5">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item._id)}
                        className="flex items-center gap-4 flex-1 min-w-0 text-left"
                      >
                        <div
                          className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${
                            activeTab === 'symptoms'
                              ? 'bg-[#d6f1ec] text-[#0f766e]'
                              : 'bg-[#fde8e1] text-[#c2410c]'
                          }`}
                        >
                          {activeTab === 'symptoms' ? <Activity size={20} /> : <FileText size={20} />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-[#0f1f2e] truncate">
                            {activeTab === 'symptoms'
                              ? item.symptoms?.slice(0, 3).join(', ') +
                                (item.symptoms?.length > 3 ? '…' : '')
                              : `Dr. ${item.extractedData?.doctorName || 'Unknown'}`}
                          </h3>
                          <p className="text-xs text-[#7b8593] mt-0.5">
                            {new Date(item.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="ml-auto flex items-center gap-3 shrink-0">
                          {activeTab === 'symptoms' && item.severity && (
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-medium ${severityBadge[item.severity] || ''}`}
                            >
                              {item.severity}
                            </span>
                          )}
                          {activeTab === 'prescriptions' && item.safetyStatus?.status && (
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                item.safetyStatus.status === 'safe'
                                  ? 'bg-[#dcfce7] text-[#166534]'
                                  : 'bg-[#fee2e2] text-[#991b1b]'
                              }`}
                            >
                              {item.safetyStatus.status}
                            </span>
                          )}
                        </div>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : item._id)}
                          className="p-2 text-[#3e4c5b] hover:text-[#0f1f2e] hover:bg-[#f0eee6] rounded-lg transition-colors"
                          aria-label="Toggle details"
                        >
                          <ChevronDown
                            size={18}
                            className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="px-5 pb-5 flex flex-wrap gap-2">
                      {getActions(item).map(({ label, icon: Icon, variant, onClick }) => (
                        <Button
                          key={label}
                          type="button"
                          size="sm"
                          variant={variant}
                          onClick={onClick}
                        >
                          <Icon size={14} /> {label}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(item._id, activeTab)}
                      >
                        <Trash2 size={14} /> Delete
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-[#e6e2d6] bg-[#f0eee6]/40 p-6 animate-fade-in">
                        {activeTab === 'symptoms' ? (
                          <div className="space-y-5">
                            <div className="grid sm:grid-cols-2 gap-5">
                              <div>
                                <p className="text-xs uppercase tracking-wide text-[#7b8593] font-semibold mb-2">
                                  Symptoms
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {item.symptoms?.map((s) => (
                                    <span
                                      key={s}
                                      className="px-2.5 py-1 bg-white border border-[#e6e2d6] rounded-full text-xs text-[#3e4c5b]"
                                    >
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-wide text-[#7b8593] font-semibold mb-2">
                                  Advice
                                </p>
                                <p className="text-sm text-[#3e4c5b]">
                                  {item.recommendations?.teleconsultationRecommended ||
                                  item.severity === 'High'
                                    ? 'A consultation was recommended.'
                                    : 'Follow the medication plan and monitor.'}
                                </p>
                              </div>
                            </div>

                            {item.recommendations?.medicines?.length > 0 && (
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-xs uppercase tracking-wide text-[#7b8593] font-semibold">
                                    Recommended medicines
                                  </p>
                                  {item.recommendations.followUpDate && (
                                    <p className="text-xs text-[#0f766e] font-medium">
                                      Follow up:{' '}
                                      {new Date(
                                        item.recommendations.followUpDate
                                      ).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  {item.recommendations.medicines.map((med, i) => (
                                    <div
                                      key={i}
                                      className="bg-white border border-[#e6e2d6] rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                                    >
                                      <div>
                                        <p className="text-sm font-medium text-[#0f1f2e]">{med.name}</p>
                                        <p className="text-xs text-[#7b8593]">{med.timing?.join(' · ')}</p>
                                      </div>
                                      <p className="text-xs text-[#3e4c5b] shrink-0">
                                        {med.dosage} · {med.duration || 'N/A'}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-5">
                            <div className="grid sm:grid-cols-2 gap-5">
                              <div className="bg-white border border-[#e6e2d6] rounded-xl p-4">
                                <p className="text-xs uppercase tracking-wide text-[#7b8593] font-semibold mb-2">
                                  Safety concerns
                                </p>
                                {item.safetyStatus?.issues?.length > 0 ? (
                                  <ul className="space-y-1 text-sm text-[#7f1d1d]">
                                    {item.safetyStatus.issues.map((issue, i) => (
                                      <li key={i}>• {issue.description || issue}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-[#16a34a]">No issues found.</p>
                                )}
                              </div>
                              <div className="bg-white border border-[#e6e2d6] rounded-xl p-4">
                                <p className="text-xs uppercase tracking-wide text-[#7b8593] font-semibold mb-2">
                                  Details
                                </p>
                                <p className="text-sm text-[#3e4c5b]">
                                  Date:{' '}
                                  <span className="text-[#0f1f2e]">
                                    {item.extractedData?.date || 'Not detected'}
                                  </span>
                                </p>
                                <p className="text-sm text-[#3e4c5b] mt-1">
                                  Doctor:{' '}
                                  <span className="text-[#0f1f2e]">
                                    {item.extractedData?.doctorName || 'Not detected'}
                                  </span>
                                </p>
                              </div>
                            </div>

                            {item.extractedData?.medicines?.length > 0 && (
                              <div>
                                <p className="text-xs uppercase tracking-wide text-[#7b8593] font-semibold mb-2">
                                  Medicines
                                </p>
                                <div className="space-y-2">
                                  {item.extractedData.medicines.map((med, i) => (
                                    <div
                                      key={i}
                                      className="bg-white border border-[#e6e2d6] rounded-xl px-4 py-3 flex flex-col sm:flex-row justify-between gap-2"
                                    >
                                      <div>
                                        <p className="text-sm font-medium text-[#0f1f2e]">{med.name}</p>
                                        <p className="text-xs text-[#7b8593]">
                                          {med.dosage} · {med.frequency}
                                        </p>
                                      </div>
                                      {med.timing?.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                          {med.timing.map((t, idx) => (
                                            <span
                                              key={idx}
                                              className="px-2.5 py-0.5 bg-[#d6f1ec] text-[#0f766e] rounded-full text-xs font-medium"
                                            >
                                              {t}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-16 text-center border-dashed">
              <Search size={40} className="mx-auto text-[#d4cfbf]" />
              <h3 className="mt-4 font-display text-xl font-semibold text-[#0f1f2e]">
                No history yet
              </h3>
              <p className="mt-2 text-sm text-[#7b8593]">
                Start a symptom check or upload a prescription to see records here.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default History;
