'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen, Headphones, PenLine, MessageCircle, Sparkles, Flame, Trophy,
  ChevronRight, ChevronLeft, Check, X, RotateCcw, Home, BarChart3, User,
  ArrowRight, Plane, Briefcase, UtensilsCrossed, Dumbbell, Film, Music2,
  Users, PawPrint, Landmark, Cpu, Gamepad2, Heart, Building2, School,
  Flag, Volume2, Loader2, AlertTriangle
} from 'lucide-react';

/* ---------------------------------- data ---------------------------------- */

const LEVELS = [
  { code: 'Pre-A1', label: 'Absolute beginner' },
  { code: 'A1', label: 'Beginner' },
  { code: 'A2', label: 'Elementary' },
  { code: 'B1', label: 'Intermediate' },
  { code: 'B2', label: 'Upper intermediate' },
  { code: 'C1', label: 'Advanced' },
  { code: 'C2', label: 'Mastery' },
];

const NATIVE_LANGS = ['English', 'Portuguese', 'French', 'German', 'Mandarin', 'Other'];

const LANGUAGES = [
  { code: 'es', name: 'Spanish', tts: 'es-ES', flag: 'ES' },
  { code: 'fr', name: 'French', tts: 'fr-FR', flag: 'FR' },
  { code: 'de', name: 'German', tts: 'de-DE', flag: 'DE' },
  { code: 'it', name: 'Italian', tts: 'it-IT', flag: 'IT' },
  { code: 'pt', name: 'Portuguese', tts: 'pt-PT', flag: 'PT' },
  { code: 'ja', name: 'Japanese', tts: 'ja-JP', flag: 'JA' },
];

const MOTIVATIONS = [
  { id: 'travel', label: 'Travel', icon: Plane },
  { id: 'relationships', label: 'Relationships', icon: Heart },
  { id: 'business', label: 'Business', icon: Briefcase },
  { id: 'school', label: 'School', icon: School },
  { id: 'citizenship', label: 'Citizenship', icon: Landmark },
  { id: 'conversation', label: 'Conversation', icon: MessageCircle },
  { id: 'books', label: 'Reading books', icon: BookOpen },
  { id: 'work', label: 'Working abroad', icon: Building2 },
];

const TIME_OPTIONS = [
  { id: 5, label: '5 min', hint: 'A quick daily touch' },
  { id: 10, label: '10 min', hint: 'Light and steady' },
  { id: 20, label: '20 min', hint: 'Solid daily habit' },
  { id: 30, label: '30 min', hint: 'Real progress' },
  { id: 45, label: '45 min', hint: 'Focused study' },
  { id: 60, label: '60+ min', hint: 'Full immersion' },
];

const STYLES = [
  { id: 'visual', label: 'Visual', desc: 'Images, color, and pattern' },
  { id: 'reading', label: 'Reading', desc: 'Text, stories, and subtitles' },
  { id: 'speaking', label: 'Speaking', desc: 'Talking it out loud' },
  { id: 'listening', label: 'Listening', desc: 'Audio and dialogue' },
  { id: 'mixed', label: 'Mixed', desc: 'A bit of everything' },
];

const INTERESTS = [
  { id: 'sports', label: 'Sports', icon: Dumbbell },
  { id: 'travel', label: 'Travel', icon: Plane },
  { id: 'food', label: 'Food', icon: UtensilsCrossed },
  { id: 'history', label: 'History', icon: Landmark },
  { id: 'business', label: 'Business', icon: Briefcase },
  { id: 'tech', label: 'Technology', icon: Cpu },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
  { id: 'movies', label: 'Movies', icon: Film },
  { id: 'fitness', label: 'Fitness', icon: Dumbbell },
  { id: 'music', label: 'Music', icon: Music2 },
  { id: 'family', label: 'Family', icon: Users },
  { id: 'animals', label: 'Animals', icon: PawPrint },
];

const TODAY_ACTIVITIES = [
  { id: 'vocab', label: 'Vocabulary', icon: BookOpen, minutes: 4 },
  { id: 'listening', label: 'Listening', icon: Headphones, minutes: 4 },
  { id: 'conversation', label: 'Conversation', icon: MessageCircle, minutes: 5 },
  { id: 'writing', label: 'Writing', icon: PenLine, minutes: 3 },
];

const GENERATING_LINES = [
  'Reading your goals\u2026',
  'Placing you on the CEFR ladder\u2026',
  'Picking today\u2019s vocabulary\u2026',
  'Personalizing examples to your interests\u2026',
  'Building your first lesson\u2026',
];

function speak(text, lang) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang || 'en-US';
  u.rate = 0.95;
  const voices = window.speechSynthesis.getVoices();
  const match = voices.find(v => v.lang && v.lang.startsWith(lang.split('-')[0]));
  if (match) u.voice = match;
  window.speechSynthesis.speak(u);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos d\u00edas';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/* -------------------------------- mascot ---------------------------------- */

