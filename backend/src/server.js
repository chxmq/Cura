import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

// Load environment variables before importing modules that read them.
dotenv.config();

import authRoutes from './routes/authRoutes.js';
import prescriptionRoutes from './routes/prescriptionRoutes.js';
import symptomRoutes from './routes/symptomRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import teleconsultationRoutes from './routes/teleconsultationRoutes.js';
import speechRoutes from './routes/speechRoutes.js';

import errorHandler from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5050;

// Middleware — support comma-separated origins for cloud deploys
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(null, allowedOrigins[0]);
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded prescription images
app.use('/uploads', express.static(uploadsDir));

// Serve publication-quality ML figures (300 DPI PNG)
const figureCandidates = [
  path.join(__dirname, '../../docs/figures/png'),
  path.join(__dirname, '../docs/figures/png')
];
const figuresDir = figureCandidates.find((dir) => existsSync(dir));
if (figuresDir) {
  app.use('/api/figures', express.static(figuresDir));
}

const warmUpDatasetAndModel = async () => {
  try {
    const { processDataset } = await import('./utils/processDataset.js');
    const datasetData = processDataset();
    console.log('Dataset loaded:', {
      symptoms: Object.keys(datasetData.symptomMappings || {}).length,
      medicines: Object.keys(datasetData.medicineDatabase || {}).length
    });
  } catch (error) {
    console.warn('Dataset loading warning:', error.message);
  }

  try {
    const { warmUpSymptomModel } = await import('./services/symptomMlModelService.js');
    const start = Date.now();
    const state = warmUpSymptomModel();
    console.log(
      `ML model warmed up: ${state.selectedModelName} (acc=${(state.validationAccuracy * 100).toFixed(2)}%) in ${Date.now() - start}ms`
    );
  } catch (error) {
    console.warn('ML warm-up warning:', error.message);
  }
};

warmUpDatasetAndModel();

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare_db';
mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/prescription', prescriptionRoutes);
app.use('/api/symptoms', symptomRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/teleconsultations', teleconsultationRoutes);
app.use('/api/speech', speechRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Healthcare API is running' });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
