import api from './api.js';

export const transcribeAudioBlob = async ({ blob, language = 'en' }) => {
  const formData = new FormData();
  formData.append('audio', blob, 'recording.webm');
  formData.append('language', language);

  const response = await api.post('/speech/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

  return response.data?.data;
};
