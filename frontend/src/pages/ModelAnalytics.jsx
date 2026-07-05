import { useEffect, useMemo, useState } from 'react';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { getSymptomModelMetrics } from '../services/symptomService.js';
import FigureGallery from '../components/FigureGallery.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

const formatPct = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`;
const clamp01 = (n) => Math.max(0, Math.min(1, Number(n || 0)));
const fmt = (value, digits = 4) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '∞';
  return n.toFixed(digits);
};
const fmtP = (value) => {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  return n < 0.0001 ? n.toExponential(2) : n.toFixed(4);
};
const prettyModel = (name) =>
  ({
    naive_bayes: 'Naive Bayes',
    knn_3: 'KNN (k=3)',
    knn_5: 'KNN (k=5)',
    knn_7: 'KNN (k=7)',
    decision_tree: 'Decision Tree',
    logistic_regression: 'Logistic Regression',
    random_forest: 'Random Forest'
  }[name] || name);

const HeatmapGrid = ({ xLabels, yLabels, values }) => (
  <div className="w-full">
    <div
      className="grid gap-1 w-full"
      style={{ gridTemplateColumns: `minmax(90px, 1.4fr) repeat(${xLabels.length}, minmax(0, 1fr))` }}
    >
      <div />
      {xLabels.map((x) => (
        <div key={x} className="text-[10px] font-semibold text-[#7b8593] uppercase tracking-wide text-center pb-1 truncate">
          {x}
        </div>
      ))}
      {yLabels.map((y, rowIdx) => (
        <FragmentRow key={y} rowLabel={y} rowValues={values[rowIdx] || []} />
      ))}
    </div>
  </div>
);

const FragmentRow = ({ rowLabel, rowValues }) => (
  <>
    <div className="text-xs font-medium text-[#3e4c5b] py-2 truncate">{rowLabel}</div>
    {rowValues.map((v, i) => {
      const c = clamp01(v);
      const bg = `rgba(15, 118, 110, ${0.06 + c * 0.7})`;
      const isLight = c < 0.55;
      return (
        <div
          key={`${rowLabel}-${i}`}
          className={`h-10 rounded-lg border border-[#e6e2d6] text-[10px] font-semibold flex items-center justify-center ${
            isLight ? 'text-[#0f1f2e]' : 'text-white'
          }`}
          style={{ backgroundColor: bg }}
          title={`${rowLabel}: ${Number(v).toFixed(4)}`}
        >
          {(Number(v) * 100).toFixed(1)}
        </div>
      );
    })}
  </>
);

const SimpleLineChart = ({ series, width = 840, height = 300 }) => {
  const padding = 40;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const lines = useMemo(() => {
    return series.map((s, idx) => {
      const points = (s.points || []).map((p) => ({
        x: padding + clamp01(p.fpr) * innerW,
        y: padding + (1 - clamp01(p.tpr)) * innerH
      }));
      const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      const colors = ['#0f766e', '#e76f51', '#6366f1', '#0ea5e9'];
      return { id: s.id, d, color: colors[idx % colors.length] };
    });
  }, [series, innerH, innerW, padding]);

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
        className="bg-[#f0eee6]/40 rounded-xl border border-[#e6e2d6]"
      >
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#d4cfbf" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#d4cfbf" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={padding} stroke="#d4cfbf" strokeDasharray="4 4" opacity="0.6" />
        {lines.map((line) => (
          <path key={line.id} d={line.d} fill="none" stroke={line.color} strokeWidth="2.5" />
        ))}
        <text x={width / 2} y={height - 10} textAnchor="middle" fill="#7b8593" fontSize="11">
          False positive rate
        </text>
        <text
          x={14}
          y={height / 2}
          textAnchor="middle"
          fill="#7b8593"
          fontSize="11"
          transform={`rotate(-90, 14, ${height / 2})`}
        >
          True positive rate
        </text>
      </svg>
    </div>
  );
};

const BarHistogram = ({ items }) => {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const w = (item.count / max) * 100;
        return (
          <div key={item.label}>
            <div className="flex justify-between text-xs text-[#3e4c5b] mb-1.5">
              <span className="font-medium">{item.label}</span>
              <span className="text-[#7b8593]">{item.count}</span>
            </div>
            <div className="h-2 bg-[#f0eee6] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${w}%`,
                  background: 'linear-gradient(90deg, #0f766e, #14b8a6)'
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TradeoffPlot = ({ items, width = 820, height = 300 }) => {
  const padding = 50;
  const maxComplexity = Math.max(...items.map((i) => i.complexityScore), 1);
  const maxAcc = Math.max(...items.map((i) => i.accuracy), 1);

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
        className="bg-[#f0eee6]/40 rounded-xl border border-[#e6e2d6]"
      >
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#d4cfbf" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#d4cfbf" />
        {items.map((item) => {
          const x = padding + (item.complexityScore / maxComplexity) * (width - padding * 2);
          const y = (height - padding) - ((item.accuracy / maxAcc) * (height - padding * 2));
          return (
            <g key={item.model}>
              <circle cx={x} cy={y} r="7" fill="#0f766e" opacity="0.85" />
              <text x={x + 12} y={y + 4} fill="#0f1f2e" fontSize="11" fontWeight="500">
                {item.model}
              </text>
            </g>
          );
        })}
        <text x={width / 2} y={height - 14} textAnchor="middle" fill="#7b8593" fontSize="11">
          Complexity score
        </text>
        <text
          x={14}
          y={height / 2}
          textAnchor="middle"
          fill="#7b8593"
          fontSize="11"
          transform={`rotate(-90, 14, ${height / 2})`}
        >
          Accuracy
        </text>
      </svg>
    </div>
  );
};

