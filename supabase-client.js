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
const GRADE_PRONUNCIATION_URL = SUPABASE_URL + "/functions/v1/grade-pronunciation";
const EVALUATE_PROGRESS_URL = SUPABASE_URL + "/functions/v1/evaluate-progress";
const GENERATE_VOCAB_URL = SUPABASE_URL + "/functions/v1/generate-vocab-batch";
const GENERATE_PLAN_URL = SUPABASE_URL + "/functions/v1/generate-lesson-plan";
const GENERATE_EXTENSIVE_PASSAGE_URL = SUPABASE_URL + "/functions/v1/generate-extensive-passage";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Same choices used by onboarding's (now-removed) daily-time step and the
// lesson-plan time picker — kept in one place so both stay consistent.
const TIME_OPTIONS = [
  { id: 5, key: 'time.5' },
  { id: 15, key: 'time.15' },
  { id: 30, key: 'time.30' },
  { id: 60, key: 'time.60' },
];

const LEVELS = [
  { code: 'Pre-A1', label: 'Absolute beginner' },
  { code: 'A1', label: 'Beginner' },
  { code: 'A2', label: 'Elementary' },
  { code: 'B1', label: 'Intermediate' },
  { code: 'B2', label: 'Upper intermediate' },
  { code: 'C1', label: 'Advanced' },
  { code: 'C2', label: 'Mastery' },
];

// Rough word-family targets per CEFR level (based on published vocabulary-
// size research — figures vary by source, these are reasonable midpoints).
// Used only for a friendly progress readout, not a hard requirement.
const VOCAB_LEVEL_TARGETS = {
  'Pre-A1': 300, 'A1': 800, 'A2': 1500, 'B1': 2500, 'B2': 4000, 'C1': 6000, 'C2': 9000,
};

// Counts how many vocab words at this level the learner has actually
// started tracking (i.e. has a skill_mastery row for) — a simple, honest
// "words learned so far" figure rather than anything stricter. skill_ref_id
// is a polymorphic pointer (grammar_points or vocab_items depending on
// skill_type), so there's no FK for PostgREST to embed through — this does
// the join as two plain queries instead.
async function getVocabProgress(userId, targetLanguage, level) {
  const target = VOCAB_LEVEL_TARGETS[level] || 1000;
  const { data: mastery } = await db.from('skill_mastery')
    .select('skill_ref_id').eq('user_id', userId).eq('skill_type', 'vocab');
  const ids = (mastery || []).map(m => m.skill_ref_id).filter(Boolean);
  if (!ids.length) return { learned: 0, target };
  const { count } = await db.from('vocab_items')
    .select('id', { count: 'exact', head: true })
    .eq('target_language', targetLanguage).eq('level', level).in('id', ids);
  return { learned: count || 0, target };
}

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

// --- Topics ------------------------------------------------------------
// Shared by the per-session topic picker on lesson.html, translate.html,
// input.html, and roleplay.html (formerly a one-time onboarding question).
const INTERESTS = [
  { id: 'Sports', key: 'int.sports' }, { id: 'Travel', key: 'int.travel' }, { id: 'Food', key: 'int.food' },
  { id: 'History', key: 'int.history' }, { id: 'Business', key: 'int.business' }, { id: 'Technology', key: 'int.technology' },
  { id: 'Gaming', key: 'int.gaming' }, { id: 'Movies', key: 'int.movies' }, { id: 'Fitness', key: 'int.fitness' },
  { id: 'Music', key: 'int.music' }, { id: 'Family', key: 'int.family' }, { id: 'Animals', key: 'int.animals' },
];

// A sentinel stored in profiles.interests (repurposed — no schema change)
// to mean "last time, they picked Surprise Me" rather than specific topics.
const SURPRISE_SENTINEL = '__surprise__';

// Random settings/angles injected into every generation call so the same
// topic doesn't produce the same scenario every time (e.g. "Food" at a
// bus stop reads very differently from "Food" at a birthday party).
const SCENARIO_ANGLES = [
  'at a bus stop', 'during a rainstorm', 'at a birthday party', 'in a kitchen', 'on a phone call',
  'at a job interview', 'while waiting in line', 'at a family dinner', 'on a train', 'at a market stall',
  'during a power outage', 'at a neighbor\'s door', 'in a waiting room', 'on a morning walk',
  'at a school reunion', 'while packing for a trip',
];
function randomAngle() { return SCENARIO_ANGLES[Math.floor(Math.random() * SCENARIO_ANGLES.length)]; }

