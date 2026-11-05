// All analysis lives here as pure functions over plain data.
import { addDays, diffDays, mean, median, weekStart, weekdayIndex } from './util.js';

// Epley estimate of a one-rep max.
export function e1rm(weight, reps) {
  if (!(weight > 0) || !(reps > 0)) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export const workSets = (entry) => (entry?.sets || []).filter((s) => s.done && !s.warmup && s.reps > 0);
export const hasWork = (session) => !!session?.entries?.some((e) => workSets(e).length);
export const sortedSessions = (sessions) =>
  Object.values(sessions).sort((a, b) => (a.date < b.date ? -1 : 1));

// One row per session an exercise was trained in, oldest first. score is the
// number progress is judged by: estimated 1RM, or best reps for bodyweight work.
// timeIds holds timed exercises (plank, stretching, treadmill). Their "reps" field is a
// duration, so they get no load volume and are scored on duration, times speed if logged.
export function buildHistories(sessionList, timeIds = new Set()) {
  const map = new Map();
  for (const session of sessionList) {
    for (const entry of session.entries || []) {
      const sets = workSets(entry);
      if (!sets.length) continue;
      const isTime = timeIds.has(entry.exerciseId);
      let topWeight = 0;
      let topReps = 0;
      let best = 0;
      let bestReps = 0;
      let bestTime = 0;
      let volume = 0;
      for (const s of sets) {
        const w = s.weight || 0;
        if (w > topWeight || (w === topWeight && s.reps > topReps)) {
          topWeight = w;
          topReps = s.reps;
        }
        best = Math.max(best, e1rm(w, s.reps));
        bestReps = Math.max(bestReps, s.reps);
        bestTime = Math.max(bestTime, (w || 1) * s.reps);
        if (!isTime) volume += w * s.reps;
      }
      if (!map.has(entry.exerciseId)) map.set(entry.exerciseId, []);
      map.get(entry.exerciseId).push({ date: session.date, sets, topWeight, topReps, e1rm: best, bestReps, bestTime, volume, count: sets.length });
    }
  }
  for (const [id, hist] of map) {
    const isTime = timeIds.has(id);
    const weighted = !isTime && hist.some((h) => h.topWeight > 0);
    let bestSoFar = 0;
    hist.forEach((h, i) => {
      h.score = isTime ? h.bestTime : weighted ? h.e1rm : h.bestReps;
      h.pr = i > 0 && h.score > bestSoFar;
      bestSoFar = Math.max(bestSoFar, h.score);
    });
    hist.weighted = weighted;
    hist.isTime = isTime;
  }
  return map;
}

// The score of a single set, on the same scale as its exercise's history.
export function setScore(hist, weight, reps) {
  if (hist.isTime) return (weight || 1) * reps;
  return hist.weighted ? e1rm(weight, reps) : reps;
}

// Compares the last three sessions with the three before them.
export function exerciseTrend(hist, onDate) {
  const last = hist[hist.length - 1];
  let lastPrIndex = 0;
  hist.forEach((h, i) => {
    if (h.pr) lastPrIndex = i;
  });
  const sessionsSincePr = hist.length - 1 - lastPrIndex;
  const base = { sessionsSincePr, daysSincePr: diffDays(last.date, hist[lastPrIndex].date), daysSinceLast: diffDays(onDate, last.date) };
  if (hist.length < 4) return { status: 'new', pct: null, stalled: false, ...base };
  const recent = hist.slice(-3).map((h) => h.score);
  const prior = hist.slice(-6, -3).map((h) => h.score);
  const pct = (mean(recent) / mean(prior) - 1) * 100;
  const status = pct >= 1 ? 'up' : pct <= -2 ? 'down' : 'flat';
  return { status, pct, stalled: sessionsSincePr >= 4 && status !== 'up', ...base };
}

// How strong each session was against that exercise's recent normal (100 = normal).
export function performanceByDate(histories) {
  const byDate = {};
  for (const hist of histories.values()) {
    if (hist.isTime) continue;
    hist.forEach((h, i) => {
      if (i < 2) return;
      const baseline = median(hist.slice(Math.max(0, i - 5), i).map((x) => x.score));
      if (baseline > 0) (byDate[h.date] ||= []).push((h.score / baseline) * 100);
    });
  }
  return Object.fromEntries(Object.entries(byDate).map(([d, r]) => [d, mean(r)]));
}

function trackerValue(entry, tracker) {
  if (!entry?.values || !Object.keys(entry.values).length) return null;
  const v = entry.values[tracker.id];
  if (tracker.type === 'check') return v ? 1 : 0;
  if (tracker.type === 'count') return v ?? 0;
  return v ?? null;
}

const variance = (a) => {
  const m = mean(a);
  return a.length > 1 ? a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1) : 0;
};

export const MIN_GROUP = 4;

