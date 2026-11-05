import { LEVEL_LIMITS, REGIONS, dayLoad, levelOf, loggedLoad, programLoad } from './body-map.js';
import { faceBody, syncBody } from './body.js';
import { barChart, heatmap, lineChart, resetCharts, tableView } from './charts.js';
import { MIN_GROUP, attendanceStats, buildHistories, exerciseTrend, habitImpact, hasWork, journeyStats, performanceByDate, periodTotals, planDates, suggestDay, weeklySeries } from './stats.js';
import { activeTrackers, attendedDates, exerciseById, kindOf, sessionList, setText, state, timeIds } from './store.js';
import { app, icons } from './ui.js';
import { addDays, diffDays, esc, fmt, fmtCompact, fmtShort, mean, today, weekStart } from './util.js';

const RANGES = [
  [30, '۳۰ روز'],
  [90, '۳ ماه'],
  [180, '۶ ماه'],
  [365, '۱ سال'],
  [0, 'همه'],
];
const SECTIONS = [
  ['overview', 'نمای کلی'],
  ['body', 'بدن'],
  ['exercises', 'حرکت‌ها'],
  ['habits', 'عادت‌ها'],
];
const BODY_MODES = [
  ['program', 'برنامه هفتگی'],
  ['today', 'امروز'],
  ['logged', 'ثبت‌شده'],
];
const view = { section: 'overview', range: 90, exercise: null, tracker: null, bodyMode: 'program', region: null };

const chartWidth = () => Math.min(innerWidth, 560) - 64;

function tile(label, value, delta) {
  return `<div class="tile"><span>${esc(label)}</span><strong>${value}</strong>${delta || ''}</div>`;
}

