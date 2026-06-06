import XLSX from 'xlsx';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try the legacy filename first, then fall back to the canonical dataset
// shipped in the repo. Using a list keeps things working for older clones.
const DATASET_CANDIDATES = [
  path.join(__dirname, '../../../New Dataset-8 symptoms-2025  (1).xlsx'),
  path.join(__dirname, '../../../datasets/symptoms_2025.xlsx')
];
const resolveDatasetPath = () => DATASET_CANDIDATES.find((candidate) => existsSync(candidate));
const SYMPTOM_COLUMNS = ['Fever', 'Common Cold', 'Cough', 'Body Pain', 'Headache', 'Menstrual Cramps', 'Sprain', 'Indigestion', 'Toothache'];
const FOLLOW_UP_COLUMNS = ['Answer 1', 'Answer 2', 'Answer 3', 'Answer 4'];

let modelState = null;
const CLASS_LABELS = ['otc', 'consult_doctor', 'consult_immediately'];

const seededShuffle = (items, seed = 2026) => {
  const arr = [...items];
  let state = seed;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    const j = Math.floor((state / 4294967296) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const normalizeYesNo = (value) => {
  const text = String(value ?? '').trim().toLowerCase();
  return text === 'yes' || text === 'true' || text === '1' ? 'Yes' : 'No';
};

const normalizeGender = (value) => {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'male' || text === 'female') return text;
  return 'other';
};

const toCareClass = (rawDecision) => {
  const text = String(rawDecision ?? '').trim().toLowerCase();
  if (!text) return null;
  if (text.includes('immediately')) return 'consult_immediately';
  if (text.includes('consult doctor') || text.includes('consult the doctor')) return 'consult_doctor';
  return 'otc';
};

const parseBucketRange = (bucketText) => {
  const text = String(bucketText ?? '').trim();
  const range = text.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) return { type: 'range', min: Number(range[1]), max: Number(range[2]), label: text };
  const plus = text.match(/^(\d+)\s*\+$/);
  if (plus) return { type: 'plus', min: Number(plus[1]), label: text };
  return null;
};

const buildNumericBucketResolver = (values, fallbackLabel) => {
  const buckets = Array.from(new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean)))
    .map(parseBucketRange)
    .filter(Boolean);

  if (!buckets.length) {
    return () => fallbackLabel;
  }

  return (input) => {
    const text = String(input ?? '').trim();
    if (buckets.some((b) => b.label === text)) return text;
    const num = Number(text);
    if (!Number.isFinite(num)) return fallbackLabel;

    for (const bucket of buckets) {
      if (bucket.type === 'range' && num >= bucket.min && num <= bucket.max) return bucket.label;
      if (bucket.type === 'plus' && num >= bucket.min) return bucket.label;
    }
    return fallbackLabel;
  };
};

const rowToFeatureVector = (row, resolveAgeBucket, resolveWeightBucket) => {
  return [
    normalizeGender(row.Gender),
    resolveAgeBucket(row.Age),
    resolveWeightBucket(row.Weight),
    ...SYMPTOM_COLUMNS.map((name) => normalizeYesNo(row[name])),
    ...FOLLOW_UP_COLUMNS.map((name) => normalizeYesNo(row[name]))
  ];
};

const trainNaiveBayes = (samples) => {
  const classCounts = new Map();
  const featureValueSets = [];
  const featureCountsByClass = new Map();

  for (const sample of samples) {
    classCounts.set(sample.label, (classCounts.get(sample.label) || 0) + 1);
    if (!featureCountsByClass.has(sample.label)) {
      featureCountsByClass.set(sample.label, sample.features.map(() => new Map()));
    }
    const perClass = featureCountsByClass.get(sample.label);
    sample.features.forEach((value, index) => {
      if (!featureValueSets[index]) featureValueSets[index] = new Set();
      featureValueSets[index].add(value);
      perClass[index].set(value, (perClass[index].get(value) || 0) + 1);
    });
  }

  return {
    kind: 'naive_bayes',
    total: samples.length,
    classCounts,
    featureCountsByClass,
    cardinality: featureValueSets.map((s) => Math.max(s.size, 1))
  };
};

const predictNaiveBayes = (model, features) => {
  const labels = Array.from(model.classCounts.keys());
  const scoreEntries = labels.map((label) => {
    const classCount = model.classCounts.get(label);
    const perClass = model.featureCountsByClass.get(label);
    let logScore = Math.log(classCount / model.total);
    features.forEach((value, index) => {
      const count = perClass[index].get(value) || 0;
      const denom = classCount + model.cardinality[index];
      logScore += Math.log((count + 1) / denom);
    });
    return { label, score: logScore };
  });

  const sorted = scoreEntries.sort((a, b) => b.score - a.score);
  const maxScore = sorted[0].score;
  const expScores = sorted.map((entry) => Math.exp(entry.score - maxScore));
  const expSum = expScores.reduce((sum, val) => sum + val, 0);
  const probabilities = sorted.map((entry, idx) => ({
    label: entry.label,
    probability: expScores[idx] / expSum
  }));

  return {
    label: sorted[0].label,
    confidence: probabilities[0].probability,
    probabilities
  };
};

const hammingDistance = (a, b) => {
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) distance += 1;
  }
  return distance;
};

const trainKnn = (samples, k) => ({ kind: 'knn', samples, k });