function Mascot({ size = 40, mood = 'happy' }) {
  return (
    <div
      style={{
        width: size, height: size, flexShrink: 0, position: 'relative',
        background: 'var(--accent)',
        borderRadius: '58% 42% 55% 45% / 55% 45% 58% 42%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{ display: 'flex', gap: size * 0.18, marginTop: -size * 0.05 }}>
        <div style={{ width: size * 0.1, height: size * 0.1, borderRadius: '50%', background: 'var(--accent-ink)' }} />
        <div style={{ width: size * 0.1, height: size * 0.1, borderRadius: '50%', background: 'var(--accent-ink)' }} />
      </div>
      <div
        style={{
          position: 'absolute', bottom: size * 0.24, width: size * 0.28, height: size * 0.14,
          borderBottom: `${Math.max(2, size * 0.045)}px solid var(--accent-ink)`,
          borderRadius: '0 0 50% 50%',
          opacity: mood === 'happy' ? 1 : 0.6,
        }}
      />
    </div>
  );
}

/* ------------------------------- CEFR ladder ------------------------------- */

const LEVEL_DESCRIPTIONS = {
  'Pre-A1': 'Just starting out \u2014 a few words here and there.',
  'A1': 'I can say hello and order a coffee.',
  'A2': 'I can get around a little and understand some things.',
  'B1': 'I can handle everyday conversations and travel.',
  'B2': 'I can talk about most topics pretty comfortably.',
  'C1': 'I can discuss complex ideas with real fluency.',
  'C2': 'I sound close to a native speaker.',
};

function CefrLadder({ mode, current, target, onSelect, progress = 0, compact = false }) {
  const currentIdx = current ? LEVELS.findIndex(l => l.code === current) : -1;
  const targetIdx = target ? LEVELS.findIndex(l => l.code === target) : -1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 0 }}>
      {LEVELS.map((lvl, i) => {
        const isCurrent = i === currentIdx;
        const isTarget = i === targetIdx;
        const isPast = currentIdx >= 0 && i < currentIdx;
        const nodeFilled = isPast || isCurrent;
        const selectable = mode === 'select';

        const segIdx = i - 1;
        const segBelowFilled = segIdx >= 0 && currentIdx >= 0 && segIdx < currentIdx;
        const segBelowPartial = segIdx >= 0 && segIdx === currentIdx - 1;

        return (
          <div key={lvl.code}>
            <button
              type="button"
              disabled={!selectable}
              onClick={() => selectable && onSelect(lvl.code)}
              style={{
                display: 'flex', alignItems: compact ? 'center' : 'flex-start', gap: 12, width: '100%',
                background: 'transparent', border: 'none', textAlign: 'left',
                cursor: selectable ? 'pointer' : 'default', padding: compact ? '7px 0' : '10px 0',
              }}
            >
              <span
                style={{
                  width: compact ? 14 : 18, height: compact ? 14 : 18, borderRadius: 999,
                  flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: compact ? 0 : 3,
                  background: nodeFilled ? 'var(--accent)' : 'var(--card-2)',
                  border: isTarget ? '2px dashed var(--mint)' : '2px solid ' + (nodeFilled ? 'var(--accent)' : 'var(--border)'),
                  boxShadow: isCurrent ? '0 0 0 5px var(--accent-soft)' : 'none',
                  transition: 'all .4s ease', position: 'relative',
                }}
              >
                {isCurrent && <span className="yy-pulse-dot" />}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: compact ? 13 : 15, fontWeight: 700,
                    color: nodeFilled || isTarget ? 'var(--text)' : 'var(--text-faint)',
                  }}>{lvl.code}</span>
                  {!compact && <span className="yy-text-dim" style={{ fontSize: 12.5, fontWeight: 700 }}>{lvl.label}</span>}
                  {isCurrent && <span className="yy-chip-mini" style={{ marginLeft: 'auto' }}>you are here</span>}
                  {isTarget && <Flag size={13} style={{ marginLeft: 'auto', color: 'var(--mint)', flexShrink: 0 }} strokeWidth={2.2} />}
                </div>
                {!compact && (
                  <span className="yy-text-faint" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.4 }}>
                    {LEVEL_DESCRIPTIONS[lvl.code]}
                  </span>
                )}
              </div>
            </button>
            {i > 0 && (
              <div style={{ marginLeft: compact ? 6 : 8, width: 2, height: compact ? 14 : 18, position: 'relative', background: 'var(--border)' }}>
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, width: '100%',
                  height: segBelowFilled ? '100%' : segBelowPartial ? `${progress}%` : '0%',
                  background: 'var(--accent)', transition: 'height 1s ease',
                }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ onboarding UI ------------------------------ */

function StepShell({ children, onBack, onNext, nextLabel = 'Continue', nextDisabled, showBack, stepIndex, totalSteps }) {
  return (
    <div className="yy-fade-slide" style={{ width: '100%', maxWidth: 480 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 36 }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} style={{ height: 4, flex: 1, borderRadius: 999, background: i <= stepIndex ? 'var(--accent)' : 'var(--border)', transition: 'background .5s ease' }} />
        ))}
      </div>
      {children}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 40 }}>
        {showBack ? (
          <button onClick={onBack} className="yy-btn-ghost"><ChevronLeft size={16} /> Back</button>
        ) : <span />}
        <button onClick={onNext} disabled={nextDisabled} className="yy-btn-primary">
          {nextLabel} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '', native: 'English', learning: null, current: null, target: null,
    motivations: [], time: null, style: null, interests: [],
  });

  const steps = ['name', 'level', 'motivation', 'time', 'style', 'interests', 'generating'];
  const totalVisible = 6;

  const toggle = (key, id, multi = true, max = null) => {
    setForm(f => {
      const list = f[key];
      if (!multi) return { ...f, [key]: id };
      const has = list.includes(id);
      if (has) return { ...f, [key]: list.filter(x => x !== id) };
      if (max && list.length >= max) return f;
      return { ...f, [key]: [...list, id] };
    });
  };

  const selectLevel = (code) => {
    setForm(f => {
      if (!f.current) return { ...f, current: code };
      if (!f.target) {
        const curIdx = LEVELS.findIndex(l => l.code === f.current);
        const codeIdx = LEVELS.findIndex(l => l.code === code);
        if (codeIdx <= curIdx) return { ...f, current: code, target: null };
        return { ...f, target: code };
      }
      return { ...f, current: code, target: null };
    });
  };

  const valid = useMemo(() => {
    switch (steps[step]) {
      case 'name': return form.name.trim().length > 0 && form.learning !== null;
      case 'level': return form.current && form.target;
      case 'motivation': return form.motivations.length > 0;
      case 'time': return form.time !== null;
      case 'style': return form.style !== null;
      case 'interests': return form.interests.length >= 3;
      default: return true;
    }
  }, [step, form]);

  const next = () => setStep(s => Math.min(s + 1, steps.length - 1));
  const back = () => setStep(s => Math.max(s - 1, 0));

  useEffect(() => {
    if (steps[step] === 'generating') {
      const t = setTimeout(() => onComplete(form), GENERATING_LINES.length * 700 + 400);
      return () => clearTimeout(t);
    }
  }, [step]); // eslint-disable-line

  const current = steps[step];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
      {current === 'name' && (
        <StepShell stepIndex={0} totalSteps={totalVisible} showBack={false} onNext={next} nextDisabled={!valid}>
          <Mascot size={52} />
          <h1 className="yy-display" style={{ fontSize: 30, margin: '16px 0 6px' }}>Hey! I'm Yak.</h1>
          <p className="yy-text-dim" style={{ marginBottom: 28, fontSize: 15 }}>Let's build your path together \u2014 what should I call you?</p>
          <label className="yy-label">Your name</label>
          <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Alex" className="yy-input" style={{ marginBottom: 24 }} />
          <label className="yy-label">Your native language</label>
          <div className="yy-chip-row">
            {NATIVE_LANGS.map(l => (
              <button key={l} className={'yy-chip' + (form.native === l ? ' yy-chip-active' : '')} onClick={() => setForm(f => ({ ...f, native: l }))}>{l}</button>
            ))}
          </div>
          <label className="yy-label" style={{ marginTop: 22 }}>Language you want to learn</label>
          <div className="yy-chip-row">
            {LANGUAGES.map(l => (
              <button key={l.code} className={'yy-chip' + (form.learning?.code === l.code ? ' yy-chip-active' : '')} onClick={() => setForm(f => ({ ...f, learning: l }))}>{l.name}</button>
            ))}
          </div>
          {form.learning && (
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="yy-badge-es">{form.learning.flag}</span>
              <span className="yy-text-dim" style={{ fontSize: 13.5 }}>You're learning <b className="yy-text">{form.learning.name}</b></span>
            </div>
          )}
        </StepShell>
      )}

      {current === 'level' && (
        <StepShell stepIndex={1} totalSteps={totalVisible} showBack onBack={back} onNext={next} nextDisabled={!valid}>
          <h1 className="yy-display" style={{ fontSize: 26, marginBottom: 8 }}>Where are you, and where are you headed?</h1>
          <p className="yy-text-dim" style={{ marginBottom: 4, fontSize: 14 }}>
            {!form.current ? 'Tap the level closest to where you are today.'
              : !form.target ? 'Now tap the level you\u2019re aiming for.'
              : <>Building a plan from <b className="yy-text">{form.current}</b> to <b className="yy-text">{form.target}</b>.{' '}
                  <button onClick={() => setForm(f => ({ ...f, current: null, target: null }))} className="yy-link">Start over</button>
                </>}
          </p>
          <div className="yy-card" style={{ padding: '18px 18px 6px', marginTop: 18 }}>
            <CefrLadder mode="select" current={form.current} target={form.target} onSelect={selectLevel} />
          </div>
          {form.current && !form.target && (
            <p className="yy-text-dim" style={{ marginTop: 14, fontSize: 13.5, textAlign: 'center' }}>
              <b className="yy-text">{form.current}</b> is set as your starting point \u2014 now tap a level above it for your goal.
            </p>
          )}
        </StepShell>
      )}

      {current === 'motivation' && (
        <StepShell stepIndex={2} totalSteps={totalVisible} showBack onBack={back} onNext={next} nextDisabled={!valid}>
          <h1 className="yy-display" style={{ fontSize: 26, marginBottom: 8 }}>Why {form.learning?.name || 'this language'}, why now?</h1>
          <p className="yy-text-dim" style={{ marginBottom: 20, fontSize: 14 }}>Choose as many as apply.</p>
          <div className="yy-grid-3">
            {MOTIVATIONS.map(m => {
              const Icon = m.icon;
              const active = form.motivations.includes(m.id);
              return (
                <button key={m.id} onClick={() => toggle('motivations', m.id)} className={'yy-tile' + (active ? ' yy-tile-active' : '')}>
                  <Icon size={19} strokeWidth={1.8} /><span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </StepShell>
      )}

      {current === 'time' && (
        <StepShell stepIndex={3} totalSteps={totalVisible} showBack onBack={back} onNext={next} nextDisabled={!valid}>
          <h1 className="yy-display" style={{ fontSize: 26, marginBottom: 8 }}>How much time can you give it daily?</h1>
          <p className="yy-text-dim" style={{ marginBottom: 20, fontSize: 14 }}>We'll size every lesson to fit.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {TIME_OPTIONS.map(t => (
              <button key={t.id} onClick={() => toggle('time', t.id, false)} className={'yy-row-option' + (form.time === t.id ? ' yy-row-option-active' : '')}>
                <span style={{ fontWeight: 700, fontSize: 15, fontFamily: 'var(--font-display)' }}>{t.label}</span>
                <span className="yy-text-faint" style={{ fontSize: 12.5 }}>{t.hint}</span>
              </button>
            ))}
          </div>
        </StepShell>
      )}

      {current === 'style' && (
        <StepShell stepIndex={4} totalSteps={totalVisible} showBack onBack={back} onNext={next} nextDisabled={!valid}>
          <h1 className="yy-display" style={{ fontSize: 26, marginBottom: 8 }}>How do you learn best?</h1>
          <p className="yy-text-dim" style={{ marginBottom: 20, fontSize: 14 }}>We'll lean into this, without ignoring the rest.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {STYLES.map(s => (
              <button key={s.id} onClick={() => toggle('style', s.id, false)} className={'yy-row-option' + (form.style === s.id ? ' yy-row-option-active' : '')}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{s.label}</span>
                <span className="yy-text-faint" style={{ fontSize: 12.5 }}>{s.desc}</span>
              </button>
            ))}
          </div>
        </StepShell>
      )}

      {current === 'interests' && (
        <StepShell stepIndex={5} totalSteps={totalVisible} showBack onBack={back} onNext={next} nextDisabled={!valid} nextLabel="Build my plan">
          <h1 className="yy-display" style={{ fontSize: 26, marginBottom: 8 }}>What do you actually like talking about?</h1>
          <p className="yy-text-dim" style={{ marginBottom: 20, fontSize: 14 }}>Pick 3\u20136 \u2014 every example will be built around these.</p>
          <div className="yy-grid-4">
            {INTERESTS.map(m => {
              const Icon = m.icon;
              const active = form.interests.includes(m.id);
              return (
                <button key={m.id} onClick={() => toggle('interests', m.id, true, 6)} className={'yy-tile' + (active ? ' yy-tile-active' : '')}>
                  <Icon size={18} strokeWidth={1.8} /><span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </StepShell>
      )}

      {current === 'generating' && <GeneratingScreen />}
    </div>
  );
}

function GeneratingScreen() {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setLine(l => Math.min(l + 1, GENERATING_LINES.length - 1)), 700);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="yy-fade-slide" style={{ textAlign: 'center', maxWidth: 380 }}>
      <Mascot size={56} />
      <p className="yy-text" style={{ marginTop: 22, fontSize: 15.5, minHeight: 24 }}>{GENERATING_LINES[line]}</p>
    </div>
  );
}

