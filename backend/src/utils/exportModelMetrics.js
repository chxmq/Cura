// Exports the live, computed model-evaluation metrics to a JSON file so the
// figure-generation pipeline (docs/figures/generate_figures.py) can render
// publication-quality plots from real numbers — no mock data.
//
// Usage (from the backend/ folder):
//   node src/utils/exportModelMetrics.js
//
// Output: docs/figures/model_metrics.json

import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { warmUpSymptomModel, getSymptomModelMetrics } from '../services/symptomMlModelService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outDir = path.join(__dirname, '../../../docs/figures');
const outFile = path.join(outDir, 'model_metrics.json');

console.log('Training model and computing full evaluation suite (this can take ~30s)...');
const warmStart = Date.now();
warmUpSymptomModel();
console.log(`Model trained in ${Date.now() - warmStart}ms.`);

const metricsStart = Date.now();
const metrics = getSymptomModelMetrics();
console.log(`Metrics + cross-validation + significance tests computed in ${Date.now() - metricsStart}ms.`);

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(metrics, null, 2));
console.log(`Wrote ${outFile}`);
