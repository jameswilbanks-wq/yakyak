// Shared Supabase client + common helpers used on every page.
// Loaded after the supabase-js CDN script tag.

const SUPABASE_URL = "https://rmktbayxhplkuonifxfw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_vlVKSwHMKvqlqpWpswOHEw_aJDuTV-l";
const EDGE_FUNCTION_URL = SUPABASE_URL + "/functions/v1/generate-lesson";
const TRANSLATE_GENERATE_URL = SUPABASE_URL + "/functions/v1/generate-translation-set";
const TRANSLATE_GRADE_URL = SUPABASE_URL + "/functions/v1/grade-translation";
const ROLEPLAY_SCENARIOS_URL = SUPABASE_URL + "/functions/v1/generate-roleplay-scenarios";
const ROLEPLAY_REPLY_URL = SUPABASE_URL + "/functions/v1/roleplay-reply";
const INPUT_PASSAGE_URL = SUPABASE_URL + "/functions/v1/generate-input-passage";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const LEVELS = [
  { code: 'Pre-A1', label: 'Absolute beginner' },
  { code: 'A1', label: 'Beginner' },
  { code: 'A2', label: 'Elementary' },
  { code: 'B1', label: 'Intermediate' },
  { code: 'B2', label: 'Upper intermediate' },
  { code: 'C1', label: 'Advanced' },
  { code: 'C2', label: 'Mastery' },
];

const LEVEL_DESCRIPTIONS = {
  'Pre-A1': 'Just starting out — a few words here and there.',
  'A1': 'I can say hello and order a coffee.',
  'A2': 'I can get around a little and understand some things.',
  'B1': 'I can handle everyday conversations and travel.',
  'B2': 'I can talk about most topics pretty comfortably.',
  'C1': 'I can discuss complex ideas with real fluency.',
  'C2': 'I sound close to a native speaker.',
};

const LANGUAGES = [
  { code: 'es', name: 'Spanish', tts: 'es-ES', flag: 'ES' },
  { code: 'fr', name: 'French', tts: 'fr-FR', flag: 'FR' },
  { code: 'de', name: 'German', tts: 'de-DE', flag: 'DE' },
  { code: 'it', name: 'Italian', tts: 'it-IT', flag: 'IT' },
  { code: 'pt', name: 'Portuguese', tts: 'pt-PT', flag: 'PT' },
  { code: 'ja', name: 'Japanese', tts: 'ja-JP', flag: 'JA' },
];

function langByCode(code) {
  return LANGUAGES.find(l => l.code === code) || LANGUAGES[0];
}

// --- DEV MODE ---------------------------------------------------------
// Login is deferred until later in the build. Every page that would
// normally require a signed-in user instead gets this one fixed mock
// user, so profiles/lessons/completions all key off a stable id.
//
// To turn real auth back on later:
//   1. Set DEV_MODE = false below.
//   2. Confirm the DB trigger (or an upsert) creates a profiles row for
//      every new signed-up user — onboarding.html now upserts, so it
//      works either way.
//   3. Make sure RLS policies on profiles/lessons/lesson_completions are
//      scoped back to auth.uid() = id instead of allowing the mock id.
const DEV_MODE = true;
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_USER = { id: MOCK_USER_ID, email: 'dev@yakyak.local' };

function speak(text, lang) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang || 'en-US';
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// Redirect helper: every protected page calls this first.
// Returns the session's user, or redirects to login.html.
async function requireAuth() {
  if (DEV_MODE) return MOCK_USER;
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session.user;
}

// Bearer token for calling edge functions. With a real session, use its
// access token. In DEV_MODE there is no session, so fall back to the
// publishable key (the generate-lesson function's verify_jwt must be off,
// or this needs to be a JWT-shaped key, for that call to succeed).
async function getAuthToken() {
  const { data: { session } } = await db.auth.getSession();
  if (session) return session.access_token;
  return SUPABASE_PUBLISHABLE_KEY;
}

// Fetch (or lazily wait for) the current user's profile row.
// The DB trigger creates it automatically on signup, but there can be
// a brief race right after signup, so this retries a few times.
async function getProfile(userId) {
  for (let i = 0; i < 5; i++) {
    const { data, error } = await db.from('profiles').select('*').eq('id', userId).single();
    if (data) return data;
    await new Promise(r => setTimeout(r, 400));
  }
  return null;
}