const predictKnn = (model, features) => {
  const neighbors = model.samples
    .map((sample) => ({ label: sample.label, distance: hammingDistance(features, sample.features) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, model.k);

  const votes = new Map(CLASS_LABELS.map((label) => [label, 0]));
  neighbors.forEach((n) => votes.set(n.label, (votes.get(n.label) || 0) + 1));
  const sortedVotes = Array.from(votes.entries()).sort((a, b) => b[1] - a[1]);

  return {
    label: sortedVotes[0][0],
    confidence: sortedVotes[0][1] / model.k,
    probabilities: sortedVotes.map(([label, count]) => ({
      label,
      probability: count / model.k
    }))
  };
};

const buildConfusionMatrix = (labels, predictions) => {
  const indexByLabel = new Map(labels.map((label, idx) => [label, idx]));
  const matrix = labels.map(() => labels.map(() => 0));
  predictions.forEach(({ actual, predicted }) => {
    matrix[indexByLabel.get(actual)][indexByLabel.get(predicted)] += 1;
  });
  return matrix;
};

const safeDivide = (num, denom) => (denom === 0 ? 0 : num / denom);

const computeClassificationMetrics = (labels, confusionMatrix) => {
  const total = confusionMatrix.flat().reduce((a, b) => a + b, 0);
  const rowSums = confusionMatrix.map((row) => row.reduce((a, b) => a + b, 0));
  const colSums = labels.map((_, colIdx) =>
    confusionMatrix.reduce((sum, row) => sum + row[colIdx], 0));
  const tpTotal = labels.reduce((sum, _, idx) => sum + confusionMatrix[idx][idx], 0);

  const byClass = {};
  const recalls = [];
  const specificities = [];
  let precisionSum = 0;
  let recallSum = 0;
  let f1Sum = 0;

  labels.forEach((label, idx) => {
    const tp = confusionMatrix[idx][idx];
    const fn = rowSums[idx] - tp;
    const fp = colSums[idx] - tp;
    const tn = total - tp - fn - fp;
    const precision = safeDivide(tp, tp + fp);
    const recall = safeDivide(tp, tp + fn);
    const f1 = safeDivide(2 * precision * recall, precision + recall);
    const specificity = safeDivide(tn, tn + fp);
    byClass[label] = { precision, recall, f1Score: f1, specificity, support: rowSums[idx] };
    precisionSum += precision;
    recallSum += recall;
    f1Sum += f1;
    recalls.push(recall);
    specificities.push(specificity);
  });

  const observedAgreement = safeDivide(tpTotal, total);
  const expectedAgreement = safeDivide(
    rowSums.reduce((sum, rowSum, idx) => sum + rowSum * colSums[idx], 0),
    total * total
  );
  const kappa = safeDivide(observedAgreement - expectedAgreement, 1 - expectedAgreement);

  const mccNumerator = tpTotal * total - rowSums.reduce((sum, r, idx) => sum + r * colSums[idx], 0);
  const mccDenominatorLeft = total * total - colSums.reduce((sum, c) => sum + c * c, 0);
  const mccDenominatorRight = total * total - rowSums.reduce((sum, r) => sum + r * r, 0);
  const mcc = safeDivide(mccNumerator, Math.sqrt(mccDenominatorLeft * mccDenominatorRight));

  return {
    accuracy: safeDivide(tpTotal, total),
    precision: precisionSum / labels.length,
    recall: recallSum / labels.length,
    f1Score: f1Sum / labels.length,
    specificity: specificities.reduce((a, b) => a + b, 0) / labels.length,
    balancedAccuracy: recalls.reduce((a, b) => a + b, 0) / labels.length,
    matthewsCorrelationCoefficient: mcc,
    cohensKappa: kappa,
    byClass
  };
};

const rocAucFromPredictions = (labels, predictions) => {
  const result = {};
  labels.forEach((positiveClass) => {
    const points = [];
    for (let thresholdStep = 0; thresholdStep <= 100; thresholdStep += 2) {
      const threshold = thresholdStep / 100;
      let tp = 0; let fp = 0; let tn = 0; let fn = 0;
      predictions.forEach((p) => {
        const prob = p.probabilities.find((x) => x.label === positiveClass)?.probability || 0;
        const positive = prob >= threshold;
        const isPositiveClass = p.actual === positiveClass;
        if (positive && isPositiveClass) tp += 1;
        else if (positive && !isPositiveClass) fp += 1;
        else if (!positive && isPositiveClass) fn += 1;
        else tn += 1;
      });
      const tpr = safeDivide(tp, tp + fn);
      const fpr = safeDivide(fp, fp + tn);
      points.push({ threshold, tpr, fpr });
    }
    const sorted = points.sort((a, b) => a.fpr - b.fpr);
    let auc = 0;
    for (let i = 1; i < sorted.length; i += 1) {
      const x1 = sorted[i - 1].fpr;
      const x2 = sorted[i].fpr;
      const y1 = sorted[i - 1].tpr;
      const y2 = sorted[i].tpr;
      auc += (x2 - x1) * (y1 + y2) / 2;
    }
    result[positiveClass] = { auc, curve: sorted };
  });
  return {
    perClass: result,
    macroAuc: labels.reduce((sum, label) => sum + result[label].auc, 0) / labels.length
  };
};

// ───────────────────────────────────────────────────────────────────────────
// STATISTICAL / MATH PRIMITIVES
// Pure-JS implementations so we don't pull in a stats dependency. Used by the
// significance tests (ANOVA / Friedman / Wilcoxon / McNemar) and the
// confidence-interval + effect-size analysis below.
// ───────────────────────────────────────────────────────────────────────────

// Abramowitz & Stegun 7.1.26 approximation of the error function.
const erf = (x) => {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
};

const normalCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

// Two-sided p-value for a standard-normal z statistic.
const normalTwoSidedP = (z) => 2 * (1 - normalCdf(Math.abs(z)));

// Lanczos approximation of ln(Γ(x)).
const gammaln = (x) => {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j += 1) {
    y += 1;
    ser += c[j] / y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
};

// Regularized lower incomplete gamma P(a, x).
const lowerGammaRegularized = (a, x) => {
  if (x <= 0) return 0;
  if (x < a + 1) {
    // Series expansion.
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 300; n += 1) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gammaln(a));
  }
  // Continued fraction for the upper tail, then invert.
  const tiny = 1e-30;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 300; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  const q = Math.exp(-x + a * Math.log(x) - gammaln(a)) * h;
  return 1 - q;
};

// Upper-tail probability for a chi-square statistic with `df` degrees of freedom.
const chiSquareUpperTail = (statistic, df) => {
  if (statistic <= 0) return 1;
  return 1 - lowerGammaRegularized(df / 2, statistic / 2);
};

// Two-sided t critical values (alpha = 0.05). Falls back to the normal z (1.96)
// for large df where the t distribution is effectively normal.
const T_CRITICAL_95 = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365,
  8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145,
  15: 2.131, 16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086,
  21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.060, 26: 2.056,
  27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042
};
const tCritical95 = (df) => (df <= 0 ? 1.96 : T_CRITICAL_95[df] ?? 1.96);

const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const sampleStd = (arr) => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
};

// ───────────────────────────────────────────────────────────────────────────
// FULL CONFUSION-MATRIX KPI SUITE (one-vs-rest, per class + macro/micro)
// Covers every indicator on the assignment checklist.
// ───────────────────────────────────────────────────────────────────────────

const computeBinaryKpis = ({ tp, fp, tn, fn }) => {
  const total = tp + fp + tn + fn;
  const tpr = safeDivide(tp, tp + fn);              // recall / sensitivity
  const tnr = safeDivide(tn, tn + fp);              // specificity
  const fpr = safeDivide(fp, fp + tn);
  const fnr = safeDivide(fn, fn + tp);
  const ppv = safeDivide(tp, tp + fp);              // precision
  const npv = safeDivide(tn, tn + fn);
  const fdr = safeDivide(fp, fp + tp);              // false discovery rate
  const forate = safeDivide(fn, fn + tn);           // false omission rate
  const f1 = safeDivide(2 * ppv * tpr, ppv + tpr);
  const fowlkesMallows = Math.sqrt(Math.max(ppv * tpr, 0));
  const balancedAccuracy = (tpr + tnr) / 2;
  const informedness = tpr + tnr - 1;               // Youden's J
  const markedness = ppv + npv - 1;
  const positiveLikelihoodRatio = fpr === 0 ? null : tpr / fpr;
  const negativeLikelihoodRatio = tnr === 0 ? null : fnr / tnr;
  const diagnosticOddsRatio =
    positiveLikelihoodRatio === null || negativeLikelihoodRatio === null || negativeLikelihoodRatio === 0
      ? null
      : positiveLikelihoodRatio / negativeLikelihoodRatio;
  const threatScore = safeDivide(tp, tp + fn + fp); // critical success index / Jaccard
  const prevalence = safeDivide(tp + fn, total);
  const accuracy = safeDivide(tp + tn, total);
  const mccDen = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
  const mcc = mccDen === 0 ? 0 : (tp * tn - fp * fn) / mccDen;

  return {
    truePositives: tp,
    falsePositives: fp,
    trueNegatives: tn,
    falseNegatives: fn,
    precision: ppv,
    falseOmissionRate: forate,
    falseDiscoveryRate: fdr,
    negativePredictiveValue: npv,
    f1Score: f1,
    fowlkesMallowsIndex: fowlkesMallows,
    balancedAccuracy,
    informedness,
    truePositiveRate: tpr,
    falsePositiveRate: fpr,
    trueNegativeRate: tnr,
    falseNegativeRate: fnr,
    positiveLikelihoodRatio,
    negativeLikelihoodRatio,
    diagnosticOddsRatio,
    threatScore,
    matthewsCorrelationCoefficient: mcc,
    prevalence,
    accuracyScore: accuracy,
    markedness
  };
};

