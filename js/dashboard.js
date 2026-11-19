import { LEVEL_LIMITS, REGIONS, dayLoad, levelOf, loggedLoad, programLoad } from './body-map.js';
import { bodyChart } from './body-svg.js';
import { barChart, heatmap, lineChart, resetCharts, tableView } from './charts.js';
import { MIN_GROUP, attendanceStats, buildHistories, exerciseTrend, habitImpact, hasWork, journeyStats, performanceByDate, periodTotals, planDates, suggestDay, weeklySeries } from './stats.js';
import { buildFacts, movingAverage, weightSeries, weightStats } from './facts.js';
import { photoStrip } from './photo.js';
import { activeTrackers, attendedDates, ensureDaily, exerciseById, freshJourney, saveDaily, kindOf, sessionList, setText, state, timeIds } from './store.js';
import { ring } from './home.js';
import { app, icons } from './ui.js';
import { addDays, diffDays, esc, fmt, fmtCompact, fmtShort, mean, parseNum, today, weekStart } from './util.js';

const RANGES = [
  [30, '۳۰ روز'],
  [90, '۳ ماه'],
  [180, '۶ ماه'],
  [365, '۱ سال'],
  [0, 'همه'],
];
const SECTIONS = [
  ['overview', 'نمای کلی'],
  ['weight', 'وزن'],
  ['body', 'عضله‌ها'],
  ['exercises', 'حرکت‌ها'],
  ['habits', 'عادت‌ها'],
];
const BODY_MODES = [
  ['program', 'برنامه هفتگی'],
  ['today', 'امروز'],
  ['logged', 'ثبت‌شده'],
];
const view = { topic: 'all', allFacts: false, section: 'overview', range: 90, exercise: null, tracker: null, bodyMode: 'program', region: null };

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

const TOPICS = [
  ['all', 'همه'],
  ['weight', 'وزن بدن'],
  ['load', 'وزنه‌ها'],
  ['records', 'رکوردها'],
  ['compare', 'مقایسه'],
  ['habits', 'عادت‌ها'],
];
const TOPIC_ICON = { weight: 'scale', load: 'dumbbell', records: 'trophy', compare: 'chart', habits: 'daily' };

function factRow(f) {
  return `<li class="insight ${f.tone}">${icons[TOPIC_ICON[f.topic]] || icons.info}<div><strong>${esc(f.title)}</strong>${f.detail ? `<p>${esc(f.detail)}</p>` : ''}<small>${esc(TOPICS.find(([k]) => k === f.topic)[1])}${f.date ? `، ${esc(fmtShort(f.date))}` : ''}</small></div></li>`;
}

// Everything derived from the current range, shared by the sections.
// The journey is set at onboarding; this covers data restored from an unusual backup.
function journeyOf() {
  const s = state.settings;
  if (s.journey) return s.journey;
  const rest = s.cycle?.rest ?? 1;
  return freshJourney(s.profile?.createdAt || today(), state.days.length + rest, rest);
}

const cycleText = () => `${fmt(state.days.length)} روز تمرین، ${fmt(state.settings.cycle?.rest ?? 0)} روز استراحت`;

function collect() {
  const end = today();
  const journey = journeyOf();
  const { cycle } = state.settings;
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
  const { homeFrom, gymFrom } = journeyOf();
  const pct = j.adherence ?? 0;
  return `<section class="card journey">
    <div class="journey-top">
      <div class="journey-ring">${ring(pct, 100, 96, `پایبندی ${Math.round(pct)} درصد`)}<b>${j.adherence == null ? '–' : `${fmt(j.adherence)}٪`}</b></div>
      <div class="journey-text"><span>پایبندی به برنامه</span>
        <p>${fmt(j.sessions)} جلسه از ${fmt(j.planned)} جلسه برنامه${j.missed ? `، ${fmt(j.missed)} غیبت` : ''}</p>
        <div class="journey-day"><b>${fmt(j.dayNumber)}</b><span>روز از شروع</span></div></div>
    </div>
    ${j.homeDays > 0 ? `<div class="timeline" role="img" aria-label="${fmt(j.homeDays)} روز تمرین خانگی و ${fmt(j.gymDays)} روز باشگاه">
      <i class="home" style="flex:${j.homeDays}"></i><i class="gym" style="flex:${j.gymDays}"></i>
    </div>
    <div class="timeline-labels">
      <div><span class="key home"></span><b>خانه: ${fmt(j.homeDays)} روز</b><small>کشش، انعطاف و کاردیو، هر روز</small><small>از ${esc(fmtShort(homeFrom))}</small></div>
      <div><span class="key gym"></span><b>باشگاه: ${fmt(j.gymDays)} روز</b><small>${esc(cycleText())}</small><small>از ${esc(fmtShort(gymFrom))}</small></div>
    </div>` : ''}
  </section>`;
}