/* ---------------------------------- lesson ---------------------------------- */

async function callClaude(system, userContent, maxTokens = 1000) {
  let response;
  try {
    response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, system, messages: [{ role: 'user', content: userContent }] }),
    });
  } catch (e) {
    throw new Error('Network request failed: ' + (e?.message || e));
  }
  const rawText = await response.text();
  if (!rawText) throw new Error('Empty response body (HTTP ' + response.status + ')');
  let data;
  try { data = JSON.parse(rawText); } catch (e) { throw new Error('Bad response (HTTP ' + response.status + '): not valid JSON'); }
  if (!response.ok || data.error) throw new Error(data?.error?.message || `API error (HTTP ${response.status})`);
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  if (!text) throw new Error('Response had no text content');
  return text.trim();
}

function extractJSON(raw) {
  const clean = raw.replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in the response');
  return JSON.parse(clean.slice(start, end + 1));
}

async function generateLesson(profile) {
  const interest = profile.interests[0] || 'daily life';
  const targetLang = profile.learning?.name || 'Spanish';
  const nativeLang = profile.native || 'English';
  const system = `Generate one short ${targetLang} micro-lesson for a learner at CEFR level ${profile.current}\u2013${profile.target}, who is interested in ${interest}. The learner's native language is ${nativeLang}. Keep vocabulary and grammar appropriate for ${profile.current}.

Respond with STRICT JSON ONLY \u2014 your entire reply must be a single JSON object and nothing else, no preamble, no code fences. Exactly this shape:
{"title": "<short ${targetLang} lesson title>", "intro": "<one encouraging sentence in ${nativeLang} about what this lesson covers>", "vocab": [{"target": "<word in ${targetLang}>", "native": "<meaning in ${nativeLang}>"}, ...5 items], "dialogue": [{"speaker": "A"|"B", "target": "<line in ${targetLang}>", "native": "<translation in ${nativeLang}>"}, ...4 to 6 lines, a short natural exchange related to the theme], "quiz": [{"question": "<question in ${nativeLang} about the vocab or dialogue>", "options": ["<opt1>","<opt2>","<opt3>","<opt4>"], "answerIndex": <0-3>}, ...3 items]}`;
  const raw = await callClaude(system, 'Generate the lesson now.', 1200);
  return extractJSON(raw);
}