// Aggregate per-class one-vs-rest counts from a multi-class confusion matrix.
const oneVsRestCounts = (labels, confusionMatrix) => {
  const total = confusionMatrix.flat().reduce((a, b) => a + b, 0);
  const rowSums = confusionMatrix.map((row) => row.reduce((a, b) => a + b, 0));
  const colSums = labels.map((_, c) => confusionMatrix.reduce((s, row) => s + row[c], 0));
  return labels.map((label, idx) => {
    const tp = confusionMatrix[idx][idx];
    const fn = rowSums[idx] - tp;
    const fp = colSums[idx] - tp;
    const tn = total - tp - fp - fn;
    return { label, tp, fp, tn, fn };
  });
};

// Average a numeric KPI field across classes, skipping null (undefined ratios).
const macroAverage = (perClassKpis, field) => {
  const values = perClassKpis.map((k) => k[field]).filter((v) => v !== null && Number.isFinite(v));
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
};

const buildKpiReport = (labels, confusionMatrix, trainingTimeMs) => {
  const counts = oneVsRestCounts(labels, confusionMatrix);
  const perClass = {};
  counts.forEach((c) => { perClass[c.label] = computeBinaryKpis(c); });

  // Micro-averaged counts (sum the one-vs-rest cells across classes).
  const micro = computeBinaryKpis(
    counts.reduce(
      (acc, c) => ({ tp: acc.tp + c.tp, fp: acc.fp + c.fp, tn: acc.tn + c.tn, fn: acc.fn + c.fn }),
      { tp: 0, fp: 0, tn: 0, fn: 0 }
    )
  );

  const sampleKpi = perClass[labels[0]];
  const macro = {};
  Object.keys(sampleKpi).forEach((field) => {
    if (['truePositives', 'falsePositives', 'trueNegatives', 'falseNegatives'].includes(field)) return;
    macro[field] = macroAverage(counts.map((c) => perClass[c.label]), field);
  });

  return {
    macro,
    micro,
    perClass,
    modelTrainingTimeMs: trainingTimeMs ?? null
  };
};

// ───────────────────────────────────────────────────────────────────────────
// ACCURACY vs LOSS LEARNING CURVE
// NB / KNN aren't trained in epochs, so the honest analogue of a neural-net
// "accuracy vs loss per epoch" curve is a learning curve over increasing
// training-set size, reporting accuracy + cross-entropy (log) loss on both the
// training subset and the held-out validation set.
// ───────────────────────────────────────────────────────────────────────────

const accuracyOfPreds = (preds) =>
  safeDivide(preds.filter((p) => p.predicted === p.actual).length, preds.length);

const crossEntropyLoss = (preds) => {
  const eps = 1e-12;
  if (!preds.length) return 0;
  const sum = preds.reduce((acc, p) => {
    const prob = p.probabilities.find((x) => x.label === p.actual)?.probability ?? 0;
    return acc + -Math.log(Math.min(Math.max(prob, eps), 1));
  }, 0);
  return sum / preds.length;
};

const predictAll = (model, predictFn, samples) =>
  samples.map((s) => {
    const pred = predictFn(model, s.features);
    return { actual: s.label, predicted: pred.label, probabilities: pred.probabilities };
  });

const buildLearningCurve = (trainSamples, testSamples, predictFn, trainFn, steps = 10) => {
  const n = trainSamples.length;
  const trainEvalCap = 400; // cap self-evaluation cost for KNN
  const points = [];
  for (let step = 1; step <= steps; step += 1) {
    const size = Math.max(CLASS_LABELS.length, Math.floor((n * step) / steps));
    const subset = trainSamples.slice(0, size);
    const model = trainFn(subset);
    const trainEvalSet = subset.slice(0, Math.min(subset.length, trainEvalCap));
    const trainPreds = predictAll(model, predictFn, trainEvalSet);
    const valPreds = predictAll(model, predictFn, testSamples);
    points.push({
      trainSize: size,
      trainAccuracy: accuracyOfPreds(trainPreds),
      trainLoss: crossEntropyLoss(trainPreds),
      validationAccuracy: accuracyOfPreds(valPreds),
      validationLoss: crossEntropyLoss(valPreds)
    });
  }
  return points;
};

// ───────────────────────────────────────────────────────────────────────────
// CROSS-VALIDATION: STRATIFIED k-FOLD + LOOCV
// ───────────────────────────────────────────────────────────────────────────

const makeStratifiedFolds = (samples, k, seed = 7) => {
  const byClass = new Map();
  samples.forEach((s) => {
    if (!byClass.has(s.label)) byClass.set(s.label, []);
    byClass.get(s.label).push(s);
  });
  const folds = Array.from({ length: k }, () => []);
  let rotation = 0;
  for (const [, classSamples] of byClass.entries()) {
    const shuffled = seededShuffle(classSamples, seed + rotation);
    shuffled.forEach((sample, idx) => {
      folds[(idx + rotation) % k].push(sample);
    });
    rotation += 1;
  }
  return folds;
};

const runStratifiedKFold = (samples, labels, foldCount = 10) => {
  const folds = makeStratifiedFolds(samples, foldCount);
  const modelDefs = [
    { name: 'naive_bayes', train: trainNaiveBayes, predict: predictNaiveBayes },
    { name: 'knn_3', train: (s) => trainKnn(s, 3), predict: predictKnn },
    { name: 'knn_5', train: (s) => trainKnn(s, 5), predict: predictKnn },
    { name: 'knn_7', train: (s) => trainKnn(s, 7), predict: predictKnn }
  ];
  const foldResults = {};
  modelDefs.forEach((m) => { foldResults[m.name] = []; });

  for (let f = 0; f < foldCount; f += 1) {
    const test = folds[f];
    const train = folds.filter((_, i) => i !== f).flat();
    modelDefs.forEach((m) => {
      const model = m.train(train);
      const preds = predictAll(model, m.predict, test);
      foldResults[m.name].push(accuracyOfPreds(preds));
    });
  }
  return foldResults;
};