// Reads the learner's last topic picks out of profiles.interests. Returns
// { topics: string[], surprise: boolean } — surprise true means the array
// held only the sentinel (or was empty and there's nothing to prefill).
function getLastTopics(profile) {
  const raw = (profile && profile.interests) || [];
  if (raw.length === 1 && raw[0] === SURPRISE_SENTINEL) return { topics: [], surprise: true };
  return { topics: raw.filter(id => id !== SURPRISE_SENTINEL), surprise: false };
}

// Persists this session's picks so the picker opens pre-checked next time.
async function saveLastTopics(userId, selection) {
  const value = selection.surprise ? [SURPRISE_SENTINEL] : selection.topics;
  await db.from('profiles').update({ interests: value }).eq('id', userId);
}

// Picks ONE topic to actually use for a single generation call. Surprise
// Me draws from the full catalog; a multi-topic pick draws one at random
// each time, so revisiting the same picks still varies lesson to lesson.
function pickTopicForSession(selection) {
  const pool = selection.surprise ? INTERESTS.map(i => i.id) : selection.topics;
  if (!pool.length) return 'daily life';
  return pool[Math.floor(Math.random() * pool.length)];
}

// Renders the "what would you like to study today?" picker into a
// container. opts: { initial: {topics, surprise}, onStart(selection) }.
function renderTopicPicker(container, opts) {
  const state = { topics: [...opts.initial.topics], surprise: opts.initial.surprise };
  function draw() {
    container.innerHTML = `
      <div class="lesson-body">
        <h1 style="font-size:24px;margin-bottom:6px;">${t('tp.title')}</h1>
        <p class="text-dim" style="font-size:14px;margin-bottom:20px;">${t('tp.subtitle')}</p>
        <div class="grid-4" id="tpGrid"></div>
        <button class="row-option${state.surprise ? ' active' : ''}" id="tpSurprise" style="margin-top:12px;justify-content:center;">
          <span style="font-weight:700;">${t('tp.surpriseMe')}</span>
        </button>
        <button class="btn-primary" id="tpStartBtn" style="margin-top:22px;width:100%;justify-content:center;" ${(state.topics.length || state.surprise) ? '' : 'disabled'}>${t('tp.start')}</button>
      </div>`;
    const grid = document.getElementById('tpGrid');
    grid.innerHTML = INTERESTS.map(i => `<button class="tile${state.topics.includes(i.id) ? ' active' : ''}" data-i="${i.id}"><span>${t(i.key)}</span></button>`).join('');
    grid.querySelectorAll('.tile').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.i;
      const idx = state.topics.indexOf(id);
      if (idx >= 0) state.topics.splice(idx, 1); else state.topics.push(id);
      state.surprise = false;
      draw();
    }));
    document.getElementById('tpSurprise').addEventListener('click', () => {
      state.surprise = !state.surprise;
      if (state.surprise) state.topics = [];
      draw();
    });
    document.getElementById('tpStartBtn').addEventListener('click', () => opts.onStart(state));
  }
  draw();
}

// Fetches the most recent `limit` values of `column` from `table` for this
// target language + level, used to tell the AI generator what NOT to
// repeat. Best-effort — returns [] on any failure rather than blocking
// generation.
async function fetchRecentValues(table, column, targetLanguage, level, limit) {
  try {
    const { data } = await db.from(table).select(column)
      .eq('target_language', targetLanguage).eq('level', level)
      .order('created_at', { ascending: false }).limit(limit || 5);
    return (data || []).map(row => row[column]).filter(Boolean);
  } catch (e) {
    return [];
  }
}

// --- Lesson Plan (build-my-plan) ------------------------------------------
// A generated plan (ordered module steps sized to a time budget) lives only
// in sessionStorage — intentionally NOT persisted to the DB, so it quietly
// resets whenever the tab/session ends (the plan preview screen tells the
// learner this up front). Each module page checks isPlanStepActive() on
// load to know whether it's running as a step of an in-progress plan
// (should size itself to the step's minutes + skip its own topic picker)
// versus a normal standalone session.
const PLAN_KEY = 'yakyak_active_plan';

