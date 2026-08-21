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
const LEVEL_TEST_COACH_URL = SUPABASE_URL + "/functions/v1/level-test-coach";
const GENERATE_COACH_CHECKIN_URL = SUPABASE_URL + "/functions/v1/generate-coach-checkin";
const GENERATE_VOCAB_EXAMPLE_URL = SUPABASE_URL + "/functions/v1/generate-vocab-example";
const LOOKUP_WORD_URL = SUPABASE_URL + "/functions/v1/lookup-word";
const GENERATE_STUDY_GUIDE_PAGE_URL = SUPABASE_URL + "/functions/v1/generate-study-guide-page";
const GENERATE_PLACEMENT_TEST_URL = SUPABASE_URL + "/functions/v1/generate-placement-test";

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

// --- CEFR Level-Up Test ---------------------------------------------------
// A separate, deliberate capstone test (see level-test.html) for crossing
// the big CEFR boundary between levels (A1→A2, A2→B1, ...) — distinct from
// the passive background evaluation above, which only moves a learner
// between the 3 sub-tiers WITHIN their current level. The test only
// unlocks once the passive system already has them at their current
// level's Advanced sub-tier (e.g. B1.3), so it stays a deliberate, earned
// moment rather than something to spam early.
const LEVEL_TEST_PASS_THRESHOLD = 75;
const LEVEL_TEST_XP_BONUS = 150;
const LEVEL_TEST_COOLDOWN_HOURS = 24;

// The CEFR level after `code`, or null if already at the top (C2).
function nextCefrLevel(code) {
  const idx = LEVELS.findIndex(l => l.code === code);
  if (idx === -1 || idx === LEVELS.length - 1) return null;
  return LEVELS[idx + 1].code;
}

// Whether this learner can attempt the level-up test right now, and if
// not, why — used both to gate the dashboard entry banner and as a
// belt-and-suspenders check on level-test.html itself (in case someone
// deep-links there directly). reason is one of: 'maxed' (already C2),
// 'not_assessed' (no background evaluation yet), 'not_advanced' (assessed
// but not yet at this level's Advanced sub-tier), 'cooldown' (failed
// recently), or null when eligible.
function levelTestEligibility(profile) {
  const next = nextCefrLevel(profile.current_level);
  if (!next) return { eligible: false, reason: 'maxed', nextLevel: null };
  if (!profile.assessed_level) return { eligible: false, reason: 'not_assessed', nextLevel: next };
  const tier = TIERS.find(t => t.code === profile.assessed_level);
  const isAdvanced = tier && tier.subKey === 'tier.advanced' && tier.baseLevel === profile.current_level;
  if (!isAdvanced) return { eligible: false, reason: 'not_advanced', nextLevel: next };
  if (profile.level_test_cooldown_until && new Date(profile.level_test_cooldown_until) > new Date()) {
    return { eligible: false, reason: 'cooldown', nextLevel: next, cooldownUntil: profile.level_test_cooldown_until };
  }
  return { eligible: true, reason: null, nextLevel: next };
}

// Shared by the dashboard's level-up banner and level-test.html's own
// ineligible/cooldown screens, so both read the same rounding rule.
function formatHoursRemaining(iso) {
  if (!iso) return t('lvt.hoursUnit', { n: LEVEL_TEST_COOLDOWN_HOURS });
  const ms = new Date(iso) - new Date();
  const hours = Math.max(1, Math.ceil(ms / 3600000));
  return t('lvt.hoursUnit', { n: hours });
}

// --- Coach Yak: daily AI check-in ----------------------------------------
// A dedicated "coach" persona (avatars/coach.png, not part of the Yak
// Evolution ladder — a fixed mascot for this feature, always the same
// character) that greets the learner once a day on the dashboard with a
// real, specific pep talk generated from their actual recent activity (see
// generate-coach-checkin). Cached in profiles.coach_checkin_date /
// coach_checkin_message so it's written once per calendar day, not
// regenerated on every dashboard load. Any later same-day dashboard visit
// instead shows a quick canned hype line (HYPE_PHRASE_KEYS below) — cheap,
// instant, no AI call, so navigating back to the dashboard mid-session
// never feels like it's nagging with the same speech twice.
const HYPE_PHRASE_KEYS = [
  'coach.hype1', 'coach.hype2', 'coach.hype3', 'coach.hype4',
  'coach.hype5', 'coach.hype6', 'coach.hype7', 'coach.hype8',
];
function randomHypePhrase() {
  return t(HYPE_PHRASE_KEYS[Math.floor(Math.random() * HYPE_PHRASE_KEYS.length)]);
}

