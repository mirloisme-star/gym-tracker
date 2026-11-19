// IndexedDB persistence. Everything is held in memory and written through on each change.
import { libraryEntry } from './library.js';
import { hasWork, sortedSessions } from './stats.js';
import { addDays, fmt, uid } from './util.js';

const DEFAULT_TRACKERS = [
  { id: 'coffee', name: 'قهوه', type: 'count', unit: 'فنجان' },
  { id: 'sleep', name: 'خواب دیشب', type: 'number', unit: 'ساعت', step: 0.5 },
  { id: 'bodyweight', name: 'وزن بدن', type: 'number', unit: 'کیلو', step: 0.1 },
  { id: 'energy', name: 'انرژی', type: 'scale' },
  { id: 'nutrition', name: 'کیفیت تغذیه', type: 'scale' },
];

export const MUSCLES = ['سینه', 'پشت', 'پا', 'ساق', 'سرشانه', 'جلوبازو', 'پشت‌بازو', 'ساعد', 'شکم', 'کاردیو', 'اصلاحی', 'سایر'];

// How a set is logged. For the timed kinds the set's reps field holds the duration.
export const KINDS = {
  strength: { label: 'وزن و تکرار', weight: 'کیلو', reps: 'تکرار' },
  sec: { label: 'زمانی (ثانیه)', reps: 'ثانیه' },
  min: { label: 'زمانی (دقیقه)', reps: 'دقیقه' },
  cardio: { label: 'هوازی (سرعت و دقیقه)', weight: 'سرعت', reps: 'دقیقه' },
};
export const kindOf = (ex) => KINDS[ex?.kind] || KINDS.strength;
export const timeIds = () => new Set(state.exercises.filter((e) => e.kind && e.kind !== 'strength').map((e) => e.id));

const defaultSettings = () => ({
  trackers: DEFAULT_TRACKERS,
  defaultRest: 90,
  theme: 'dark',
  lastBackupAt: null,
  profile: null, // set by onboarding; null means a first run
  journey: null,
  cycle: { start: null, rest: 1 },
  weeklyGoal: 3,
});

// The app's first user reported this history instead of logging it set by set. planEnd is
// the last day the summary covers, and the cycle start makes 14 Aban their day two.
const OWNER_JOURNEY = { homeFrom: '2026-09-11', gymFrom: '2026-10-18', planEnd: '2026-11-04', planLen: 4, planRest: 1, missed: 2 };
const OWNER_CYCLE_START = '2026-10-19';

// A journey for someone starting today: no reported history, everything is logged in the app.
export const freshJourney = (start, planLen, planRest) => ({ homeFrom: start, gymFrom: start, planEnd: addDays(start, -1), planLen, planRest, missed: 0 });

function mergeSettings(saved) {
  const defaults = defaultSettings();
  const merged = { ...defaults, ...saved, cycle: { ...defaults.cycle, ...saved?.cycle } };
  // Data from before onboarding existed belongs to the first user, whose program was seeded.
  if (saved?.seeded && !saved.profile) {
    merged.profile = { name: '', goal: 'muscle', level: 'beginner', createdAt: OWNER_JOURNEY.homeFrom };
    merged.journey = OWNER_JOURNEY;
    merged.cycle = { start: OWNER_CYCLE_START, rest: saved.cycle?.rest ?? 1 };
    merged.theme = saved.theme || 'auto';
  }
  return merged;
}

export const state = { exercises: [], days: [], settings: defaultSettings(), sessions: {}, daily: {}, photos: {}, coach: null };

let db;
let onWriteError = () => {};
export const setWriteErrorHandler = (fn) => (onWriteError = fn);

