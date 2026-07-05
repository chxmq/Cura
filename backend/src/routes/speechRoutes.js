import express from 'express';
import multer from 'multer';
import auth from '../middleware/auth.js';
import { transcribeAudio } from '../services/speechService.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// POST /api/speech/transcribe
// Multipart: audio file + optional language (en|hi|kn)
// JSON fallback: { audioBase64, mimeType, language }
router.post('/transcribe', auth, upload.single('audio'), async (req, res, next) => {
  try {
    const language = ['en', 'hi', 'kn'].includes(req.body?.language)
      ? req.body.language
      : 'en';

    let audioBase64;
    let mimeType = 'audio/webm';

    if (req.file?.buffer) {
      audioBase64 = req.file.buffer.toString('base64');
      mimeType = req.file.mimetype || mimeType;
    } else if (req.body?.audioBase64) {
      audioBase64 = req.body.audioBase64;
      mimeType = req.body.mimeType || mimeType;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Please provide an audio file or audioBase64 payload.'
      });
    }

    const result = await transcribeAudio({ audioBase64, mimeType, language });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

export default router;