// Returns { isNew, message }. isNew=true means this is the first dashboard
// visit today and message is the freshly generated (and now cached) full
// pep talk. isNew=false means today's check-in already happened (or the
// generation call failed) — caller should show a random hype phrase
// instead in that case.
async function getDailyCoachCheckin(user, profile) {
  const today = new Date().toISOString().slice(0, 10);
  if (profile.coach_checkin_date === today && profile.coach_checkin_message) {
    return { isNew: false, message: null };
  }
  try {
    const stats = await gatherProgressStats(user.id, profile.target_language);
    const token = await getAuthToken();
    const res = await fetch(GENERATE_COACH_CHECKIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        targetLanguage: langByCode(profile.target_language).name,
        nativeLanguage: profile.native_language,
        tierLabel: profile.assessed_level ? tierLabel(profile.assessed_level) : null,
        streak: profile.streak, xp: profile.xp,
        focusAreas: profile.assessed_focus_areas || [],
        stats,
      }),
    });
    const raw = await res.text();
    const data = JSON.parse(raw);
    if (res.ok && !data.error && data.message) {
      const update = { coach_checkin_date: today, coach_checkin_message: data.message };
      await db.from('profiles').update(update).eq('id', user.id);
      Object.assign(profile, update);
      return { isNew: true, message: data.message };
    }
  } catch (e) { /* best-effort — dashboard still works without it */ }
  return { isNew: false, message: null };
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
  { code: 'waypoint_pre_a1', name: 'Basecamp', icon: 'tent', desc: 'Started the trail', category: 'waypoint' },
  { code: 'waypoint_a1', name: 'First Ridge', icon: 'boot', desc: 'Reached A1', category: 'waypoint' },
  { code: 'waypoint_a2', name: 'Cloud Pass', icon: 'cloud', desc: 'Reached A2', category: 'waypoint' },
  { code: 'waypoint_b1', name: 'Alpine Meadow', icon: 'flower', desc: 'Reached B1', category: 'waypoint' },
  { code: 'waypoint_b2', name: 'Summit Ridge', icon: 'mountain', desc: 'Reached B2', category: 'waypoint' },
  { code: 'waypoint_c1', name: 'The Peak', icon: 'flag', desc: 'Reached C1', category: 'waypoint' },
  { code: 'waypoint_c2', name: 'Beyond the Summit', icon: 'star', desc: 'Reached C2', category: 'waypoint' },
  { code: 'chatterbox', name: 'Chatterbox', icon: 'chat', desc: 'Completed 10 Natural Dialog conversations', category: 'skill' },
  { code: 'quick_ear', name: 'Quick Ear', icon: 'headphones', desc: 'Scored 90+ average pronunciation on 10 Listen & Read sessions', category: 'skill' },
  { code: 'bookworm', name: 'Bookworm', icon: 'book', desc: 'Finished 15 Reading Library passages', category: 'skill' },
  { code: 'wordsmith', name: 'Wordsmith', icon: 'books', desc: 'Learned 200 vocabulary words', category: 'skill' },
  { code: 'grammar_sleuth', name: 'Grammar Sleuth', icon: 'search', desc: 'Corrected 25 grammar mistakes', category: 'skill' },
  { code: 'early_bird', name: 'Early Bird', icon: 'sunrise', desc: 'Practiced before 7am, 5 times', category: 'personality' },
  { code: 'night_owl', name: 'Night Owl', icon: 'owl', desc: 'Practiced after 10pm, 5 times', category: 'personality' },
  { code: 'comeback_kid', name: 'Comeback Kid', icon: 'flame', desc: 'Rebuilt a streak of 5+ after breaking one', category: 'personality' },
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

// Confetti burst — the same "congrats!" feeling as an iMessage confetti
// effect. Pure DOM+CSS (see .confetti-burst/.confetti-piece in
// styles.css): spawns a batch of small colored pieces at random positions
// near the top of the viewport, each with its own randomized fall
// duration/delay, sideways drift, size, and spin, then removes the whole
// burst from the DOM once every piece has finished animating so it never
// lingers behind as a debugging surprise later in the session.
//
// Two tiers: fireConfetti('small') fires a quick, narrow pop for a single
// correct answer (called right where each module already knows an answer
// was right, e.g. right after `correct = ...`/`isCorrect === true`).
// fireConfetti('big') — the default, unchanged from the original
// full-screen version — is reserved for finishing an entire set/session
// with a perfect score. Small bursts are deliberately modest so a learner
// blazing through a set correctly doesn't get buried in confetti before
// the real payoff at the end.
function fireConfetti(size) {
  const big = size !== 'small';
  const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#B983FF', '#FF9F45'];
  const container = document.createElement('div');
  container.className = 'confetti-burst';
  const pieceCount = big ? 90 : 22;
  const spreadWidth = big ? 100 : 46; // vw
  const spreadStart = big ? 0 : 27; // vw, centers the narrow burst
  for (let i = 0; i < pieceCount; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = (spreadStart + Math.random() * spreadWidth) + 'vw';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    const size = (big ? 6 : 5) + Math.random() * (big ? 7 : 5);
    piece.style.width = size + 'px';
    piece.style.height = (size * (0.4 + Math.random() * 0.7)) + 'px';
    piece.style.borderRadius = Math.random() < 0.3 ? '50%' : '2px';
    piece.style.setProperty('--confetti-drift', Math.round(Math.random() * 200 - 100) + 'px');
    piece.style.setProperty('--confetti-rot', Math.round(Math.random() * 720 - 360) + 'deg');
    const duration = big ? (2.2 + Math.random() * 1.4) : (1.1 + Math.random() * 0.7);
    piece.style.animationDuration = duration + 's';
    piece.style.animationDelay = (Math.random() * (big ? 0.35 : 0.15)) + 's';
    container.appendChild(piece);
  }
  document.body.appendChild(container);
  setTimeout(() => container.remove(), big ? 4200 : 2200);
}

