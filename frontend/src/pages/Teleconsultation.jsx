import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic,
  Video,
  Send,
  Loader2,
  Volume2,
  VolumeX,
  PhoneOff,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { getHealthAssistantReply, getHeygenAccessToken } from '../services/teleconsultationService.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useSpeechToText } from '../hooks/useSpeechToText.js';
import { getTtsLang } from '../i18n/index.js';

const Teleconsultation = () => {
  const { locale, t } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Avatar session state
  const [avatarError, setAvatarError] = useState('');
  const [avatarReady, setAvatarReady] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarAudioEnabled, setAvatarAudioEnabled] = useState(false);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);
  const [avatarAttempted, setAvatarAttempted] = useState(false);

  const avatarRef = useRef(null);
  const videoRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: t('assistant.greeting'),
      sources: []
    }]);
  }, [locale, t]);

  const chatHistoryForApi = useMemo(
    () => messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content })),
    [messages]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!voiceEnabled || !window.speechSynthesis) return undefined;
    return () => window.speechSynthesis.cancel();
  }, [voiceEnabled]);

  // -------- Avatar session lifecycle --------

  const startAvatarSession = async () => {
    if (avatarLoading || avatarReady) return;
    setAvatarError('');
    setAvatarLoading(true);
    setAvatarAttempted(true);
    try {
      const module = await import('@heygen/liveavatar-web-sdk');
      const { LiveAvatarSession, SessionEvent, AgentEventsEnum } = module;

      const configuredAvatarId = (import.meta.env.VITE_HEYGEN_AVATAR_ID || '').trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(configuredAvatarId);
      const token = await getHeygenAccessToken(isUuid ? configuredAvatarId : undefined);
      if (!token) throw new Error('Backend didn\'t return a HeyGen session token. Check LIVEAVATAR_API_KEY in your .env.');

      avatarRef.current = new LiveAvatarSession(token, { voiceChat: false });

      avatarRef.current.on(SessionEvent.SESSION_STREAM_READY, () => {
        if (videoRef.current && avatarRef.current) {
          avatarRef.current.attach(videoRef.current);
          videoRef.current.muted = false;
          videoRef.current.play().catch(() => {});
        }
        setAvatarAudioEnabled(false);
        setAvatarReady(true);
      });

      avatarRef.current.on(SessionEvent.SESSION_DISCONNECTED, () => {
        setAvatarReady(false);
        setAvatarSpeaking(false);
      });
      avatarRef.current.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => setAvatarSpeaking(true));
      avatarRef.current.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => setAvatarSpeaking(false));

      await avatarRef.current.start();
      await enableAvatarAudio();
    } catch (err) {
      const msg = err?.message || 'Couldn\'t start the doctor avatar.';
      setAvatarError(msg);
    } finally {
      setAvatarLoading(false);
    }
  };

  const stopAvatarSession = async () => {
    try {
      await avatarRef.current?.stop();
    } catch {
      // no-op
    } finally {
      avatarRef.current = null;
      setAvatarReady(false);
      setAvatarAudioEnabled(false);
      setAvatarSpeaking(false);
      if (videoRef.current) videoRef.current.srcObject = null;
    }
  };

  const enableAvatarAudio = async () => {
    if (!videoRef.current) return;
    try {
      videoRef.current.muted = false;
      videoRef.current.volume = 1;
      await videoRef.current.play();
      setAvatarAudioEnabled(true);
      setAvatarError('');
    } catch {
      setAvatarAudioEnabled(false);
      setAvatarError('Audio is blocked by your browser. Click "Enable audio" to allow it.');
    }
  };

  // Auto-start the avatar when the user lands on the page —
  // this makes it feel like a real video call instead of a chat-then-video flow.
  useEffect(() => {
    startAvatarSession();
    return () => {
      try {
        avatarRef.current?.stop();
      } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------- Chat & speech --------

  const speakText = (text) => {
    if (!voiceEnabled || !window.speechSynthesis || !text) return;
    // If the avatar is connected and speaking, don't double-up with browser TTS.
    if (avatarReady) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getTtsLang(locale);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const speakWithAvatar = async (text) => {
    if (!avatarRef.current || !avatarReady || !text) return;
    try {
      const room = avatarRef.current.room;
      const participant = room?.localParticipant;
      const isConnected = room?.state === 'connected';

      if (isConnected && participant) {
        const payload = {
          event_id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
          event_type: 'avatar.speak_text',
          text
        };
        const data = new TextEncoder().encode(JSON.stringify(payload));
        participant.publishData(data, { reliable: true, topic: 'agent-control' });
      } else {
        avatarRef.current.repeat(text);
      }
      setAvatarError('');
    } catch (firstError) {
      try {
        avatarRef.current.message(text);
        setAvatarError('');
      } catch (secondError) {
        const detail = secondError?.message || firstError?.message || 'Avatar speak failed.';
        setAvatarError(`Avatar audio failed: ${detail}`);
      }
    }
  };

  const sendPrompt = async (inputText) => {
    const trimmed = String(inputText || '').trim();
    if (!trimmed || loading) return;

    setError('');
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: trimmed, sources: [] }]);
    setQuery('');

    try {
      const response = await getHealthAssistantReply({
        query: trimmed,
        history: chatHistoryForApi,
        language: locale
      });
      const answer = response?.answer || t('assistant.error');
      const sources = response?.sources || [];
      setMessages((prev) => [...prev, { role: 'assistant', content: answer, sources }]);
      speakText(answer);
      await speakWithAvatar(answer);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || t('assistant.error'));
    } finally {
      setLoading(false);
    }
  };

  const submitQuery = () => sendPrompt(query);

  const { listening, toggleListening } = useSpeechToText({
    locale,
    onTranscript: (transcript, meta) => {
      setQuery(transcript);
      if (!meta?.interim) sendPrompt(transcript);
    },
    onError: (err) => setError(err?.message || t('assistant.error'))
  });

  // -------- Avatar status pill --------

  let statusLabel = 'Connecting…';
  let statusClass = 'bg-[#fef3c7] text-[#854d0e]';
  if (avatarReady && avatarSpeaking) {
    statusLabel = 'Doctor speaking';
    statusClass = 'bg-[#dbeafe] text-[#1e40af]';
  } else if (avatarReady) {
    statusLabel = 'Live';
    statusClass = 'bg-[#dcfce7] text-[#166534]';
  } else if (avatarError && avatarAttempted) {
    statusLabel = 'Disconnected';
    statusClass = 'bg-[#fee2e2] text-[#991b1b]';
  }

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <div className="text-center mb-8 space-y-3">
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[#0f1f2e] tracking-tight">
          {t('assistant.title')}
        </h1>
        <p className="text-[#3e4c5b] max-w-2xl mx-auto">
          A live video session with an AI doctor avatar. Speak naturally — the
          assistant is grounded in a medical knowledge base.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Video — primary focus */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-0 overflow-hidden">
            <div className="relative bg-[#0f1f2e] aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={!avatarAudioEnabled}
                className="w-full h-full object-cover"
              />

              {/* Pre-connect overlay */}
              {!avatarReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f1f2e]/95 text-white space-y-4 px-8 text-center">
                  {avatarLoading || (avatarAttempted && !avatarError) ? (
                    <>
                      <Loader2 size={36} className="animate-spin text-[#5eead4]" />
                      <p className="text-lg font-medium">Connecting to your AI doctor…</p>
                      <p className="text-sm text-white/60 max-w-sm">
                        Setting up the live video session. This usually takes 5–10 seconds.
                      </p>
                    </>
                  ) : avatarError ? (
                    <>
                      <AlertCircle size={36} className="text-[#fca5a5]" />
                      <p className="text-lg font-medium">Avatar couldn't start</p>
                      <p className="text-sm text-white/70 max-w-md leading-relaxed">{avatarError}</p>
                      <Button variant="primary" size="sm" onClick={startAvatarSession}>
                        Try again
                      </Button>
                      <p className="text-xs text-white/50 max-w-md mt-2">
                        You can still chat below — the AI assistant works without the avatar.
                      </p>
                    </>
                  ) : (
                    <>
                      <Video size={36} className="text-[#5eead4]" />
                      <p className="text-lg font-medium">Ready to start</p>
                      <Button variant="primary" size="sm" onClick={startAvatarSession}>
                        <Video size={14} /> Start session
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* In-call overlay (status pill, top-left) */}
              {avatarReady && (
                <div className="absolute top-4 left-4">
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${statusClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${avatarSpeaking ? 'bg-[#1e40af] animate-pulse' : 'bg-[#16a34a]'}`} />
                    {statusLabel}
                  </span>
                </div>
              )}

              {/* In-call controls (bottom strip) */}
              {avatarReady && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0f1f2e]/80 backdrop-blur-md px-3 py-2 rounded-full">
                  <button
                    onClick={enableAvatarAudio}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                    aria-label={avatarAudioEnabled ? 'Audio on' : 'Enable audio'}
                  >
                    {avatarAudioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  </button>
                  <button
                    onClick={stopAvatarSession}
                    className="w-10 h-10 rounded-full bg-[#dc2626] hover:bg-[#b91c1c] text-white flex items-center justify-center transition-colors"
                    aria-label="End session"
                  >
                    <PhoneOff size={16} />
                  </button>
                </div>
              )}
            </div>
          </Card>

          {/* Telemetry — small, under the video */}
          <Card className="bg-[#f0eee6]/40 py-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-semibold text-[#0f766e] uppercase tracking-wide">LLM</p>
                <p className="mt-0.5 text-sm text-[#0f1f2e] font-medium">Gemini 2.5 Flash</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[#0f766e] uppercase tracking-wide">RAG</p>
                <p className="mt-0.5 text-sm text-[#0f1f2e] font-medium">LangChain · Medical context</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[#0f766e] uppercase tracking-wide">Avatar</p>
                <p className="mt-0.5 text-sm text-[#0f1f2e] font-medium">HeyGen LiveAvatar</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Chat — secondary */}
        <div className="lg:col-span-2">
          <Card className="p-5 flex flex-col h-[640px]">
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={`${msg.role}-${index}`}
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      isUser
                        ? 'ml-auto bg-[#0f766e] text-white'
                        : 'bg-[#f0eee6] text-[#0f1f2e]'
                    }`}
                  >
                    <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${isUser ? 'text-white/70' : 'text-[#7b8593]'}`}>
                      {isUser ? 'You' : 'Doctor'}
                    </p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    {msg.sources?.length ? (
                      <div className="mt-2 pt-2 border-t border-current/10 space-y-1">
                        {msg.sources.map((source) => (
                          <p
                            key={source.id}
                            className={`text-[11px] ${isUser ? 'text-white/70' : 'text-[#7b8593]'} flex gap-1`}
                          >
                            <Sparkles size={10} className="mt-0.5 shrink-0" />
                            <span>Source {source.id}: {source.excerpt}</span>
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="mt-4 pt-4 border-t border-[#e6e2d6] space-y-3">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitQuery();
                  }
                }}
                placeholder={avatarReady ? 'Ask the doctor anything…' : 'Type your question…'}
                rows={2}
                className="w-full px-4 py-3 bg-[#f0eee6]/50 border border-[#d4cfbf] rounded-xl text-sm text-[#0f1f2e] placeholder:text-[#9aa3b1] focus:outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#0f766e]/10 resize-none"
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={submitQuery} disabled={loading} size="sm">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Send
                </Button>
                <Button variant="ghost" onClick={toggleListening} size="sm">
                  <Mic size={14} className={listening ? 'text-[#dc2626]' : ''} />
                  {listening ? t('assistant.listening') : t('assistant.voiceInput')}
                </Button>
                <Button variant="ghost" onClick={() => setVoiceEnabled((v) => !v)} size="sm">
                  <Volume2 size={14} /> {voiceEnabled ? 'Speak: on' : 'Speak: off'}
                </Button>
              </div>
              {error && <p className="text-xs text-[#dc2626]">{error}</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Teleconsultation;