function factsCard(c) {
  const all = buildFacts({
    histories: c.histories,
    names: new Map(state.exercises.map((e) => [e.id, e.name])),
    daily: state.daily,
    trackers: state.settings.trackers,
    attended: c.logged,
    today: c.end,
  });
  const topics = TOPICS.filter(([k]) => k === 'all' || all.some((f) => f.topic === k));
  if (!topics.some(([k]) => k === view.topic)) view.topic = 'all';
  const list = view.topic === 'all' ? all : all.filter((f) => f.topic === view.topic);
  const shown = view.allFacts ? list : list.slice(0, 6);
  return `<section class="card">
    <h2>${icons.spark} نکته‌ها از داده‌های تو</h2>
    ${all.length ? `${topics.length > 2 ? `<div class="chips mini" role="group" aria-label="موضوع">${topics.map(([k, l]) => `<button class="chip" aria-pressed="${view.topic === k}" data-act="facts-topic" data-topic="${k}">${l}</button>`).join('')}</div>` : ''}
      <ul class="insights">${shown.map(factRow).join('')}</ul>
      ${list.length > shown.length ? `<button class="btn ghost full small" data-act="facts-more">${fmt(list.length - shown.length)} نکته دیگه</button>` : ''}`
      : '<p class="muted">هر چی بیشتر ست، وزن بدن و عادت‌هات رو ثبت کنی، اینجا نکته‌های بیشتری از روند خودت می‌بینی: تغییر وزن، رکوردها، مقایسه حرکت‌ها و عوض شدن عادت‌ها از هفته‌ای به هفته دیگه.</p>'}
  </section>`;
}