function getActivePlan() {
  try {
    const raw = sessionStorage.getItem(PLAN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function saveActivePlan(plan) {
  try { sessionStorage.setItem(PLAN_KEY, JSON.stringify(plan)); } catch (e) {}
}
function clearActivePlan() {
  try { sessionStorage.removeItem(PLAN_KEY); } catch (e) {}
}

// Returns { plan, step } if THIS page is the current step of an
// in-progress plan — gated on both the '?plan=1' URL flag and matching
// sessionStorage, so a stale leftover plan can never silently hijack a
// normal direct visit to a module page. Returns null otherwise.
function isPlanStepActive(moduleName) {
  if (!/[?&]plan=1(&|$)/.test(window.location.search)) return null;
  const plan = getActivePlan();
  if (!plan || !plan.steps || !plan.steps.length) return null;
  const step = plan.steps[plan.currentIndex];
  if (!step || step.module !== moduleName) return null;
  return { plan, step };
}

// Call when a plan-mode module finishes: folds its XP into the plan's
// running total, advances to the next step, and returns the URL to send
// the learner to next — the next module, or the wrap-up summary if that
// was the last step.
function advancePlanAndGetNextUrl(plan, xpEarned) {
  plan.totalXp = (plan.totalXp || 0) + (xpEarned || 0);
  plan.currentIndex = (plan.currentIndex || 0) + 1;
  saveActivePlan(plan);
  return plan.currentIndex < plan.steps.length
    ? plan.steps[plan.currentIndex].module + '.html?plan=1'
    : 'plan-summary.html';
}

// --- Progress evaluation -------------------------------------------------
// A 21-tier proficiency scale (Beginner/Intermediate/Advanced within each
// of the 7 CEFR levels), assessed by AI from actual performance data rather
// than self-reported at onboarding. Once assessed, it becomes authoritative:
// profiles.current_level is kept in sync with the tier's base CEFR code, so
// every generation edge function (which only knows about the 7 base codes)
// keeps working unchanged.
const TIER_SUB_KEYS = ['tier.beginner', 'tier.intermediate', 'tier.advanced'];
const TIERS = LEVELS.flatMap((l, li) => TIER_SUB_KEYS.map((subKey, si) => ({
  code: `${l.code}.${si + 1}`,
  baseLevel: l.code,
  subKey,
  ordinal: li * 3 + si,
})));

function tierIndex(code) {
  const tier = TIERS.find(x => x.code === code);
  return tier ? tier.ordinal : -1;
}
function tierBaseLevel(code) {
  const tier = TIERS.find(x => x.code === code);
  return tier ? tier.baseLevel : null;
}
function tierLabel(code) {
  const tier = TIERS.find(x => x.code === code);
  if (!tier) return code;
  return `${t(tier.subKey)} ${tier.baseLevel}`;
}

// Pulls a recent-activity sample (per module, capped and language-scoped)
// and reduces it to compact stats — counts, accuracy/scores, and which
// CEFR levels the content itself was generated at — for the AI to reason
// over. Deliberately approximate (e.g. lesson quizzes are ~3 questions,
// reading comprehension is 4-7); this feeds a holistic judgment call, not
// an exact formula.
async function gatherProgressStats(userId, targetLanguage) {
  const [lessonsRes, transRes, inputRes, rpRes] = await Promise.all([
    db.from('lesson_completions').select('score, completed_at, lessons(level, target_language)')
      .eq('user_id', userId).order('completed_at', { ascending: false }).limit(8),
    db.from('translation_attempts').select('is_correct, attempted_at, translation_exercises(level, target_language)')
      .eq('user_id', userId).order('attempted_at', { ascending: false }).limit(10),
    db.from('input_completions').select('score, pronunciation_avg, completed_at, input_passages(level, target_language)')
      .eq('user_id', userId).order('completed_at', { ascending: false }).limit(8),
    db.from('roleplay_sessions').select('goal_completed, grammar_flagged, completed_at, roleplay_scenarios(level, target_language)')
      .eq('user_id', userId).eq('status', 'completed').order('completed_at', { ascending: false }).limit(8),
  ]);

  const byLang = (rows, rel) => (rows || []).filter(r => r[rel] && r[rel].target_language === targetLanguage);
  const levelCounts = (rows, rel) => rows.reduce((acc, r) => {
    const lvl = r[rel] && r[rel].level;
    if (lvl) acc[lvl] = (acc[lvl] || 0) + 1;
    return acc;
  }, {});

  const lessons = byLang(lessonsRes.data, 'lessons');
  const translations = byLang(transRes.data, 'translation_exercises');
  const reading = byLang(inputRes.data, 'input_passages');
  const roleplay = byLang(rpRes.data, 'roleplay_scenarios');

  return {
    lessons: {
      count: lessons.length,
      avgQuizScoreOutOfApprox3: lessons.length ? +(lessons.reduce((s, r) => s + (r.score || 0), 0) / lessons.length).toFixed(2) : null,
      levels: levelCounts(lessons, 'lessons'),
    },
    translations: {
      count: translations.length,
      accuracyPercent: translations.length ? Math.round(100 * translations.filter(r => r.is_correct).length / translations.length) : null,
      levels: levelCounts(translations, 'translation_exercises'),
    },
    reading: {
      count: reading.length,
      avgComprehensionScoreOutOfApprox5: reading.length ? +(reading.reduce((s, r) => s + (r.score || 0), 0) / reading.length).toFixed(2) : null,
      avgPronunciationPercent: (() => {
        const scored = reading.filter(r => r.pronunciation_avg !== null && r.pronunciation_avg !== undefined);
        return scored.length ? Math.round(scored.reduce((s, r) => s + r.pronunciation_avg, 0) / scored.length) : null;
      })(),
      levels: levelCounts(reading, 'input_passages'),
    },
    roleplay: {
      count: roleplay.length,
      goalCompletionPercent: roleplay.length ? Math.round(100 * roleplay.filter(r => r.goal_completed).length / roleplay.length) : null,
      avgGrammarFlagsPerSession: roleplay.length ? +(roleplay.reduce((s, r) => s + ((r.grammar_flagged || []).length), 0) / roleplay.length).toFixed(2) : null,
      levels: levelCounts(roleplay, 'roleplay_scenarios'),
    },
  };
}

const FIRST_EVAL_MIN_ACTIVITIES = 6;
const REEVAL_MIN_NEW_ACTIVITIES = 3;

// Call once per completed activity, from any of the 4 modules, right after
// its own XP/streak update. Bumps the running counters; once there's
// enough fresh data it silently asks the AI for an honest tier verdict and
// applies it (updating current_level too, since the tier is authoritative).
// Returns { leveledUp: true, tierLabel, reasoning } only when this call
// caused an UP move — the one case worth interrupting the finish screen
// for. Never throws — evaluation is best-effort and must not block the
// normal finish flow.
async function recordActivityAndMaybeEvaluate(user, profile) {
  const newTotal = (profile.total_activities || 0) + 1;
  const newSinceAssessment = (profile.activities_since_assessment || 0) + 1;
  const neverAssessed = !profile.assessed_level;
  const eligible = neverAssessed ? newTotal >= FIRST_EVAL_MIN_ACTIVITIES : newSinceAssessment >= REEVAL_MIN_NEW_ACTIVITIES;

  if (!eligible) {
    await db.from('profiles').update({ total_activities: newTotal, activities_since_assessment: newSinceAssessment }).eq('id', user.id);
    profile.total_activities = newTotal;
    profile.activities_since_assessment = newSinceAssessment;
    return null;
  }

  let result = null;
  try {
    const stats = await gatherProgressStats(user.id, profile.target_language);
    const token = await getAuthToken();
    const res = await fetch(EVALUATE_PROGRESS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        targetLanguage: langByCode(profile.target_language).name,
        nativeLanguage: profile.native_language,
        currentTier: profile.assessed_level || null,
        stats,
      }),
    });
    const raw = await res.text();
    const data = JSON.parse(raw);
    if (res.ok && !data.error && data.tierCode) result = data;
  } catch (e) { /* best-effort */ }

  const prevTier = profile.assessed_level;
  const update = { total_activities: newTotal };
  if (result) {
    update.activities_since_assessment = 0;
    update.assessed_level = result.tierCode;
    update.assessed_reasoning = result.reasoning || null;
    update.assessed_focus_areas = result.focusAreas || [];
    update.assessed_at = new Date().toISOString();
    const base = tierBaseLevel(result.tierCode);
    if (base) update.current_level = base;
  } else {
    // Couldn't get a verdict this time — keep the counter so it retries
    // on the next completed activity instead of waiting another 3.
    update.activities_since_assessment = newSinceAssessment;
  }

  await db.from('profiles').update(update).eq('id', user.id);
  Object.assign(profile, update);

  if (result && prevTier && tierIndex(result.tierCode) > tierIndex(prevTier)) {
    return { leveledUp: true, tierLabel: tierLabel(result.tierCode), reasoning: result.reasoning };
  }
  return null;
}