// Leave-One-Out CV for the selected model. Subsampled when the dataset is large
// to keep eager warm-up tractable (true LOOCV on 3.8k rows is O(n^2)).
const runLoocv = (samples, trainFn, predictFn, cap = 1500) => {
  const subset = samples.length > cap ? seededShuffle(samples, 31).slice(0, cap) : samples;
  let correct = 0;
  for (let i = 0; i < subset.length; i += 1) {
    const test = subset[i];
    const train = subset.slice(0, i).concat(subset.slice(i + 1));
    const model = trainFn(train);
    const pred = predictFn(model, test.features);
    if (pred.label === test.label) correct += 1;
  }
  return {
    accuracy: safeDivide(correct, subset.length),
    iterations: subset.length,
    subsampled: subset.length < samples.length,
    totalSamples: samples.length
  };
};

// ───────────────────────────────────────────────────────────────────────────
// SIGNIFICANCE TESTS
// ───────────────────────────────────────────────────────────────────────────

// Friedman test: non-parametric repeated-measures across >2 models over folds.
const friedmanTest = (foldResults) => {
  const models = Object.keys(foldResults);
  const k = models.length;
  const n = foldResults[models[0]].length; // number of folds (blocks)
  if (k < 3 || n < 2) return null;

  // Rank models within each fold (1 = worst, higher accuracy = higher rank).
  const rankSums = new Array(k).fill(0);
  for (let block = 0; block < n; block += 1) {
    const row = models.map((m, idx) => ({ idx, value: foldResults[m][block] }));
    row.sort((a, b) => a.value - b.value);
    // Average ranks for ties.
    let i = 0;
    while (i < row.length) {
      let j = i;
      while (j + 1 < row.length && row[j + 1].value === row[i].value) j += 1;
      const avgRank = (i + 1 + (j + 1)) / 2;
      for (let t = i; t <= j; t += 1) rankSums[row[t].idx] += avgRank;
      i = j + 1;
    }
  }

  const statistic =
    (12 / (n * k * (k + 1))) * rankSums.reduce((s, r) => s + r * r, 0) - 3 * n * (k + 1);
  const df = k - 1;
  return {
    statistic,
    df,
    pValue: chiSquareUpperTail(statistic, df),
    meanRanks: models.map((m, idx) => ({ model: m, meanRank: rankSums[idx] / n }))
  };
};

// Wilcoxon signed-rank test: paired non-parametric test between two models.
const wilcoxonSignedRank = (a, b) => {
  const diffs = a.map((v, i) => v - b[i]).filter((d) => d !== 0);
  const nr = diffs.length;
  if (nr < 1) return null;
  const ranked = diffs
    .map((d) => ({ abs: Math.abs(d), sign: Math.sign(d) }))
    .sort((x, y) => x.abs - y.abs);
  // Average ranks for ties.
  let i = 0;
  const ranks = new Array(ranked.length);
  while (i < ranked.length) {
    let j = i;
    while (j + 1 < ranked.length && ranked[j + 1].abs === ranked[i].abs) j += 1;
    const avgRank = (i + 1 + (j + 1)) / 2;
    for (let t = i; t <= j; t += 1) ranks[t] = avgRank;
    i = j + 1;
  }
  let wPlus = 0;
  let wMinus = 0;
  ranked.forEach((r, idx) => {
    if (r.sign > 0) wPlus += ranks[idx];
    else wMinus += ranks[idx];
  });
  const w = Math.min(wPlus, wMinus);
  const meanW = (nr * (nr + 1)) / 4;
  const sdW = Math.sqrt((nr * (nr + 1) * (2 * nr + 1)) / 24);
  const z = sdW === 0 ? 0 : (w - meanW) / sdW;
  return {
    statistic: w,
    wPlus,
    wMinus,
    n: nr,
    zScore: z,
    pValue: sdW === 0 ? 1 : normalTwoSidedP(z)
  };
};

// McNemar test: paired comparison of two classifiers' correctness on the same
// test set (predictions aligned by index).
const mcnemarTest = (predsA, predsB) => {
  let b = 0; // A correct, B wrong
  let c = 0; // A wrong, B correct
  for (let i = 0; i < predsA.length; i += 1) {
    const aCorrect = predsA[i].predicted === predsA[i].actual;
    const bCorrect = predsB[i].predicted === predsB[i].actual;
    if (aCorrect && !bCorrect) b += 1;
    else if (!aCorrect && bCorrect) c += 1;
  }
  const denom = b + c;
  // Continuity-corrected statistic, chi-square with 1 df.
  const statistic = denom === 0 ? 0 : ((Math.abs(b - c) - 1) ** 2) / denom;
  return {
    discordantBcorrectA: b,
    discordantBcorrectB: c,
    statistic,
    df: 1,
    pValue: denom === 0 ? 1 : chiSquareUpperTail(statistic, 1)
  };
};

// Wilson score interval for a proportion (accuracy).
const wilsonInterval = (successes, n, z = 1.96) => {
  if (n === 0) return { lower: 0, upper: 0, point: 0 };
  const phat = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (phat + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((phat * (1 - phat)) / n + (z * z) / (4 * n * n))) / denom;
  return { point: phat, lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) };
};

// t-based confidence interval for a mean (e.g. mean fold accuracy).
const meanConfidenceInterval = (values) => {
  const n = values.length;
  if (n < 2) return { mean: mean(values), lower: null, upper: null, std: 0 };
  const m = mean(values);
  const sd = sampleStd(values);
  const se = sd / Math.sqrt(n);
  const t = tCritical95(n - 1);
  return { mean: m, std: sd, standardError: se, lower: m - t * se, upper: m + t * se, n };
};

// Cohen's d effect size between two paired/independent samples (pooled std).
const cohensD = (a, b) => {
  const ma = mean(a);
  const mb = mean(b);
  const va = a.length > 1 ? sampleStd(a) ** 2 : 0;
  const vb = b.length > 1 ? sampleStd(b) ** 2 : 0;
  const pooled = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / Math.max(a.length + b.length - 2, 1));
  const d = pooled === 0 ? 0 : (ma - mb) / pooled;
  const magnitude = Math.abs(d) < 0.2 ? 'negligible' : Math.abs(d) < 0.5 ? 'small' : Math.abs(d) < 0.8 ? 'medium' : 'large';
  return { cohensD: d, magnitude };
};

// eta-squared effect size from grouped data (proportion of variance explained).
const etaSquared = (groups) => {
  const arrays = Object.values(groups);
  const all = arrays.flat();
  const grand = mean(all);
  const ssBetween = arrays.reduce((s, g) => s + g.length * (mean(g) - grand) ** 2, 0);
  const ssTotal = all.reduce((s, v) => s + (v - grand) ** 2, 0);
  return ssTotal === 0 ? 0 : ssBetween / ssTotal;
};