function celebrationHTML(levelUpResult) {
  return `
    <div class="card" style="margin-top:18px;background:var(--mint-soft);border-color:var(--mint);text-align:center;">
      <div style="color:var(--mint);">${icon('confetti', { size: 34 })}</div>
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
// shared signal that feeds the spaced-repetition queue (Huddle Up).
//
// A fresh miss (correct=false) also resets mistake_cleared/
// mistake_reviews_passed — see the Huddle Up section below — so a word or
// grammar point that was already "graduated" out of the mistake queue but
// gets missed again anywhere in the app (not just in Huddle Up itself)
// comes back into rotation rather than staying invisible forever.
async function recordSkillResult(userId, skillType, skillRefId, correct) {
  if (!skillRefId) return;
  const { data: existing } = await db.from('skill_mastery').select('*')
    .eq('user_id', userId).eq('skill_type', skillType).eq('skill_ref_id', skillRefId).maybeSingle();

  let strength = existing ? existing.strength : 0;
  let correctCount = existing ? existing.correct_count : 0;
  let incorrectCount = existing ? existing.incorrect_count : 0;

  const row = {
    user_id: userId,
    skill_type: skillType,
    skill_ref_id: skillRefId,
  };

  if (correct) { correctCount++; strength = Math.min(5, strength + 1); }
  else {
    incorrectCount++; strength = Math.max(0, strength - 1);
    row.mistake_cleared = false;
    row.mistake_reviews_passed = 0;
  }

  // Simple SM-2-style interval ladder keyed off strength (0-5).
  const intervalDays = [0.5, 1, 2, 4, 7, 14][strength];
  const now = new Date();
  const nextReview = new Date(now.getTime() + intervalDays * 86400000);

  row.strength = strength;
  row.correct_count = correctCount;
  row.incorrect_count = incorrectCount;
  row.last_seen_at = now.toISOString();
  row.next_review_at = nextReview.toISOString();
  row.updated_at = now.toISOString();

  await db.from('skill_mastery').upsert(row, { onConflict: 'user_id,skill_type,skill_ref_id' });
}

// --- Huddle Up: mistake review ------------------------------------------
// Huddle Up (review.html) is deliberately scoped to actual mistakes only —
// it queries skill_mastery/pronunciation_mistakes rows that have been
// missed at least once, not everything ever encountered. An item graduates
// (mistake_cleared / cleared = true, drops out of the queue for good) once
// it's been answered correctly here 3 TIMES IN A ROW — any miss along the
// way resets the streak to 0, so a lucky guess elsewhere doesn't cheapen
// real mastery.
const MISTAKE_REVIEWS_TO_GRADUATE = 3;

// The grading path used ONLY inside Huddle Up itself — wraps
// recordSkillResult (still handles the general strength/interval ladder)
// and additionally advances the graduation counter. Getting a word right
// via a multiple-choice guess elsewhere does NOT move this counter; only a
// deliberate recall-under-test pass here does.
// Returns { passed, cleared } so the caller (Huddle Up's card UI) can show
// a "mastered!" moment right when an item graduates out of the queue.
async function recordMistakeReviewResult(userId, skillType, skillRefId, correct) {
  await recordSkillResult(userId, skillType, skillRefId, correct);
  if (!correct) return { passed: 0, cleared: false }; // recordSkillResult already zeroed + reopened it
  const { data: existing } = await db.from('skill_mastery').select('mistake_reviews_passed')
    .eq('user_id', userId).eq('skill_type', skillType).eq('skill_ref_id', skillRefId).maybeSingle();
  const passed = (existing ? existing.mistake_reviews_passed : 0) + 1;
  const cleared = passed >= MISTAKE_REVIEWS_TO_GRADUATE;
  await db.from('skill_mastery').update({
    mistake_reviews_passed: passed,
    mistake_cleared: cleared,
  }).eq('user_id', userId).eq('skill_type', skillType).eq('skill_ref_id', skillRefId);
  return { passed, cleared };
}

// Called after grade-pronunciation flags mispronounced words (input.html),
// so they land in Huddle Up instead of vanishing once the session ends.
// One row per (user, language, word) — matched case-insensitively since
// pronunciation_mistakes has no FK to a curated word list, just whatever
// exact substrings grade-pronunciation flagged. A fresh miss on a word
// already in rotation resets its streak, same reasoning as
// recordSkillResult above. Best-effort; must not block the module finishing.
async function recordPronunciationMistakes(userId, targetLanguage, missedWords, sentenceContext) {
  if (!missedWords || !missedWords.length) return;
  const now = new Date().toISOString();
  for (const word of missedWords) {
    try {
      const { data: existing } = await db.from('pronunciation_mistakes').select('id')
        .eq('user_id', userId).eq('target_language', targetLanguage).ilike('word', word).maybeSingle();
      if (existing) {
        await db.from('pronunciation_mistakes').update({
          sentence_context: sentenceContext || null, correct_streak: 0, cleared: false,
          next_review_at: now, last_seen_at: now,
        }).eq('id', existing.id);
      } else {
        await db.from('pronunciation_mistakes').insert({
          user_id: userId, target_language: targetLanguage, word,
          sentence_context: sentenceContext || null, next_review_at: now, last_seen_at: now,
        });
      }
    } catch (e) { /* best-effort per word */ }
  }
}

// Grades a Huddle Up pronunciation-drill card. Uses its own short interval
// ladder (1/3/7 days as the streak builds) rather than skill_mastery's,
// since this is a separate table with its own simpler shape.
async function gradePronunciationMistake(id, correct) {
  const { data: existing } = await db.from('pronunciation_mistakes').select('correct_streak').eq('id', id).maybeSingle();
  const streak = correct ? (existing ? existing.correct_streak : 0) + 1 : 0;
  const cleared = streak >= MISTAKE_REVIEWS_TO_GRADUATE;
  const now = new Date();
  const intervalDays = correct ? [1, 3, 7][Math.min(streak - 1, 2)] : 0.5;
  const nextReview = new Date(now.getTime() + intervalDays * 86400000);
  await db.from('pronunciation_mistakes').update({
    correct_streak: streak,
    cleared,
    next_review_at: nextReview.toISOString(),
    last_seen_at: now.toISOString(),
  }).eq('id', id);
  return { streak, cleared };
}

// Lazily fetches + caches an example sentence for a vocab_items row that
// doesn't have one yet (older rows, or ones never shown via vocab.html's
// batch flow). Persists onto the row itself so it's a one-time generation
// cost per word, not regenerated every time it comes up in Huddle Up.
async function getOrCreateVocabExample(vocabItem, targetLanguage, nativeLanguage) {
  if (vocabItem.example_target) {
    return { exampleTarget: vocabItem.example_target, exampleNative: vocabItem.example_native };
  }
  try {
    const token = await getAuthToken();
    const res = await fetch(GENERATE_VOCAB_EXAMPLE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        targetText: vocabItem.target_text, nativeText: vocabItem.native_text,
        targetLanguage, nativeLanguage, level: vocabItem.level,
      }),
    });
    const data = JSON.parse(await res.text());
    if (res.ok && !data.error && data.exampleTarget) {
      await db.from('vocab_items').update({
        example_target: data.exampleTarget, example_native: data.exampleNative || null,
      }).eq('id', vocabItem.id);
      return { exampleTarget: data.exampleTarget, exampleNative: data.exampleNative || null };
    }
  } catch (e) { /* best-effort — card still works without an example */ }
  return { exampleTarget: null, exampleNative: null };
}

// Powers reading.html's Storybook mode (tap any word for a lookup card).
// Finds an existing vocab_items row for this exact word first (case-
// insensitive — same matching style as pronunciation_mistakes) so the same
// word tapped again later, in this passage or a different one, is free and
// instant. Otherwise calls lookup-word once and persists a fresh row,
// which doubles as free content for vocab.html's avoid-list (tapped words
// won't get redundantly re-taught in a freshly generated batch).
//
// Returns { vocabItemId, translation, phonetic } — vocabItemId is what the
// caller passes to recordSkillResult if the learner taps "Learn". Merely
// looking a word up (even if they tap "I know it") does NOT touch
// skill_mastery — only an explicit "Learn" tap enters it into the Huddle Up
// mistake-review pipeline.
async function getOrCreateWordLookup(word, sentenceContext, targetLanguage, nativeLanguage, level) {
  const { data: existing } = await db.from('vocab_items').select('*')
    .eq('target_language', targetLanguage).ilike('target_text', word).limit(1).maybeSingle();
  if (existing && existing.phonetic) {
    return { vocabItemId: existing.id, translation: existing.native_text, phonetic: existing.phonetic };
  }

  try {
    const token = await getAuthToken();
    const res = await fetch(LOOKUP_WORD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ word, sentenceContext, targetLanguage, nativeLanguage, level }),
    });
    const data = JSON.parse(await res.text());
    if (!res.ok || data.error || !data.translation) throw new Error(data.error || 'lookup failed');

    if (existing) {
      await db.from('vocab_items').update({ phonetic: data.phonetic || null }).eq('id', existing.id);
      return { vocabItemId: existing.id, translation: existing.native_text, phonetic: data.phonetic || null };
    }
    const { data: row } = await db.from('vocab_items').insert({
      target_language: targetLanguage, native_language: nativeLanguage,
      target_text: word, native_text: data.translation, level: level || 'A2',
      tags: [], example_target: sentenceContext || null,
      phonetic: data.phonetic || null,
    }).select('id').single();
    return { vocabItemId: row ? row.id : null, translation: data.translation, phonetic: data.phonetic || null };
  } catch (e) {
    // Best-effort — if the existing row (without phonetic) is all we have,
    // still let the learner see the translation; otherwise surface nothing.
    if (existing) return { vocabItemId: existing.id, translation: existing.native_text, phonetic: null };
    return { vocabItemId: null, translation: null, phonetic: null };
  }
}

// --- Study Guide (study-guide.html) --------------------------------------
// A "classroom/textbook" reference section, distinct from every other
// module (which are all interactive quizzes/drills). Pages are meant to be
// a STABLE reference, not fresh-every-time content — the same topic always
// returns the same page, found-or-created once and cached forever in
// study_guide_pages (shared across all learners of a target language, same
// as vocab_items/reading_passages).

function slugifyTopic(topic) {
  return String(topic).trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
}

// Pass an empty/null topic to let the model pick one itself (the "Surprise
// me" flow) — the resolved topic comes back either way. Checks for an
// existing page by topic before AND after generating (the model can land on
// a topic name that already exists under the exact same slug), so repeat
// taps on "Surprise me" don't pile up near-duplicate pages.
async function getOrCreateStudyGuidePage(pageType, topic, targetLanguage, nativeLanguage, level) {
  if (topic) {
    const topicKey = slugifyTopic(topic);
    const { data: existing } = await db.from('study_guide_pages').select('*')
      .eq('target_language', targetLanguage).eq('page_type', pageType).eq('topic_key', topicKey).maybeSingle();
    if (existing) return { id: existing.id, topic: existing.topic, content: existing.content, isNew: false };
  }

  const avoid = topic ? [] : await fetchRecentValues('study_guide_pages', 'topic', targetLanguage, level, 20);
  const token = await getAuthToken();
  const res = await fetch(GENERATE_STUDY_GUIDE_PAGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ pageType, topic: topic || null, targetLanguage, nativeLanguage, level, avoid }),
  });
  const raw = await res.text();
  const data = JSON.parse(raw);
  if (!res.ok || data.error || !data.content || !data.topic) throw new Error(data.error || 'Could not generate page');

  const resolvedTopic = data.topic;
  const topicKey = slugifyTopic(resolvedTopic);

  const { data: existingAfter } = await db.from('study_guide_pages').select('*')
    .eq('target_language', targetLanguage).eq('page_type', pageType).eq('topic_key', topicKey).maybeSingle();
  if (existingAfter) return { id: existingAfter.id, topic: existingAfter.topic, content: existingAfter.content, isNew: false };

  const { data: row, error } = await db.from('study_guide_pages').insert({
    target_language: targetLanguage, native_language: nativeLanguage, level: level || 'A2',
    page_type: pageType, topic: resolvedTopic, topic_key: topicKey, content: data.content,
  }).select('*').single();
  if (error) {
    // Unique-index race (another tab/user inserted the same topic between
    // our check and our insert) — just fetch what won rather than erroring.
    const { data: race } = await db.from('study_guide_pages').select('*')
      .eq('target_language', targetLanguage).eq('page_type', pageType).eq('topic_key', topicKey).maybeSingle();
    if (race) return { id: race.id, topic: race.topic, content: race.content, isNew: false };
    throw error;
  }
  return { id: row.id, topic: row.topic, content: row.content, isNew: true };
}

// Library browsing — recent pages for this target language, newest first,
// optionally filtered to one page_type ('grammar'|'vocab_theme'|'phrase_list', or null for all).
async function fetchStudyGuideLibrary(targetLanguage, pageType, limit) {
  let q = db.from('study_guide_pages').select('id, page_type, topic, content, created_at')
    .eq('target_language', targetLanguage).order('created_at', { ascending: false }).limit(limit || 40);
  if (pageType) q = q.eq('page_type', pageType);
  const { data } = await q;
  return data || [];
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

// --- Shared icon system --------------------------------------------------
// Part of the Aug 2026 visual overhaul: raw OS emoji rendered differently
// (or not at all) across platforms and read as dated/cheap. Every decorative
// glyph in the product is now one of these inline SVGs instead, drawn to
// match via currentColor + the .icon/.icon-lg/.icon-xl classes in
// styles.css. Call icon('name') anywhere a template literal builds HTML;
// call icon('name', {size}) for a one-off pixel size instead of the class
// scale. Falls back to a blank sparkle-shaped glyph for unknown names
// rather than throwing, since this only ever renders decorative chrome.
const ICONS = {
  flame:'<path d="M12 2c1 4-3 5-3 9a5 5 0 0 0 10 0c0-2-1-3-2-4 .5 2-1 3-2 2 1-2-1-3-3-7z"/>',
  sparkle:'<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z"/>',
  dice:'<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/>',
  fork:'<path d="M7 2v8M5 2v5a2 2 0 0 0 4 0V2M17 2c-2 0-3 2-3 5s1 4 3 4V22"/>',
  tent:'<path d="M3 20L12 4l9 16M8 20l4-8 4 8M3 20h18"/>',
  cloud:'<path d="M7 18a4 4 0 1 1 .6-7.96A5 5 0 0 1 17 12h.5a3.5 3.5 0 1 1 0 7H7z"/>',
  flower:'<circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="6" r="2.2"/><circle cx="12" cy="18" r="2.2"/><circle cx="6" cy="12" r="2.2"/><circle cx="18" cy="12" r="2.2"/>',
  mountain:'<path d="M3 19L10 6l3 5 2-3 6 11H3z"/>',
  home:'<path d="M4 11l8-7 8 7M6 10v10h12V10"/>',
  chart:'<path d="M5 20V10M12 20V4M19 20v-7"/>',
  chat:'<path d="M4 5h16v11H8l-4 4V5z"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>',
  trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 5H5a3 3 0 0 0 3 4M16 5h3a3 3 0 0 1-3 4"/><path d="M12 13v3M9 20h6M10 20v-2.5a2 2 0 0 1 4 0V20"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  medal:'<circle cx="12" cy="14" r="6"/><path d="M9 8.5L7 3h3l2 4.5M15 8.5L17 3h-3l-2 4.5"/><circle cx="12" cy="14" r="2.4" fill="currentColor"/>',
  speak:'<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
  books:'<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="9.5" y="4" width="5" height="16" rx="1"/><path d="M16.5 5.5l4 1.2-3 14-4-1.1"/>',
  book:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5z"/><path d="M20 19H6.5A2.5 2.5 0 0 0 4 21.5"/>',
  handshake:'<path d="M2 12l5-4 4 3 3-3 2 2 4-3 2 2-6 8-3-2-3 2z"/><path d="M9 15l3-3"/>',
  bot:'<rect x="5" y="8" width="14" height="11" rx="3"/><circle cx="9.5" cy="13.5" r="1.3" fill="currentColor"/><circle cx="14.5" cy="13.5" r="1.3" fill="currentColor"/><path d="M12 8V4M9 4h6"/>',
  letters:'<path d="M4 18L8.5 6h1L14 18M5.4 14h6.7"/><path d="M16 18v-6a3 3 0 1 1 3 3h-3"/>',
  ruler:'<path d="M3 16.5L16.5 3l4.5 4.5L7.5 21 3 16.5z"/><path d="M13 6.5l1.5 1.5M10 9.5L11.5 11M7 12.5L8.5 14"/>',
  warning:'<path d="M12 3l10 18H2z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="1" fill="currentColor"/>',
  check:'<path d="M4 12l6 6L20 6"/>',
  close:'<path d="M5 5l14 14M19 5L5 19"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  speaker:'<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9a4 4 0 0 1 0 6M19.5 7a8 8 0 0 1 0 10"/>',
  headphones:'<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  pencil:'<path d="M4 20l1-4L16 5l3 3L8 19l-4 1z"/><path d="M14 7l3 3"/>',
  confetti:'<path d="M4 20l3-9M8 20l2-11M13 20l3-13M4 6l3 1M15 4l2 2M19 8l-2 1"/>',
  lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  bicep:'<path d="M4 17c0-6 3-11 7-12 2 3-1 4-1 6 3-1 6 1 6 4 3 0 4 3 3 6-3 2-9 3-12 1-2-1-3-3-3-5z"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 6.5l9 6 9-6"/>',
  bag:'<path d="M6 7h12l1 14H5L6 7z"/><path d="M9 7V6a3 3 0 0 1 6 0v1"/>',
  bulb:'<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/>',
  crown:'<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z"/>',
  flag:'<path d="M5 3v18"/><path d="M5 4h14l-3 4 3 4H5"/>',
  boot:'<path d="M8 3h4v9l3 2h4v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6l4-2V3z"/>',
  yak:'<ellipse cx="12" cy="14" rx="7" ry="6"/><path d="M6 10L4 6M18 10l2-4M9 12l-1 3M15 12l1 3"/><circle cx="9.5" cy="13" r="1" fill="currentColor"/><circle cx="14.5" cy="13" r="1" fill="currentColor"/>',
  sunrise:'<path d="M3 18h18M6 18a6 6 0 0 1 12 0"/><path d="M12 6v3M5 9l2 2M19 9l-2 2"/>',
  star:'<path d="M12 3l2.6 5.9 6.4.6-4.9 4.3 1.5 6.2L12 16.9 6.4 20l1.5-6.2-4.9-4.3 6.4-.6z"/>',
  owl:'<path d="M7 3C4 5 3 8 3 11a5 5 0 0 0 5 5M17 3c3 2 4 5 4 8a5 5 0 0 1-5 5"/><circle cx="9" cy="12" r="2.3"/><circle cx="15" cy="12" r="2.3"/><path d="M12 14v3M9 21l3-2.5L15 21"/>',
};
function icon(name, opts) {
  const body = ICONS[name] || ICONS.sparkle;
  // Always keep the base "icon" class (or an explicit override) so the
  // stroke/fill/linecap rules from styles.css still apply — a custom
  // opts.size only needs to override width/height/vertical-align via an
  // inline style, which wins on specificity anyway. Dropping the class
  // entirely (the old behavior) left multi-path outline icons like "bot"
  // or "fork" with no stroke at all, rendering as a filled-black blob
  // instead of the intended line art.
  const cls = (opts && opts.cls) ? opts.cls : 'icon';
  const style = opts && opts.size ? ` style="width:${opts.size}px;height:${opts.size}px;vertical-align:-${Math.round(opts.size * 0.18)}px"` : '';
  return `<svg class="${cls}"${style} viewBox="0 0 24 24">${body}</svg>`;
}

// --- Shared chunk-hover rendering ---------------------------------------
// Any screen that shows a target-language sentence paired with its native
// translation as aligned {target, native} chunks (see generate-extensive-
// passage and generate-vocab-batch — both ask the model for this shape, and
// both derive their flat sentence strings by joining chunk text) can use
// these three helpers to render bump-on-hover spans instead of writing the
// wiring again per page. Originally lived only in reading.html; pulled out
// here once vocab.html needed the same behavior for example sentences.

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Wraps each chunk of the TARGET side in an "rl-chunk" span (itself
// containing "rl-word" spans, individually addressable so a per-word TTS
// onboundary highlighter can still work alongside this) and each chunk of
// the NATIVE side in a matching "rl-chunk" span. Both sides share a
// data-align id per chunk, which is all wireChunkHover() needs to bump the
// right pair on hover. sIdx should be unique per sentence rendered
// concurrently in the DOM (e.g. the sentence's index in a passage, or just
// 0 for a single-sentence card) so data-align ids never collide.
function sentenceToChunkedSpansHTML(chunks, sIdx) {
  let charPos = 0;
  const targetParts = [];
  const nativeParts = [];
  chunks.forEach((c, cIdx) => {
    if (cIdx > 0) charPos += 1; // the joining space between chunks
    const alignId = `s${sIdx}-c${cIdx}`;
    let wordsHTML = '';
    let lastLocal = 0;
    const wordRe = /\S+/g;
    let m;
    while ((m = wordRe.exec(c.target))) {
      wordsHTML += escapeHtml(c.target.slice(lastLocal, m.index));
      wordsHTML += `<span class="rl-word" data-start="${charPos + m.index}">${escapeHtml(m[0])}</span>`;
      lastLocal = m.index + m[0].length;
    }
    wordsHTML += escapeHtml(c.target.slice(lastLocal));
    targetParts.push(`<span class="rl-chunk" data-align="${alignId}">${wordsHTML}</span>`);
    nativeParts.push(`<span class="rl-chunk" data-align="${alignId}">${escapeHtml(c.native || '')}</span>`);
    charPos += c.target.length;
  });
  return { targetHTML: targetParts.join(' '), nativeHTML: nativeParts.join(' ') };
}

// Groups every .rl-chunk currently in the DOM by its data-align id and
// wires hover so entering either side of a pair bumps/bolds both. Call
// after every re-render that includes chunked spans.
function wireChunkHover() {
  const groups = {};
  document.querySelectorAll('.rl-chunk').forEach(el => {
    (groups[el.dataset.align] = groups[el.dataset.align] || []).push(el);
  });
  Object.values(groups).forEach(els => {
    els.forEach(el => {
      el.addEventListener('mouseenter', () => els.forEach(e => e.classList.add('rl-chunk-hover')));
      el.addEventListener('mouseleave', () => els.forEach(e => e.classList.remove('rl-chunk-hover')));
    });
  });
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
// AVATARS is the full illustrated-character catalog (20 yaks). Which one a
// given user displays is no longer a free pick — see "Yak Evolution" below,
// which maps cumulative XP to one of 10 of these characters in an unlocked-
// through-practice progression. yakAvatarHTML() itself just draws whichever
// avatarId it's handed, plus a tiered corner badge for how far up the CEFR
// waypoints the user has climbed and a few small medal chips for other
// earned badges — that layer is independent of which yak is shown. The
// images live in avatars/<file> (transparent PNGs, already cropped to a
// square canvas), referenced with a plain relative path since this is a
// static site with no build step / asset hashing.
const AVATARS = [
  { id: 'superhero', nameKey: 'av.superhero', file: 'avatars/superhero.png' },
  { id: 'chef', nameKey: 'av.chef', file: 'avatars/chef.png' },
  { id: 'skier', nameKey: 'av.skier', file: 'avatars/skier.png' },
  { id: 'punk', nameKey: 'av.punk', file: 'avatars/punk.png' },
  { id: 'astronaut', nameKey: 'av.astronaut', file: 'avatars/astronaut.png' },
  { id: 'cowboy', nameKey: 'av.cowboy', file: 'avatars/cowboy.png' },
  { id: 'detective', nameKey: 'av.detective', file: 'avatars/detective.png' },
  { id: 'yogi', nameKey: 'av.yogi', file: 'avatars/yogi.png' },
  { id: 'dj', nameKey: 'av.dj', file: 'avatars/dj.png' },
  { id: 'pirate', nameKey: 'av.pirate', file: 'avatars/pirate.png' },
  { id: 'barista', nameKey: 'av.barista', file: 'avatars/barista.png' },
  { id: 'biker', nameKey: 'av.biker', file: 'avatars/biker.png' },
  { id: 'disco', nameKey: 'av.disco', file: 'avatars/disco.png' },
  { id: 'gamer', nameKey: 'av.gamer', file: 'avatars/gamer.png' },
  { id: 'lifeguard', nameKey: 'av.lifeguard', file: 'avatars/lifeguard.png' },
  { id: 'painter', nameKey: 'av.painter', file: 'avatars/painter.png' },
  { id: 'samurai', nameKey: 'av.samurai', file: 'avatars/samurai.png' },
  { id: 'scientist', nameKey: 'av.scientist', file: 'avatars/scientist.png' },
  { id: 'scuba', nameKey: 'av.scuba', file: 'avatars/scuba.png' },
  { id: 'wizard', nameKey: 'av.wizard', file: 'avatars/wizard.png' },
];

const WAYPOINT_ORDER = ['waypoint_pre_a1', 'waypoint_a1', 'waypoint_a2', 'waypoint_b1', 'waypoint_b2', 'waypoint_c1', 'waypoint_c2'];
const CROWN_TIERS = {
  bronze: { fill: '#B08D57', stroke: '#8A6B3D' },
  silver: { fill: '#D6DBE0', stroke: '#9AA0A8' },
  gold: { fill: '#FFD75E', stroke: '#C9A227' },
};

// Renders a yak avatar as inline HTML: a circular photo with a gentle idle
// bob/sway animation (CSS, see .yak-avatar-idle in styles.css — the images
// are static illustrations, this is what gives them "slight movement"),
// a small corner badge for CEFR waypoint tier (since each illustration's
// composition is too different to place a crown "on the head" reliably
// the way the old SVG design could), and a row of medal emoji beneath for
// up to 3 other earned badges (with a "+N" overflow chip). badgeCodes is
// the user's full list of earned user_badges.badge_code values.
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

  const crownBadge = crownTier ? `
    <span style="position:absolute;top:-3px;right:-3px;width:${Math.round(size * 0.42)}px;height:${Math.round(size * 0.42)}px;border-radius:999px;background:${CROWN_TIERS[crownTier].fill};border:2px solid ${CROWN_TIERS[crownTier].stroke};display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 2px 5px rgba(0,0,0,.25);">${icon('crown', { size: Math.max(10, Math.round(size * 0.26)) })}</span>` : '';

  // Small per-instance randomized negative delay so multiple avatars on
  // the same screen (e.g. a Basecamp leaderboard) don't bob in lockstep.
  const delay = (-(Math.random() * 3)).toFixed(2);

  return `
    <div style="display:inline-flex;flex-direction:column;align-items:center;">
      <div style="position:relative;width:${size}px;height:${size}px;flex-shrink:0;">
        <div class="yak-avatar-idle" style="width:100%;height:100%;border-radius:50%;overflow:hidden;background:var(--card-2);display:flex;align-items:center;justify-content:center;">
          <img src="${a.file}" alt="${a.nameKey ? t(a.nameKey) : a.id}" style="width:114%;height:114%;object-fit:cover;animation-delay:${delay}s;" />
        </div>
        ${crownBadge}
      </div>
      ${medalIcons.length ? `
        <div style="display:flex;gap:3px;margin-top:3px;color:var(--accent-ink);">
          ${medalIcons.map(ic => icon(ic, { size: Math.max(10, Math.round(size * 0.22)) })).join('')}
          ${extra > 0 ? `<span style="font-size:${Math.max(9, Math.round(size * 0.18))}px;color:var(--text-faint);align-self:center;">+${extra}</span>` : ''}
        </div>` : ''}
    </div>`;
}

// --- Yak Evolution ---------------------------------------------------
// Replaces the old free-pick avatar system: nobody chooses their yak
// anymore, they earn the next one. 10 stages, ordered from an everyday
// "just getting started" persona up to a mythic one, each unlocked at a
// cumulative-XP threshold. Thresholds are hand-tuned rather than derived
// from a formula: early stages come quickly (a few sessions) so new users
// see the system move right away, then the gap widens so the later stages
// stay aspirational — Wizard Yak is meant to take real, sustained practice
// (months, not a weekend), which is the point of using it as a motivator.
// Titles/taglines/descriptions are flavor copy and intentionally
// English-only, same as BADGES above — not run through t().
const YAK_EVOLUTION = [
  { level: 1, avatarId: 'barista', title: 'Barista Yak', tagline: 'everyday hustle', desc: 'Up at 5am, steaming milk, perfecting latte art. Grounded, warm, and reliably caffeinated.', minXp: 0 },
  { level: 2, avatarId: 'lifeguard', title: 'Lifeguard Yak', tagline: 'community helper', desc: 'Whistle ready, eyes on the horizon. First to help, last to leave the beach.', minXp: 60 },
  { level: 3, avatarId: 'painter', title: 'Painter Yak', tagline: 'creative spark', desc: 'Splatters, palettes, and big ideas. Sees color where others see blank walls.', minXp: 150 },
  { level: 4, avatarId: 'scuba', title: 'Scuba Yak', tagline: 'explorer', desc: 'Down the rabbit hole — or reef. Curious enough to breathe underwater for answers.', minXp: 280 },
  { level: 5, avatarId: 'gamer', title: 'Gamer Yak', tagline: 'digital warrior', desc: 'RGB-lit focus, clutch reflexes. Boss fights are just Tuesday practice.', minXp: 450 },
  { level: 6, avatarId: 'biker', title: 'Biker Yak', tagline: 'rebel', desc: "Leather jacket, engine hum. Doesn't follow the road — carves it.", minXp: 700 },
  { level: 7, avatarId: 'disco', title: 'Disco Yak', tagline: 'showman', desc: 'Mirrorball moment. Enters a room and the room levels up instantly.', minXp: 1000 },
  { level: 8, avatarId: 'scientist', title: 'Mad Scientist Yak', tagline: 'genius', desc: "Lab coat fizzing, goggles fogged. 99% chaos, 1% breakthrough — that's the formula.", minXp: 1400 },
  { level: 9, avatarId: 'samurai', title: 'Samurai Yak', tagline: 'legendary warrior', desc: 'Blade still, breath steady. Honor over hype. Legends whisper his name.', minXp: 1900 },
  { level: 10, avatarId: 'wizard', title: 'Wizard Yak', tagline: 'extraordinary / mythic', desc: 'Staff cracked reality open. No longer climbing — rewriting the ladder itself.', minXp: 2500 },
];

// Highest stage whose minXp the learner has cleared. YAK_EVOLUTION is
// already in ascending-level order, so this is just "last one that fits."
function currentEvolutionStage(xp) {
  xp = xp || 0;
  let stage = YAK_EVOLUTION[0];
  for (const s of YAK_EVOLUTION) {
    if (xp >= s.minXp) stage = s;
    else break;
  }
  return stage;
}

// The stage after the current one, or null if already at the top
// (Wizard Yak, level 10) — used to render "N XP to go" progress UI.
function nextEvolutionStage(xp) {
  const current = currentEvolutionStage(xp);
  return YAK_EVOLUTION.find(s => s.level === current.level + 1) || null;
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