const openDb = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open('gym-tracker', 2);
    req.onupgradeneeded = (e) => {
      if (e.oldVersion < 1) {
        req.result.createObjectStore('meta');
        req.result.createObjectStore('sessions', { keyPath: 'date' });
        req.result.createObjectStore('daily', { keyPath: 'date' });
      }
      if (e.oldVersion < 2) req.result.createObjectStore('photos', { keyPath: 'date' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const getAll = (store) =>
  new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const getMeta = (key) =>
  new Promise((resolve, reject) => {
    const req = db.transaction('meta').objectStore('meta').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

function write(store, fn) {
  const tx = db.transaction(store, 'readwrite');
  fn(tx.objectStore(store));
  tx.onerror = tx.onabort = () => onWriteError(tx.error);
  return new Promise((resolve) => (tx.oncomplete = resolve));
}

export async function initStore() {
  db = await openDb();
  state.exercises = (await getMeta('exercises')) || [];
  state.days = (await getMeta('days')) || [];
  state.settings = mergeSettings(await getMeta('settings'));
  state.sessions = Object.fromEntries((await getAll('sessions')).map((s) => [s.date, s]));
  state.daily = Object.fromEntries((await getAll('daily')).map((d) => [d.date, d]));
  state.photos = Object.fromEntries((await getAll('photos')).map((p) => [p.date, p]));
  state.coach = (await getMeta('coach')) || null;
  // Without this the browser may evict the data when the phone runs low on space.
  navigator.storage?.persist?.();
}

export const saveMeta = (key) => write('meta', (s) => s.put(state[key], key));
export const saveSession = (date) => write('sessions', (s) => s.put(state.sessions[date]));
export const saveDaily = (date) => write('daily', (s) => s.put(state.daily[date]));
export const savePhoto = (date) => write('photos', (s) => s.put(state.photos[date]));
export const saveCoach = () => write('meta', (s) => s.put(state.coach, 'coach'));

export const exerciseById = (id) => state.exercises.find((e) => e.id === id);
export const enName = (ex) => ex?.en || libraryEntry(ex?.name)?.en || '';
export const sessionList = () => sortedSessions(state.sessions);

export function setText(ex, s) {
  const kind = kindOf(ex);
  if (ex?.kind === 'sec' || ex?.kind === 'min') return `${fmt(s.reps)} ${kind.reps}`;
  if (ex?.kind === 'cardio') return `${fmt(s.reps)} دقیقه با سرعت ${fmt(s.weight || 0)}`;
  return `⁦${fmt(s.weight || 0)}×${fmt(s.reps)}⁩`; // isolated so RTL text keeps weight×reps order
}

export function findOrCreateExercise(name, muscle, kind = 'strength') {
  const clean = name.trim();
  const found = state.exercises.find((e) => e.name === clean);
  if (found) return found;
  const ex = { id: uid(), name: clean, muscle: muscle || 'سایر', kind };
  state.exercises.push(ex);
  saveMeta('exercises');
  return ex;
}

export function ensureSession(date, dayId = null) {
  return (state.sessions[date] ||= { date, dayId, entries: [], note: '' });
}

export function ensureEntry(date, exerciseId, dayId) {
  const session = ensureSession(date, dayId);
  let entry = session.entries.find((e) => e.exerciseId === exerciseId);
  if (!entry) {
    entry = { exerciseId, sets: [] };
    session.entries.push(entry);
  }
  return entry;
}

export const ensureDaily = (date) => (state.daily[date] ||= { date, gym: false, values: {}, note: '' });

// A logged workout counts as attendance by itself.
export const attended = (date) => hasWork(state.sessions[date]) || !!state.daily[date]?.gym;
export const attendedDates = () => {
  const all = new Set([...Object.keys(state.sessions), ...Object.keys(state.daily)]);
  return [...all].filter(attended).sort();
};

export const activeTrackers = () => state.settings.trackers.filter((t) => !t.archived);

export function buildBackup() {
  const { exercises, days, sessions, daily, photos } = state;
  // The API key is a secret: a backup file gets shared and stored in places a key shouldn't be.
  const { ai, ...settings } = state.settings;
  return { format: 'gym-tracker-backup', version: 2, exportedAt: new Date().toISOString(), data: { exercises, days, settings, sessions, daily, photos } };
}

export function validateBackup(obj) {
  const d = obj?.data;
  if (obj?.format !== 'gym-tracker-backup' || !d) return 'این فایل بک‌آپ این اپ نیست.';
  const isMap = (x) => x && typeof x === 'object' && !Array.isArray(x);
  if (!Array.isArray(d.exercises) || !Array.isArray(d.days) || !isMap(d.settings) || !isMap(d.sessions) || !isMap(d.daily)) {
    return 'ساختار فایل بک‌آپ خراب است.';
  }
  if (Object.values(d.sessions).some((s) => !s.date || !Array.isArray(s.entries))) return 'جلسه‌های تمرین داخل فایل خراب هستند.';
  return null;
}

export async function restoreBackup(obj) {
  const d = obj.data;
  const photos = d.photos && typeof d.photos === 'object' ? d.photos : {};
  // Keep this phone's API key; backups never carry one.
  const settings = { ...d.settings, ai: state.settings.ai };
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['meta', 'sessions', 'daily', 'photos'], 'readwrite');
    tx.objectStore('meta').clear();
    tx.objectStore('sessions').clear();
    tx.objectStore('daily').clear();
    tx.objectStore('photos').clear();
    tx.objectStore('meta').put(d.exercises, 'exercises');
    tx.objectStore('meta').put(d.days, 'days');
    tx.objectStore('meta').put(settings, 'settings');
    Object.values(d.sessions).forEach((s) => tx.objectStore('sessions').put(s));
    Object.values(d.daily).forEach((x) => tx.objectStore('daily').put(x));
    Object.values(photos).forEach((x) => tx.objectStore('photos').put(x));
    tx.oncomplete = resolve;
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
  state.exercises = d.exercises;
  state.days = d.days;
  state.settings = mergeSettings(settings);
  state.sessions = d.sessions;
  state.daily = d.daily;
  state.photos = photos;
  state.coach = null;
}
