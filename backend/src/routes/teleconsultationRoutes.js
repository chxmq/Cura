import express from 'express';
import auth from '../middleware/auth.js';
import TeleconsultationAppointment from '../models/TeleconsultationAppointment.js';
import {
  getHealthAssistantReply
} from '../services/teleconsultationAssistantService.js';

const router = express.Router();
const HEYGEN_REQUEST_TIMEOUT_MS = 15_000;

const fetchJsonWithTimeout = async (url, options = {}, timeoutMs = HEYGEN_REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const raw = await response.text();
    let json = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }
    return { response, raw, json };
  } finally {
    clearTimeout(timeoutId);
  }
};

const extractTokenFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return '';
  return (
    payload?.data?.session_token
    || payload?.data?.token
    || payload?.session_token
    || payload?.token
    || ''
  );
};

// Save a doctor appointment for the authenticated user.
// Body: { doctorName, doctorSpecialty, appointmentDate, appointmentTime }
router.post('/appointments', auth, async (req, res, next) => {
  try {
    const {
      doctorName,
      doctorSpecialty,
      appointmentDate,
      appointmentTime
    } = req.body;

    if (!doctorName || !doctorSpecialty || !appointmentDate || !appointmentTime) {
      return res.status(400).json({
        success: false,
        error: 'Please provide doctorName, doctorSpecialty, appointmentDate, and appointmentTime'
      });
    }

    const appointment = await TeleconsultationAppointment.create({
      userId: req.userId,
      doctorName,
      doctorSpecialty,
      appointmentDate,
      appointmentTime
    });

    res.json({
      success: true,
      data: {
        appointmentId: appointment._id,
        appointment
      }
    });
  } catch (error) {
    next(error);
  }
});

// RAG + Gemini assistant reply
// Body: { query, history?: [{ role: "user"|"assistant", content: string }] }
router.post('/assistant/respond', auth, async (req, res, next) => {
  try {
    const { query, history = [], language = 'en' } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Please provide a query string.'
      });
    }

    const response = await getHealthAssistantReply({
      query: query.trim(),
      history: Array.isArray(history) ? history : [],
      language: ['en', 'hi', 'kn'].includes(language) ? language : 'en'
    });

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    next(error);
  }
});

// Generate LiveAvatar session token for avatar sessions.
router.post('/assistant/heygen-token', auth, async (req, res, next) => {
  try {
    const apiKey = process.env.LIVEAVATAR_API_KEY || process.env.HEYGEN_API_KEY;
    const avatarId = req.body?.avatarId
      || process.env.LIVEAVATAR_AVATAR_ID
      || process.env.HEYGEN_AVATAR_ID
      || 'Ann_Doctor_Sitting_public';

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'LIVEAVATAR_API_KEY (or HEYGEN_API_KEY fallback) is not configured on the server.'
      });
    }

    const liveavatarRequest = () => fetchJsonWithTimeout(
      'https://api.liveavatar.com/v1/sessions/token',
      {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey.trim(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mode: 'LITE',
          avatar_id: avatarId,
          is_sandbox: false,
          max_session_duration: 1200
        })
      }
    );

    const heygenFallbackRequest = () => fetchJsonWithTimeout(
      'https://api.heygen.com/v1/streaming.create_token',
      {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey.trim(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }
    );

    let primaryError = null;
    try {
      const { response, raw, json } = await liveavatarRequest();
      if (response.ok) {
        const token = extractTokenFromPayload(json);
        if (token) {
          return res.json({
            success: true,
            data: {
              token,
              sessionId: json?.data?.session_id || null,
              provider: 'liveavatar'
            }
          });
        }
      }
      primaryError = `LiveAvatar responded ${response.status}: ${raw?.slice(0, 300) || 'empty response'}`;
    } catch (err) {
      primaryError = err?.name === 'AbortError'
        ? `LiveAvatar request timed out after ${HEYGEN_REQUEST_TIMEOUT_MS}ms`
        : `LiveAvatar request failed: ${err?.message || 'unknown error'}`;
    }

    // Fallback for regions/accounts where liveavatar.com is unstable.
    const { response: fallbackResponse, raw: fallbackRaw, json: fallbackJson } = await heygenFallbackRequest();
    if (!fallbackResponse.ok) {
      const status = fallbackResponse.status >= 400 ? fallbackResponse.status : 502;
      return res.status(status).json({
        success: false,
        error: `Failed to create avatar token. ${primaryError}. HeyGen fallback responded ${fallbackResponse.status}: ${fallbackRaw?.slice(0, 300) || 'empty response'}`
      });
    }

    const fallbackToken = extractTokenFromPayload(fallbackJson);
    if (!fallbackToken) {
      return res.status(502).json({
        success: false,
        error: `HeyGen fallback returned invalid token payload. ${primaryError}`
      });
    }

    return res.json({
      success: true,
      data: {
        token: fallbackToken,
        sessionId: null,
        provider: 'heygen-fallback'
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