// --- Social + rewards, Phase 1: Trail Markers (badges), Basecamp
// (leaderboard), Trail Cheers -------------------------------------------
// Badge catalog lives in code (same pattern as LEVELS/TIERS/INTERESTS) —
// only which ones a user has actually earned is persisted, in user_badges.
// Deliberately not Duolingo's owl/flame/gems: waypoints mark real CEFR
// progress on the trail, and the rest reward balanced practice across
// YakYak's modules rather than pure login streaks.
const BADGES = [
  { code: 'waypoint_pre_a1', name: 'Basecamp', icon: '⛺', desc: 'Started the trail', category: 'waypoint' },
  { code: 'waypoint_a1', name: 'First Ridge', icon: '🥾', desc: 'Reached A1', category: 'waypoint' },
  { code: 'waypoint_a2', name: 'Cloud Pass', icon: '☁️', desc: 'Reached A2', category: 'waypoint' },
  { code: 'waypoint_b1', name: 'Alpine Meadow', icon: '🌼', desc: 'Reached B1', category: 'waypoint' },
  { code: 'waypoint_b2', name: 'Summit Ridge', icon: '🏔️', desc: 'Reached B2', category: 'waypoint' },
  { code: 'waypoint_c1', name: 'The Peak', icon: '🏁', desc: 'Reached C1', category: 'waypoint' },
  { code: 'waypoint_c2', name: 'Beyond the Summit', icon: '🌟', desc: 'Reached C2', category: 'waypoint' },
  { code: 'chatterbox', name: 'Chatterbox', icon: '💬', desc: 'Completed 10 Natural Dialog conversations', category: 'skill' },
  { code: 'quick_ear', name: 'Quick Ear', icon: '🎧', desc: 'Scored 90+ average pronunciation on 10 Listen & Read sessions', category: 'skill' },
  { code: 'bookworm', name: 'Bookworm', icon: '📖', desc: 'Finished 15 Reading Library passages', category: 'skill' },
  { code: 'wordsmith', name: 'Wordsmith', icon: '📚', desc: 'Learned 200 vocabulary words', category: 'skill' },
  { code: 'grammar_sleuth', name: 'Grammar Sleuth', icon: '🔍', desc: 'Corrected 25 grammar mistakes', category: 'skill' },
  { code: 'early_bird', name: 'Early Bird', icon: '🌅', desc: 'Practiced before 7am, 5 times', category: 'personality' },
  { code: 'night_owl', name: 'Night Owl', icon: '🦉', desc: 'Practiced after 10pm, 5 times', category: 'personality' },
  { code: 'comeback_kid', name: 'Comeback Kid', icon: '🔥', desc: 'Rebuilt a streak of 5+ after breaking one', category: 'personality' },
];