function LessonScreen({ profile, onFinish, onExit }) {
  const [status, setStatus] = useState('loading'); // loading | error | ready | quiz | done
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState(null);
  const [quizIndex, setQuizIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);

  const load = async () => {
    setStatus('loading'); setError(null);
    try {
      const data = await generateLesson(profile);
      setLesson(data);
      setStatus('ready');
    } catch (e) {
      setError(e?.message || 'Unknown error');
      setStatus('error');
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const startQuiz = () => { setStatus('quiz'); setQuizIndex(0); setPicked(null); setCorrectCount(0); };

  const choose = (idx) => {
    if (picked !== null) return;
    setPicked(idx);
    if (idx === lesson.quiz[quizIndex].answerIndex) setCorrectCount(c => c + 1);
  };

  const nextQuestion = () => {
    if (quizIndex + 1 < lesson.quiz.length) { setQuizIndex(i => i + 1); setPicked(null); }
    else setStatus('done');
  };

  return (
    <div className="yy-lesson-wrap">
      <div className="yy-lesson-top">
        <button className="yy-icon-btn" onClick={onExit}><X size={20} /></button>
        {lesson && <span className="yy-text-faint" style={{ fontSize: 12.5 }}>{lesson.title}</span>}
      </div>

      {status === 'loading' && (
        <div className="yy-lesson-center">
          <Mascot size={52} />
          <p className="yy-text-dim" style={{ marginTop: 16, fontSize: 14.5 }}>Yak is putting your lesson together\u2026</p>
        </div>
      )}

      {status === 'error' && (
        <div className="yy-lesson-center">
          <AlertTriangle size={30} style={{ color: 'var(--accent)' }} />
          <p className="yy-text" style={{ marginTop: 14, fontWeight: 700, textAlign: 'center' }}>Couldn't generate your lesson</p>
          <p className="yy-text-faint" style={{ fontSize: 12.5, textAlign: 'center', marginTop: 6, maxWidth: 320 }}>
            {error}
          </p>
          {error && error.toLowerCase().includes('anthropic_api_key') === false && error.toLowerCase().includes('api key') === false && (
            <p className="yy-text-faint" style={{ fontSize: 11, textAlign: 'center', marginTop: 4, maxWidth: 320 }}>
              If this keeps happening, the server may be missing its ANTHROPIC_API_KEY environment variable.
            </p>
          )}
          <button className="yy-btn-primary" style={{ marginTop: 18 }} onClick={load}><RotateCcw size={15} /> Try again</button>
        </div>
      )}

      {status === 'ready' && lesson && (
        <div className="yy-lesson-body">
          <p className="yy-text-dim" style={{ fontSize: 14.5, marginBottom: 20 }}>{lesson.intro}</p>

          <span className="yy-label">New vocabulary</span>
          <div className="yy-vocab-list">
            {lesson.vocab.map((v, i) => (
              <div key={i} className="yy-vocab-row">
                <button className="yy-icon-btn yy-icon-btn-sm" onClick={() => speak(v.target, profile.learning?.tts)}><Volume2 size={14} /></button>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-display)' }}>{v.target}</span>
                <span className="yy-text-faint">{v.native}</span>
              </div>
            ))}
          </div>

          <span className="yy-label" style={{ marginTop: 22, display: 'block' }}>Mini dialogue</span>
          <div className="yy-dialogue-box">
            {lesson.dialogue.map((l, i) => (
              <div key={i} className={'yy-dialogue-line' + (l.speaker === 'A' ? '' : ' yy-dialogue-line-b')}>
                <button className="yy-icon-btn yy-icon-btn-sm" onClick={() => speak(l.target, profile.learning?.tts)}><Volume2 size={12} /></button>
                <div>
                  <div style={{ fontWeight: 600 }}>{l.target}</div>
                  <div className="yy-text-faint" style={{ fontSize: 12 }}>{l.native}</div>
                </div>
              </div>
            ))}
          </div>

          <button className="yy-btn-primary" style={{ marginTop: 26, width: '100%', justifyContent: 'center' }} onClick={startQuiz}>
            Quick quiz <ArrowRight size={16} />
          </button>
        </div>
      )}

      {status === 'quiz' && lesson && (
        <div className="yy-lesson-body">
          <span className="yy-text-faint" style={{ fontSize: 12 }}>Question {quizIndex + 1} of {lesson.quiz.length}</span>
          <h2 className="yy-display" style={{ fontSize: 21, margin: '8px 0 18px' }}>{lesson.quiz[quizIndex].question}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lesson.quiz[quizIndex].options.map((opt, i) => {
              const isAnswer = i === lesson.quiz[quizIndex].answerIndex;
              const show = picked !== null && (isAnswer ? 'correct' : i === picked ? 'wrong' : null);
              return (
                <button key={i} onClick={() => choose(i)} disabled={picked !== null}
                  className={'yy-option' + (show === 'correct' ? ' yy-option-correct' : show === 'wrong' ? ' yy-option-wrong' : '')}>
                  {opt}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <button className="yy-btn-primary" style={{ marginTop: 20, width: '100%', justifyContent: 'center' }} onClick={nextQuestion}>
              {quizIndex + 1 < lesson.quiz.length ? 'Next question' : 'Finish lesson'} <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}

      {status === 'done' && lesson && (
        <div className="yy-lesson-center">
          <Trophy size={40} style={{ color: 'var(--accent)' }} />
          <h2 className="yy-display" style={{ fontSize: 24, margin: '14px 0 4px' }}>Lesson complete</h2>
          <p className="yy-text-dim" style={{ fontSize: 14.5, marginBottom: 20 }}>{correctCount} of {lesson.quiz.length} correct</p>
          <button className="yy-btn-primary" onClick={() => onFinish({ xp: 20 + correctCount * 10 })}>Back to home <ArrowRight size={16} /></button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- dashboard -------------------------------- */

function BottomNav({ active }) {
  const items = [
    { icon: Home, label: 'Home', key: 'home' },
    { icon: BarChart3, label: 'Progress', key: 'progress' },
    { icon: MessageCircle, label: 'Talk', key: 'talk' },
    { icon: User, label: 'Profile', key: 'profile' },
  ];
  return (
    <div className="yy-bottom-nav">
      {items.map(it => (
        <button key={it.key} className={'yy-nav-item' + (active === it.key ? ' yy-nav-item-active' : '')}>
          <it.icon size={20} strokeWidth={active === it.key ? 2.4 : 1.8} />
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

function Dashboard({ profile, xp, streak, done, onToggleDone, onStartLesson }) {
  const doneCount = Object.values(done).filter(Boolean).length;
  const weekData = [40, 70, 55, 90, 60, 100, 28];
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="yy-dash-wrap">
      <div className="yy-dash-content">
        <div className="yy-dash-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mascot size={38} />
            <div>
              <h1 className="yy-display" style={{ fontSize: 22 }}>{greeting()}, {profile.name || 'there'}.</h1>
              <p className="yy-text-faint" style={{ fontSize: 12.5 }}>{profile.current} \u2192 {profile.target} \u00b7 {profile.time} min/day</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="yy-stat-pill"><Flame size={14} style={{ color: 'var(--accent)' }} /><span>{streak}</span></div>
            <div className="yy-stat-pill"><Sparkles size={14} style={{ color: 'var(--mint)' }} /><span>{xp}</span></div>
          </div>
        </div>

        <div className="yy-card yy-hero">
          <span className="yy-chip-mini">Today's lesson \u00b7 {profile.time} min</span>
          <h2 className="yy-display" style={{ fontSize: 22, margin: '8px 0 4px' }}>Ready when you are</h2>
          <p className="yy-text-dim" style={{ fontSize: 13.5, marginBottom: 18 }}>A fresh lesson built around {profile.interests[0] || 'your interests'}.</p>
          <button className="yy-btn-primary" onClick={onStartLesson} style={{ width: 'fit-content' }}>
            Start lesson <ArrowRight size={16} />
          </button>

          <div className="yy-activity-grid">
            {TODAY_ACTIVITIES.map(a => {
              const Icon = a.icon;
              const isDone = !!done[a.id];
              return (
                <button key={a.id} onClick={() => onToggleDone(a.id)} className={'yy-activity' + (isDone ? ' yy-activity-done' : '')}>
                  <span className="yy-activity-icon">{isDone ? <Check size={14} strokeWidth={2.5} /> : <Icon size={14} strokeWidth={1.8} />}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a.label}</div>
                    <div className="yy-text-faint" style={{ fontSize: 10.5 }}>{a.minutes} min</div>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="yy-text-faint" style={{ fontSize: 11.5, marginTop: 12 }}>{doneCount} of {TODAY_ACTIVITIES.length} complete</div>
        </div>

        <div className="yy-card" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <span className="yy-label" style={{ marginBottom: 0 }}>Your path</span>
            <span className="yy-text-faint" style={{ fontSize: 11 }}>62% to {nextLevel(profile.current)}</span>
          </div>
          <CefrLadder mode="display" current={profile.current} target={profile.target} progress={62} compact />
        </div>

        <div className="yy-card" style={{ marginTop: 14 }}>
          <span className="yy-label" style={{ marginBottom: 12, display: 'block' }}>This week</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 52 }}>
            {weekData.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: '100%', borderRadius: 4, height: `${v * 0.4}px`, background: i === 5 ? 'var(--accent)' : 'var(--card-2)', transition: 'height .8s ease' }} />
                <span className="yy-text-faint" style={{ fontSize: 10 }}>{days[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav active="home" />
    </div>
  );
}

function nextLevel(code) {
  const i = LEVELS.findIndex(l => l.code === code);
  return LEVELS[Math.min(i + 1, LEVELS.length - 1)].code;
}

/* ---------------------------------- root ----------------------------------- */

export default function YakYak() {
  const [phase, setPhase] = useState('onboarding'); // onboarding | dashboard | lesson
  const [profile, setProfile] = useState(null);
  const [xp, setXp] = useState(1840);
  const [streak, setStreak] = useState(12);
  const [done, setDone] = useState({});

  const finishLesson = ({ xp: earned }) => {
    setXp(x => x + earned);
    setDone(d => ({ ...d, vocab: true, listening: true }));
    setPhase('dashboard');
  };

  return (
    <div className="yy-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;500;600;700;800&display=swap');

        .yy-root {
          --bg:#FBF2E4; --card:#FFFFFF; --card-2:#F6E9D3; --border:#EBDFC5;
          --text:#2B2016; --text-dim:#6B5A45; --text-faint:#A6906F;
          --accent:#EE7B3B; --accent-soft:rgba(238,123,59,.14); --accent-ink:#3A1F0E;
          --mint:#3FAE8A; --mint-soft:rgba(63,174,138,.14);
          --danger:#D9503A; --danger-soft:rgba(217,80,58,.12);
          --font-display:'Baloo 2',sans-serif;
          background: var(--bg); color: var(--text); min-height: 100vh;
          font-family:'Nunito',sans-serif;
        }
        .yy-display { font-family: var(--font-display); font-weight: 700; letter-spacing: -0.01em; line-height: 1.15; margin:0; }
        .yy-text { color: var(--text); }
        .yy-text-dim { color: var(--text-dim); }
        .yy-text-faint { color: var(--text-faint); }
        .yy-label { display:block; font-size:11.5px; text-transform:uppercase; letter-spacing:.07em; color:var(--text-faint); margin-bottom:10px; font-weight:800; }

        .yy-card { background: var(--card); border:1px solid var(--border); border-radius:22px; padding:20px; box-shadow: 0 2px 10px rgba(58,31,14,.04); }
        .yy-hero { display:flex; flex-direction:column; }

        .yy-input { width:100%; background:var(--card-2); border:1px solid var(--border); border-radius:14px; padding:13px 16px; font-size:15px; color:var(--text); font-family:inherit; outline:none; transition:border-color .2s ease; }
        .yy-input:focus { border-color: var(--accent); }

        .yy-chip-row { display:flex; flex-wrap:wrap; gap:8px; }
        .yy-chip { padding:9px 15px; border-radius:999px; border:1px solid var(--border); background:var(--card); color:var(--text-dim); font-size:13px; cursor:pointer; transition:all .18s ease; font-family:inherit; font-weight:600; }
        .yy-chip:hover { border-color: var(--accent); }
        .yy-chip-active { background: var(--accent-soft); border-color: var(--accent); color: var(--accent-ink); }

        .yy-chip-mini { display:inline-flex; align-items:center; padding:5px 12px; border-radius:999px; background: var(--accent-soft); color: var(--accent-ink); font-size:11px; font-weight:800; width:fit-content; }

        .yy-badge-es { width:28px; height:28px; border-radius:9px; background:var(--accent-soft); color:var(--accent-ink); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; }

        .yy-link { background:none; border:none; color:var(--mint); text-decoration:underline; cursor:pointer; font-size:inherit; padding:0; font-family:inherit; font-weight:700; }

        .yy-btn-primary { display:inline-flex; align-items:center; gap:8px; background:var(--accent); color:#FFF8EF; border:none; border-radius:999px; padding:14px 24px; font-size:15px; font-weight:800; cursor:pointer; transition:transform .15s ease, opacity .2s ease; font-family:var(--font-display); box-shadow: 0 4px 14px var(--accent-soft); }
        .yy-btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
        .yy-btn-primary:disabled { opacity:.35; cursor:not-allowed; box-shadow:none; }

        .yy-btn-ghost { display:inline-flex; align-items:center; gap:6px; background:none; border:none; color:var(--text-dim); font-size:14px; cursor:pointer; padding:8px 4px; font-family:inherit; font-weight:700; }
        .yy-btn-ghost:hover { color: var(--text); }

        .yy-grid-3 { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
        @media (min-width:420px){ .yy-grid-3 { grid-template-columns:repeat(3,1fr); } }
        .yy-grid-4 { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
        @media (min-width:420px){ .yy-grid-4 { grid-template-columns:repeat(3,1fr); } }

        .yy-tile { display:flex; flex-direction:column; align-items:flex-start; gap:10px; padding:15px 13px; border-radius:16px; border:1px solid var(--border); background:var(--card); color:var(--text-dim); cursor:pointer; transition:all .18s ease; font-size:13px; font-family:inherit; font-weight:700; text-align:left; }
        .yy-tile:hover { border-color:var(--accent); }
        .yy-tile-active { background:var(--accent-soft); border-color:var(--accent); color:var(--accent-ink); }

        .yy-row-option { display:flex; justify-content:space-between; align-items:center; padding:15px 18px; border-radius:16px; border:1px solid var(--border); background:var(--card); color:var(--text); cursor:pointer; transition:all .18s ease; font-family:inherit; width:100%; }
        .yy-row-option:hover { border-color:var(--accent); }
        .yy-row-option-active { background:var(--accent-soft); border-color:var(--accent); }

        .yy-pulse-dot { position:absolute; inset:0; border-radius:999px; animation: yy-pulse 1.8s ease-out infinite; }
        @keyframes yy-pulse { 0%{ box-shadow:0 0 0 0 var(--accent-soft);} 100%{ box-shadow:0 0 0 10px rgba(0,0,0,0);} }

        .yy-fade-slide { animation: yy-fadeslide .45s cubic-bezier(.16,1,.3,1); text-align:center; }
        @keyframes yy-fadeslide { from { opacity:0; transform:translateY(10px);} to { opacity:1; transform:translateY(0);} }

        .yy-dash-wrap { display:flex; flex-direction:column; min-height:100vh; }
        .yy-dash-content { flex:1; padding:20px 16px 100px; max-width:640px; margin:0 auto; width:100%; box-sizing:border-box; }
        .yy-dash-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px; gap:10px; flex-wrap:wrap; }

        .yy-stat-pill { display:flex; align-items:center; gap:6px; background:var(--card); border:1px solid var(--border); border-radius:999px; padding:7px 12px; font-size:12.5px; font-weight:800; }

        .yy-activity-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin-top:18px; }
        .yy-activity { display:flex; align-items:center; gap:9px; padding:10px 11px; border-radius:13px; border:1px solid var(--border); background:var(--card-2); cursor:pointer; color:var(--text); transition:all .18s ease; font-family:inherit; }
        .yy-activity:hover { border-color:var(--accent); }
        .yy-activity-done { background:var(--accent-soft); border-color:var(--accent); }
        .yy-activity-icon { width:24px; height:24px; border-radius:8px; background:var(--card); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--text-dim); }
        .yy-activity-done .yy-activity-icon { background:var(--accent); color:#fff; }

        .yy-bottom-nav { position:sticky; bottom:0; display:flex; background:var(--card); border-top:1px solid var(--border); padding:8px 6px calc(8px + env(safe-area-inset-bottom)); }
        .yy-nav-item { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; background:none; border:none; color:var(--text-faint); font-size:10.5px; font-weight:700; padding:6px 2px; cursor:pointer; font-family:inherit; }
        .yy-nav-item-active { color: var(--accent); }

        .yy-icon-btn { background:var(--card-2); border:none; border-radius:999px; width:38px; height:38px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text-dim); }
        .yy-icon-btn-sm { width:26px; height:26px; flex-shrink:0; }

        .yy-lesson-wrap { min-height:100vh; display:flex; flex-direction:column; max-width:640px; margin:0 auto; }
        .yy-lesson-top { display:flex; align-items:center; justify-content:space-between; padding:16px; }
        .yy-lesson-center { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; text-align:center; }
        .yy-lesson-body { padding:0 20px 40px; }

        .yy-vocab-list { display:flex; flex-direction:column; gap:8px; }
        .yy-vocab-row { display:flex; align-items:center; gap:10px; background:var(--card); border:1px solid var(--border); border-radius:14px; padding:10px 12px; font-size:14px; }

        .yy-dialogue-box { display:flex; flex-direction:column; gap:10px; }
        .yy-dialogue-line { display:flex; gap:10px; align-items:flex-start; background:var(--card); border:1px solid var(--border); border-radius:14px; padding:10px 12px; font-size:13.5px; }
        .yy-dialogue-line-b { background: var(--card-2); }

        .yy-option { padding:14px 16px; border-radius:14px; border:1px solid var(--border); background:var(--card); color:var(--text); font-size:14.5px; cursor:pointer; text-align:left; font-family:inherit; transition:all .15s ease; }
        .yy-option:hover:not(:disabled) { border-color:var(--accent); }
        .yy-option-correct { background:var(--mint-soft); border-color:var(--mint); }
        .yy-option-wrong { background:var(--danger-soft); border-color:var(--danger); }
      `}</style>

      {phase === 'onboarding' && (
        <Onboarding onComplete={(f) => { setProfile(f); setPhase('dashboard'); }} />
      )}
      {phase === 'dashboard' && profile && (
        <Dashboard
          profile={profile} xp={xp} streak={streak} done={done}
          onToggleDone={(id) => setDone(d => ({ ...d, [id]: !d[id] }))}
          onStartLesson={() => setPhase('lesson')}
        />
      )}
      {phase === 'lesson' && profile && (
        <LessonScreen profile={profile} onFinish={finishLesson} onExit={() => setPhase('dashboard')} />
      )}
    </div>
  );
}
