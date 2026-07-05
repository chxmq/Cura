import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LEGACY_FILENAME = 'New Dataset-8 symptoms-2025  (1).xlsx';
const CANONICAL_RELATIVE = path.join('datasets', 'symptoms_2025.xlsx');

const buildCandidates = (fromDir = __dirname) => {
  const unique = new Set();

  if (process.env.DATASET_PATH) unique.add(process.env.DATASET_PATH);

  // Docker WORKDIR=/app, Render rootDir=backend, and local repo root.
  unique.add(path.join(process.cwd(), CANONICAL_RELATIVE));
  unique.add(path.join(process.cwd(), '..', CANONICAL_RELATIVE));
  unique.add(path.join(process.cwd(), LEGACY_FILENAME));
  unique.add(path.join(process.cwd(), '..', LEGACY_FILENAME));

  // From backend/src/utils or backend/src/services
  unique.add(path.join(fromDir, '../../datasets/symptoms_2025.xlsx'));
  unique.add(path.join(fromDir, '../../../datasets/symptoms_2025.xlsx'));
  unique.add(path.join(fromDir, '../../../', LEGACY_FILENAME));
  unique.add(path.join(fromDir, '../../../../datasets/symptoms_2025.xlsx'));

  return Array.from(unique);
};

export const getDatasetCandidates = (fromDir) => buildCandidates(fromDir);

export const resolveDatasetPath = (fromDir) => {
  const candidates = buildCandidates(fromDir);
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
};

export const formatDatasetLookupError = (fromDir) => {
  const candidates = buildCandidates(fromDir);
  return `Dataset not found. Looked in:\n${candidates.map((p) => ` - ${p}`).join('\n')}`;
};
