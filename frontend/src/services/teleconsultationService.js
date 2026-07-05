import api from './api.js';

export const createTeleconsultationAppointment = async ({
  doctorName,
  doctorSpecialty,
  appointmentDate,
  appointmentTime
}) => {
  const response = await api.post('/teleconsultations/appointments', {
    doctorName,
    doctorSpecialty,
    appointmentDate,
    appointmentTime
  });
  return response.data;
};

export const getHealthAssistantReply = async ({ query, history = [], language = 'en' }) => {
  const response = await api.post('/teleconsultations/assistant/respond', {
    query,
    history,
    language
  });
  return response.data?.data;
};

export const getHeygenAccessToken = async (avatarId) => {
  try {
    const response = await api.post('/teleconsultations/assistant/heygen-token', {
      avatarId
    });
    return response.data?.data?.token;
  } catch (error) {
    const backendMessage = error?.response?.data?.error;
    if (backendMessage) {
      throw new Error(backendMessage);
    }
    throw error;
  }
};

