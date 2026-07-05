// Utility to process Excel dataset and create symptom-medicine mappings
import XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveDatasetPath } from './resolveDatasetPath.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Module-level cache so repeat callers (server boot, RAG pipeline, etc.)
// don't re-read the spreadsheet on every invocation.
let cachedDataset = null;

/**
 * Process Excel dataset and extract symptom-medicine relationships
 */
export const processDataset = () => {
  if (cachedDataset) return cachedDataset;
  cachedDataset = computeDataset();
  return cachedDataset;
};

const computeDataset = () => {
  try {
    const datasetPath = resolveDatasetPath(__dirname);

    let workbook;
    try {
      if (!datasetPath) {
        throw new Error('Dataset path not found');
      }
      const fileBuffer = readFileSync(datasetPath);
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (error) {
      console.warn('Dataset file not found, using default mappings');
      return getDefaultMappings();
    }

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    // Process data to create symptom-medicine mappings
    const symptomMappings = {};
    const medicineDatabase = {};

    data.forEach((row, index) => {
      // Extract symptoms (assuming columns like Symptom1, Symptom2, etc. or a Symptoms column)
      const symptoms = [];
      const medicines = [];

      // Try different possible column names
      Object.keys(row).forEach(key => {
        const value = String(row[key] || '').trim();

        // Identify symptom columns
        if (key.toLowerCase().includes('symptom') && value) {
          symptoms.push(value);
        }

        // Identify medicine columns
        if ((key.toLowerCase().includes('medicine') ||
          key.toLowerCase().includes('drug') ||
          key.toLowerCase().includes('medication')) && value) {
          medicines.push(value);
        }

        // Check for severity
        if (key.toLowerCase().includes('severity') && value) {
          // Store severity information
        }
      });

      // If no structured columns found, try to infer from all columns
      if (symptoms.length === 0 && medicines.length === 0) {
        // Assume first few columns are symptoms, later are medicines/treatments
        const values = Object.values(row).filter(v => v && String(v).trim());
        if (values.length >= 2) {
          symptoms.push(...values.slice(0, Math.floor(values.length / 2)));
          medicines.push(...values.slice(Math.floor(values.length / 2)));
        }
      }

      // Create mappings
      symptoms.forEach(symptom => {
        if (!symptomMappings[symptom]) {
          symptomMappings[symptom] = [];
        }
        medicines.forEach(medicine => {
          if (!symptomMappings[symptom].includes(medicine)) {
            symptomMappings[symptom].push(medicine);
          }
        });
      });

      // Store medicine information
      medicines.forEach(medicine => {
        if (!medicineDatabase[medicine]) {
          medicineDatabase[medicine] = {
            name: medicine,
            commonSymptoms: symptoms,
            dosage: inferDosage(medicine),
            frequency: inferFrequency(medicine, row)
          };
        }
      });
    });

    return {
      symptomMappings,
      medicineDatabase,
      rawData: data
    };
  } catch (error) {
    console.error('Error processing dataset:', error);
    return getDefaultMappings();
  }
};

/**
 * Infer dosage from medicine name or row data
 */
const inferDosage = (medicineName) => {
  // Common dosage patterns
  const dosagePatterns = {
    'paracetamol': '500mg',
    'acetaminophen': '500mg',
    'ibuprofen': '400mg',
    'amoxicillin': '500mg',
    'azithromycin': '500mg',
    'ciprofloxacin': '500mg',
    'doxycycline': '100mg',
    'metformin': '500mg',
    'aspirin': '75mg',
    'omeprazole': '20mg',
    'loratadine': '10mg'
  };

  const lowerName = medicineName.toLowerCase();
  for (const [key, dosage] of Object.entries(dosagePatterns)) {
    if (lowerName.includes(key)) {
      return dosage;
    }
  }

  return 'As prescribed';
};

/**
 * Infer frequency from medicine or row data
 */
const inferFrequency = (medicineName, row) => {
  // Prefer an explicit frequency/times column from the row when present.
  const explicitKey = Object.keys(row || {}).find((key) => {
    const lower = key.toLowerCase();
    return lower.includes('frequency') || lower.includes('times');
  });
  if (explicitKey && row[explicitKey]) {
    return String(row[explicitKey]).trim();
  }

  const frequencyPatterns = {
    'paracetamol': '2 times daily',
    'ibuprofen': '3 times daily',
    'amoxicillin': '3 times daily',
    'azithromycin': 'Once daily',
    'antibiotic': '2-3 times daily'
  };

  const lowerName = medicineName.toLowerCase();
  for (const [key, frequency] of Object.entries(frequencyPatterns)) {
    if (lowerName.includes(key)) {
      return frequency;
    }
  }

  return '2 times daily';
};

/**
 * Default mappings if dataset cannot be loaded
 */
const getDefaultMappings = () => {
  return {
    symptomMappings: {
      'Fever': ['Paracetamol', 'Ibuprofen'],
      'Common Cold': ['Paracetamol', 'Antihistamine'],
      'Cough': ['Cough Syrup', 'Expectorant'],
      'Body Pain': ['Ibuprofen', 'Paracetamol'],
      'Headache': ['Paracetamol', 'Ibuprofen'],
      'Menstrual Cramps': ['Ibuprofen', 'Mefenamic Acid'],
      'Sprain': ['Ibuprofen', 'Topical Analgesic'],
      'Indigestion': ['Omeprazole', 'Antacid'],
      'Toothache': ['Ibuprofen', 'Paracetamol']
    },
    medicineDatabase: {
      'Paracetamol': {
        name: 'Paracetamol',
        commonSymptoms: ['Fever', 'Headache', 'Body Pain'],
        dosage: '500mg',
        frequency: '2 times daily'
      },
      'Ibuprofen': {
        name: 'Ibuprofen',
        commonSymptoms: ['Body Pain', 'Headache', 'Menstrual Cramps'],
        dosage: '400mg',
        frequency: '3 times daily'
      }
    },
    rawData: []
  };
};

export default { processDataset };
