import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Stethoscope,
  FileText,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Activity,
  Calendar,
  Pill,
  Clock,
  CheckCircle2,
  Heart,
  Brain,
  Zap,
  MessageSquareHeart,
  MapPin,
  Mic,
  Camera,
  TrendingUp,
  Lock
} from 'lucide-react';
import Button from '../components/ui/Button';
import HeroBackdrop from '../components/ui/HeroBackdrop';
import Spotlight from '../components/ui/Spotlight';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import ScrollReveal from '../components/ui/ScrollReveal';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/LanguageContext.jsx';

// ────────────────────────────────────────────────────────────────────
// Hero mockup cards — three layered floating panels
// ────────────────────────────────────────────────────────────────────
const SeverityResultCard = () => (
  <div className="bg-white border border-[#e6e2d6] rounded-3xl shadow-[0_4px_12px_rgba(15,31,46,0.04),0_24px_60px_rgba(15,31,46,0.10)] p-5 sm:p-6 space-y-4 w-full">
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[#dcfce7] text-[#166534]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse" />
        Mild — keep an eye on it
      </span>
      <span className="text-[10px] text-[#7b8593] font-medium font-mono">live</span>
    </div>

    <div>
      <p className="font-display text-lg font-semibold text-[#0f1f2e] leading-snug">
        Here's what we recommend
      </p>
      <p className="text-xs text-[#7b8593] mt-0.5">
        knn_7 · confidence 94.2%
      </p>
    </div>

    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0f766e] uppercase tracking-wide">
      <Sparkles size={12} /> AI-suggested combination
    </div>

    <div className="space-y-2">
      {[
        { name: 'Paracetamol', meta: '500mg · 3 days' },
        { name: 'Cetirizine', meta: '10mg · 5 days' }
      ].map((med) => (
        <div key={med.name} className="bg-[#f0eee6]/50 border border-[#e6e2d6] rounded-2xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#d6f1ec] text-[#0f766e] flex items-center justify-center shrink-0">
            <Pill size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-[#0f1f2e] truncate">{med.name}</p>
            <p className="text-[11px] text-[#7b8593]">{med.meta}</p>
          </div>
        </div>
      ))}
    </div>

    <div className="flex items-center justify-between pt-3 border-t border-[#e6e2d6]">
      <p className="flex items-center gap-1.5 text-xs text-[#3e4c5b]">
        <Calendar size={12} className="text-[#0f766e]" />
        Follow up <span className="font-semibold text-[#0f1f2e]">May 3</span>
      </p>
      <span className="text-xs font-semibold text-[#0f766e] flex items-center gap-1">
        <CheckCircle2 size={12} /> Saved
      </span>
    </div>
  </div>
);

const PrescriptionCard = () => (
  <div className="bg-white border border-[#e6e2d6] rounded-3xl shadow-[0_4px_12px_rgba(15,31,46,0.04),0_18px_40px_rgba(15,31,46,0.08)] p-5 w-full">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-[#fde8e1] text-[#c2410c] flex items-center justify-center">
        <FileText size={18} />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[#c2410c] font-semibold">Prescription</p>
        <p className="font-semibold text-sm text-[#0f1f2e]">Safety check</p>
      </div>
    </div>
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <CheckCircle2 size={13} className="text-[#16a34a]" />
        <span className="text-[#3e4c5b]">Dosage within limits</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <CheckCircle2 size={13} className="text-[#16a34a]" />
        <span className="text-[#3e4c5b]">No drug interactions</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <CheckCircle2 size={13} className="text-[#16a34a]" />
        <span className="text-[#3e4c5b]">Timing valid</span>
      </div>
    </div>
  </div>
);

const ChatCard = () => (
  <div className="bg-white border border-[#e6e2d6] rounded-3xl shadow-[0_4px_12px_rgba(15,31,46,0.04),0_18px_40px_rgba(15,31,46,0.08)] p-4 w-full space-y-2">
    <div className="flex items-center gap-2 mb-1">
      <div className="w-7 h-7 rounded-lg bg-[#e0f2fe] text-[#0369a1] flex items-center justify-center">
        <MessageSquareHeart size={14} />
      </div>
      <p className="text-[10px] uppercase tracking-wider text-[#0369a1] font-semibold">Doctor</p>
    </div>
    <p className="text-xs text-[#0f1f2e] leading-relaxed bg-[#f0eee6]/60 rounded-xl px-3 py-2">
      Based on what you're describing, hydration and rest are the priority.
    </p>
    <div className="flex items-center gap-1 text-[10px] text-[#7b8593]">
      <Sparkles size={10} className="text-[#0f766e]" />
      <span>Source 1: Common Cold protocol</span>
    </div>
  </div>
);

// ────────────────────────────────────────────────────────────────────
// Live "thinking" demo — auto-plays a tiny inference animation
// ────────────────────────────────────────────────────────────────────
const LiveDemo = () => {
  const [step, setStep] = useState(0);
  const steps = [
    { label: 'You', text: 'I have fever and cough.', color: 'teal' },
    { label: 'ML model', text: 'Predicted care path: consult_doctor (conf. 87%)', color: 'navy' },
    { label: 'Severity', text: 'Moderate — based on flowchart rules', color: 'amber' },
    { label: 'Gemini', text: 'Suggested: Paracetamol 500mg + warm fluids + rest. Watch for breathing changes.', color: 'teal' }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % (steps.length + 1));
    }, 2200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-white border border-[#e6e2d6] rounded-3xl p-6 sm:p-8 shadow-[0_2px_4px_rgba(15,31,46,0.05),0_24px_60px_rgba(15,31,46,0.08)]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
          <span className="text-xs font-semibold text-[#7b8593] uppercase tracking-wider">Live trace</span>
        </div>
        <span className="text-[10px] text-[#9aa3b1] font-mono">replays every ~9s</span>
      </div>

      <div className="space-y-3 min-h-[280px]">
        {steps.map((s, i) => {
          const visible = step > i;
          const colorMap = {
            teal: 'bg-[#d6f1ec] text-[#0f766e]',
            navy: 'bg-[#0f1f2e] text-white',
            amber: 'bg-[#fef3c7] text-[#854d0e]'
          };
          return (
            <div
              key={i}
              className="flex items-start gap-3 transition-all duration-500"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(8px)'
              }}
            >
              <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colorMap[s.color]}`}>
                {s.label}
              </span>
              <p className="text-sm text-[#0f1f2e] leading-relaxed pt-1">{s.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────
// Bento card primitive
// ────────────────────────────────────────────────────────────────────
const BentoCard = ({ icon: Icon, title, description, accent = 'teal', className = '', children }) => {
  const accentMap = {
    teal: { bg: 'bg-[#d6f1ec]', text: 'text-[#0f766e]', glow: 'rgba(15,118,110,0.18)' },
    coral: { bg: 'bg-[#fde8e1]', text: 'text-[#c2410c]', glow: 'rgba(231,111,81,0.18)' },
    sky: { bg: 'bg-[#e0f2fe]', text: 'text-[#0369a1]', glow: 'rgba(56,189,248,0.20)' },
    violet: { bg: 'bg-[#ede9fe]', text: 'text-[#6d28d9]', glow: 'rgba(124,58,237,0.18)' },
    amber: { bg: 'bg-[#fef3c7]', text: 'text-[#854d0e]', glow: 'rgba(217,119,6,0.18)' }
  };
  const c = accentMap[accent] || accentMap.teal;

  return (
    <Spotlight glowColor={c.glow.match(/\d+,\s*\d+,\s*\d+/)?.[0] || '15,118,110'} glowOpacity={0.25} className="h-full">
      <div className={`relative bg-white border border-[#e6e2d6] rounded-3xl p-7 h-full overflow-hidden hover:border-[#0f766e]/30 transition-colors ${className}`}>
        {Icon && (
          <div className={`w-12 h-12 rounded-2xl ${c.bg} ${c.text} flex items-center justify-center mb-5`}>
            <Icon size={22} strokeWidth={2} />
          </div>
        )}
        <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#0f1f2e] tracking-tight mb-2">
          {title}
        </h3>
        {description && (
          <p className="text-[#3e4c5b] leading-relaxed text-sm">{description}</p>
        )}
        {children}
      </div>
    </Spotlight>
  );
};

// ────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────
const Home = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="space-y-16 sm:space-y-24 pb-12">

      {/* ═════════════════════════════════════════════ HERO ═════════════════════════════════════════════ */}
      <section className="relative isolate pt-6 lg:pt-12 pb-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <HeroBackdrop />

        <Spotlight glowOpacity={0.12} glowSize={500} className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-12 items-center relative">
            {/* LEFT — headline + CTAs */}
            <div className="lg:col-span-7 space-y-7 text-center lg:text-left">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-[#e6e2d6] text-xs font-medium text-[#3e4c5b] shadow-[0_1px_2px_rgba(15,31,46,0.04)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0f766e] opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0f766e]" />
                </span>
                {t('home.badge')}
              </span>

              <h1 className="font-display font-semibold tracking-tight text-[#0f1f2e] leading-[1.0]">
                <span className="block text-5xl sm:text-6xl lg:text-7xl xl:text-[5.5rem]">
                  {t('home.tagline').split(',')[0]},
                </span>
                <span className="block text-5xl sm:text-6xl lg:text-7xl xl:text-[5.5rem]">
                  {t('home.tagline').includes('care') ? (
                    <>with <span className="text-gradient">care.</span></>
                  ) : (
                    <span className="text-gradient">{t('home.tagline').split(',').slice(1).join(',').trim()}</span>
                  )}
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-[#3e4c5b] max-w-xl mx-auto lg:mx-0 leading-relaxed">
                {t('home.subtitle')}
              </p>

              <div className="flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-3 pt-2">
                <Link to={user ? '/symptoms' : '/register'}>
                  <Button size="lg" className="min-w-[210px] group">
                    {user ? t('home.ctaSymptoms') : t('nav.getStarted')}
                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </Link>
                <Link to={user ? '/prescription' : '/register'}>
                  <Button size="lg" variant="secondary" className="min-w-[210px]">
                    {t('home.ctaPrescription')}
                  </Button>
                </Link>
              </div>

              <div className="flex flex-wrap items-center lg:justify-start justify-center gap-x-6 gap-y-2 pt-3 text-sm text-[#7b8593]">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-[#0f766e]" /> {t('home.trustNoAds')}
                </span>
                <span className="flex items-center gap-1.5">
                  <Activity size={14} className="text-[#0f766e]" /> {t('home.trustMl')}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-[#0f766e]" /> {t('home.trustFree')}
                </span>
              </div>
            </div>

            {/* RIGHT — stacked cards */}
            <div className="lg:col-span-5 flex flex-col gap-4 items-center lg:items-end">
              <ScrollReveal direction="left" delay={150} className="w-full max-w-[360px]">
                <div className="relative">
                  {/* Floating heart accent */}
                  <div className="absolute -top-3 -left-3 w-10 h-10 rounded-xl bg-[#fde8e1] flex items-center justify-center -rotate-6 shadow-[0_4px_12px_rgba(231,111,81,0.22)] z-10 animate-pulse">
                    <Heart size={16} className="text-[#e76f51]" />
                  </div>
                  <SeverityResultCard />
                </div>
              </ScrollReveal>
              <div className="flex gap-4 w-full max-w-[360px] hidden sm:flex">
                <ScrollReveal direction="up" delay={300} className="flex-1">
                  <PrescriptionCard />
                </ScrollReveal>
                <ScrollReveal direction="up" delay={450} className="flex-1">
                  <ChatCard />
                </ScrollReveal>
              </div>
            </div>
          </div>
        </Spotlight>
      </section>

      {/* ═════════════════════════════════════════════ STATS ═════════════════════════════════════════════ */}
      <ScrollReveal>
        <section>
          <Spotlight glowOpacity={0.08} className="rounded-3xl">
            <div className="bg-white border border-[#e6e2d6] rounded-3xl px-6 sm:px-12 py-10 sm:py-12">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12">
                {[
                  { value: 94.85, suffix: '%', decimals: 2, label: 'Accuracy', icon: Activity, hint: '94.85% on a 3-class test set' },
                  { value: 89.79, suffix: '%', decimals: 2, label: 'Macro F1', icon: TrendingUp, hint: 'Honest score on imbalanced data' },
                  { value: 3880, suffix: '', decimals: 0, label: 'Training samples', icon: Brain, hint: '80/20 train/test split' },
                  { value: 0.74, suffix: 'ms', decimals: 2, label: 'Avg. inference', icon: Zap, hint: 'KNN-7 lookup time' }
                ].map(({ value, suffix, decimals, label, icon: Icon, hint }) => (
                  <div key={label} className="text-center sm:text-left">
                    <div className="inline-flex items-center gap-2 text-[#0f766e] mb-2">
                      <Icon size={16} />
                    </div>
                    <p className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#0f1f2e] tracking-tight tabular-nums">
                      <AnimatedNumber value={value} suffix={suffix} decimals={decimals} />
                    </p>
                    <p className="text-sm text-[#7b8593] mt-1">{label}</p>
                    <p className="text-[10px] text-[#9aa3b1] mt-0.5 hidden sm:block">{hint}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[#9aa3b1] mt-8 text-center sm:text-left">
                Live numbers from the KNN-7 classifier. Full evaluation in{' '}
                <Link to="/analytics" className="text-[#0f766e] hover:text-[#115e59] font-medium underline-offset-4 hover:underline">
                  Analytics →
                </Link>
              </p>
            </div>
          </Spotlight>
        </section>
      </ScrollReveal>

      {/* ═════════════════════════════════════════════ LIVE DEMO ═════════════════════════════════════════════ */}
      <section className="space-y-10">
        <ScrollReveal>
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs font-semibold text-[#0f766e] uppercase tracking-wider">
              Behind the curtain
            </p>
            <h2 className="mt-2 font-display text-4xl sm:text-5xl font-semibold text-[#0f1f2e] tracking-tight">
              See Cura think.
            </h2>
            <p className="mt-4 text-lg text-[#3e4c5b]">
              Every symptom check runs through the same trace. Here it is, replaying live.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <div className="max-w-3xl mx-auto">
            <LiveDemo />
          </div>
        </ScrollReveal>
      </section>

      {/* ═════════════════════════════════════════════ BENTO FEATURES ═════════════════════════════════════════════ */}
      <section className="space-y-10">
        <ScrollReveal>
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs font-semibold text-[#0f766e] uppercase tracking-wider">
              What's in the box
            </p>
            <h2 className="mt-2 font-display text-4xl sm:text-5xl font-semibold text-[#0f1f2e] tracking-tight">
              Everything the diagram asks for.
            </h2>
            <p className="mt-4 text-lg text-[#3e4c5b]">
              Two flows, four AI surfaces, one calm interface.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {/* Big card - prescription */}
          <ScrollReveal delay={50} className="md:col-span-2">
            <BentoCard
              icon={Camera}
              title="Read any prescription"
              description="Snap a photo — Gemini Vision extracts every medicine, dose, and timing. Then we run a safety pass for dosage limits and drug interactions."
              accent="coral"
            >
              <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-medium">
                {['Paracetamol 500mg', 'Cetirizine 10mg', 'Pantoprazole 40mg'].map((p) => (
                  <span key={p} className="px-2.5 py-1 bg-[#fde8e1]/50 text-[#c2410c] rounded-full border border-[#fbcab2]/50">
                    {p}
                  </span>
                ))}
              </div>
            </BentoCard>
          </ScrollReveal>

          {/* Mid card - symptoms */}
          <ScrollReveal delay={120}>
            <BentoCard
              icon={Stethoscope}
              title="Decode symptoms"
              description="A trained ML classifier + Gemini drug suggestions, gated by deterministic safety rules."
              accent="teal"
            />
          </ScrollReveal>

          <ScrollReveal delay={190}>
            <BentoCard
              icon={MessageSquareHeart}
              title="Talk to an AI doctor"
              description="Live HeyGen avatar grounded in a medical RAG pipeline."
              accent="sky"
            />
          </ScrollReveal>

          <ScrollReveal delay={260}>
            <BentoCard
              icon={MapPin}
              title="Find care nearby"
              description="OpenStreetMap-powered locator for hospitals, clinics, and pharmacies."
              accent="violet"
            />
          </ScrollReveal>

          {/* Wide card - voice */}
          <ScrollReveal delay={330}>
            <BentoCard
              icon={Mic}
              title={t('home.featureMultilingual')}
              description={t('home.featureMultilingualDesc')}
              accent="amber"
            />
          </ScrollReveal>
        </div>
      </section>

      {/* ═════════════════════════════════════════════ HONESTY ═════════════════════════════════════════════ */}
      <ScrollReveal>
        <section className="bg-white border border-[#e6e2d6] rounded-3xl p-8 sm:p-14 relative overflow-hidden">
          <Spotlight glowOpacity={0.06} className="absolute inset-0" />
          <div className="relative">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <p className="text-xs font-semibold text-[#0f766e] uppercase tracking-wider">
                Honest by design
              </p>
              <h2 className="mt-2 font-display text-4xl sm:text-5xl font-semibold text-[#0f1f2e] tracking-tight">
                No magic. Just thoughtful product.
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
              {[
                {
                  icon: CheckCircle2,
                  title: 'What we do',
                  body: 'Classify severity from a real ML model. Suggest OTC combinations with Gemini. Flag clearly when you need a doctor.'
                },
                {
                  icon: Activity,
                  title: 'How we do it',
                  body: 'Naive Bayes, KNN, Decision Tree, Logistic Regression, and Random Forest trained on a 3,880-row labelled dataset. Gemini 2.5 Flash for vision, language, and cloud speech-to-text. LangChain RAG for the assistant.'
                },
                {
                  icon: Lock,
                  title: 'What we don\'t do',
                  body: 'Replace your doctor. We surface model confidence on every prediction so you can decide how much to trust each answer.'
                }
              ].map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <div className="w-12 h-12 rounded-2xl bg-[#d6f1ec] text-[#0f766e] flex items-center justify-center mb-5">
                    <Icon size={22} />
                  </div>
                  <h3 className="font-display text-2xl font-semibold text-[#0f1f2e] tracking-tight">{title}</h3>
                  <p className="mt-3 text-[#3e4c5b] leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ═════════════════════════════════════════════ CLOSING CTA ═════════════════════════════════════════════ */}
      <ScrollReveal>
        <section className="relative isolate overflow-hidden rounded-3xl bg-[#0f1f2e] text-white px-6 sm:px-12 py-16 sm:py-24">
          {/* Animated gradient blobs */}
          <div className="absolute inset-0 -z-10 opacity-70 pointer-events-none">
            <div
              className="absolute top-0 left-0 w-[480px] h-[480px] rounded-full"
              style={{
                filter: 'blur(80px)',
                background: 'radial-gradient(circle, rgba(15,118,110,0.7), transparent 70%)',
                animation: 'driftA 18s ease-in-out infinite alternate'
              }}
            />
            <div
              className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full"
              style={{
                filter: 'blur(80px)',
                background: 'radial-gradient(circle, rgba(231,111,81,0.55), transparent 70%)',
                animation: 'driftB 22s ease-in-out infinite alternate'
              }}
            />
            <style>{`
              @keyframes driftA { from { transform: translate(0,0) } to { transform: translate(80px, 60px) } }
              @keyframes driftB { from { transform: translate(0,0) } to { transform: translate(-60px, -40px) } }
            `}</style>
          </div>

          {/* Faint dot field */}
          <svg className="absolute inset-0 -z-10 w-full h-full opacity-[0.06] pointer-events-none">
            <defs>
              <pattern id="ctadots" width="22" height="22" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#ctadots)" />
          </svg>

          <div className="max-w-3xl mx-auto text-center space-y-8 relative">
            <p className="text-xs font-semibold text-[#5eead4] uppercase tracking-wider">
              Take it slow
            </p>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
              Your health, on{' '}
              <span className="text-[#5eead4]">your terms.</span>
            </h2>
            <p className="text-lg text-white/70 max-w-xl mx-auto leading-relaxed">
              No fear-mongering, no upsells, no data harvesting. Just the calmest way we know to help
              you make a small decision about your body.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link to={user ? '/symptoms' : '/register'}>
                <Button
                  size="lg"
                  style={{ backgroundColor: 'white', color: '#0f1f2e' }}
                  className="min-w-[210px] hover:opacity-90"
                >
                  {user ? 'Open Cura' : 'Get started — free'}
                  <ArrowRight size={16} />
                </Button>
              </Link>
              {!user && (
                <Link to="/login">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="text-white border-white/20 hover:bg-white/10 hover:text-white min-w-[210px]"
                  >
                    I have an account
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </section>
      </ScrollReveal>
    </div>
  );
};

export default Home;