function overviewSection(c) {
  const prevTo = addDays(c.from, -1);
  const prevFrom = addDays(c.from, -c.spanDays);
  const totals = periodTotals(c.worked, c.from, c.end, c.timed);
  const prev = view.range ? periodTotals(c.worked, prevFrom, prevTo, c.timed) : null;
  const inRange = c.union.filter((d) => d >= c.from && d <= c.end);
  // The reported absences have no dates, so they're spread evenly over the reported days.
  const reportedInRange = c.reported.filter((d) => d >= c.from).length;
  const missedShare = c.reported.length ? (journeyOf().missed * reportedInRange) / c.reported.length : 0;
  const sessionsInRange = inRange.length - missedShare;
  const att = attendanceStats(c.union, c.end);
  const prs = [...c.histories.values()].flat().filter((h) => h.pr && h.date >= c.from).length;
  const weeks = weeklySeries(c.worked, c.from, c.end, c.timed);
  const width = chartWidth();
  // The rate and the weekly chart only make sense from the day the gym started.
  const gymFrom = journeyOf().gymFrom;
  const gymWeeks = Math.max(1, (diffDays(c.end, c.from > gymFrom ? c.from : gymFrom) + 1) / 7);
  const weekRows = [];
  for (let w = weeks[0].week > weekStart(gymFrom) ? weeks[0].week : weekStart(gymFrom); w <= c.end; w = addDays(w, 7)) {
    const count = c.union.filter((d) => d >= w && d < addDays(w, 7)).length;
    weekRows.push({ date: w, value: count, tip: `هفته ${fmtShort(w)}: ${fmt(count)} جلسه` });
  }
  const planSet = new Set(c.reported);
  const loggedSet = new Set(c.logged);
  const homeTo = addDays(journeyOf().gymFrom, -1);
  const cellKind = (d) => (loggedSet.has(d) ? 'on' : planSet.has(d) ? 'plan' : d >= journeyOf().homeFrom && d <= homeTo ? 'home' : '');
  const heatWeeks = Math.min(26, Math.max(14, Math.ceil(diffDays(c.end, journeyOf().homeFrom) / 7) + 1));
  const hasVolume = weeks.some((w) => w.volume > 0);

  return `<div class="tiles">
      ${tile('جلسه در هفته', fmt(sessionsInRange / gymWeeks))}
      ${tile('هفته‌های پیاپی', fmt(att.streakWeeks))}
      ${tile('حجم ثبت‌شده (کیلو)', fmtCompact(totals.volume), prev ? deltaText(totals.volume, prev.volume) : '')}
      ${tile('رکورد جدید', fmt(prs))}
    </div>

    ${factsCard(c)}

    <section class="card">
      <h2>تقویم تمرین</h2>
      ${heatmap(cellKind, c.end, heatWeeks)}
      <h3>جلسه در هر هفته</h3>
      ${barChart({ bars: weekRows.slice(-26), width, label: 'جلسه در هر هفته', format: fmt })}
      ${journeyOf().missed ? `<p class="caption">روزهای «طبق برنامه» از چرخه تمرینت حساب شدن. تاریخ ${fmt(journeyOf().missed)} غیبتت مشخص نیست، پس این نمودار ممکنه تا همین اندازه بیشتر از واقعیت نشون بده.</p>` : ''}
    </section>

    ${hasVolume ? `<section class="card">
      <h2>حجم هفتگی (کیلو)</h2>
      ${barChart({ bars: weeks.slice(-26).map((w) => ({ date: w.week, value: w.volume, tip: `هفته ${fmtShort(w.week)}: ${fmt(w.volume)} کیلو، ${fmt(w.sets)} ست` })), width, label: 'حجم هفتگی' })}
      ${tableView(['هفته', 'جلسه', 'ست', 'حجم'], [...weeks].reverse().map((w) => [fmtShort(w.week), fmt(w.sessions), fmt(w.sets), fmt(w.volume)]))}
    </section>` : ''}

    ${Object.keys(state.photos).length ? `<section class="card"><h2>${icons.camera} عکس‌های پیشرفت</h2>${photoStrip()}</section>` : ''}`;
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
  return `کل برنامه فعلیت، با حساب چرخه ${cycleText()}.`;
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
    ${bodyChart(Object.fromEntries(Object.keys(REGIONS).map((r) => [r, levelOf(load[r]?.sets)])), picked)}
    <div class="heat-legend" aria-label="راهنمای رنگ">
      ${[['0', 'بدون کار'], ['1', `زیر ${fmt(a)}`], ['2', `${fmt(a)}–${fmt(b)}`], ['3', `${fmt(b)}–${fmt(d)}`], ['4', `${fmt(d)}+`]].map(([n, l]) => `<span><i style="background:var(--heat-${n})"></i>${l}</span>`).join('')}
      <small>${esc(unit)}</small>
    </div>
    <div class="body-detail" aria-live="polite">
      ${picked ? `<h2>${esc(REGIONS[picked])}</h2>
        ${row ? `<p class="body-sets"><b>${fmt(row.sets)}</b> ${esc(unit)}</p><ul class="body-list">${exerciseRows}</ul>` : '<p class="muted">توی این نما کار مستقیمی نداره.</p>'}`
        : '<p class="muted">روی هر عضله بزن تا تعداد ست و حرکت‌هاش رو ببینی.</p>'}
    </div>
  </section>

  <section class="card">
    <h2>حجم هر عضله</h2>
    ${ranked.length ? `<div class="hbars">${ranked.map(([r, v]) => `<button class="hbar" data-act="body-pick" data-region="${r}" aria-pressed="${r === picked}"><span>${esc(REGIONS[r])}</span><div><i style="width:${(v.sets / max) * 100}%;background:var(--heat-${levelOf(v.sets)})"></i></div><b>${fmt(v.sets)}</b></button>`).join('')}</div>
      <p class="caption">حرکت‌های کمکی نصف یک ست حساب شدن. عددها ${esc(unit)} هستن.</p>` : '<p class="muted">توی این نما داده‌ای نیست.</p>'}
    ${idle.length && ranked.length ? `<p class="caption">بدون کار: ${idle.map((r) => REGIONS[r]).join('، ')}</p>` : ''}
  </section>`;
}

function weightSection(c) {
  const tracker = state.settings.trackers.find((t) => t.id === 'bodyweight');
  if (!tracker || tracker.archived) {
    return '<div class="card empty"><h2>ثبت وزن خاموشه</h2><p>«وزن بدن» از لیست موارد روزانه حذف شده. از تنظیمات دوباره اضافه‌اش کن.</p><a class="btn primary" href="#settings">تنظیمات</a></div>';
  }
  const all = weightSeries(state.daily);
  const series = all.filter((p) => p.date >= c.from && p.date <= c.end);
  const todayValue = state.daily[c.end]?.values?.bodyweight;
  const input = `<section class="card weight-input">
    <div><h2>وزن امروز</h2><small class="muted">صبح، ناشتا و قبل از تمرین دقیق‌تره</small></div>
    <div class="stepper">
      <button class="icon-btn" data-act="weight-step" data-n="0.1" aria-label="بیشتر">${icons.plus}</button>
      <input class="num" inputmode="decimal" aria-label="وزن امروز به کیلو" data-change="weight-today" value="${todayValue ?? ''}" placeholder="${all.at(-1)?.y ?? 'کیلو'}">
      <button class="icon-btn" data-act="weight-step" data-n="-0.1" aria-label="کمتر">${icons.minus}</button>
    </div>
  </section>`;
  if (!all.length) return `${input}<div class="card empty"><h2>هنوز وزنی ثبت نشده</h2><p>هر چند روز یه بار وزنت رو ثبت کن تا نمودار بالا و پایین رفتنش اینجا ساخته بشه.</p></div>`;
  const span = view.range || Math.max(1, diffDays(c.end, all[0].date));
  const s = weightStats(series.length ? series : all, c.end, span);
  const avg = movingAverage(all).filter((p) => p.date >= c.from);
  const width = chartWidth();
  return `${input}
    <div class="tiles">
      ${tile('وزن فعلی', `${fmt(s.last.y)} <small>کیلو</small>`, `<small class="delta">${esc(fmtShort(s.last.date))}</small>`)}
      ${tile('تغییر در بازه', `${s.change >= 0 ? '+' : '−'}${fmt(Math.abs(s.change))} <small>کیلو</small>`, `<small class="delta">در ${fmt(s.days)} روز</small>`)}
      ${tile('کمترین', `${fmt(s.min.y)} <small>کیلو</small>`, `<small class="delta">${esc(fmtShort(s.min.date))}</small>`)}
      ${tile('بیشترین', `${fmt(s.max.y)} <small>کیلو</small>`, `<small class="delta">${esc(fmtShort(s.max.date))}</small>`)}
    </div>
    <section class="card">
      <h2>${icons.scale} روند وزن</h2>
      ${series.length ? lineChart({
        points: series.map((p) => ({ date: p.date, y: p.y, mark: true, tip: `${fmtShort(p.date)}: ${fmt(p.y)} کیلو` })),
        trend: series.length > 2 ? avg : null,
        width,
        height: 220,
        label: 'نمودار وزن بدن',
        format: fmt,
      }) : '<p class="muted">توی این بازه وزنی ثبت نشده.</p>'}
      <div class="legend"><span><i class="cell on"></i>هر بار ثبت</span>${series.length > 2 ? '<span><i class="cell home"></i>میانگین ۷ روزه</span>' : ''}</div>
      <p class="caption">وزن روزانه با آب و غذا بالا و پایین می‌ره. خط نارنجی میانگین هفتگیه و روند واقعی رو بهتر نشون می‌ده.</p>
      ${tableView(['تاریخ', 'وزن', 'تغییر'], [...series].reverse().map((p, i, arr) => [fmtShort(p.date), fmt(p.y), arr[i + 1] ? `${p.y - arr[i + 1].y >= 0 ? '+' : '−'}${fmt(Math.abs(p.y - arr[i + 1].y))}` : '–']))}
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
  const content = { overview: overviewSection, weight: weightSection, body: bodySection, exercises: exerciseSection, habits: habitSection }[view.section](c);
  return `<div class="page-head"><h1>گزارش پیشرفت</h1><a class="icon-btn" href="#settings" aria-label="تنظیمات">${icons.gear}</a></div>
    ${journeyCard(c)}
    <div class="segments" role="group" aria-label="بخش آمار">${SECTIONS.map(([k, l]) => `<button aria-pressed="${view.section === k}" data-act="stats-section" data-section="${k}">${l}</button>`).join('')}</div>
    ${showRange ? `<div class="chips" role="group" aria-label="بازه زمانی">${RANGES.map(([d, l]) => `<button class="chip" aria-pressed="${view.range === d}" data-act="stats-range" data-n="${d}">${l}</button>`).join('')}</div>` : ''}
    ${content}`;
}