// Centralizes the XP/streak/last-activity update every module performs at
// session-finish (previously duplicated across 5 files). Also detects a
// "streak break" (losing a streak that was 5+) for the Comeback Kid badge,
// and logs an xp_events row so Basecamp's "this week" leaderboard view has
// a timestamped record to sum — profiles.xp is cumulative-only, and a
// couple of modules never had a completions table to derive weekly XP from
// otherwise. Best-effort on the xp_events insert; must not block finishing.
async function updateStreakAndActivity(user, profile, xpEarned, moduleName) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const isNewDay = profile.last_activity_date !== today;
  const newStreak = profile.last_activity_date === today ? profile.streak
    : profile.last_activity_date === yesterday ? profile.streak + 1 : 1;
  const brokeAStreak = isNewDay && newStreak === 1 && profile.streak >= 5;
  const hadBroken5plus = !!(profile.had_broken_streak_5plus || brokeAStreak);

  const update = {
    xp: profile.xp + xpEarned, streak: newStreak, last_activity_date: today,
    had_broken_streak_5plus: hadBroken5plus,
  };
  await db.from('profiles').update(update).eq('id', user.id);
  Object.assign(profile, update);

  try { await db.from('xp_events').insert({ user_id: user.id, module: moduleName, xp_earned: xpEarned }); } catch (e) {}
}

