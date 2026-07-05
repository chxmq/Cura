import { GoogleGenerativeAI } from '@google/generative-ai';

const LANGUAGE_NAMES = {
  en: 'English',
  hi: 'Hindi',
  kn: 'Kannada'
};

export const transcribeAudio = async ({ audioBase64, mimeType = 'audio/webm', language = 'en' }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Add it to backend .env.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  });

  const langName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.en;

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: audioBase64
      }
    },
    {
      text: `Transcribe this audio accurately in ${langName}. Return only the transcribed text with no extra commentary or punctuation unless spoken.`
    }
  ]);

  const text = result?.response?.text?.()?.trim() || '';
  if (!text) {
    throw new Error('Could not transcribe audio. Please try again or type your message.');
  }

  return { transcript: text, language };
};