// Splits training days into high and low for a habit and compares performance.
export function habitImpact(perf, daily, tracker) {
  const rows = [];
  for (const [date, score] of Object.entries(perf)) {
    const value = trackerValue(daily[date], tracker);
    if (value != null) rows.push({ value, score });
  }
  const none = { enough: false, samples: rows.length };
  if (rows.length < MIN_GROUP * 2) return none;
  const med = tracker.type === 'check' ? 1 : median(rows.map((r) => r.value));
  let hi = rows.filter((r) => r.value >= med);
  let lo = rows.filter((r) => r.value < med);
  let split = 'gte';
  if (!lo.length) {
    hi = rows.filter((r) => r.value > med);
    lo = rows.filter((r) => r.value <= med);
    split = 'gt';
  }
  if (hi.length < MIN_GROUP || lo.length < MIN_GROUP) return none;
  const sHi = hi.map((r) => r.score);
  const sLo = lo.map((r) => r.score);
  const diff = mean(sHi) - mean(sLo);
  const se = Math.sqrt(variance(sHi) / sHi.length + variance(sLo) / sLo.length);
  return { enough: true, split, threshold: med, nHi: hi.length, nLo: lo.length, diff, strong: se > 0 && Math.abs(diff) / se >= 2 };
}

export function weeklySeries(sessionList, from, to, timeIds = new Set()) {
  const weeks = [];
  const index = new Map();
  for (let w = weekStart(from); w <= to; w = addDays(w, 7)) {
    const row = { week: w, sessions: 0, volume: 0, sets: 0 };
    weeks.push(row);
    index.set(w, row);
  }
  for (const session of sessionList) {
    if (session.date < from || session.date > to || !hasWork(session)) continue;
    const row = index.get(weekStart(session.date));
    row.sessions += 1;
    for (const entry of session.entries) {
      if (timeIds.has(entry.exerciseId)) continue;
      for (const s of workSets(entry)) {
        row.sets += 1;
        row.volume += (s.weight || 0) * s.reps;
      }
    }
  }
  return weeks;
}

export function periodTotals(sessionList, from, to, timeIds = new Set()) {
  const total = { sessions: 0, volume: 0, sets: 0 };
  for (const w of weeklySeries(sessionList, from, to, timeIds)) {
    total.sessions += w.sessions;
    total.volume += w.volume;
    total.sets += w.sets;
  }
  return total;
}

// dates must be sorted ascending.
export function attendanceStats(dates, onDate) {
  const set = new Set(dates.map(weekStart));
  let streak = 0;
  let w = weekStart(onDate);
  if (!set.has(w)) w = addDays(w, -7); // a quiet current week hasn't broken the streak yet
  while (set.has(w)) {
    streak += 1;
    w = addDays(w, -7);
  }
  let longestGap = 0;
  for (let i = 1; i < dates.length; i++) longestGap = Math.max(longestGap, diffDays(dates[i], dates[i - 1]));
  return { streakWeeks: streak, longestGap, daysSinceLast: dates.length ? diffDays(onDate, dates[dates.length - 1]) : null };
}

// Weekday assignment wins. Otherwise the program follows a cycle of training days and
// rest days, counted on from the last logged session so picking another day re-anchors it.
export function suggestDay(days, sessionList, date, cycle) {
  if (!days.length) return null;
  if (days.some((d) => d.weekdays?.length)) {
    return days.find((d) => d.weekdays?.includes(weekdayIndex(date)))?.id ?? null;
  }
  const len = days.length + (cycle?.rest || 0);
  for (let i = sessionList.length - 1; i >= 0; i--) {
    const s = sessionList[i];
    if (s.date >= date || !hasWork(s)) continue;
    const at = days.findIndex((d) => d.id === s.dayId);
    if (at >= 0) return days[(at + (cycle ? diffDays(date, s.date) : 1)) % len]?.id ?? null;
  }
  if (!cycle) return days[0].id;
  if (date < cycle.start) return null;
  return days[diffDays(date, cycle.start) % len]?.id ?? null;
}

// Training days of a repeating cycle between two dates, inclusive.
export function planDates(start, from, to, len, rest) {
  const out = [];
  for (let d = from < start ? start : from; d <= to; d = addDays(d, 1)) {
    if (diffDays(d, start) % len < len - rest) out.push(d);
  }
  return out;
}

// Combines the owner's reported history with what the app has logged since.
export function journeyStats(journey, cycle, dayCount, attended, onDate) {
  const { homeFrom, gymFrom, planEnd, planLen, planRest, missed } = journey;
  const reported = planDates(gymFrom, gymFrom, planEnd, planLen, planRest);
  const len = dayCount + (cycle?.rest || 0) || planLen;
  const rest = cycle?.rest ?? planRest;
  const going = new Set(attended.filter((d) => d > planEnd && d <= onDate));
  // Today only counts once it's done; it isn't a miss while the day is still open.
  const due = planDates(cycle?.start || gymFrom, addDays(planEnd, 1), addDays(onDate, -1), len, rest);
  const planned = reported.length + new Set([...due, ...going]).size;
  const missedSince = due.filter((d) => !going.has(d)).length;
  const sessions = reported.length - missed + going.size;
  return {
    dayNumber: diffDays(onDate, homeFrom) + 1,
    homeDays: diffDays(gymFrom, homeFrom),
    gymDays: diffDays(onDate, gymFrom) + 1,
    planned,
    sessions,
    missed: missed + missedSince,
    adherence: planned ? (sessions / planned) * 100 : null,
  };
}
