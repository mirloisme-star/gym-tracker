// Plain facts drawn from the user's own logs: weight, loads, records, how exercises compare and
// how habits moved week to week. Pure, no DOM, so it runs under the tests.
import { exerciseTrend } from './stats.js';
import { addDays, diffDays, fmt, mean } from './util.js';


// Recent window [today-6, today] against the 7 days before it. A rolling week reads the same
// on any weekday, unlike a calendar week that is nearly empty on Saturday.
function windows(today) {
  return { recent: [addDays(today, -6), today], prev: [addDays(today, -13), addDays(today, -7)] };
}
const inside = (d, [a, b]) => d >= a && d <= b;
const pct = (now, before) => (before ? (now / before - 1) * 100 : null);
const signed = (n, unit = '') => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n))}${unit}`;

// Body-weight entries, oldest first.
export function weightSeries(daily, trackerId = 'bodyweight') {
  return Object.values(daily)
    .filter((d) => typeof d.values?.[trackerId] === 'number' && d.values[trackerId] > 0)
    .map((d) => ({ date: d.date, y: d.values[trackerId] }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// A trailing average over the entries of the last `days` days, for a steadier weight line.
export function movingAverage(series, days = 7) {
  return series.map((p) => {
    const win = series.filter((q) => q.date <= p.date && diffDays(p.date, q.date) < days);
    return { date: p.date, y: mean(win.map((q) => q.y)) };
  });
}

export function weightStats(series, today, span = 30) {
  if (!series.length) return null;
  const last = series.at(-1);
  const from = addDays(today, -span);
  const base = [...series].reverse().find((p) => p.date <= from) || series[0];
  const ys = series.map((p) => p.y);
  return {
    last,
    base,
    change: last.y - base.y,
    days: diffDays(last.date, base.date),
    min: series.find((p) => p.y === Math.min(...ys)),
    max: series.find((p) => p.y === Math.max(...ys)),
    count: series.length,
  };
}

function weightFacts(series, today) {
  const out = [];
  const s = weightStats(series, today);
  if (!s || s.count < 2) return out;
  if (s.days > 0) {
    const dir = Math.abs(s.change) < 0.2 ? 'ثابت موند' : s.change < 0 ? `${fmt(Math.abs(s.change))} کیلو کم شد` : `${fmt(s.change)} کیلو زیاد شد`;
    out.push({ topic: 'weight', tone: 'info', rank: 2, title: `وزنت در ${fmt(s.days)} روز ${dir}`, detail: `از ${fmt(s.base.y)} به ${fmt(s.last.y)} کیلو.` });
  }
  // A one-day swing this big is mostly water and food, worth saying so before it worries anyone.
  let jump = null;
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1];
    const b = series[i];
    if (diffDays(b.date, a.date) <= 2 && diffDays(today, b.date) <= 30 && Math.abs(b.y - a.y) >= 1.5 && (!jump || Math.abs(b.y - a.y) > Math.abs(jump.d))) jump = { d: b.y - a.y, date: b.date };
  }
  if (jump) out.push({ topic: 'weight', tone: 'info', rank: 4, title: `تغییر ناگهانی وزن: ${signed(jump.d, ' کیلو')}`, detail: 'تغییرهای یکی‌دو روزه بیشتر آب و غذای بدنه تا چربی یا عضله. به روند هفتگی نگاه کن.', date: jump.date });
  return out;
}

function loadFacts(histories, names, today) {
  const out = [];
  const { recent, prev } = windows(today);
  let volNow = 0;
  let volBefore = 0;
  let heaviest = null;
  let prsMonth = 0;
  let prsPrevMonth = 0;
  let lastPr = null;
  let jump = null;
  let drop = null;
  const progress = [];
  for (const [id, hist] of histories) {
    const name = names.get(id);
    if (!name || hist.isTime) continue;
    hist.forEach((h, i) => {
      if (inside(h.date, recent)) volNow += h.volume;
      if (inside(h.date, prev)) volBefore += h.volume;
      if (hist.weighted && (!heaviest || h.topWeight > heaviest.w)) heaviest = { w: h.topWeight, reps: h.topReps, name, date: h.date };
      if (!h.pr) return;
      const age = diffDays(today, h.date);
      if (age < 30) prsMonth += 1;
      else if (age < 60) prsPrevMonth += 1;
      if (!lastPr || h.date > lastPr.date) lastPr = { name, date: h.date, h };
      const before = Math.max(...hist.slice(0, i).map((x) => x.score));
      const gain = pct(h.score, before);
      if (age < 30 && gain >= 10 && (!jump || gain > jump.gain)) jump = { name, gain, date: h.date };
    });
    // A sharp fall in the latest session against the three before it.
    const last = hist.at(-1);
    if (hist.length >= 4 && diffDays(today, last.date) <= 14) {
      const ref = Math.max(...hist.slice(-4, -1).map((x) => x.score));
      const loss = pct(last.score, ref);
      if (loss <= -12 && (!drop || loss < drop.loss)) drop = { name, loss, date: last.date };
    }
    // Progress over the last 60 days, for comparing exercises with each other.
    const window = hist.filter((h) => diffDays(today, h.date) <= 60);
    if (hist.weighted && window.length >= 3 && window[0].score > 0) progress.push({ name, gain: pct(window.at(-1).score, window[0].score), n: window.length });
    const t = exerciseTrend(hist, today);
    if (t.stalled && t.daysSinceLast <= 21) out.push({ topic: 'records', tone: 'warn', rank: 1, title: `${name}: ${fmt(t.sessionsSincePr)} جلسه بدون رکورد`, detail: 'وزنه، تکرار یا استراحت بین ست‌ها رو کمی تغییر بده تا از درجا زدن دربیای.' });
  }
  if (volNow || volBefore) {
    const change = pct(volNow, volBefore);
    if (volBefore && change != null && Math.abs(change) >= 5) {
      out.push({ topic: 'load', tone: change > 0 ? 'good' : 'info', rank: 2, title: `حجم تمرین ${fmt(Math.abs(change))}٪ ${change > 0 ? 'بیشتر' : 'کمتر'} از هفته قبل`, detail: `${fmt(volNow)} کیلو در ۷ روز اخیر، در برابر ${fmt(volBefore)} کیلو در ۷ روز قبلش.` });
    } else if (volNow && !volBefore) {
      out.push({ topic: 'load', tone: 'good', rank: 3, title: `${fmt(volNow)} کیلو حجم در ۷ روز اخیر`, detail: 'هفته قبلش تمرین وزنه‌ای ثبت نشده بود.' });
    }
  }
  if (heaviest?.w > 0) out.push({ topic: 'load', tone: 'info', rank: 5, title: `سنگین‌ترین وزنه‌ات: ${fmt(heaviest.w)} کیلو`, detail: `${heaviest.name}، ${fmt(heaviest.reps)} تکرار.`, date: heaviest.date });
  if (prsMonth || prsPrevMonth) {
    const more = prsMonth - prsPrevMonth;
    out.push({ topic: 'records', tone: prsMonth ? 'good' : 'warn', rank: 2, title: `${fmt(prsMonth)} رکورد در ۳۰ روز اخیر`, detail: prsPrevMonth ? `${more >= 0 ? `${fmt(more)} تا بیشتر` : `${fmt(-more)} تا کمتر`} از ۳۰ روز قبلش.${lastPr ? ` آخرینش: ${lastPr.name}.` : ''}` : lastPr ? `آخرینش: ${lastPr.name}.` : '' });
  }
  if (jump) out.push({ topic: 'records', tone: 'good', rank: 1, title: `جهش در ${jump.name}: ${fmt(jump.gain)}٪ بالاتر از رکورد قبلی`, detail: 'یه پرش بزرگ یکباره. اگه فرم حرکت درست بود، سطح جدیدت همینه.', date: jump.date });
  if (drop) out.push({ topic: 'records', tone: 'warn', rank: 1, title: `افت ناگهانی در ${drop.name}: ${fmt(Math.abs(drop.loss))}٪`, detail: 'جلسه آخر خیلی پایین‌تر از سه جلسه قبلش بود. خواب، تغذیه یا خستگی رو چک کن.', date: drop.date });
  if (progress.length >= 2) {
    progress.sort((a, b) => b.gain - a.gain);
    const best = progress[0];
    const worst = progress.at(-1);
    out.push({ topic: 'compare', tone: 'info', rank: 3, title: `بیشترین پیشرفت: ${best.name} (${signed(best.gain, '٪')})`, detail: `کمترین پیشرفت در ۶۰ روز اخیر: ${worst.name} (${signed(worst.gain, '٪')}).` });
  }
  return out;
}

function habitFacts(daily, trackers, attended, today) {
  const out = [];
  const { recent, prev } = windows(today);
  const sessionsNow = attended.filter((d) => inside(d, recent)).length;
  const sessionsBefore = attended.filter((d) => inside(d, prev)).length;
  if (sessionsNow !== sessionsBefore && (sessionsNow || sessionsBefore)) {
    out.push({ topic: 'habits', tone: sessionsNow > sessionsBefore ? 'good' : 'warn', rank: 2, title: `${fmt(sessionsNow)} جلسه در ۷ روز اخیر`, detail: `هفته قبلش ${fmt(sessionsBefore)} جلسه بود.` });
  }
  for (const t of trackers) {
    if (t.archived || t.id === 'bodyweight') continue;
    const days = (win) => {
      const vals = [];
      for (let d = win[0]; d <= win[1]; d = addDays(d, 1)) {
        const v = daily[d]?.values?.[t.id];
        if (v != null && v !== false) vals.push(v === true ? 1 : v);
      }
      return vals;
    };
    const now = days(recent);
    const before = days(prev);
    const unit = t.unit ? ` ${t.unit}` : '';
    if (t.type === 'check') {
      if (Math.abs(now.length - before.length) >= 2) out.push({ topic: 'habits', tone: now.length > before.length ? 'good' : 'warn', rank: 3, title: `${t.name}: ${fmt(now.length)} روز از ۷ روز اخیر`, detail: `هفته قبلش ${fmt(before.length)} روز.` });
      continue;
    }
    if (now.length < 2 || before.length < 2) continue;
    const a = mean(now);
    const b = mean(before);
    const diff = a - b;
    const notable = t.type === 'scale' ? Math.abs(diff) >= 0.7 : t.type === 'count' ? Math.abs(diff) >= 0.75 : Math.abs(diff) >= Math.max(0.5, Math.abs(b) * 0.1);
    if (!notable) continue;
    const label = t.type === 'scale' ? 'امتیاز' : 'میانگین';
    out.push({ topic: 'habits', tone: 'info', rank: 3, title: `${t.name}: ${label} ${fmt(a)}${unit} در ۷ روز اخیر`, detail: `${fmt(Math.abs(diff))}${unit} ${diff > 0 ? 'بیشتر' : 'کمتر'} از هفته قبلش (${fmt(b)}${unit}).` });
  }
  return out;
}

export function buildFacts({ histories, names, daily, trackers, attended, today }) {
  const weightTracker = trackers.find((t) => t.id === 'bodyweight' && !t.archived);
  return [
    ...(weightTracker ? weightFacts(weightSeries(daily), today) : []),
    ...loadFacts(histories, names, today),
    ...habitFacts(daily, trackers, attended, today),
  ].sort((a, b) => a.rank - b.rank);
}