// Call once per completed activity, right after updateStreakAndActivity.
// Checks every badge's threshold against fresh counts and awards any
// newly-earned ones. Returns the array of newly-earned badge objects (for
// a small celebration card), or [] — never throws, best-effort only.
async function checkAndAwardBadges(user, profile) {
  try {
    const hour = new Date().getHours();
    const profileUpdate = {};
    if (hour < 7) profileUpdate.early_bird_count = (profile.early_bird_count || 0) + 1;
    if (hour >= 22) profileUpdate.night_owl_count = (profile.night_owl_count || 0) + 1;
    if (Object.keys(profileUpdate).length) {
      await db.from('profiles').update(profileUpdate).eq('id', user.id);
      Object.assign(profile, profileUpdate);
    }

    const [existingRes, rpRes, icRes, rcRes, smRes] = await Promise.all([
      db.from('user_badges').select('badge_code').eq('user_id', user.id),
      db.from('roleplay_sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'completed'),
      db.from('input_completions').select('pronunciation_avg').eq('user_id', user.id),
      db.from('reading_completions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      db.from('skill_mastery').select('skill_type, correct_count').eq('user_id', user.id),
    ]);

    const earned = new Set((existingRes.data || []).map(r => r.badge_code));
    const chatterboxCount = rpRes.count || 0;
    const quickEarCount = (icRes.data || []).filter(r => r.pronunciation_avg !== null && r.pronunciation_avg >= 90).length;
    const bookwormCount = rcRes.count || 0;
    const smRows = smRes.data || [];
    const wordsmithCount = smRows.filter(r => r.skill_type === 'vocab').length;
    const grammarSleuthCount = smRows.filter(r => r.skill_type === 'grammar').reduce((s, r) => s + (r.correct_count || 0), 0);

    const qualifies = {
      waypoint_pre_a1: true,
      waypoint_a1: profile.current_level === 'A1',
      waypoint_a2: profile.current_level === 'A2',
      waypoint_b1: profile.current_level === 'B1',
      waypoint_b2: profile.current_level === 'B2',
      waypoint_c1: profile.current_level === 'C1',
      waypoint_c2: profile.current_level === 'C2',
      chatterbox: chatterboxCount >= 10,
      quick_ear: quickEarCount >= 10,
      bookworm: bookwormCount >= 15,
      wordsmith: wordsmithCount >= 200,
      grammar_sleuth: grammarSleuthCount >= 25,
      early_bird: (profile.early_bird_count || 0) >= 5,
      night_owl: (profile.night_owl_count || 0) >= 5,
      comeback_kid: !!(profile.had_broken_streak_5plus && profile.streak >= 5),
    };

    const toAward = BADGES.filter(b => !earned.has(b.code) && qualifies[b.code]);
    if (toAward.length) {
      await db.from('user_badges').insert(toAward.map(b => ({ user_id: user.id, badge_code: b.code })));
    }
    return toAward;
  } catch (e) {
    return [];
  }
}

function badgesEarnedHTML(badges) {
  if (!badges || !badges.length) return '';
  return `
    <div class="card" style="margin-top:14px;background:var(--mint-soft);border-color:var(--mint);text-align:center;">
      <div style="font-size:13px;font-weight:800;color:var(--mint);margin-bottom:10px;">${t('badge.earned')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">
        ${badges.map(b => `
          <div style="background:var(--card);border-radius:14px;padding:12px 14px;min-width:110px;">
            <div style="font-size:28px;">${b.icon}</div>
            <div style="font-weight:800;font-size:13px;margin-top:4px;">${b.name}</div>
            <div class="text-dim" style="font-size:11px;margin-top:2px;">${b.desc}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function celebrationHTML(levelUpResult) {
  return `
    <div class="card" style="margin-top:18px;background:var(--mint-soft);border-color:var(--mint);text-align:center;">
      <div style="font-size:34px;">🎉</div>
      <h3 style="font-size:19px;margin:10px 0 4px;">${t('lvl.congrats', { tier: levelUpResult.tierLabel })}</h3>
      <p class="text-dim" style="font-size:13.5px;">${levelUpResult.reasoning || ''}</p>
    </div>`;
}

// --- DEV MODE ---------------------------------------------------------
// Real auth (email + one-time code, see login.html) is now live. This
// flag and the mock user are kept around only in case we need to flip
// back to single-user dev mode temporarily; every page already calls
// requireAuth()/getAuthToken(), which do the right thing either way.
const DEV_MODE = false;
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
  if (h < 12) return t('greeting.morning');
  if (h < 19) return t('greeting.afternoon');
  return t('greeting.evening');
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

// Shared by lesson.html's dialogue quiz, translate.html, and input.html's
// comprehension check — all three grade translations via grade-translation,
// which optionally returns { grammarCode, grammarLabel, grammarLesson } when
// a wrong answer traces back to a specific, teachable grammar pattern. This
// persists that pattern into the same grammar_points + skill_mastery tables
// roleplay.html's corrections use, so it surfaces later in spaced-repetition
// review, and returns the small "quick lesson" card HTML to inject inline.
async function saveGrammarLesson(userId, targetLanguage, level, result) {
  if (!result || !result.grammarCode || !result.grammarLabel || !result.grammarLesson) return;
  const { data: gp } = await db.from('grammar_points')
    .upsert({
      target_language: targetLanguage,
      code: result.grammarCode,
      label: result.grammarLabel,
      level: level,
      description: result.grammarLesson,
    }, { onConflict: 'target_language,code' })
    .select('id').single();
  if (gp) await recordSkillResult(userId, 'grammar', gp.id, false);
}

function grammarLessonHTML(result) {
  if (!result || !result.grammarLesson) return '';
  return `
    <div class="card" style="margin-top:14px;">
      <span class="chip-mini" style="background:var(--mint-soft);color:var(--mint);margin-bottom:8px;">${t('gl.quickLesson')}${result.grammarLabel ? ' · ' + result.grammarLabel : ''}</span>
      <p class="text-dim" style="font-size:13px;line-height:1.5;">${result.grammarLesson}</p>
    </div>`;
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

// --- Yak avatars ---------------------------------------------------------
// A small chosen-identity layer on top of Trail Markers: pick one of 5
// colored yaks (like Duolingo's owl), and it wears your progress — a
// tiered crown for how far up the CEFR waypoints you've climbed, plus a
// few small medal chips for other earned badges. Palette-only variants of
// one drawing (not 5 separate illustrations) so they stay visually
// consistent and cheap to render anywhere (dashboard header, Basecamp).
const AVATARS = [
  { id: 'cocoa', nameKey: 'av.cocoa', body: '#B0784A', fringe: '#8B5A2B', horn: '#EDE0C0', snout: '#E8C9A0', dark: '#3A1F0E' },
  { id: 'frost', nameKey: 'av.frost', body: '#F3EDE3', fringe: '#E0D4BC', horn: '#D8CBA8', snout: '#FFF8EF', dark: '#3A1F0E' },
  { id: 'shadow', nameKey: 'av.shadow', body: '#4A4038', fringe: '#2E2620', horn: '#C9BCA0', snout: '#6B5A45', dark: '#241A10' },
  { id: 'rusty', nameKey: 'av.rusty', body: '#A8482E', fringe: '#7A2F1C', horn: '#EDE0C0', snout: '#D9855E', dark: '#2E160A' },
  { id: 'summitGold', nameKey: 'av.summitGold', body: '#D9A93F', fringe: '#B8862A', horn: '#F5EBC9', snout: '#F0C97A', dark: '#3A2508' },
];

const WAYPOINT_ORDER = ['waypoint_pre_a1', 'waypoint_a1', 'waypoint_a2', 'waypoint_b1', 'waypoint_b2', 'waypoint_c1', 'waypoint_c2'];
const CROWN_TIERS = {
  bronze: { fill: '#B08D57', stroke: '#8A6B3D' },
  silver: { fill: '#D6DBE0', stroke: '#9AA0A8' },
  gold: { fill: '#FFD75E', stroke: '#C9A227' },
};

// Renders a yak avatar as inline HTML (SVG bust + a small row of medal
// emoji beneath it). badgeCodes is the full list of a user's earned
// user_badges.badge_code values — the crown tier comes from the highest
// CEFR waypoint among them, and up to 3 non-waypoint badges show as medals
// (with a "+N" overflow chip) so the avatar stays readable even once
// someone has earned a lot of Trail Markers.
function yakAvatarHTML(avatarId, size, badgeCodes) {
  const a = AVATARS.find(x => x.id === avatarId) || AVATARS[0];
  badgeCodes = badgeCodes || [];
  size = size || 56;

  const highestWaypointIdx = Math.max(-1, ...badgeCodes.map(c => WAYPOINT_ORDER.indexOf(c)).filter(i => i >= 0));
  let crownTier = null;
  if (highestWaypointIdx >= 5) crownTier = 'gold';
  else if (highestWaypointIdx >= 3) crownTier = 'silver';
  else if (highestWaypointIdx >= 1) crownTier = 'bronze';

  const medalCodes = badgeCodes.filter(c => !WAYPOINT_ORDER.includes(c));
  const medalIcons = medalCodes.slice(0, 3).map(code => (BADGES.find(b => b.code === code) || {}).icon).filter(Boolean);
  const extra = medalCodes.length - medalIcons.length;

  const crownSVG = crownTier ? `
    <path d="M32,20 L38,4 L47,16 L60,0 L73,16 L82,4 L88,20 Z" fill="${CROWN_TIERS[crownTier].fill}" stroke="${CROWN_TIERS[crownTier].stroke}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="60" cy="8" r="3" fill="${CROWN_TIERS[crownTier].fill}" stroke="${CROWN_TIERS[crownTier].stroke}" stroke-width="1.5"/>` : '';

  return `
    <div style="display:inline-flex;flex-direction:column;align-items:center;">
      <svg viewBox="0 0 120 130" width="${size}" height="${Math.round(size * 130 / 120)}">
        <path d="M28,42 Q12,20 24,6 Q36,16 34,36 Z" fill="${a.horn}"/>
        <path d="M92,42 Q108,20 96,6 Q84,16 86,36 Z" fill="${a.horn}"/>
        <path d="M22,50 Q16,26 32,20 Q42,30 52,20 Q60,28 68,20 Q78,30 88,20 Q104,26 98,50 Z" fill="${a.fringe}"/>
        <ellipse cx="60" cy="76" rx="44" ry="40" fill="${a.body}"/>
        <ellipse cx="60" cy="98" rx="22" ry="16" fill="${a.snout}"/>
        <ellipse cx="53" cy="96" rx="2.5" ry="3.5" fill="${a.dark}"/>
        <ellipse cx="67" cy="96" rx="2.5" ry="3.5" fill="${a.dark}"/>
        <circle cx="44" cy="68" r="6.5" fill="${a.dark}"/>
        <circle cx="76" cy="68" r="6.5" fill="${a.dark}"/>
        <circle cx="46.5" cy="65.5" r="2" fill="#fff"/>
        <circle cx="78.5" cy="65.5" r="2" fill="#fff"/>
        <path d="M50,110 Q60,116 70,110" stroke="${a.dark}" stroke-width="3" fill="none" stroke-linecap="round"/>
        ${crownSVG}
      </svg>
      ${medalIcons.length ? `
        <div style="display:flex;gap:3px;margin-top:2px;">
          ${medalIcons.map(ic => `<span style="font-size:${Math.max(10, Math.round(size * 0.22))}px;">${ic}</span>`).join('')}
          ${extra > 0 ? `<span style="font-size:${Math.max(9, Math.round(size * 0.18))}px;color:var(--text-faint);align-self:center;">+${extra}</span>` : ''}
        </div>` : ''}
    </div>`;
}

// Opens a modal to choose one of the 5 yak avatars. Calls onPick(avatarId)
// and closes itself; does NOT persist anything — the caller is responsible
// for saving avatar_id (different pages want to save it slightly
// differently, e.g. onboarding batches it into the initial profile upsert).
function openAvatarPicker(currentId, onPick) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card">
      <h2 style="font-size:20px;margin-bottom:4px;">${t('av.pickTitle')}</h2>
      <p class="text-dim" style="font-size:13.5px;margin-bottom:16px;">${t('av.pickSubtitle')}</p>
      <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;" id="avatarGrid"></div>
      <button class="btn-ghost" id="closeAvatarPickerBtn" style="margin-top:18px;width:100%;justify-content:center;">${t('av.cancel')}</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('avatarGrid').innerHTML = AVATARS.map(a => `
    <button class="tile${a.id === currentId ? ' active' : ''}" data-a="${a.id}" style="align-items:center;width:88px;">
      ${yakAvatarHTML(a.id, 56, [])}
      <span style="font-size:11.5px;font-weight:700;margin-top:4px;">${t(a.nameKey)}</span>
    </button>`).join('');
  document.getElementById('avatarGrid').querySelectorAll('[data-a]').forEach(btn => {
    btn.addEventListener('click', () => { overlay.remove(); onPick(btn.dataset.a); });
  });
  document.getElementById('closeAvatarPickerBtn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
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
            ${!opts.compact ? `<span class="ladder-label">${levelLabel(lvl.code)}</span>` : ''}
            ${isCurrent ? `<span class="chip-mini" style="margin-left:auto;">${t('ob.you.are.here')}</span>` : ''}
            ${isTarget ? `<span style="margin-left:auto;color:var(--mint);font-weight:800;font-size:11px;">${t('ob.goal')}</span>` : ''}
          </div>
          ${!opts.compact ? `<span class="ladder-desc">${levelDesc(lvl.code)}</span>` : ''}
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
