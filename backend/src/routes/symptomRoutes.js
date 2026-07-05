import express from 'express';
import auth from '../middleware/auth.js';
import SymptomAnalysis from '../models/SymptomAnalysis.js';
import Recommendation from '../models/Recommendation.js';
import { createRecommendationFromAnalysis } from '../services/recommendationService.js';
import { predictSymptomAssessment, getSymptomModelMetrics } from '../services/symptomMlModelService.js';
import { getMedicineCombinationFromGemini } from '../services/geminiService.js';

const router = express.Router();

/**
 * POST /api/symptoms/analyze
 * Analyzes symptoms using trained ML model only.
 * Body: { personalData: {age,sex,weight}, symptoms: string[], followUpAnswers: { feverAbove104, fatigueWeakness, durationMoreThan3Days, takenOtherMedicine } }
 */
router.post('/analyze', auth, async (req, res, next) => {
  try {
    const { personalData: rawPersonalData, symptoms, followUpAnswers } = req.body;

    if (!rawPersonalData || !symptoms || !followUpAnswers) {
      return res.status(400).json({
        success: false,
        error: 'Please provide personal data, symptoms, and follow-up answers'
      });
    }

    // Don't mutate req.body — work on a normalised copy.
    const personalData = {
      ...rawPersonalData,
      sex: typeof rawPersonalData.sex === 'string'
        ? rawPersonalData.sex.toLowerCase()
        : rawPersonalData.sex
    };

    if (!personalData.age || !personalData.sex || !personalData.weight) {
      return res.status(400).json({
        success: false,
        error: 'Please provide age, sex, and weight'
      });
    }

    if (!Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please select at least one symptom'
      });
    }

    const followUpNormalized = {
      feverAbove104: !!followUpAnswers.feverAbove104,
      fatigueWeakness: !!followUpAnswers.fatigueWeakness,
      durationMoreThan3Days: !!followUpAnswers.durationMoreThan3Days,
      takenOtherMedicine: !!followUpAnswers.takenOtherMedicine
    };
    const { severity, recommendations, mlPrediction } = predictSymptomAssessment(
      symptoms,
      personalData,
      followUpNormalized
    );

    // For Mild/Moderate severity, ask Gemini for a richer drug combination
    // (the teacher's flowchart calls this out explicitly). For High severity
    // we deliberately don't recommend OTC drugs — the user should see a doctor.
    let aiRationale = '';
    let aiWarnings = [];
    let aiPowered = false;
    if (severity !== 'High') {
      const aiSuggestion = await getMedicineCombinationFromGemini({
        symptoms,
        severity,
        personalData,
        followUpAnswers: followUpNormalized
      });
      if (aiSuggestion && aiSuggestion.medicines.length > 0) {
        recommendations.medicines = aiSuggestion.medicines;
        aiRationale = aiSuggestion.rationale || '';
        aiWarnings = aiSuggestion.warnings || [];
        aiPowered = true;
      } else {
        aiRationale = 'Using the local ML + rules fallback plan because live AI suggestions were unavailable right now.';
        aiWarnings = [
          'If symptoms worsen or do not improve in 48-72 hours, consult a clinician.',
          'Do not combine additional OTC medicines with similar ingredients unless advised.'
        ];
      }
    }

    const symptomAnalysis = await SymptomAnalysis.create({
      userId: req.userId,
      personalData,
      symptoms,
      followUpAnswers: followUpNormalized,
      severity,
      recommendations
    });

    const recommendation = await createRecommendationFromAnalysis(
      req.userId,
      symptomAnalysis._id,
      recommendations
    );

    res.json({
      success: true,
      data: {
        analysisId: symptomAnalysis._id,
        severity,
        recommendations,
        mlPrediction,
        aiPowered,
        aiRationale,
        aiWarnings,
        recommendationId: recommendation._id
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/history', auth, async (req, res, next) => {
  try {
    const analyses = await SymptomAnalysis.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      success: true,
      data: analyses
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', auth, async (req, res, next) => {
  try {
    const analysis = await SymptomAnalysis.findOne({ _id: req.params.id, userId: req.userId });
    if (!analysis) {
      return res.status(404).json({ success: false, error: 'Analysis not found' });
    }

    await Recommendation.deleteMany({ symptomAnalysisId: req.params.id, userId: req.userId });
    await SymptomAnalysis.deleteOne({ _id: req.params.id, userId: req.userId });
    res.json({ success: true, message: 'Analysis deleted' });
  } catch (error) {
    next(error);
  }
});

router.get('/model-metrics', auth, async (req, res, next) => {
  try {
    const metrics = getSymptomModelMetrics();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(error);
  }
});

export default router;
