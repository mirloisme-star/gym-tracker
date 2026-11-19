// The daily coach message: a summary of recent training and habits goes to a language model
// through GapGPT, which writes a short, specific note. One message per day, kept on the phone.
import { attendanceStats, buildHistories, exerciseTrend, hasWork, journeyStats } from './stats.js';
import { activeTrackers, attendedDates, exerciseById, saveCoach, sessionList, setText, state, timeIds } from './store.js';
import { GOALS, LEVELS } from './onboarding.js';
import { MAX_FACTS, SYSTEM, pickModel } from './coach-prompt.js';
import { addDays, today, weekStart } from './util.js';

export { pickModel };

let pending = null;
let lastError = null;

export const coachError = () => lastError;
export const coachBusy = () => !!pending;
// The shared coach worker holds the owner's key, so everyone gets a message without one.
// Someone with their own GapGPT key can use it instead, from settings.
export const COACH_URL = 'https://gym-coach.mirloisme.workers.dev/coach';
const ownKey = () => !!(state.settings.ai?.key && state.settings.ai?.model);
export const hasKey = () => ownKey() || !!COACH_URL;

// Plain facts only, so the model can't invent numbers.
export function coachFacts(onDate = today()) {
  const s = state.settings;
  const from = addDays(onDate, -13);
  const sessions = sessionList().filter((x) => hasWork(x));
  const recent = sessions.filter((x) => x.date >= from && x.date <= onDate);
  const histories = buildHistories(sessions, timeIds());
  const attended = attendedDates();
  const att = attendanceStats(attended, onDate);
  const thisWeek = attended.filter((d) => d >= weekStart(onDate) && d <= onDate).length;
  const prs = [];
  const trends = [];
  for (const [id, hist] of histories) {
    const ex = exerciseById(id);
    if (!ex) continue;
    hist.filter((h) => h.pr && h.date >= from).forEach((h) => prs.push(`${h.date}: ${ex.name} ${setText(ex, { weight: h.topWeight, reps: h.topReps })}`));
    if (!hist.isTime) {
      const t = exerciseTrend(hist, onDate);
      if (t.daysSinceLast <= 21 && t.status !== 'new') trends.push(`${ex.name}: ${t.status}${t.pct != null ? ` (${Math.round(t.pct)}%)` : ''}${t.stalled ? ', stalled' : ''}`);
    }
  }
  const habits = activeTrackers().map((t) => {
    const values = [];
    for (let d = from; d <= onDate; d = addDays(d, 1)) {
      const v = state.daily[d]?.values?.[t.id];
      if (v != null && v !== false) values.push(`${d.slice(5)}=${v === true ? 'yes' : v}`);
    }
    return `${t.name}${t.unit ? ` (${t.unit})` : ''}: ${values.join(', ') || 'not logged'}`;
  });
  const journey = s.journey ? journeyStats(s.journey, s.cycle, state.days.length, attended, onDate) : null;
  return [
    `Today: ${onDate}. User name: ${s.profile?.name || 'unknown'}. Goal: ${GOALS[s.profile?.goal]?.[0] || '-'}. Level: ${LEVELS[s.profile?.level] || '-'}.`,
    `Weekly goal: ${s.weeklyGoal} sessions. This week so far: ${thisWeek}. Week streak: ${att.streakWeeks}. Days since last session: ${att.daysSinceLast ?? 'none yet'}.`,
    journey ? `Day ${journey.dayNumber} since start. Planned sessions ${journey.planned}, done ${journey.sessions}, missed ${journey.missed}.` : '',
    `Sessions in the last 14 days (${recent.length}):`,
    ...recent.map((x) => `- ${x.date} ${state.days.find((d) => d.id === x.dayId)?.name || ''}: ${x.entries.map((e) => {
      const ex = exerciseById(e.exerciseId);
      const done = e.sets.filter((st) => st.done && !st.warmup);
      return done.length ? `${ex?.name} ${done.map((st) => setText(ex, st)).join(' ')}` : '';
    }).filter(Boolean).join('; ')}${x.note ? ` | note: ${x.note}` : ''}`),
    `Personal records in the last 14 days: ${prs.join('; ') || 'none'}.`,
    `Exercise trends (last 3 sessions vs the 3 before): ${trends.join('; ') || 'not enough data'}.`,
    'Daily habits, last 14 days:',
    ...habits.map((h) => `- ${h}`),
    `Post-workout photos taken in the last 14 days: ${Object.keys(state.photos).filter((d) => d >= from).length}.`,
  ].filter(Boolean).join('\n').replace(/[\u2066-\u2069]/g, '');
}

