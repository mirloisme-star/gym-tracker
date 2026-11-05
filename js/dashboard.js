import { barChart, heatmap, lineChart, resetCharts, tableView } from './charts.js';
import { MIN_GROUP, attendanceStats, buildHistories, exerciseTrend, habitImpact, hasWork, muscleSets, performanceByDate, periodTotals, weeklySeries } from './stats.js';
import { activeTrackers, attendedDates, exerciseById, kindOf, sessionList, setText, state, timeIds } from './store.js';
import { app, icons } from './ui.js';
import { addDays, diffDays, esc, fmt, fmtCompact, fmtShort, mean, today } from './util.js';

const RANGES = [
  [30, '۳۰ روز'],
  [90, '۳ ماه'],
  [180, '۶ ماه'],
  [365, '۱ سال'],
  [0, 'همه'],
];
const view = { range: 90, exercise: null, tracker: null };

const chartWidth = () => Math.min(innerWidth, 560) - 64;

function tile(label, value, delta) {
  return `<div class="tile"><span>${esc(label)}</span><strong>${value}</strong>${delta || ''}</div>`;
}

function deltaText(now, before) {
  if (!before) return '<small class="delta">دوره قبل داده‌ای نیست</small>';
  const pct = (now / before - 1) * 100;
  const dir = Math.abs(pct) < 0.5 ? 'flat' : pct > 0 ? 'up' : 'down';
  const arrow = { up: '▲', down: '▼', flat: '●' }[dir];
  return `<small class="delta ${dir}">${arrow} ${fmt(Math.abs(pct))}٪ نسبت به دوره قبل</small>`;
}

function insightRow(kind, title, detail) {
  const icon = { good: icons.good, warn: icons.alert, info: icons.info }[kind];
  const tag = { good: 'خوب', warn: 'نیاز به توجه', info: 'نکته' }[kind];
  return `<li class="insight ${kind}">${icon}<div><strong>${esc(title)}</strong><p>${esc(detail)}</p><small>${tag}</small></div></li>`;
}

function buildInsights(histories, dates, from, end) {
  const rows = [];
  const improving = [];
  for (const [id, hist] of histories) {
    const name = exerciseById(id)?.name;
    if (!name || hist.isTime) continue; // a fixed 12-minute walk isn't a plateau
    const t = exerciseTrend(hist, end);
    if (t.daysSinceLast > 30) continue;
    if (t.status === 'down') {
      rows.push({ rank: 0, html: insightRow('warn', `افت در ${name}`, `میانگین ۳ جلسه آخر ${fmt(Math.abs(t.pct))}٪ پایین‌تر از ۳ جلسه قبلشه.`) });
    } else if (t.stalled) {
      rows.push({ rank: 1, html: insightRow('warn', `توقف در ${name}`, `${fmt(t.sessionsSincePr)} جلسه است رکوردت رو نزدی (${fmt(t.daysSincePr)} روز).`) });
    } else if (t.status === 'up') {
      improving.push({ name, pct: t.pct });
    }
  }
  // Problems get a row each; progress is one summary row so it doesn't bury them.
  if (improving.length) {
    const top = improving.sort((a, b) => b.pct - a.pct).slice(0, 3).map((x) => `${x.name} (${fmt(x.pct)}٪)`).join('، ');
    rows.push({ rank: 3, html: insightRow('good', `${fmt(improving.length)} حرکت در حال پیشرفت`, `بیشترین پیشرفت در ۳ جلسه آخر: ${top}`) });
  }
  const recent = dates.filter((d) => d >= addDays(end, -27)).length;
  const earlier = dates.filter((d) => d >= addDays(end, -55) && d < addDays(end, -27)).length;
  if (earlier >= 4 && recent <= earlier * 0.7) {
    rows.push({ rank: 0, html: insightRow('warn', 'حضور کمتر شده', `۴ هفته اخیر ${fmt(recent)} جلسه، ۴ هفته قبلش ${fmt(earlier)} جلسه.`) });
  }
  const list = dates.filter((d) => d >= from);
  const a = attendanceStats(list, end);
  if (a.longestGap >= 10) {
    rows.push({ rank: 2, html: insightRow('info', 'طولانی‌ترین وقفه', `توی این بازه ${fmt(a.longestGap)} روز پشت سر هم تمرین نداشتی.`) });
  }
  return rows.sort((x, y) => x.rank - y.rank).map((r) => r.html);
}