function deltaText(now, before) {
  if (!before) return '';
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

// Everything derived from the current range, shared by the sections.
function collect() {
  const end = today();
  const { journey, cycle } = state.settings;
  const worked = sessionList().filter(hasWork);
  const logged = attendedDates();
  const timed = timeIds();
  const from = view.range ? addDays(end, -(view.range - 1)) : journey.homeFrom;
  const spanDays = diffDays(end, from) + 1;
  const reported = planDates(journey.gymFrom, journey.gymFrom, journey.planEnd, journey.planLen, journey.planRest);
  const union = [...new Set([...reported, ...logged])].sort();
  return {
    end,
    from,
    spanDays,
    worked,
    logged,
    timed,
    reported,
    union,
    weeksCount: Math.max(1, spanDays / 7),
    histories: buildHistories(worked, timed),
    journey: journeyStats(journey, cycle, state.days.length, logged, end),
  };
}

function journeyCard(c) {
  const j = c.journey;
  const { homeFrom, gymFrom } = state.settings.journey;
  return `<section class="card journey">
    <div class="journey-top">
      <div><span>پایبندی به برنامه</span><strong>${fmt(j.adherence)}٪</strong></div>
      <div class="journey-day"><span>روز</span><b>${fmt(j.dayNumber)}</b><span>از شروع</span></div>
    </div>
    <p class="journey-sum">${fmt(j.sessions)} جلسه از ${fmt(j.planned)} جلسه برنامه، ${fmt(j.missed)} غیبت</p>
    <div class="timeline" role="img" aria-label="${fmt(j.homeDays)} روز تمرین خانگی و ${fmt(j.gymDays)} روز باشگاه">
      <i class="home" style="flex:${j.homeDays}"></i><i class="gym" style="flex:${j.gymDays}"></i>
    </div>
    <div class="timeline-labels">
      <div><span class="key home"></span><b>خانه: ${fmt(j.homeDays)} روز</b><small>کشش، انعطاف و کاردیو، هر روز</small><small>از ${esc(fmtShort(homeFrom))}</small></div>
      <div><span class="key gym"></span><b>باشگاه: ${fmt(j.gymDays)} روز</b><small>۳ روز تمرین، ۱ روز استراحت</small><small>از ${esc(fmtShort(gymFrom))}</small></div>
    </div>
  </section>`;
}

function buildInsights(c) {
  const rows = [];
  const improving = [];
  for (const [id, hist] of c.histories) {
    const name = exerciseById(id)?.name;
    if (!name || hist.isTime) continue; // a fixed 12-minute walk isn't a plateau
    const t = exerciseTrend(hist, c.end);
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
  const untrained = Object.keys(REGIONS).filter((r) => !programLoad(state.days, state.exercises, state.settings.cycle?.rest)[r]);
  if (untrained.length) {
    rows.push({ rank: 2, html: insightRow('info', 'بدون کار مستقیم در برنامه', `${untrained.map((r) => REGIONS[r]).join('، ')}. اگه عمدیه مشکلی نیست.`) });
  }
  if (c.journey.adherence >= 85) {
    rows.push({ rank: 3, html: insightRow('good', 'پایبندی خوب', `از ${fmt(c.journey.planned)} جلسه برنامه فقط ${fmt(c.journey.missed)} جلسه رو نرفتی.`) });
  }
  return rows.sort((x, y) => x.rank - y.rank).map((r) => r.html);
}

function overviewSection(c) {
  const prevTo = addDays(c.from, -1);
  const prevFrom = addDays(c.from, -c.spanDays);
  const totals = periodTotals(c.worked, c.from, c.end, c.timed);
  const prev = view.range ? periodTotals(c.worked, prevFrom, prevTo, c.timed) : null;
  const inRange = c.union.filter((d) => d >= c.from && d <= c.end);
  // The reported absences have no dates, so they're spread evenly over the reported days.
  const reportedInRange = c.reported.filter((d) => d >= c.from).length;
  const missedShare = c.reported.length ? (state.settings.journey.missed * reportedInRange) / c.reported.length : 0;
  const sessionsInRange = inRange.length - missedShare;
  const att = attendanceStats(c.union, c.end);
  const prs = [...c.histories.values()].flat().filter((h) => h.pr && h.date >= c.from).length;
  const weeks = weeklySeries(c.worked, c.from, c.end, c.timed);
  const width = chartWidth();
  // The rate and the weekly chart only make sense from the day the gym started.
  const gymFrom = state.settings.journey.gymFrom;
  const gymWeeks = Math.max(1, (diffDays(c.end, c.from > gymFrom ? c.from : gymFrom) + 1) / 7);
  const weekRows = [];
  for (let w = weeks[0].week > weekStart(gymFrom) ? weeks[0].week : weekStart(gymFrom); w <= c.end; w = addDays(w, 7)) {
    const count = c.union.filter((d) => d >= w && d < addDays(w, 7)).length;
    weekRows.push({ date: w, value: count, tip: `هفته ${fmtShort(w)}: ${fmt(count)} جلسه` });
  }
  const planSet = new Set(c.reported);
  const loggedSet = new Set(c.logged);
  const homeTo = addDays(state.settings.journey.gymFrom, -1);
  const cellKind = (d) => (loggedSet.has(d) ? 'on' : planSet.has(d) ? 'plan' : d >= state.settings.journey.homeFrom && d <= homeTo ? 'home' : '');
  const heatWeeks = Math.min(26, Math.max(14, Math.ceil(diffDays(c.end, state.settings.journey.homeFrom) / 7) + 1));
  const insights = buildInsights(c);
  const hasVolume = weeks.some((w) => w.volume > 0);

  return `<div class="tiles">
      ${tile('جلسه در هفته', fmt(sessionsInRange / gymWeeks))}
      ${tile('هفته‌های پیاپی', fmt(att.streakWeeks))}
      ${tile('حجم ثبت‌شده (کیلو)', fmtCompact(totals.volume), prev ? deltaText(totals.volume, prev.volume) : '')}
      ${tile('رکورد جدید', fmt(prs))}
    </div>

    <section class="card">
      <h2>عیب‌یابی</h2>
      ${insights.length ? `<ul class="insights">${insights.join('')}</ul>` : ''}
      ${c.histories.size ? '' : '<p class="muted">روند هر حرکت از وقتی شروع می‌شه که ست‌ها رو ثبت کنی. برای تشخیص توقف یا افت، حداقل ۴ جلسه از هر حرکت لازمه.</p>'}
    </section>

    <section class="card">
      <h2>تقویم تمرین</h2>
      ${heatmap(cellKind, c.end, heatWeeks)}
      <h3>جلسه در هر هفته</h3>
      ${barChart({ bars: weekRows.slice(-26), width, label: 'جلسه در هر هفته', format: fmt })}
      <p class="caption">روزهای «طبق برنامه» از چرخه تمرینت حساب شدن. تاریخ ${fmt(state.settings.journey.missed)} غیبتت مشخص نیست، پس این نمودار ممکنه تا همین اندازه بیشتر از واقعیت نشون بده.</p>
    </section>

    ${hasVolume ? `<section class="card">
      <h2>حجم هفتگی (کیلو)</h2>
      ${barChart({ bars: weeks.slice(-26).map((w) => ({ date: w.week, value: w.volume, tip: `هفته ${fmtShort(w.week)}: ${fmt(w.volume)} کیلو، ${fmt(w.sets)} ست` })), width, label: 'حجم هفتگی' })}
      ${tableView(['هفته', 'جلسه', 'ست', 'حجم'], [...weeks].reverse().map((w) => [fmtShort(w.week), fmt(w.sessions), fmt(w.sets), fmt(w.volume)]))}
    </section>` : ''}`;
}

const todayDay = (c) => {
  const session = state.sessions[c.end];
  const id = session ? session.dayId : suggestDay(state.days, sessionList(), c.end, state.settings.cycle);
  return state.days.find((d) => d.id === id) || null;
};

function bodyLoad(c) {
  if (view.bodyMode === 'today') return { load: dayLoad(todayDay(c), state.exercises), unit: 'ست' };
  if (view.bodyMode === 'logged') return { load: loggedLoad(c.worked, state.exercises, c.from, c.end, c.weeksCount), unit: 'ست در هفته' };
  return { load: programLoad(state.days, state.exercises, state.settings.cycle?.rest), unit: 'ست در هفته' };
}

function bodyCaption(c) {
  if (view.bodyMode === 'today') {
    const day = todayDay(c);
    return day ? `تمرین امروز: ${day.name}` : 'امروز طبق چرخه روز استراحته.';
  }
  if (view.bodyMode === 'logged') return 'فقط ست‌هایی که توی اپ ثبت کردی، در بازه انتخاب‌شده.';
  return 'کل برنامه فعلیت، با حساب چرخه ۳ روز تمرین و ۱ روز استراحت.';
}

function bodySection(c) {
  const { load, unit } = bodyLoad(c);
  const ranked = Object.entries(load).sort((a, b) => b[1].sets - a[1].sets);
  const max = Math.max(1, ...ranked.map(([, r]) => r.sets));
  const idle = Object.keys(REGIONS).filter((r) => !load[r]);
  const picked = view.region && REGIONS[view.region] ? view.region : null;
  const row = picked ? load[picked] : null;
  const [a, b, d] = LEVEL_LIMITS;
  const exerciseRows = row
    ? Object.entries(row.exercises)
        .sort((x, y) => y[1].sets - x[1].sets)
        .map(([name, e]) => `<li><span>${esc(name)}${e.role === 'secondary' ? ' <small>کمکی</small>' : ''}</span><b>${fmt(e.sets)}</b></li>`)
        .join('')
    : '';
  return `<section class="card body-card">
    <div class="segments small" role="group" aria-label="داده روی بدن">${BODY_MODES.map(([k, l]) => `<button aria-pressed="${view.bodyMode === k}" data-act="body-mode" data-mode="${k}">${l}</button>`).join('')}</div>
    <p class="caption">${esc(bodyCaption(c))}</p>
    <div id="body3d" class="body-stage">
      <div class="body-face">
        <button class="btn small" data-act="body-face" data-side="front">جلو</button>
        <button class="btn small" data-act="body-face" data-side="back">پشت</button>
      </div>
    </div>
    <div class="heat-legend" aria-label="راهنمای رنگ">
      ${[['0', 'بدون کار'], ['1', `زیر ${fmt(a)}`], ['2', `${fmt(a)}–${fmt(b)}`], ['3', `${fmt(b)}–${fmt(d)}`], ['4', `${fmt(d)}+`]].map(([n, l]) => `<span><i style="background:var(--heat-${n})"></i>${l}</span>`).join('')}
      <small>${esc(unit)}</small>
    </div>
    <div class="body-detail" aria-live="polite">
      ${picked ? `<h2>${esc(REGIONS[picked])}</h2>
        ${row ? `<p class="body-sets"><b>${fmt(row.sets)}</b> ${esc(unit)}</p><ul class="body-list">${exerciseRows}</ul>` : '<p class="muted">توی این نما کار مستقیمی نداره.</p>'}`
        : '<p class="muted">مدل رو با کشیدن بچرخون و روی هر عضله بزن تا حرکت‌هاش رو ببینی.</p>'}
    </div>
  </section>

  <section class="card">
    <h2>حجم هر عضله</h2>
    ${ranked.length ? `<div class="hbars">${ranked.map(([r, v]) => `<button class="hbar" data-act="body-pick" data-region="${r}" aria-pressed="${r === picked}"><span>${esc(REGIONS[r])}</span><div><i style="width:${(v.sets / max) * 100}%;background:var(--heat-${levelOf(v.sets)})"></i></div><b>${fmt(v.sets)}</b></button>`).join('')}</div>
      <p class="caption">حرکت‌های کمکی نصف یک ست حساب شدن. عددها ${esc(unit)} هستن.</p>` : '<p class="muted">توی این نما داده‌ای نیست.</p>'}
    ${idle.length && ranked.length ? `<p class="caption">بدون کار: ${idle.map((r) => REGIONS[r]).join('، ')}</p>` : ''}
  </section>`;
}

function exerciseSection(c) {
  const { histories, from } = c;
  const ids = [...histories.keys()].filter((id) => exerciseById(id));
  if (!ids.length) {
    return '<div class="card empty"><h2>هنوز ستی ثبت نشده</h2><p>از اولین ستی که توی تب تمرین ثبت کنی، نمودار هر حرکت اینجا شکل می‌گیره.</p><a class="btn primary" href="#workout">رفتن به تمرین امروز</a></div>';
  }
  if (!ids.includes(view.exercise)) {
    view.exercise = ids.reduce((a, b) => (histories.get(a).at(-1).date >= histories.get(b).at(-1).date ? a : b));
  }
  const all = histories.get(view.exercise);
  const hist = all.filter((h) => h.date >= from);
  const best = all.reduce((a, b) => (b.score > a.score ? b : a));
  const t = exerciseTrend(all, c.end);
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
        points: hist.map((h) => ({ date: h.date, y: h.score, mark: h.pr, tip: `${fmtShort(h.date)}: ${fmt(h.score)}${h.pr ? '، رکورد' : ''} (${setText(ex, { weight: h.topWeight, reps: h.topReps })})` })),
        width,
        label: `${scoreLabel} ${ex.name}`,
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
        <small>${r.strong ? 'سیگنال روشن' : 'هنوز قطعی نیست'}، مقایسه ${fmt(r.nHi)} و ${fmt(r.nLo)} جلسه</small></div>`,
    });
  }
  out.sort((a, b) => b.size - a.size);
  return { rows: out.map((r) => r.html), waiting, total };
}

function habitSection(c) {
  const { from, end } = c;
  const habits = habitRows(c.histories);
  const trackers = activeTrackers();
  if (!trackers.some((t) => t.id === view.tracker)) view.tracker = trackers[0]?.id;
  const t = trackers.find((x) => x.id === view.tracker);
  let body = '';
  if (t) {
    const entries = Object.values(state.daily)
      .filter((d) => d.date >= from && d.date <= end && d.values?.[t.id] != null)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const width = chartWidth();
    const unit = t.unit || '';
    body = '<p class="muted">توی این بازه چیزی ثبت نکردی.</p>';
    if (entries.length) {
      if (t.type === 'number' || t.type === 'scale') {
        const vals = entries.map((e) => e.values[t.id]);
        body = `<div class="tiles">
          ${tile('میانگین', `${fmt(mean(vals))} <small>${esc(unit)}</small>`)}
          ${tile('تغییر در بازه', `${vals.at(-1) - vals[0] >= 0 ? '+' : '−'}${fmt(Math.abs(vals.at(-1) - vals[0]))} <small>${esc(unit)}</small>`)}
        </div>
        ${lineChart({ points: entries.map((e) => ({ date: e.date, y: e.values[t.id], tip: `${fmtShort(e.date)}: ${fmt(e.values[t.id])} ${unit}` })), width, label: t.name, format: fmt })}`;
      } else {
        const firstDay = entries[0].date;
        const weeks = [];
        for (let w = addDays(firstDay, -((new Date(`${firstDay}T12:00`).getDay() + 1) % 7)); w <= end; w = addDays(w, 7)) weeks.push(w);
        const sumFor = (w) => entries.filter((e) => e.date >= w && e.date < addDays(w, 7)).reduce((n, e) => n + (t.type === 'check' ? 1 : e.values[t.id]), 0);
        const days = Math.max(1, diffDays(end, firstDay) + 1);
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
  }
  return `<section class="card">
      <h2>اثر عادت‌ها روی قدرتت</h2>
      ${habits.rows.length ? `${habits.rows.join('')}
        <p class="caption">قدرت هر جلسه نسبت به میانگین اخیر خودت سنجیده می‌شه. این مقایسه هم‌زمانی رو نشون می‌ده و اثبات علت نیست.</p>` : ''}
      ${habits.waiting ? `<p class="muted">${habits.rows.length ? `${fmt(habits.waiting)} مورد دیگه هنوز داده کافی نداره. ` : ''}برای هر مقایسه حداقل ${fmt(MIN_GROUP)} جلسه در هر گروه لازمه. الان ${fmt(habits.total)} جلسه قابل سنجش داری.</p>` : ''}
    </section>
    ${t ? `<section class="card"><h2>روند عادت‌ها و بدن</h2>
      <select class="wide" aria-label="انتخاب مورد" data-change="stats-tracker">${trackers.map((x) => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      ${body}
    </section>` : ''}`;
}

export function dashboardView() {
  resetCharts();
  const c = collect();
  const showRange = view.section !== 'body' || view.bodyMode === 'logged';
  const content = { overview: overviewSection, body: bodySection, exercises: exerciseSection, habits: habitSection }[view.section](c);
  return `<div class="page-head"><h1>آمار و روند</h1><a class="icon-btn" href="#settings" aria-label="تنظیمات">${icons.gear}</a></div>
    ${journeyCard(c)}
    <div class="segments" role="group" aria-label="بخش آمار">${SECTIONS.map(([k, l]) => `<button aria-pressed="${view.section === k}" data-act="stats-section" data-section="${k}">${l}</button>`).join('')}</div>
    ${showRange ? `<div class="chips" role="group" aria-label="بازه زمانی">${RANGES.map(([d, l]) => `<button class="chip" aria-pressed="${view.range === d}" data-act="stats-range" data-n="${d}">${l}</button>`).join('')}</div>` : ''}
    ${content}`;
}

// Runs after each render; the 3D figure needs its container to exist in the page.
export function afterDashboard() {
  const host = document.getElementById('body3d');
  if (!host) return;
  const { load } = bodyLoad(collect());
  const levels = Object.fromEntries(Object.keys(REGIONS).map((r) => [r, levelOf(load[r]?.sets)]));
  syncBody(host, {
    levels,
    picked: view.region,
    pick: (region) => {
      view.region = region;
      app.render();
    },
  }).then((ok) => {
    if (!ok && host.isConnected) host.innerHTML = '<p class="muted pad center">این دستگاه مدل سه‌بعدی رو پشتیبانی نمی‌کنه. فهرست عضلات پایین همون اطلاعات رو داره.</p>';
  });
}

export const dashboardActions = {
  'stats-range': (el) => {
    view.range = Number(el.dataset.n);
    app.render();
  },
  'stats-section': (el) => {
    view.section = el.dataset.section;
    app.render();
  },
  'body-mode': (el) => {
    view.bodyMode = el.dataset.mode;
    app.render();
  },
  'body-pick': (el) => {
    view.region = el.dataset.region;
    app.render();
    document.querySelector('.body-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  'body-face': (el) => faceBody(el.dataset.side === 'front'),
  'ex-stats': (el) => {
    view.exercise = el.dataset.ex;
    view.section = 'exercises';
    location.hash = '#stats';
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