const API = 'https://api.gapgpt.app/v1';

class ApiError extends Error {
  constructor(status, message, shared = false) {
    super(message);
    this.status = status;
    this.shared = shared;
  }
}

async function viaWorker(facts) {
  let res;
  try {
    res = await fetch(COACH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facts: facts.slice(0, MAX_FACTS) }),
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error || res.statusText, true);
  return data.text;
}

async function call(path, { key = state.settings.ai?.key, body } = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error?.message || res.statusText);
  return data;
}

function explain(err) {
  const status = err?.status;
  if (err?.shared) {
    if (status === 0) return 'به سرور مربی وصل نشد. اینترنت رو چک کن.';
    if (status === 429) return err.message === 'ip_limit' ? 'سهم پیام امروزت تموم شده. فردا دوباره امتحان کن.' : 'سقف پیام‌های امروز مربی پر شده. فردا دوباره امتحان کن.';
    if (status === 402) return 'اعتبار مربی تموم شده و به‌زودی شارژ می‌شه.';
    return 'مربی الان در دسترس نیست. بعداً دوباره امتحان کن.';
  }
  if (status === 0) return 'به GapGPT وصل نشد. اینترنت رو چک کن.';
  if (status === 401 || status === 403) return 'کلید API معتبر نیست. از تنظیمات درستش کن.';
  if (status === 402) return 'اعتبار حساب GapGPT تموم شده. حسابت رو شارژ کن.';
  if (status === 429) return 'سرویس فعلاً شلوغه یا سقف استفاده پر شده. بعداً دوباره امتحان کن.';
  if (status) return `خطای سرویس (${status}). بعداً دوباره امتحان کن، یا از تنظیمات مدل دیگه‌ای انتخاب کن.`;
  return 'پیام امروز ساخته نشد.';
}

// Resolves to the text, or null with coachError() set.
export function generateCoach({ force = false } = {}) {
  const day = today();
  if (!hasKey()) return Promise.resolve(null);
  if (!force && state.coach?.date === day) return Promise.resolve(state.coach.text);
  if (pending) return pending;
  lastError = null;
  pending = (async () => {
    try {
      let text;
      if (ownKey()) {
        const data = await call('/chat/completions', {
          body: {
            model: state.settings.ai.model,
            messages: [
              { role: 'system', content: SYSTEM },
              { role: 'user', content: `Facts:\n${coachFacts(day)}\n\nWrite today's message.` },
            ],
          },
        });
        text = String(data?.choices?.[0]?.message?.content ?? '').trim();
      } else {
        text = String((await viaWorker(coachFacts(day))) ?? '').trim();
      }
      if (!text) throw new ApiError(500, 'empty');
      state.coach = { date: day, text, at: Date.now() };
      saveCoach();
      return text;
    } catch (err) {
      lastError = explain(err);
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

// Checks a key by listing the models it can use. Resolves to { models } or { error }.
export async function testKey(key) {
  try {
    const data = await call('/models', { key });
    const models = (data?.data || []).map((m) => m.id).filter(Boolean).sort();
    if (!models.length) return { error: 'این کلید به هیچ مدلی دسترسی نداره.' };
    return { models };
  } catch (err) {
    return { error: explain(err) };
  }
}