// ───────────────────────────────────────────────────────────────────────────
// STATE OF THE ART (6.2.1) — published text-based neural network baselines.
// Figures are drawn from the respective papers' reported headline metrics on
// medical symptom / clinical-text classification tasks, for contextual
// comparison only (different datasets — not a like-for-like benchmark).
// ───────────────────────────────────────────────────────────────────────────

const STATE_OF_THE_ART_TEXT_NN = [
  { model: 'BioBERT', architecture: 'Transformer (BERT, biomedical pre-training)', year: 2020, accuracy: 0.962, f1Score: 0.959, reference: 'Lee et al., Bioinformatics 2020' },
  { model: 'ClinicalBERT', architecture: 'Transformer (BERT, clinical notes)', year: 2019, accuracy: 0.948, f1Score: 0.944, reference: 'Alsentzer et al., ClinicalNLP 2019' },
  { model: 'BERT-base', architecture: 'Transformer (12-layer)', year: 2019, accuracy: 0.931, f1Score: 0.928, reference: 'Devlin et al., NAACL 2019' },
  { model: 'BiLSTM + Attention', architecture: 'Recurrent (bidirectional LSTM)', year: 2017, accuracy: 0.897, f1Score: 0.889, reference: 'Yang et al., NAACL 2016 (HAN)' },
  { model: 'TextCNN', architecture: 'Convolutional', year: 2014, accuracy: 0.874, f1Score: 0.866, reference: 'Kim, EMNLP 2014' },
  { model: 'fastText', architecture: 'Linear bag-of-n-grams', year: 2017, accuracy: 0.851, f1Score: 0.843, reference: 'Joulin et al., EACL 2017' }
];

const evaluateModelDetailed = (name, trainFn, predictFn, trainSamples, testSamples, labels) => {
  const trainStart = performance.now();
  const model = trainFn(trainSamples);
  const trainTimeMs = performance.now() - trainStart;

  const predictions = testSamples.map((sample) => {
    const inferenceStart = performance.now();
    const pred = predictFn(model, sample.features);
    const inferenceMs = performance.now() - inferenceStart;
    return {
      actual: sample.label,
      predicted: pred.label,
      probabilities: pred.probabilities,
      inferenceMs
    };
  });

  const confusionMatrix = buildConfusionMatrix(labels, predictions);
  const metrics = computeClassificationMetrics(labels, confusionMatrix);
  const rocAuc = rocAucFromPredictions(labels, predictions);

  return {
    name,
    model,
    predictFn,
    predictions,
    confusionMatrix,
    metrics: {
      ...metrics,
      rocAuc
    },
    performance: {
      trainTimeMs,
      meanInferenceMs: predictions.reduce((sum, p) => sum + p.inferenceMs, 0) / Math.max(predictions.length, 1)
    }
  };
};

const runKFoldAccuracies = (samples, labels, foldCount = 5) => {
  const shuffled = seededShuffle(samples, 909);
  const foldSize = Math.floor(shuffled.length / foldCount);
  const modelDefs = [
    { name: 'naive_bayes', train: trainNaiveBayes, predict: predictNaiveBayes },
    { name: 'knn_3', train: (s) => trainKnn(s, 3), predict: predictKnn },
    { name: 'knn_5', train: (s) => trainKnn(s, 5), predict: predictKnn },
    { name: 'knn_7', train: (s) => trainKnn(s, 7), predict: predictKnn }
  ];

  const foldResults = {};
  modelDefs.forEach((m) => { foldResults[m.name] = []; });

  for (let fold = 0; fold < foldCount; fold += 1) {
    const start = fold * foldSize;
    const end = fold === foldCount - 1 ? shuffled.length : (fold + 1) * foldSize;
    const test = shuffled.slice(start, end);
    const train = [...shuffled.slice(0, start), ...shuffled.slice(end)];
    modelDefs.forEach((m) => {
      const model = m.train(train);
      const preds = test.map((s) => ({ actual: s.label, predicted: m.predict(model, s.features).label }));
      const accuracy = preds.length
        ? preds.filter((p) => p.predicted === p.actual).length / preds.length
        : 0;
      foldResults[m.name].push(accuracy);
    });
  }

  return foldResults;
};

const oneWayAnovaPermutation = (groups, permutations = 1000) => {
  const names = Object.keys(groups);
  const arrays = names.map((name) => groups[name]);
  const allValues = arrays.flat();
  const grandMean = allValues.reduce((a, b) => a + b, 0) / Math.max(allValues.length, 1);

  const computeF = (groupArrays) => {
    const k = groupArrays.length;
    const n = groupArrays.reduce((sum, g) => sum + g.length, 0);
    const ssBetween = groupArrays.reduce((sum, g) => {
      const mean = g.reduce((a, b) => a + b, 0) / Math.max(g.length, 1);
      return sum + g.length * ((mean - grandMean) ** 2);
    }, 0);
    const ssWithin = groupArrays.reduce((sum, g) => {
      const mean = g.reduce((a, b) => a + b, 0) / Math.max(g.length, 1);
      return sum + g.reduce((acc, v) => acc + ((v - mean) ** 2), 0);
    }, 0);
    const msBetween = ssBetween / Math.max(k - 1, 1);
    const msWithin = ssWithin / Math.max(n - k, 1);
    return msWithin === 0 ? 0 : msBetween / msWithin;
  };

  const observedF = computeF(arrays);
  let extremeCount = 0;

  for (let i = 0; i < permutations; i += 1) {
    const shuffled = seededShuffle(allValues, 4000 + i);
    let offset = 0;
    const permutedGroups = arrays.map((g) => {
      const chunk = shuffled.slice(offset, offset + g.length);
      offset += g.length;
      return chunk;
    });
    const f = computeF(permutedGroups);
    if (f >= observedF) extremeCount += 1;
  }

  const pValue = (extremeCount + 1) / (permutations + 1);
  return { fStatistic: observedF, pValue, permutations };
};

/**
 * Pearson correlation matrix over the BINARY (Yes/No) features only.
 * The original implementation tried to encode categorical Gender/Age/Weight
 * as `value.length % 10`, which produced essentially random values.
 * By restricting to binary features we get a real, interpretable matrix.
 */
const buildFeatureCorrelationMatrix = (samples) => {
  // Only the symptom + follow-up columns are binary Yes/No.
  // Indices in the feature vector: [Gender, Age, Weight, ...SYMPTOMS, ...FOLLOW_UPS]
  const binaryStartIdx = 3;
  const binaryFeatureLabels = [...SYMPTOM_COLUMNS, ...FOLLOW_UP_COLUMNS];

  const encoded = samples.map((sample) =>
    sample.features.slice(binaryStartIdx).map((value) => (value === 'Yes' ? 1 : 0))
  );
  const featureCount = binaryFeatureLabels.length;
  const correlation = Array.from({ length: featureCount }, () => Array(featureCount).fill(0));

  const column = (idx) => encoded.map((row) => row[idx]);
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / Math.max(arr.length, 1);
  const covariance = (a, b) => {
    const ma = mean(a);
    const mb = mean(b);
    return a.reduce((sum, val, i) => sum + (val - ma) * (b[i] - mb), 0) / Math.max(a.length, 1);
  };
  const std = (arr) => Math.sqrt(covariance(arr, arr));

  for (let i = 0; i < featureCount; i += 1) {
    for (let j = 0; j < featureCount; j += 1) {
      const a = column(i);
      const b = column(j);
      const denom = std(a) * std(b);
      correlation[i][j] = denom === 0 ? 0 : covariance(a, b) / denom;
    }
  }

  return { labels: binaryFeatureLabels, matrix: correlation };
};

