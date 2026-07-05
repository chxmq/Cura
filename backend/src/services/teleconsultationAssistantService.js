import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { processDataset } from '../utils/processDataset.js';

let retrievalIndexPromise = null;

const buildKnowledgeText = () => {
  const dataset = processDataset();
  const symptomMappings = dataset?.symptomMappings || {};
  const medicineDatabase = dataset?.medicineDatabase || {};

  const symptomChunks = Object.entries(symptomMappings)
    .slice(0, 250)
    .map(([symptom, medicines]) => {
      const medicineList = Array.isArray(medicines) ? medicines.join(', ') : '';
      return `Symptom: ${symptom}. Common medicines: ${medicineList}.`;
    });

  const medicineChunks = Object.values(medicineDatabase)
    .slice(0, 250)
    .map((medicine) => {
      const symptoms = Array.isArray(medicine.commonSymptoms) ? medicine.commonSymptoms.join(', ') : 'N/A';
      return `Medicine: ${medicine.name}. Commonly used for: ${symptoms}. Typical dosage: ${medicine.dosage}. Frequency: ${medicine.frequency}.`;
    });

  const safetyChunk = `Safety note: This assistant provides educational guidance only, not a diagnosis. 
If symptoms are severe (high fever, chest pain, breathing issues, bleeding, confusion, severe dehydration), seek emergency care immediately.`;

  return [safetyChunk, ...symptomChunks, ...medicineChunks].join('\n');
};

const tokenize = (text = '') => text
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter(Boolean);

const lexicalScore = (query, chunk) => {
  const queryTokens = tokenize(query);
  const chunkText = chunk.toLowerCase();
  if (!queryTokens.length || !chunkText) return 0;

  let score = 0;
  const seen = new Set();
  queryTokens.forEach((token) => {
    if (seen.has(token)) return;
    seen.add(token);
    if (chunkText.includes(token)) score += 1;
  });

  if (chunkText.includes(query.toLowerCase())) score += 2;
  return score;
};

const getRetrievalIndex = async () => {
  if (!retrievalIndexPromise) {
    retrievalIndexPromise = (async () => {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set. Add it to backend .env.');
      }

      const sourceText = buildKnowledgeText();
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 600,
        chunkOverlap: 80
      });

      const docs = await splitter.createDocuments([sourceText]);
      const chunks = docs.map((doc) => doc.pageContent);

      return {
        chunks
      };
    })();

    retrievalIndexPromise = retrievalIndexPromise.catch((error) => {
      retrievalIndexPromise = null;
      throw error;
    });
  }

  return retrievalIndexPromise;
};

const formatHistory = (history = []) => history
  .slice(-6)
  .map((entry) => `${entry.role === 'assistant' ? 'Assistant' : 'User'}: ${entry.content}`)
  .join('\n');

export const getHealthAssistantReply = async ({ query, history = [], language = 'en' }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Add it to backend .env.');
  }

  const languageInstructions = {
    en: 'Respond in clear, simple English.',
    hi: 'उत्तर स्पष्ट, सरल हिंदी में दें।',
    kn: 'ಉತ್ತರವನ್ನು ಸ್ಪಷ್ಟ, ಸರಳ ಕನ್ನಡದಲ್ಲಿ ನೀಡಿ.'
  };

  const retrievalIndex = await getRetrievalIndex();
  const ranked = retrievalIndex.chunks
    .map((chunk) => ({
      chunk,
      score: lexicalScore(query, chunk)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  const contextText = ranked.map((item) => item.chunk).join('\n');

  const model = new ChatGoogleGenerativeAI({
    apiKey,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    temperature: 0.3
  });

  const prompt = `You are a medical health assistant powered by a RAG pipeline.
Use the "Retrieved context" to answer factually. If context is insufficient, say so clearly and give safe next steps.
Never claim to be a licensed doctor. Keep responses concise and practical.
${languageInstructions[language] || languageInstructions.en}

Conversation history:
${formatHistory(history)}

Retrieved context:
${contextText || 'No context retrieved.'}

User question:
${query}
`;

  const response = await model.invoke(prompt);

  return {
    answer: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
    sources: ranked.slice(0, 3).map((item, index) => ({
      id: index + 1,
      excerpt: item.chunk.slice(0, 180)
    }))
  };
};