// Records a right/wrong result against a user's mastery of one vocab or
// grammar item and reschedules its next review. Any module that produces a
// graded answer (translate, roleplay, drills) should call this — it's the
// shared signal that feeds the spaced-repetition queue (module 4).
async function recordSkillResult(userId, skillType, skillRefId, correct) {
  if (!skillRefId) return;
  const { data: existing } = await db.from('skill_mastery').select('*')
    .eq('user_id', userId).eq('skill_type', skillType).eq('skill_ref_id', skillRefId).maybeSingle();

  let strength = existing ? existing.strength : 0;
  let correctCount = existing ? existing.correct_count : 0;
  let incorrectCount = existing ? existing.incorrect_count : 0;

  if (correct) { correctCount++; strength = Math.min(5, strength + 1); }
  else { incorrectCount++; strength = Math.max(0, strength - 1); }

  // Simple SM-2-style interval ladder keyed off strength (0-5).
  const intervalDays = [0.5, 1, 2, 4, 7, 14][strength];
  const now = new Date();
  const nextReview = new Date(now.getTime() + intervalDays * 86400000);

  await db.from('skill_mastery').upsert({
    user_id: userId,
    skill_type: skillType,
    skill_ref_id: skillRefId,
    strength, correct_count: correctCount, incorrect_count: incorrectCount,
    last_seen_at: now.toISOString(),
    next_review_at: nextReview.toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: 'user_id,skill_type,skill_ref_id' });
}

function mascotHTML(size) {
  size = size || 40;
  return `<div class="mascot" style="width:${size}px;height:${size}px;">
    <div class="eyes" style="gap:${size * 0.18}px;">
      <div class="eye" style="width:${size * 0.1}px;height:${size * 0.1}px;"></div>
      <div class="eye" style="width:${size * 0.1}px;height:${size * 0.1}px;"></div>
    </div>
    <div class="smile" style="bottom:${size * 0.24}px;width:${size * 0.28}px;height:${size * 0.14}px;border-bottom-width:${Math.max(2, size * 0.045)}px;"></div>
  </div>`;
}

// Renders the CEFR ladder into a container element.
// opts: { current, target, mode: 'select'|'display', compact, onSelect }
function renderLadder(container, opts) {
  const currentIdx = opts.current ? LEVELS.findIndex(l => l.code === opts.current) : -1;
  const targetIdx = opts.target ? LEVELS.findIndex(l => l.code === opts.target) : -1;
  const selectable = opts.mode === 'select';
  const html = [];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    const lvl = LEVELS[i];
    const isCurrent = i === currentIdx;
    const isTarget = i === targetIdx;
    const isPast = currentIdx >= 0 && i < currentIdx;
    const nodeFilled = isPast || isCurrent;

    html.push(`<div>
      <button type="button" class="ladder-row${opts.compact ? ' compact' : ''}" data-code="${lvl.code}" ${selectable ? '' : 'disabled'}>
        <span class="ladder-dot${nodeFilled ? ' filled' : ''}${isTarget ? ' target' : ''}${isCurrent ? ' current' : ''}">
          ${isCurrent ? '<span class="pulse-dot"></span>' : ''}
        </span>
        <div style="display:flex;flex-direction:column;flex:1;min-width:0;">
          <div style="display:flex;align-items:baseline;gap:8px;">
            <span class="ladder-code${nodeFilled || isTarget ? ' active' : ''}">${lvl.code}</span>
            ${!opts.compact ? `<span class="ladder-label">${lvl.label}</span>` : ''}
            ${isCurrent ? '<span class="chip-mini" style="margin-left:auto;">you are here</span>' : ''}
            ${isTarget ? '<span style="margin-left:auto;color:var(--mint);font-weight:800;font-size:11px;">GOAL</span>' : ''}
          </div>
          ${!opts.compact ? `<span class="ladder-desc">${LEVEL_DESCRIPTIONS[lvl.code]}</span>` : ''}
        </div>
      </button>
      ${i > 0 ? `<div class="ladder-line"><div class="ladder-line-fill" style="height:${
        (currentIdx >= 0 && (i - 1) < currentIdx) ? '100%' : ((i - 1) === currentIdx - 1 ? (opts.progress || 0) + '%' : '0%')
      };"></div></div>` : ''}
    </div>`);
  }
  container.innerHTML = html.join('');
  if (selectable) {
    container.querySelectorAll('.ladder-row').forEach(btn => {
      btn.addEventListener('click', () => opts.onSelect(btn.dataset.code));
    });
  }
}