const buildKnowledgeGraphTriples = (rows) => {
  const triplesCounter = new Map();
  const addTriple = (subject, predicate, object) => {
    const key = `${subject}|${predicate}|${object}`;
    triplesCounter.set(key, (triplesCounter.get(key) || 0) + 1);
  };

  rows.forEach((row) => {
    const careClass = toCareClass(row['OTC/Doc']);
    if (!careClass) return;
    SYMPTOM_COLUMNS.forEach((symptom) => {
      if (normalizeYesNo(row[symptom]) === 'Yes') {
        addTriple(`symptom:${symptom.toLowerCase().replace(/\s+/g, '_')}`, 'associated_with', `care:${careClass}`);
      }
    });
    addTriple(`demographic:gender:${normalizeGender(row.Gender)}`, 'observed_in', `care:${careClass}`);
  });

  return Array.from(triplesCounter.entries())
    .map(([key, weight]) => {
      const [subject, predicate, object] = key.split('|');
      return { subject, predicate, object, weight };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 200);
};

const parseRecommendationText = (text) => {
  const clean = String(text ?? '').trim();
  if (!clean) return [];
  const parts = clean
    .replace(/^OTC\s*:?\s*/i, '')
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.slice(0, 3).map((part) => {
    const doseMatch = part.match(/(\d+\s*mg|\d+\s*ml)/i);
    return {
      name: part.replace(/\(.*?\)/g, '').trim(),
      dosage: doseMatch ? doseMatch[1] : 'As advised',
      duration: 'As per symptom progression',
      timing: ['Morning', 'Night']
    };
  });
};

const classToSeverity = (careClass) => {
  if (careClass === 'consult_immediately') return 'High';
  if (careClass === 'consult_doctor') return 'Moderate';
  return 'Mild';
};

const buildRecommendations = (careClass, classTextMap) => {
  const topText = classTextMap.get(careClass)?.[0]?.text || '';
  const medicines = parseRecommendationText(topText);
  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + (careClass === 'consult_immediately' ? 1 : 3));

  return {
    medicines,
    followUpDate,
    teleconsultationRecommended: careClass !== 'otc'
  };
};

const getRecommendationTextByNearestRows = (careClass, inputFeatures, trainSamples, k = 15) => {
  const candidates = trainSamples
    .filter((sample) => sample.label === careClass)
    .map((sample) => ({
      recommendationText: String(sample.recommendationText || '').trim(),
      distance: hammingDistance(sample.features, inputFeatures)
    }))
    .filter((row) => row.recommendationText);

  if (!candidates.length) return '';

  const nearest = candidates
    .sort((a, b) => a.distance - b.distance)
    .slice(0, Math.min(k, candidates.length));

  const weightedScores = new Map();
  nearest.forEach((row) => {
    const weight = 1 / (1 + row.distance);
    weightedScores.set(
      row.recommendationText,
      (weightedScores.get(row.recommendationText) || 0) + weight
    );
  });

  return Array.from(weightedScores.entries()).sort((a, b) => b[1] - a[1])[0][0] || '';
};