function habitRows(histories) {
  const perf = performanceByDate(histories);
  const total = Object.keys(perf).length;
  const out = [];
  let waiting = 0;
  for (const t of state.settings.trackers.filter((x) => !x.archived && x.id !== 'bodyweight')) {
    const r = habitImpact(perf, state.daily, t);
    if (!r.enough) {
      waiting += 1;
      continue;
    }
    const unit = t.unit ? ` ${t.unit}` : '';
    const hi = t.type === 'check' ? 'روزهای مصرف' : r.split === 'gte' ? `${fmt(r.threshold)}${unit} یا بیشتر` : `بیشتر از ${fmt(r.threshold)}${unit}`;
    const lo = t.type === 'check' ? 'روزهای بدون مصرف' : r.split === 'gte' ? `کمتر از ${fmt(r.threshold)}${unit}` : `${fmt(r.threshold)}${unit} یا کمتر`;
    const better = r.diff >= 0 ? hi : lo;
    out.push({
      size: Math.abs(r.diff),
      html: `<div class="impact-row"><strong>${esc(t.name)}</strong>
        <p>${esc(better)}: ${fmt(Math.abs(r.diff))}٪ قوی‌تر</p>
        <small>${r.strong ? 'سیگنال روشن' : 'هنوز قطعی نیست'} · مقایسه ${fmt(r.nHi)} و ${fmt(r.nLo)} جلسه</small></div>`,
    });
  }
  out.sort((a, b) => b.size - a.size);
  return { rows: out.map((r) => r.html), waiting, total };
}

function exerciseSection(histories, from) {
  const ids = [...histories.keys()].filter((id) => exerciseById(id));
  if (!ids.length) return '';
  if (!ids.includes(view.exercise)) {
    view.exercise = ids.reduce((a, b) => (histories.get(a).at(-1).date >= histories.get(b).at(-1).date ? a : b));
  }
  const all = histories.get(view.exercise);
  const hist = all.filter((h) => h.date >= from);
  const best = all.reduce((a, b) => (b.score > a.score ? b : a));
  const t = exerciseTrend(all, today());
  const statusText = { up: 'در حال پیشرفت', flat: 'ثابت', down: 'در حال افت', new: 'داده کم' }[t.status];
  const weighted = all.weighted;
  const ex = exerciseById(view.exercise);
  const scoreLabel = weighted ? '۱RM تخمینی'
    : ex.kind === 'cardio' ? 'سرعت × دقیقه'
    : all.isTime ? `بیشترین مدت (${kindOf(ex).reps})` : 'بیشترین تکرار';
  const options = ids
    .map((id) => `<option value="${id}" ${id === view.exercise ? 'selected' : ''}>${esc(exerciseById(id).name)}</option>`)
    .join('');
  const width = chartWidth();
  return `<section class="card" id="exercise-section">
    <h2>پیشرفت هر حرکت</h2>
    <select class="wide" aria-label="انتخاب حرکت" data-change="stats-exercise">${options}</select>
    <div class="tiles">
      ${tile(scoreLabel, weighted ? `${fmt(best.score)} <small>کیلو</small>` : fmt(best.score))}
      ${all.isTime ? '' : tile('بیشترین وزن', `${fmt(Math.max(...all.map((h) => h.topWeight)))} <small>کیلو</small>`)}
      ${tile('وضعیت', esc(statusText), t.pct != null ? `<small class="delta">${t.pct >= 0 ? '+' : '−'}${fmt(Math.abs(t.pct))}٪</small>` : '')}
      ${tile('جلسه از آخرین رکورد', fmt(t.sessionsSincePr))}
    </div>
    ${hist.length ? `
      <h3>${scoreLabel}</h3>
      ${lineChart({
        points: hist.map((h) => ({ date: h.date, y: h.score, mark: h.pr, tip: `${fmtShort(h.date)}: ${fmt(h.score)}${h.pr ? ' · رکورد' : ''} (${setText(ex, { weight: h.topWeight, reps: h.topReps })})` })),
        width,
        label: `${scoreLabel} ${exerciseById(view.exercise).name}`,
      })}
      <p class="caption">نقطه‌ها رکوردها هستن.</p>
      ${weighted ? `<h3>حجم هر جلسه (کیلو)</h3>${barChart({
        bars: hist.slice(-30).map((h) => ({ date: h.date, value: h.volume, tip: `${fmtShort(h.date)}: ${fmt(h.volume)} کیلو در ${fmt(h.count)} ست` })),
        width,
        tone: 'second',
        label: 'حجم هر جلسه',
      })}` : ''}
      ${tableView(['تاریخ', 'ست‌ها', scoreLabel, 'حجم'], [...hist].reverse().map((h) => [fmtShort(h.date), h.sets.map((s) => setText(ex, s)).join('، '), fmt(h.score), fmt(h.volume)]))}
    ` : '<p class="muted">توی این بازه جلسه‌ای برای این حرکت نیست.</p>'}
  </section>`;
}