const GraphTriples = ({ triples }) => (
  <div className="max-h-72 overflow-auto rounded-xl border border-[#e6e2d6]">
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-[#f0eee6]">
        <tr className="text-[#7b8593] uppercase tracking-wide text-[10px]">
          <th className="p-3 text-left font-semibold">Subject</th>
          <th className="p-3 text-left font-semibold">Predicate</th>
          <th className="p-3 text-left font-semibold">Object</th>
          <th className="p-3 text-right font-semibold">Weight</th>
        </tr>
      </thead>
      <tbody>
        {triples.map((t, idx) => (
          <tr key={`${t.subject}-${idx}`} className="border-t border-[#e6e2d6] text-[#0f1f2e]">
            <td className="p-3">{t.subject}</td>
            <td className="p-3 text-[#0f766e]">{t.predicate}</td>
            <td className="p-3">{t.object}</td>
            <td className="p-3 text-right text-[#7b8593]">{t.weight}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const StatCard = ({ label, value }) => (
  <Card className="p-5">
    <p className="text-xs uppercase tracking-wide text-[#7b8593] font-semibold">{label}</p>
    <p className="font-display text-2xl font-semibold text-[#0f1f2e] mt-2">{value}</p>
  </Card>
);

// ── Confusion matrix (raw counts, row = actual, col = predicted) ──
const ConfusionMatrix = ({ labels, matrix }) => {
  const max = Math.max(...matrix.flat(), 1);
  return (
    <div className="w-full">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            <th className="p-2" />
            <th className="p-2 text-[10px] uppercase tracking-wide text-[#7b8593]" colSpan={labels.length}>
              Predicted
            </th>
          </tr>
          <tr>
            <th className="p-2 text-left text-[10px] uppercase text-[#7b8593]">Actual</th>
            {labels.map((l) => (
              <th key={l} className="p-2 font-semibold text-[#3e4c5b] break-words">{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, r) => (
            <tr key={labels[r]}>
              <td className="p-2 font-semibold text-[#3e4c5b] break-words">{labels[r]}</td>
              {row.map((v, c) => {
                const intensity = clamp01(v / max);
                const isDiagonal = r === c;
                const bg = isDiagonal
                  ? `rgba(15, 118, 110, ${0.15 + intensity * 0.7})`
                  : `rgba(231, 111, 81, ${0.08 + intensity * 0.6})`;
                return (
                  <td
                    key={c}
                    className="p-3 text-center font-semibold rounded-lg border border-[#e6e2d6]"
                    style={{ backgroundColor: bg, color: intensity > 0.5 ? '#fff' : '#0f1f2e' }}
                  >
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Generic auto-scaling multi-line chart over (x, y) series ──
const XYLineChart = ({ series, xLabel, yLabel, width = 420, height = 260, yMax }) => {
  const padding = 46;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const allX = series.flatMap((s) => s.points.map((p) => p.x));
  const allY = series.flatMap((s) => s.points.map((p) => p.y));
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const maxY = yMax ?? Math.max(...allY, 0.0001);
  const colors = ['#0f766e', '#e76f51', '#6366f1', '#0ea5e9'];

  const sx = (x) => padding + ((x - minX) / Math.max(maxX - minX, 1e-9)) * innerW;
  const sy = (y) => padding + (1 - clamp01(y / maxY)) * innerH;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
        className="bg-[#f0eee6]/40 rounded-xl border border-[#e6e2d6]"
      >
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#d4cfbf" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#d4cfbf" />
        {series.map((s, idx) => {
          const d = s.points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x)} ${sy(p.y)}`)
            .join(' ');
          return (
            <g key={s.id}>
              <path d={d} fill="none" stroke={colors[idx % colors.length]} strokeWidth="2.5" />
              {s.points.map((p, i) => (
                <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="3" fill={colors[idx % colors.length]} />
              ))}
            </g>
          );
        })}
        <text x={width / 2} y={height - 10} textAnchor="middle" fill="#7b8593" fontSize="11">{xLabel}</text>
        <text x={14} y={height / 2} textAnchor="middle" fill="#7b8593" fontSize="11" transform={`rotate(-90, 14, ${height / 2})`}>{yLabel}</text>
      </svg>
      <div className="flex flex-wrap gap-3 mt-2 px-2">
        {series.map((s, idx) => (
          <span key={s.id} className="flex items-center gap-1.5 text-xs text-[#3e4c5b]">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
            {s.id}
          </span>
        ))}
      </div>
    </div>
  );
};

// ── KPI table: label + value rows ──
const KpiTable = ({ rows }) => (
  <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1">
    {rows.map((row) => (
      <div key={row.label} className="flex justify-between items-baseline py-1.5 border-b border-[#efece2]">
        <span className="text-xs text-[#3e4c5b]">{row.label}</span>
        <span className="text-sm font-semibold text-[#0f1f2e] tabular-nums">{row.value}</span>
      </div>
    ))}
  </div>
);

// ── Significance test card ──
const StatTestCard = ({ title, rows, significant }) => (
  <div className="rounded-xl border border-[#e6e2d6] p-4 bg-white/40">
    <div className="flex items-center justify-between mb-2">
      <h3 className="font-display text-sm font-semibold text-[#0f1f2e]">{title}</h3>
      {significant !== null && significant !== undefined && (
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            significant ? 'bg-[#0f766e]/15 text-[#0f766e]' : 'bg-[#7b8593]/15 text-[#7b8593]'
          }`}
        >
          {significant ? 'Significant (p<0.05)' : 'Not significant'}
        </span>
      )}
    </div>
    <div className="space-y-1">
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between text-xs">
          <span className="text-[#7b8593]">{r.label}</span>
          <span className="font-medium text-[#0f1f2e] tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  </div>
);

const SimpleTable = ({ columns, rows }) => (
  <div className="rounded-xl border border-[#e6e2d6]">
    <table className="w-full text-xs">
      <thead className="bg-[#f0eee6] text-[#7b8593] uppercase tracking-wide text-[10px]">
        <tr>
          {columns.map((c) => (
            <th key={c.key} className={`p-2 font-semibold ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx} className={`border-t border-[#e6e2d6] ${row._highlight ? 'bg-[#0f766e]/8' : ''}`}>
            {columns.map((c) => (
              <td key={c.key} className={`p-2 text-[#0f1f2e] break-words ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                {row[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ModelAnalytics = () => {
  const { t } = useLanguage();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getSymptomModelMetrics();
        if (!res?.success) {
          setError(res?.error || 'Couldn\'t load analytics.');
          return;
        }
        setMetrics(res.data);
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || 'Couldn\'t load analytics.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const rocSeries = useMemo(() => {
    const perClass = metrics?.rocAucAnalysis?.perClass || {};
    return Object.entries(perClass).map(([id, data]) => ({ id, points: data.curve || [] }));
  }, [metrics]);

  const accuracyCurve = useMemo(() => {
    const points = metrics?.accuracyVsLoss?.points || [];
    return [
      { id: 'Training accuracy', points: points.map((p) => ({ x: p.trainSize, y: p.trainAccuracy })) },
      { id: 'Validation accuracy', points: points.map((p) => ({ x: p.trainSize, y: p.validationAccuracy })) }
    ];
  }, [metrics]);

  const lossCurve = useMemo(() => {
    const points = metrics?.accuracyVsLoss?.points || [];
    return [
      { id: 'Training loss', points: points.map((p) => ({ x: p.trainSize, y: p.trainLoss })) },
      { id: 'Validation loss', points: points.map((p) => ({ x: p.trainSize, y: p.validationLoss })) }
    ];
  }, [metrics]);

  const kpiRows = useMemo(() => {
    const m = metrics?.kpiReport?.macro;
    if (!m) return [];
    return [
      { label: 'Accuracy Score', value: fmt(m.accuracyScore) },
      { label: 'Precision (PPV)', value: fmt(m.precision) },
      { label: 'True Positive Rate (Recall)', value: fmt(m.truePositiveRate) },
      { label: 'True Negative Rate (Specificity)', value: fmt(m.trueNegativeRate) },
      { label: 'False Positive Rate', value: fmt(m.falsePositiveRate) },
      { label: 'False Negative Rate', value: fmt(m.falseNegativeRate) },
      { label: 'False Discovery Rate', value: fmt(m.falseDiscoveryRate) },
      { label: 'False Omission Rate', value: fmt(m.falseOmissionRate) },
      { label: 'Negative Predictive Value', value: fmt(m.negativePredictiveValue) },
      { label: 'F1 Score', value: fmt(m.f1Score) },
      { label: 'Fowlkes–Mallows Index', value: fmt(m.fowlkesMallowsIndex) },
      { label: 'Balanced Accuracy', value: fmt(m.balancedAccuracy) },
      { label: 'Informedness (Youden J)', value: fmt(m.informedness) },
      { label: 'Markedness', value: fmt(m.markedness) },
      { label: 'Threat Score (CSI)', value: fmt(m.threatScore) },
      { label: 'Matthews Corr. Coefficient', value: fmt(m.matthewsCorrelationCoefficient) },
      { label: 'Prevalence', value: fmt(m.prevalence) },
      { label: 'Positive Likelihood Ratio', value: fmt(m.positiveLikelihoodRatio, 3) },
      { label: 'Negative Likelihood Ratio', value: fmt(m.negativeLikelihoodRatio, 3) },
      { label: 'Diagnostic Odds Ratio', value: fmt(m.diagnosticOddsRatio, 2) },
      { label: 'Model Training Time', value: `${fmt(metrics?.kpiReport?.modelTrainingTimeMs, 2)} ms` }
    ];
  }, [metrics]);

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6">
      <div className="text-center mb-4 space-y-3">
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[#0f1f2e] tracking-tight">
          {t('analytics.title')}
        </h1>
        <p className="text-[#3e4c5b] max-w-2xl mx-auto">
          {t('analytics.subtitle')}
        </p>
      </div>

      <ErrorMessage message={error} onDismiss={() => setError('')} />

      {loading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : metrics && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Selected model" value={metrics.selectedModelName} />
            <StatCard
              label="Accuracy"
              value={formatPct(metrics.datasetClassificationPerformance?.accuracy)}
            />
            <StatCard label="Macro AUC" value={formatPct(metrics.rocAucAnalysis?.macroAuc)} />
            <StatCard
              label="ANOVA p-value"
              value={Number(metrics.hypothesisTesting?.anova?.pValue || 0).toExponential(2)}
            />
          </div>

          <Card>
            <FigureGallery
              title={t('analytics.figures')}
              description={t('analytics.figuresDesc')}
            />
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <h2 className="font-display text-lg font-semibold text-[#0f1f2e] mb-1">Confusion matrix</h2>
              <p className="text-xs text-[#7b8593] mb-4">
                Held-out test set · rows = actual, columns = predicted
              </p>
              <ConfusionMatrix
                labels={metrics.datasetClassificationPerformance?.confusionMatrix?.labels || []}
                matrix={metrics.datasetClassificationPerformance?.confusionMatrix?.matrix || []}
              />
            </Card>

            <Card>
              <h2 className="font-display text-lg font-semibold text-[#0f1f2e] mb-1">
                Model validation KPIs
              </h2>
              <p className="text-xs text-[#7b8593] mb-4">
                Macro-averaged (one-vs-rest) over all care classes
              </p>
              <KpiTable rows={kpiRows} />
            </Card>
          </div>

          <Card>
            <h2 className="font-display text-lg font-semibold text-[#0f1f2e] mb-1">
              Accuracy vs loss
            </h2>
            <p className="text-xs text-[#7b8593] mb-4">
              {metrics.accuracyVsLoss?.description}
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <XYLineChart
                series={accuracyCurve}
                xLabel="Training set size"
                yLabel="Accuracy"
                yMax={1}
              />
              <XYLineChart
                series={lossCurve}
                xLabel="Training set size"
                yLabel="Cross-entropy loss"
              />
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold text-[#0f1f2e] mb-4">
              Comparative model metrics
            </h2>
            <HeatmapGrid
              xLabels={metrics.comparativeModelAnalysis?.heatmap?.xLabels || []}
              yLabels={metrics.comparativeModelAnalysis?.heatmap?.yLabels || []}
              values={metrics.comparativeModelAnalysis?.heatmap?.values || []}
            />
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold text-[#0f1f2e] mb-4">ROC curves</h2>
            <SimpleLineChart series={rocSeries} />
            <div className="flex flex-wrap gap-2 mt-4">
              {Object.entries(metrics.rocAucAnalysis?.perClass || {}).map(([label, data]) => (
                <span
                  key={label}
                  className="text-xs font-medium text-[#0f1f2e] bg-[#f0eee6] px-3 py-1.5 rounded-full"
                >
                  {label} · AUC {formatPct(data.auc)}
                </span>
              ))}
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <h2 className="font-display text-lg font-semibold text-[#0f1f2e] mb-4">
                Class distribution
              </h2>
              <BarHistogram items={metrics.comparativeModelAnalysis?.histogram?.careClassCounts || []} />
            </Card>

            <Card>
              <h2 className="font-display text-lg font-semibold text-[#0f1f2e] mb-4">
                Accuracy vs complexity
              </h2>
              <TradeoffPlot items={metrics.tradeOffAnalysis || []} />
            </Card>
          </div>

          <Card>
            <h2 className="font-display text-lg font-semibold text-[#0f1f2e] mb-4">
              Feature correlation matrix
            </h2>
            <HeatmapGrid
              xLabels={metrics.comparativeModelAnalysis?.correlationMatrix?.labels || []}
              yLabels={metrics.comparativeModelAnalysis?.correlationMatrix?.labels || []}
              values={(metrics.comparativeModelAnalysis?.correlationMatrix?.matrix || []).map((row) =>
                row.map((v) => (Number(v) + 1) / 2)
              )}
            />
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold text-[#0f1f2e] mb-1">
              {t('analytics.comparison')}
            </h2>
            <p className="text-xs text-[#7b8593] mb-4">{t('analytics.comparisonDesc')}</p>
            <SimpleTable
              columns={[
                { key: 'model', label: 'Model' },
                { key: 'accuracy', label: 'Acc', align: 'right' },
                { key: 'precision', label: 'Prec', align: 'right' },
                { key: 'recall', label: 'Recall', align: 'right' },
                { key: 'f1', label: 'F1', align: 'right' },
                { key: 'spec', label: 'Spec', align: 'right' },
                { key: 'bal', label: 'BalAcc', align: 'right' },
                { key: 'mcc', label: 'MCC', align: 'right' },
                { key: 'fm', label: 'FM', align: 'right' },
                { key: 'auc', label: 'AUC', align: 'right' },
                { key: 'train', label: 'Train (ms)', align: 'right' }
              ]}
              rows={(metrics.comparativeModelAnalysis?.models || []).map((m) => ({
                _highlight: m.model === metrics.selectedModelName,
                model: prettyModel(m.model),
                accuracy: fmt(m.accuracy, 3),
                precision: fmt(m.precision, 3),
                recall: fmt(m.recall, 3),
                f1: fmt(m.f1Score, 3),
                spec: fmt(m.specificity, 3),
                bal: fmt(m.balancedAccuracy, 3),
                mcc: fmt(m.mcc, 3),
                fm: fmt(m.fowlkesMallows, 3),
                auc: fmt(m.macroAuc, 3),
                train: fmt(m.trainTimeMs, 2)
              }))}
            />
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold text-[#0f1f2e] mb-1">
              Cross-validation
            </h2>
            <p className="text-xs text-[#7b8593] mb-4">
              Mean fold accuracy ± 95% confidence interval
            </p>
            <div className="grid lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#7b8593] mb-2">
                  {metrics.crossValidation?.kFold?.folds}-fold CV
                </h3>
                <SimpleTable
                  columns={[
                    { key: 'model', label: 'Model' },
                    { key: 'mean', label: 'Mean', align: 'right' },
                    { key: 'ci', label: '95% CI', align: 'right' }
                  ]}
                  rows={(metrics.crossValidation?.kFold?.perModel || []).map((m) => ({
                    _highlight: m.model === metrics.selectedModelName,
                    model: prettyModel(m.model),
                    mean: formatPct(m.mean),
                    ci: `${formatPct(m.lower)} – ${formatPct(m.upper)}`
                  }))}
                />
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#7b8593] mb-2">
                  {metrics.crossValidation?.stratifiedKFold?.folds}-fold stratified CV
                </h3>
                <SimpleTable
                  columns={[
                    { key: 'model', label: 'Model' },
                    { key: 'mean', label: 'Mean', align: 'right' },
                    { key: 'ci', label: '95% CI', align: 'right' }
                  ]}
                  rows={(metrics.crossValidation?.stratifiedKFold?.perModel || []).map((m) => ({
                    _highlight: m.model === metrics.selectedModelName,
                    model: prettyModel(m.model),
                    mean: formatPct(m.mean),
                    ci: `${formatPct(m.lower)} – ${formatPct(m.upper)}`
                  }))}
                />
              </div>
            </div>

            <div className="mt-6 grid sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-[#e6e2d6] p-4">
                <p className="text-[10px] uppercase tracking-wide text-[#7b8593] font-semibold">LOOCV accuracy</p>
                <p className="font-display text-2xl font-semibold text-[#0f1f2e] mt-1">
                  {formatPct(metrics.crossValidation?.loocv?.accuracy)}
                </p>
                <p className="text-[11px] text-[#7b8593] mt-1">
                  {metrics.crossValidation?.loocv?.iterations} iterations
                  {metrics.crossValidation?.loocv?.subsampled ? ' (subsampled)' : ''}
                </p>
              </div>
              <div className="rounded-xl border border-[#e6e2d6] p-4">
                <p className="text-[10px] uppercase tracking-wide text-[#7b8593] font-semibold">Stratified k-fold accuracy</p>
                <p className="font-display text-2xl font-semibold text-[#0f1f2e] mt-1">
                  {formatPct(metrics.crossValidation?.loocvVsStratified?.stratifiedKFoldAccuracy)}
                </p>
                <p className="text-[11px] text-[#7b8593] mt-1">
                  Selected model · {prettyModel(metrics.selectedModelName)}
                </p>
              </div>
              <div className="rounded-xl border border-[#e6e2d6] p-4">
                <p className="text-[10px] uppercase tracking-wide text-[#7b8593] font-semibold">LOOCV vs stratified Δ</p>
                <p className="font-display text-2xl font-semibold text-[#0f1f2e] mt-1">
                  {formatPct(Math.abs(
                    (metrics.crossValidation?.loocvVsStratified?.stratifiedKFoldAccuracy || 0) -
                    (metrics.crossValidation?.loocv?.accuracy || 0)
                  ))}
                </p>
                <p className="text-[11px] text-[#7b8593] mt-1">Absolute accuracy difference</p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold text-[#0f1f2e] mb-1">
              Statistical significance analysis
            </h2>
            <p className="text-xs text-[#7b8593] mb-4">
              Comparing {prettyModel(metrics.selectedModelName)} vs {prettyModel(metrics.runnerUpModelName)} (α = 0.05)
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatTestCard
                title="ANOVA (one-way)"
                significant={metrics.hypothesisTesting?.significanceSummary?.anovaSignificant}
                rows={[
                  { label: 'F-statistic', value: fmt(metrics.hypothesisTesting?.anova?.fStatistic, 3) },
                  { label: 'p-value', value: fmtP(metrics.hypothesisTesting?.anova?.pValue) },
                  { label: 'η² effect size', value: fmt(metrics.hypothesisTesting?.anova?.etaSquared, 3) }
                ]}
              />
              <StatTestCard
                title="Friedman test"
                significant={metrics.hypothesisTesting?.significanceSummary?.friedmanSignificant}
                rows={[
                  { label: 'χ² statistic', value: fmt(metrics.hypothesisTesting?.friedman?.statistic, 3) },
                  { label: 'df', value: metrics.hypothesisTesting?.friedman?.df ?? '—' },
                  { label: 'p-value', value: fmtP(metrics.hypothesisTesting?.friedman?.pValue) }
                ]}
              />
              <StatTestCard
                title="Wilcoxon signed-rank"
                significant={metrics.hypothesisTesting?.significanceSummary?.wilcoxonSignificant}
                rows={[
                  { label: 'W statistic', value: fmt(metrics.hypothesisTesting?.wilcoxonSignedRank?.statistic, 1) },
                  { label: 'z-score', value: fmt(metrics.hypothesisTesting?.wilcoxonSignedRank?.zScore, 3) },
                  { label: 'p-value', value: fmtP(metrics.hypothesisTesting?.wilcoxonSignedRank?.pValue) }
                ]}
              />
              <StatTestCard
                title="McNemar test"
                significant={metrics.hypothesisTesting?.significanceSummary?.mcnemarSignificant}
                rows={[
                  { label: 'χ² (corrected)', value: fmt(metrics.hypothesisTesting?.mcnemar?.statistic, 3) },
                  { label: 'Discordant b / c', value: `${metrics.hypothesisTesting?.mcnemar?.discordantBcorrectA ?? '—'} / ${metrics.hypothesisTesting?.mcnemar?.discordantBcorrectB ?? '—'}` },
                  { label: 'p-value', value: fmtP(metrics.hypothesisTesting?.mcnemar?.pValue) }
                ]}
              />
              <StatTestCard
                title="Confidence intervals (95%)"
                rows={[
                  { label: 'Test accuracy (Wilson)', value: `${formatPct(metrics.hypothesisTesting?.confidenceIntervals?.testAccuracyWilson95?.lower)} – ${formatPct(metrics.hypothesisTesting?.confidenceIntervals?.testAccuracyWilson95?.upper)}` },
                  { label: 'k-fold mean (t)', value: `${formatPct(metrics.hypothesisTesting?.confidenceIntervals?.stratifiedKFoldMean95?.lower)} – ${formatPct(metrics.hypothesisTesting?.confidenceIntervals?.stratifiedKFoldMean95?.upper)}` },
                  { label: 'Std error', value: fmt(metrics.hypothesisTesting?.confidenceIntervals?.stratifiedKFoldMean95?.standardError, 4) }
                ]}
              />
              <StatTestCard
                title="Effect size"
                rows={[
                  { label: "Cohen's d", value: fmt(metrics.hypothesisTesting?.effectSize?.pairwiseCohensD?.cohensD, 3) },
                  { label: 'Magnitude', value: metrics.hypothesisTesting?.effectSize?.pairwiseCohensD?.magnitude ?? '—' },
                  { label: 'ANOVA η²', value: fmt(metrics.hypothesisTesting?.effectSize?.anovaEtaSquared, 3) }
                ]}
              />
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold text-[#0f1f2e] mb-1">
              {t('analytics.sota')}
            </h2>
            <p className="text-xs text-[#7b8593] mb-4">{t('analytics.sotaDesc')}</p>
            <SimpleTable
              columns={[
                { key: 'model', label: 'Model' },
                { key: 'arch', label: 'Architecture' },
                { key: 'year', label: 'Year', align: 'right' },
                { key: 'acc', label: 'Accuracy', align: 'right' },
                { key: 'f1', label: 'F1', align: 'right' },
                { key: 'bal', label: 'BalAcc', align: 'right' },
                { key: 'mcc', label: 'MCC', align: 'right' },
                { key: 'auc', label: 'AUC', align: 'right' },
                { key: 'ref', label: 'Reference' }
              ]}
              rows={[
                {
                  _highlight: true,
                  model: `${prettyModel(metrics.stateOfTheArtComparison?.ours?.model)} (ours)`,
                  arch: metrics.stateOfTheArtComparison?.ours?.architecture,
                  year: metrics.stateOfTheArtComparison?.ours?.year,
                  acc: formatPct(metrics.stateOfTheArtComparison?.ours?.accuracy),
                  f1: fmt(metrics.stateOfTheArtComparison?.ours?.f1Score, 3),
                  bal: '—',
                  mcc: '—',
                  auc: '—',
                  ref: 'Selected model'
                },
                ...(metrics.stateOfTheArtComparison?.trainedOnDataset || []).map((b) => ({
                  model: prettyModel(b.model),
                  arch: b.architecture,
                  year: b.year,
                  acc: formatPct(b.accuracy),
                  f1: fmt(b.f1Score, 3),
                  bal: fmt(b.balancedAccuracy, 3),
                  mcc: fmt(b.mcc, 3),
                  auc: fmt(b.macroAuc, 3),
                  ref: b.reference
                })),
                ...(metrics.stateOfTheArtComparison?.baselines || []).map((b) => ({
                  model: b.model,
                  arch: b.architecture,
                  year: b.year,
                  acc: formatPct(b.accuracy),
                  f1: fmt(b.f1Score, 3),
                  bal: '—',
                  mcc: '—',
                  auc: '—',
                  ref: b.reference
                }))
              ]}
            />
            <p className="text-[11px] text-[#7b8593] mt-3">
              Baseline figures are reported on different datasets and are provided for contextual reference only — not a like-for-like benchmark.
            </p>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold text-[#0f1f2e] mb-4">
              Healthcare knowledge graph
            </h2>
            <GraphTriples triples={metrics.healthcareKnowledgeGraph?.triples || []} />
          </Card>
        </>
      )}
    </div>
  );
};

export default ModelAnalytics;
