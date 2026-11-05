// Which regions of the 3D body each exercise trains, and how many sets they get. Pure, no DOM.
import { workSets } from './stats.js';

export const REGIONS = {
  chest: 'سینه',
  frontDelt: 'سرشانه جلو',
  sideDelt: 'سرشانه کنار',
  rearDelt: 'سرشانه پشت',
  biceps: 'جلوبازو',
  triceps: 'پشت‌بازو',
  forearm: 'ساعد',
  abs: 'شکم',
  obliques: 'پهلو',
  traps: 'ذوزنقه',
  lats: 'زیربغل',
  lowerBack: 'فیله کمر',
  glutes: 'باسن',
  quads: 'جلو پا',
  hamstrings: 'پشت پا',
  calves: 'ساق',
};

// [primary regions, secondary regions]. Secondary work counts as half a set.
const BY_NAME = {
  'نشر خم دمبل خوابیده': [['rearDelt'], ['traps']],
  'سرشانه دمبل جفت پرس': [['frontDelt', 'sideDelt'], ['triceps', 'traps']],
  'فلای برعکس': [['rearDelt'], ['traps']],
  'جلوبازو دمبل جفت خوابیده': [['biceps'], ['forearm']],
  'جلوبازو دستگاه نشسته': [['biceps'], []],
  'پنجه دستگاه': [['forearm'], []],
  'زیر شکم دراگون': [['abs'], ['obliques']],
  'پلانک': [['abs'], ['obliques']],
  'پشت پا نشسته': [['hamstrings'], []],
  'جلو پا با ماشین': [['quads'], []],
  'پرس پا خوابیده': [['quads', 'glutes'], ['hamstrings']],
  'پشت بازو طناب تکیه': [['triceps'], []],
  'پشت بازو دمبل تک دو دستی': [['triceps'], []],
  'ساق ایستاده دستگاه': [['calves'], []],
  'مولتی بالا دستگاه نشسته': [['chest'], ['frontDelt', 'triceps']],
  'قفسه فلای دستگاه': [['chest'], ['frontDelt']],
  'بارفیکس کمکی': [['lats'], ['biceps', 'traps']],
  'زیربغل دوبل جمع از بالا': [['lats'], ['biceps']],
  'H جفت نشسته': [['lats', 'traps'], ['biceps', 'rearDelt']],
  'پول آور ارنج صاف دمبل': [['lats'], ['triceps']],
};

// New exercises fall back to the muscle chosen for them in the program editor.
const BY_MUSCLE = {
  'سینه': [['chest'], ['frontDelt', 'triceps']],
  'پشت': [['lats'], ['biceps', 'traps']],
  'پا': [['quads', 'hamstrings', 'glutes'], []],
  'ساق': [['calves'], []],
  'سرشانه': [['frontDelt', 'sideDelt', 'rearDelt'], []],
  'جلوبازو': [['biceps'], ['forearm']],
  'پشت‌بازو': [['triceps'], []],
  'ساعد': [['forearm'], []],
  'شکم': [['abs'], ['obliques']],
};

export const regionsFor = (ex) => BY_NAME[ex?.name] || BY_MUSCLE[ex?.muscle] || [[], []];

function addSets(load, ex, sets) {
  const [primary, secondary] = regionsFor(ex);
  const put = (region, amount, role) => {
    const row = (load[region] ||= { sets: 0, exercises: {} });
    row.sets += amount;
    const item = (row.exercises[ex.name] ||= { sets: 0, role });
    item.sets += amount;
  };
  primary.forEach((r) => put(r, sets, 'primary'));
  secondary.forEach((r) => put(r, sets / 2, 'secondary'));
}

function scaled(load, factor) {
  for (const row of Object.values(load)) {
    row.sets *= factor;
    Object.values(row.exercises).forEach((e) => (e.sets *= factor));
  }
  return load;
}

// Sets of one program day, as they are.
export function dayLoad(day, exercises) {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const load = {};
  for (const item of day?.items || []) addSets(load, byId.get(item.exerciseId), item.sets || 0);
  return load;
}

// Sets per week the program gives each region, across its cycle of training and rest days.
export function programLoad(days, exercises, rest = 0) {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const load = {};
  for (const day of days) {
    for (const item of day.items) addSets(load, byId.get(item.exerciseId), item.sets || 0);
  }
  const len = days.length + rest;
  return len ? scaled(load, 7 / len) : load;
}

// Sets per week actually logged between two dates.
export function loggedLoad(sessionList, exercises, from, to, weeks) {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const load = {};
  for (const session of sessionList) {
    if (session.date < from || session.date > to) continue;
    for (const entry of session.entries || []) {
      const n = workSets(entry).length;
      if (n) addSets(load, byId.get(entry.exerciseId), n);
    }
  }
  return scaled(load, 1 / Math.max(weeks, 1));
}

export const LEVEL_LIMITS = [5, 10, 15];
export function levelOf(sets) {
  if (!(sets > 0)) return 0;
  const i = LEVEL_LIMITS.findIndex((limit) => sets < limit);
  return i === -1 ? 4 : i + 1;
}
