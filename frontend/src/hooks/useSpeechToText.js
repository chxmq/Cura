import { useCallback, useRef, useState } from 'react';
import { getSpeechLang } from '../i18n/index.js';
import {
  isVoiceSupported,
  startSpeechRecognition,
  stopSpeechRecognition
} from '../services/voiceService.js';
import { transcribeAudioBlob } from '../services/speechService.js';

/**
 * Unified speech-to-text: browser Web Speech API first, Gemini cloud fallback.
 */
export const useSpeechToText = ({ locale = 'en', onTranscript, onError, onListeningChange } = {}) => {
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const lastTranscriptRef = useRef('');
  const [listening, setListening] = useState(false);
  const [usingCloud, setUsingCloud] = useState(false);

  const setListeningState = useCallback((value) => {
    setListening(value);
    onListeningChange?.(value);
  }, [onListeningChange]);

  const stopBrowserRecognition = useCallback(() => {
    stopSpeechRecognition(recognitionRef.current);
    recognitionRef.current = null;
  }, []);

  const startCloudRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone recording is not supported in this browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    chunksRef.current = [];
    mediaRecorderRef.current = recorder;
    setUsingCloud(true);

    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setListeningState(false);
      setUsingCloud(false);

      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      if (!blob.size) {
        onError?.({ message: 'No audio captured. Please try again.' });
        return;
      }

      try {
        const result = await transcribeAudioBlob({ blob, language: locale });
        const transcript = result?.transcript?.trim();
        if (transcript) onTranscript?.(transcript);
        else onError?.({ message: 'Could not transcribe audio. Please try again.' });
      } catch (err) {
        onError?.({
          message: err?.response?.data?.error || err?.message || 'Cloud speech-to-text failed.'
        });
      }
    };

    recorder.start();
    setListeningState(true);
  }, [locale, onError, onTranscript, setListeningState]);

  const stopCloudRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
  }, []);

  const startListening = useCallback(() => {
    if (listening) return;

    const speechLang = getSpeechLang(locale);

    if (isVoiceSupported()) {
      try {
        recognitionRef.current = startSpeechRecognition({
          lang: speechLang,
          continuous: false,
          interimResults: true,
          onStart: () => setListeningState(true),
          onResult: (transcript) => {
            lastTranscriptRef.current = transcript;
            onTranscript?.(transcript, { interim: true });
          },
          onError: async (err) => {
            stopBrowserRecognition();
            // Fall back to Gemini cloud STT for unsupported languages or browser failures.
            if (['language-not-supported', 'network', 'service-not-allowed', 'not-allowed'].includes(err.code)) {
              try {
                await startCloudRecording();
              } catch (cloudErr) {
                setListeningState(false);
                onError?.(err.code === 'not-allowed' ? err : { message: cloudErr.message });
              }
            } else {
              setListeningState(false);
              onError?.(err);
            }
          },
          onEnd: () => {
            const finalText = lastTranscriptRef.current?.trim();
            if (finalText) onTranscript?.(finalText, { interim: false });
            lastTranscriptRef.current = '';
            setListeningState(false);
            recognitionRef.current = null;
          }
        });
        return;
      } catch {
        // Fall through to cloud recording.
      }
    }

    startCloudRecording().catch((err) => {
      setListeningState(false);
      onError?.({ message: err.message });
    });
  }, [listening, locale, onError, onTranscript, setListeningState, startCloudRecording, stopBrowserRecognition]);

  const stopListening = useCallback(() => {
    if (usingCloud || mediaRecorderRef.current) {
      stopCloudRecording();
    } else {
      stopBrowserRecognition();
      setListeningState(false);
    }
  }, [setListeningState, stopBrowserRecognition, stopCloudRecording, usingCloud]);

  const toggleListening = useCallback(() => {
    if (listening) stopListening();
    else startListening();
  }, [listening, startListening, stopListening]);

  return {
    listening,
    usingCloud,
    isSupported: isVoiceSupported() || !!navigator.mediaDevices?.getUserMedia,
    startListening,
    stopListening,
    toggleListening
  };
};
