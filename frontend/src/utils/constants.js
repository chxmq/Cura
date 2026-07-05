// Application constants

export const SYMPTOMS_LIST = [
  'Fever',
  'Common Cold',
  'Cough',
  'Body Pain',
  'Headache',
  'Menstrual Cramps',
  'Sprain',
  'Indigestion',
  'Toothache'
];

const rawApiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050/api';
export const API_BASE_URL = rawApiBase.endsWith('/api')
  ? rawApiBase
  : `${rawApiBase.replace(/\/$/, '')}/api`;

export const SEVERITY_COLORS = {
  Mild: 'bg-blue-100 text-blue-800 border-blue-300',
  Moderate: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  High: 'bg-red-100 text-red-800 border-red-300'
};

export const SAFETY_STATUS_COLORS = {
  safe: 'bg-blue-100 text-blue-800 border-blue-300',
  unsafe: 'bg-red-100 text-red-800 border-red-300'
};