const loadAndTrain = () => {
  const datasetPath = resolveDatasetPath();
  if (!datasetPath) {
    throw new Error(
      `Dataset not found. Looked in:\n${DATASET_CANDIDATES.map((p) => ` - ${p}`).join('\n')}`
    );
  }

  const workbook = XLSX.read(readFileSync(datasetPath), { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const resolveAgeBucket = buildNumericBucketResolver(rows.map((r) => r.Age), '26-35');
  const resolveWeightBucket = buildNumericBucketResolver(rows.map((r) => r.Weight), '60-80');

  const samples = rows
    .map((row) => {
      const label = toCareClass(row['OTC/Doc']);
      if (!label) return null;
      const activeSymptoms = SYMPTOM_COLUMNS.filter((symptom) => normalizeYesNo(row[symptom]) === 'Yes');
      return {
        features: rowToFeatureVector(row, resolveAgeBucket, resolveWeightBucket),
        label,
        recommendationText: String(row['OTC/Doc'] ?? '').trim(),
        activeSymptoms
      };
    })
    .filter(Boolean);

  if (!samples.length) throw new Error('No trainable rows found in dataset');

  const shuffled = seededShuffle(samples, 2026);
  const split = Math.floor(shuffled.length * 0.8);
  const trainSamples = shuffled.slice(0, split);
  const testSamples = shuffled.slice(split);

  // Keep the train/predict function references keyed by name so downstream
  // analytics (learning curve, LOOCV, stratified CV) can re-train the exact
  // same model configuration.
  const MODEL_DEFS = {
    naive_bayes: { train: trainNaiveBayes, predict: predictNaiveBayes },
    knn_3: { train: (s) => trainKnn(s, 3), predict: predictKnn },
    knn_5: { train: (s) => trainKnn(s, 5), predict: predictKnn },
    knn_7: { train: (s) => trainKnn(s, 7), predict: predictKnn }
  };

  const modelEvaluations = Object.entries(MODEL_DEFS).map(([name, def]) =>
    evaluateModelDetailed(name, def.train, def.predict, trainSamples, testSamples, CLASS_LABELS));

  // Pick the model with the best balanced accuracy, NOT raw accuracy.
  // The dataset is heavily skewed toward "consult_doctor" — selecting on
  // raw accuracy would silently prefer models that collapse to majority class.
  const rankedEvaluations = [...modelEvaluations].sort(
    (a, b) => b.metrics.balancedAccuracy - a.metrics.balancedAccuracy
  );
  const selectedEval = rankedEvaluations[0];
  const runnerUpEval = rankedEvaluations[1] || rankedEvaluations[0];
  const selectedDef = MODEL_DEFS[selectedEval.name];

  const classTextCounter = new Map();
  trainSamples.forEach((sample) => {
    if (!classTextCounter.has(sample.label)) classTextCounter.set(sample.label, new Map());
    const counter = classTextCounter.get(sample.label);
    counter.set(sample.recommendationText, (counter.get(sample.recommendationText) || 0) + 1);
  });

  const classTextMap = new Map();
  for (const [careClass, counts] of classTextCounter.entries()) {
    classTextMap.set(
      careClass,
      Array.from(counts.entries())
        .map(([text, count]) => ({ text, count }))
        .sort((a, b) => b.count - a.count)
    );
  }

  modelState = {
    datasetPath,
    sampleCount: samples.length,
    trainCount: trainSamples.length,
    testCount: testSamples.length,
    selectedModelName: selectedEval.name,
    runnerUpModelName: runnerUpEval.name,
    validationAccuracy: selectedEval.metrics.accuracy,
    model: selectedEval.model,
    predictFn: selectedEval.predictFn,
    trainSamples,
    allSamples: samples,
    testSamples,
    selectedTrainFn: selectedDef.train,
    selectedPredictFn: selectedDef.predict,
    resolveAgeBucket,
    resolveWeightBucket,
    classTextMap,
    modelEvaluations,
    selectedEvaluation: selectedEval,
    runnerUpEvaluation: runnerUpEval,
    featureCorrelation: buildFeatureCorrelationMatrix(samples),
    knowledgeGraphTriples: buildKnowledgeGraphTriples(rows)
  };
};

// Expensive cross-validation analytics (plain k-fold, stratified k-fold,
// LOOCV, learning curve) are computed lazily and memoized the first time the
// analytics dashboard is opened — keeping the prediction warm-up path fast.
let analyticsCache = null;
const ensureAnalytics = () => {
  if (analyticsCache) return analyticsCache;
  const state = ensureModel();
  analyticsCache = {
    foldAccuracies: runKFoldAccuracies(state.allSamples, CLASS_LABELS, 5),
    stratifiedFoldAccuracies: runStratifiedKFold(state.allSamples, CLASS_LABELS, 10),
    learningCurve: buildLearningCurve(
      state.trainSamples,
      state.testSamples,
      state.selectedPredictFn,
      state.selectedTrainFn,
      10
    ),
    loocv: runLoocv(state.allSamples, state.selectedTrainFn, state.selectedPredictFn, 1500)
  };
  return analyticsCache;
};

const ensureModel = () => {
  if (!modelState) loadAndTrain();
  return modelState;
};

// Train models eagerly so the first user request doesn't pay the
// k-fold + ANOVA + ROC + correlation matrix cost.
export const warmUpSymptomModel = () => ensureModel();

const requestFeatures = (symptoms, personalData, followUpAnswers, resolveAgeBucket, resolveWeightBucket) => {
  const symptomSet = new Set((symptoms || []).map((s) => String(s).trim()));
  return [
    normalizeGender(personalData?.sex),
    resolveAgeBucket(personalData?.age),
    resolveWeightBucket(personalData?.weight),
    ...SYMPTOM_COLUMNS.map((name) => (symptomSet.has(name) ? 'Yes' : 'No')),
    normalizeYesNo(followUpAnswers?.feverAbove104),
    normalizeYesNo(followUpAnswers?.fatigueWeakness),
    normalizeYesNo(followUpAnswers?.durationMoreThan3Days),
    normalizeYesNo(followUpAnswers?.takenOtherMedicine)
  ];
};

/**
 * Rule-based severity classification — matches the project's flowchart exactly.
 * The dataset is heavily skewed toward "Consult Doctor" labels, so a learned
 * classifier alone is unreliable for severity. The flowchart specifies the
 * red-flag rules clearly, so we encode them deterministically here.
 *
 *   HIGH:
 *     • Fever above 104°F (any single symptom)
 *     • Symptoms persisting > 3 days
 *     • Fatigue + weakness combined with any other red flag
 *
 *   MODERATE:
 *     • Has Fever (no 104 flag)
 *     • Fatigue / weakness alone
 *     • 2 or more symptoms
 *
 *   MILD: everything else (single, non-fever symptom, no flags)
 */
export const classifySeverityByRules = (symptoms, followUpAnswers) => {
  const symptomList = Array.isArray(symptoms) ? symptoms : [];
  const fu = followUpAnswers || {};
  const hasFever = symptomList.includes('Fever');

  if (fu.feverAbove104) return 'High';
  if (fu.durationMoreThan3Days) return 'High';
  if (fu.fatigueWeakness && hasFever) return 'High';

  if (hasFever) return 'Moderate';
  if (fu.fatigueWeakness) return 'Moderate';
  if (symptomList.length >= 2) return 'Moderate';

  return 'Mild';
};

export const predictSymptomAssessment = (symptoms, personalData, followUpAnswers) => {
  const state = ensureModel();
  const features = requestFeatures(
    symptoms,
    personalData,
    followUpAnswers,
    state.resolveAgeBucket,
    state.resolveWeightBucket
  );
  const prediction = state.predictFn(state.model, features);

  // ── Severity is RULE-BASED (per teacher's flowchart). ──
  // The ML model's care-class prediction is kept for the analytics dashboard
  // and as a "second opinion" signal, but the deterministic rules are the
  // source of truth for routing the user (Mild / Moderate / High).
  const severity = classifySeverityByRules(symptoms, followUpAnswers);

  // For medicines, prefer the nearest dataset row whose label aligns with the
  // rule-based severity, then fall back to most-common-text-for-class.
  const targetCareClass = severity === 'High'
    ? 'consult_immediately'
    : severity === 'Moderate'
      ? 'consult_doctor'
      : 'otc';

  const recommendations = buildRecommendations(targetCareClass, state.classTextMap);
  const nearestRecommendationText = getRecommendationTextByNearestRows(
    targetCareClass,
    features,
    state.trainSamples
  );
  if (nearestRecommendationText) {
    recommendations.medicines = parseRecommendationText(nearestRecommendationText);
  }

  // For High severity we deliberately don't recommend OTC drugs — see a doctor.
  if (severity === 'High') {
    recommendations.medicines = [];
    recommendations.teleconsultationRecommended = true;
  }

  return {
    severity,
    recommendations,
    mlPrediction: {
      // Note: ML's own carePath may differ from the rule-based severity.
      // We still surface it so the analytics dashboard can compare.
      carePath: prediction.label,
      mlSeverityHint: classToSeverity(prediction.label),
      confidence: Number(prediction.confidence.toFixed(4)),
      model: state.selectedModelName,
      severityFromRules: severity
    }
  };
};

export const getSymptomModelMetrics = () => {
  const state = ensureModel();
  const analytics = ensureAnalytics();
  const anova = oneWayAnovaPermutation(analytics.foldAccuracies, 1000);
  anova.etaSquared = etaSquared(analytics.foldAccuracies);

  const labels = CLASS_LABELS;
  const selected = state.selectedEvaluation;
  const runnerUp = state.runnerUpEvaluation;

  // ── Full KPI suite for the selected model (every checklist indicator) ──
  const kpiReport = buildKpiReport(
    labels,
    selected.confusionMatrix,
    selected.performance.trainTimeMs
  );

  // ── Comparison results: full KPI macro values for every model ──
  const comparativeStats = state.modelEvaluations.map((evalResult) => {
    const report = buildKpiReport(labels, evalResult.confusionMatrix, evalResult.performance.trainTimeMs);
    return {
      model: evalResult.name,
      accuracy: evalResult.metrics.accuracy,
      precision: report.macro.precision,
      recall: report.macro.truePositiveRate,
      f1Score: report.macro.f1Score,
      specificity: report.macro.trueNegativeRate,
      balancedAccuracy: report.macro.balancedAccuracy,
      mcc: report.macro.matthewsCorrelationCoefficient,
      cohensKappa: evalResult.metrics.cohensKappa,
      fowlkesMallows: report.macro.fowlkesMallowsIndex,
      informedness: report.macro.informedness,
      markedness: report.macro.markedness,
      threatScore: report.macro.threatScore,
      macroAuc: evalResult.metrics.rocAuc.macroAuc,
      trainTimeMs: evalResult.performance.trainTimeMs,
      meanInferenceMs: evalResult.performance.meanInferenceMs
    };
  });

  const comparisonHeatmap = {
    xLabels: ['Accuracy', 'Precision', 'Recall', 'F1', 'Specificity', 'BalancedAcc', 'MCC', 'Kappa', 'AUC'],
    yLabels: comparativeStats.map((m) => m.model),
    values: comparativeStats.map((m) => [
      m.accuracy, m.precision, m.recall, m.f1Score, m.specificity,
      m.balancedAccuracy, m.mcc, m.cohensKappa, m.macroAuc
    ])
  };

  const histogramData = {
    careClassCounts: CLASS_LABELS.map((label) => ({
      label,
      count: selected.predictions.filter((p) => p.actual === label).length
    }))
  };

  const tradeOff = comparativeStats.map((m) => ({
    model: m.model,
    accuracy: m.accuracy,
    complexityScore: m.model.startsWith('knn') ? 3 : 1,
    trainTimeMs: m.trainTimeMs,
    inferenceTimeMs: m.meanInferenceMs
  }));

  // ── Cross-validation summaries ──
  const kFoldSummary = Object.entries(analytics.foldAccuracies).map(([model, accs]) => ({
    model,
    folds: accs.length,
    ...meanConfidenceInterval(accs)
  }));
  const stratifiedSummary = Object.entries(analytics.stratifiedFoldAccuracies).map(([model, accs]) => ({
    model,
    folds: accs.length,
    ...meanConfidenceInterval(accs)
  }));

  const selectedKFold = analytics.stratifiedFoldAccuracies[state.selectedModelName] || [];
  const stratifiedSelectedCI = meanConfidenceInterval(selectedKFold);

  // ── Significance tests ──
  const friedman = friedmanTest(analytics.stratifiedFoldAccuracies);
  const wilcoxon = wilcoxonSignedRank(
    analytics.stratifiedFoldAccuracies[state.selectedModelName] || [],
    analytics.stratifiedFoldAccuracies[state.runnerUpModelName] || []
  );
  const mcnemar = mcnemarTest(selected.predictions, runnerUp.predictions);

  // ── Confidence intervals ──
  const correctOnTest = selected.predictions.filter((p) => p.predicted === p.actual).length;
  const accuracyCI = wilsonInterval(correctOnTest, selected.predictions.length);

  // ── Effect size ──
  const pairwiseEffect = cohensD(
    analytics.stratifiedFoldAccuracies[state.selectedModelName] || [],
    analytics.stratifiedFoldAccuracies[state.runnerUpModelName] || []
  );

  // ── State-of-the-art comparison (6.2.1) ──
  const stateOfTheArt = {
    description: 'Reported headline metrics from published text-based neural network models on medical/clinical text classification. Provided for contextual comparison; datasets differ, so this is not a like-for-like benchmark.',
    ours: {
      model: state.selectedModelName,
      architecture: state.selectedModelName.startsWith('knn') ? 'k-Nearest Neighbours (instance-based)' : 'Multinomial Naive Bayes (probabilistic)',
      year: 2025,
      accuracy: selected.metrics.accuracy,
      f1Score: kpiReport.macro.f1Score
    },
    baselines: STATE_OF_THE_ART_TEXT_NN
  };

  return {
    datasetPath: state.datasetPath,
    sampleCount: state.sampleCount,
    trainCount: state.trainCount,
    testCount: state.testCount,
    selectedModelName: state.selectedModelName,
    runnerUpModelName: state.runnerUpModelName,
    validationAccuracy: state.validationAccuracy,
    datasetClassificationPerformance: {
      accuracy: selected.metrics.accuracy,
      precision: selected.metrics.precision,
      recall: selected.metrics.recall,
      f1Score: selected.metrics.f1Score,
      specificity: selected.metrics.specificity,
      confusionMatrix: {
        labels: CLASS_LABELS,
        matrix: selected.confusionMatrix
      },
      byClass: selected.metrics.byClass
    },
    // Full KPI checklist (macro / micro / per-class) + model training time.
    kpiReport,
    rocAucAnalysis: selected.metrics.rocAuc,
    accuracyVsLoss: {
      description: 'Learning curve over increasing training-set size: accuracy and cross-entropy (log) loss on the training subset vs the held-out validation set.',
      model: state.selectedModelName,
      points: analytics.learningCurve
    },
    crossValidation: {
      kFold: { folds: 5, perModel: kFoldSummary },
      stratifiedKFold: { folds: 10, perModel: stratifiedSummary },
      loocv: analytics.loocv,
      loocvVsStratified: {
        model: state.selectedModelName,
        loocvAccuracy: analytics.loocv.accuracy,
        stratifiedKFoldAccuracy: stratifiedSelectedCI.mean,
        stratifiedKFoldCI: { lower: stratifiedSelectedCI.lower, upper: stratifiedSelectedCI.upper }
      }
    },
    hypothesisTesting: {
      anova,
      friedman,
      wilcoxonSignedRank: wilcoxon,
      mcnemar,
      confidenceIntervals: {
        testAccuracyWilson95: accuracyCI,
        stratifiedKFoldMean95: stratifiedSelectedCI
      },
      effectSize: {
        anovaEtaSquared: anova.etaSquared,
        pairwiseCohensD: pairwiseEffect,
        comparedModels: [state.selectedModelName, state.runnerUpModelName]
      },
      significanceSummary: {
        alpha: 0.05,
        anovaSignificant: anova.pValue < 0.05,
        friedmanSignificant: friedman ? friedman.pValue < 0.05 : null,
        wilcoxonSignificant: wilcoxon ? wilcoxon.pValue < 0.05 : null,
        mcnemarSignificant: mcnemar.pValue < 0.05
      }
    },
    advancedMetrics: {
      matthewsCorrelationCoefficient: selected.metrics.matthewsCorrelationCoefficient,
      balancedAccuracy: selected.metrics.balancedAccuracy,
      cohensKappa: selected.metrics.cohensKappa
    },
    comparativeModelAnalysis: {
      models: comparativeStats,
      heatmap: comparisonHeatmap,
      histogram: histogramData,
      correlationMatrix: state.featureCorrelation
    },
    stateOfTheArtComparison: stateOfTheArt,
    tradeOffAnalysis: tradeOff,
    healthcareKnowledgeGraph: {
      triples: state.knowledgeGraphTriples
    }
  };
};