export const dashboardActions = {
  'facts-topic': (el) => {
    view.topic = el.dataset.topic;
    view.allFacts = false;
    app.render();
  },
  'facts-more': () => {
    view.allFacts = true;
    app.render();
  },
  'weight-step': (el) => {
    const t = today();
    const rec = ensureDaily(t);
    const series = weightSeries(state.daily);
    const base = rec.values.bodyweight ?? series.at(-1)?.y ?? 70;
    rec.values.bodyweight = Math.max(20, Math.round((base + Number(el.dataset.n)) * 10) / 10);
    saveDaily(t);
    app.render();
  },
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
    view.region = view.region === el.dataset.region ? null : el.dataset.region;
    app.render();
    if (el.classList.contains('hbar')) document.querySelector('.body-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  'ex-stats': (el) => {
    view.exercise = el.dataset.ex;
    view.section = 'exercises';
    location.hash = '#stats';
  },
};

export const dashboardChanges = {
  'weight-today': (el) => {
    const v = parseNum(el.value);
    const rec = ensureDaily(today());
    if (v > 0) rec.values.bodyweight = v;
    else delete rec.values.bodyweight;
    saveDaily(today());
    app.render();
  },
  'stats-exercise': (el) => {
    view.exercise = el.value;
    app.render();
  },
  'stats-tracker': (el) => {
    view.tracker = el.value;
    app.render();
  },
};