function habitSection(from, end) {
  const trackers = activeTrackers();
  if (!trackers.length) return '';
  if (!trackers.some((t) => t.id === view.tracker)) view.tracker = trackers[0].id;
  const t = trackers.find((x) => x.id === view.tracker);
  const entries = Object.values(state.daily)
    .filter((d) => d.date >= from && d.date <= end && d.values?.[t.id] != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const options = trackers.map((x) => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const width = chartWidth();
  const unit = t.unit || '';
  let body = '<p class="muted">توی این بازه چیزی ثبت نکردی.</p>';
  if (entries.length) {
    if (t.type === 'number' || t.type === 'scale') {
      const vals = entries.map((e) => e.values[t.id]);
      body = `<div class="tiles">
        ${tile('میانگین', `${fmt(mean(vals))} <small>${esc(unit)}</small>`)}
        ${tile('تغییر در بازه', `${vals.at(-1) - vals[0] >= 0 ? '+' : '−'}${fmt(Math.abs(vals.at(-1) - vals[0]))} <small>${esc(unit)}</small>`)}
      </div>
      ${lineChart({ points: entries.map((e) => ({ date: e.date, y: e.values[t.id], tip: `${fmtShort(e.date)}: ${fmt(e.values[t.id])} ${unit}` })), width, label: t.name, format: fmt })}`;
    } else {
      const weeks = [];
      for (let w = addDays(from, -((new Date(`${from}T12:00`).getDay() + 1) % 7)); w <= end; w = addDays(w, 7)) weeks.push(w);
      const sumFor = (w) => entries.filter((e) => e.date >= w && e.date < addDays(w, 7)).reduce((n, e) => n + (t.type === 'check' ? 1 : e.values[t.id]), 0);
      const days = Math.max(1, diffDays(end, from) + 1);
      const total = entries.reduce((n, e) => n + (t.type === 'check' ? 1 : e.values[t.id]), 0);
      body = `<div class="tiles">
        ${t.type === 'check' ? tile('پایبندی', `${fmt((total / days) * 100)}٪`) : tile('میانگین روزانه', `${fmt(total / days)} <small>${esc(unit)}</small>`)}
        ${tile(t.type === 'check' ? 'روزهای مصرف' : 'مجموع', fmt(total))}
      </div>
      ${barChart({ bars: weeks.map((w) => ({ date: w, value: sumFor(w), tip: `هفته ${fmtShort(w)}: ${fmt(sumFor(w))} ${t.type === 'check' ? 'روز' : unit}` })), width, label: `${t.name} در هر هفته`, format: fmt })}
      <p class="caption">هر ستون یک هفته است.</p>`;
    }
    body += tableView(['تاریخ', 'مقدار'], [...entries].reverse().map((e) => [fmtShort(e.date), t.type === 'check' ? 'بله' : fmt(e.values[t.id])]));
  }
  return `<section class="card"><h2>عادت‌ها و بدن</h2>
    <select class="wide" aria-label="انتخاب مورد" data-change="stats-tracker">${options}</select>
    ${body}
  </section>`;
}

export function dashboardView() {
  resetCharts();
  const end = today();
  const sessions = sessionList();
  const worked = sessions.filter(hasWork);
  const dates = attendedDates();
  const anything = dates.length || Object.keys(state.daily).length;
  const head = `<div class="page-head"><h1>آمار و روند</h1><a class="icon-btn" href="#settings" aria-label="تنظیمات">${icons.gear}</a></div>`;
  if (!anything) {
    return `${head}<div class="card empty"><h2>هنوز داده‌ای نیست</h2><p>بعد از اولین تمرین یا ثبت روزانه، آمار اینجا شکل می‌گیره.</p></div>`;
  }
  const earliest = [dates[0], worked[0]?.date, Object.keys(state.daily).sort()[0]].filter(Boolean).sort()[0];
  const from = view.range ? addDays(end, -(view.range - 1)) : earliest;
  const spanDays = diffDays(end, from) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(from, -spanDays);
  const timed = timeIds();
  const totals = periodTotals(worked, from, end, timed);
  const prev = view.range ? periodTotals(worked, prevFrom, prevTo, timed) : null;
  const rangeDates = dates.filter((d) => d >= from);
  const prevDates = dates.filter((d) => d >= prevFrom && d <= prevTo);
  const att = attendanceStats(dates, end);
  const histories = buildHistories(worked, timed);
  const prs = [...histories.values()].flat().filter((h) => h.pr && h.date >= from).length;
  const weeks = weeklySeries(worked, from, end, timed);
  const weeksCount = Math.max(1, spanDays / 7);
  const width = chartWidth();

  const insights = buildInsights(histories, dates, from, end);
  const habits = habitRows(histories);
  const muscles = Object.entries(muscleSets(worked, state.exercises, from, end, timed)).sort((a, b) => b[1] - a[1]);
  const maxMuscle = Math.max(1, ...muscles.map((m) => m[1]));

  return `${head}
    <div class="chips" role="group" aria-label="بازه زمانی">${RANGES.map(([d, l]) => `<button class="chip" aria-pressed="${view.range === d}" data-act="stats-range" data-n="${d}">${l}</button>`).join('')}</div>

    <section class="hero card">
      <span>جلسه در هفته</span>
      <strong>${fmt(rangeDates.length / weeksCount)}</strong>
      ${prev ? deltaText(rangeDates.length, prevDates.length) : ''}
      <small>${fmt(rangeDates.length)} حضور در این بازه${att.daysSinceLast != null ? ` · ${att.daysSinceLast === 0 ? 'آخرین حضور امروز' : `آخرین حضور ${fmt(att.daysSinceLast)} روز پیش`}` : ''}</small>
    </section>
    <div class="tiles">
      ${tile('حجم کل (کیلو)', fmtCompact(totals.volume), prev ? deltaText(totals.volume, prev.volume) : '')}
      ${tile('ست‌های کاری', fmt(totals.sets), prev ? deltaText(totals.sets, prev.sets) : '')}
      ${tile('رکورد جدید', fmt(prs))}
      ${tile('هفته‌های پیاپی', fmt(att.streakWeeks))}
    </div>

    <section class="card">
      <h2>عیب‌یابی</h2>
      ${insights.length ? `<ul class="insights">${insights.join('')}</ul>` : '<p class="muted">مشکلی پیدا نشد. برای تشخیص روند هر حرکت حداقل ۴ جلسه ثبت لازمه.</p>'}
      <h3>اثر عادت‌ها روی قدرتت</h3>
      ${habits.rows.length ? `${habits.rows.join('')}
        <p class="caption">قدرت هر جلسه نسبت به میانگین اخیر خودت سنجیده می‌شه. این مقایسه هم‌زمانی رو نشون می‌ده و اثبات علت نیست.</p>` : ''}
      ${habits.waiting ? `<p class="muted">${habits.rows.length ? `${fmt(habits.waiting)} مورد دیگه هنوز داده کافی نداره.` : ''} برای هر مقایسه حداقل ${fmt(MIN_GROUP)} جلسه در هر گروه لازمه. الان ${fmt(habits.total)} جلسه قابل سنجش داری.</p>` : ''}
    </section>

    <section class="card">
      <h2>حضور در باشگاه</h2>
      ${heatmap(dates, end)}
      <h3>جلسه در هر هفته</h3>
      ${barChart({ bars: weeks.slice(-26).map((w) => ({ date: w.week, value: w.sessions, tip: `هفته ${fmtShort(w.week)}: ${fmt(w.sessions)} جلسه` })), width, label: 'جلسه در هر هفته', format: fmt })}
    </section>

    <section class="card">
      <h2>حجم هفتگی (کیلو)</h2>
      ${barChart({ bars: weeks.slice(-26).map((w) => ({ date: w.week, value: w.volume, tip: `هفته ${fmtShort(w.week)}: ${fmt(w.volume)} کیلو، ${fmt(w.sets)} ست` })), width, label: 'حجم هفتگی' })}
      ${tableView(['هفته', 'جلسه', 'ست', 'حجم'], [...weeks].reverse().map((w) => [fmtShort(w.week), fmt(w.sessions), fmt(w.sets), fmt(w.volume)]))}
    </section>

    ${exerciseSection(histories, from)}

    ${muscles.length ? `<section class="card">
      <h2>ست کاری هر عضله در هفته</h2>
      <div class="hbars">${muscles.map(([m, n]) => `<div class="hbar"><span>${esc(m)}</span><div><i style="width:${(n / maxMuscle) * 100}%"></i></div><b>${fmt(n / weeksCount)}</b></div>`).join('')}</div>
    </section>` : ''}

    ${habitSection(from, end)}`;
}

export const dashboardActions = {
  'stats-range': (el) => {
    view.range = Number(el.dataset.n);
    app.render();
  },
  'ex-stats': (el) => {
    view.exercise = el.dataset.ex;
    location.hash = '#stats';
    requestAnimationFrame(() => document.getElementById('exercise-section')?.scrollIntoView());
  },
};

export const dashboardChanges = {
  'stats-exercise': (el) => {
    view.exercise = el.value;
    app.render();
  },
  'stats-tracker': (el) => {
    view.tracker = el.value;
    app.render();
  },
};
