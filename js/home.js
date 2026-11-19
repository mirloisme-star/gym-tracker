// Home: the coach's note, this week at a glance and today's workout.
import { REGIONS, regionsFor } from './body-map.js';
import { coachBusy, coachError, generateCoach, hasKey } from './coach.js';
import { weightSeries, weightStats } from './facts.js';
import { photoButton } from './photo.js';
import { attendanceStats, buildHistories, hasWork, suggestDay, workSets } from './stats.js';
import { attended, attendedDates, exerciseById, sessionList, setText, state, timeIds } from './store.js';
import { app, icons, toast } from './ui.js';
import { WEEKDAYS, addDays, esc, fmt, fmtCompact, fmtDay, fmtLong, fmtShort, today, weekStart } from './util.js';

export function ring(value, goal, size = 112, label = '') {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const pct = goal ? Math.min(1, value / goal) : 0;
  return `<svg class="ring-chart" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}">
    <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}"/>
    <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

// Everything that describes one finished (or ongoing) session.
export function sessionSummary(date) {
  const session = state.sessions[date];
  if (!hasWork(session)) return null;
  const timed = timeIds();
  const before = buildHistories(sessionList().filter((s) => s.date < date), timed);
  let sets = 0;
  let volume = 0;
  let prs = 0;
  const regions = new Set();
  const times = [];
  for (const entry of session.entries) {
    const work = workSets(entry);
    if (!work.length) continue;
    const ex = exerciseById(entry.exerciseId);
    regionsFor(ex)[0].forEach((r) => regions.add(r));
    sets += work.length;
    if (!timed.has(entry.exerciseId)) volume += work.reduce((n, s) => n + (s.weight || 0) * s.reps, 0);
    const hist = before.get(entry.exerciseId);
    const today = buildHistories([{ ...session, entries: [entry] }], timed).get(entry.exerciseId)?.[0];
    if (hist?.length && today && today.score > Math.max(...hist.map((h) => h.score))) prs += 1;
    entry.sets.forEach((s) => s.done && s.at && times.push(s.at));
  }
  const minutes = times.length > 1 ? Math.round((Math.max(...times) - Math.min(...times)) / 60000) : null;
  return { sets, volume, prs, minutes, regions: [...regions], exercises: session.entries.filter((e) => workSets(e).length).length };
}

function estimateMinutes(day) {
  const seconds = (day?.items || []).reduce((n, it) => {
    const ex = exerciseById(it.exerciseId);
    if (ex?.kind === 'cardio' || ex?.kind === 'min') return n + (it.repsMax || 10) * 60;
    return n + (it.sets || 1) * ((it.rest ?? state.settings.defaultRest) + 40);
  }, 0);
  return Math.round(seconds / 60);
}

function coachCard() {
  if (!hasKey()) {
    return `<a class="coach-card off" href="#settings/ai">
      <span class="coach-badge">${icons.spark} مربی هوشمند</span>
      <p>هر روز یه پیام کوتاه از روی تمرین‌ها و عادت‌هات می‌گیری که بدونی کجای مسیری و انرژی بگیری.</p>
      <span class="btn small light">فعال‌سازی ${icons.left}</span>
    </a>`;
  }
  const c = state.coach;
  const fresh = c?.date === today();
  // Joins a request already in flight, so the card fills in once it lands.
  if (!fresh && !coachError()) generateCoach().then(() => location.hash.startsWith('#home') && app.render());
  const body = fresh
    ? `<p class="coach-text">${esc(c.text)}</p>`
    : coachBusy() || !coachError()
      ? '<div class="skeleton"><i></i><i></i><i></i></div>'
      : `<p class="coach-text muted-light">${esc(coachError())}</p>`;
  return `<section class="coach-card">
    <div class="coach-head"><span class="coach-badge">${icons.spark} پیام امروز مربی</span>
      <button class="icon-btn" data-act="coach-refresh" aria-label="پیام جدید" ${coachBusy() ? 'disabled' : ''}>${icons.refresh}</button></div>
    ${body}
  </section>`;
}

function weekStrip() {
  const start = weekStart(today());
  const days = state.days;
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const isToday = d === today();
    const done = attended(d);
    const planned = d > today() && !!suggestDay(days, sessionList(), d, state.settings.cycle);
    cells.push(`<div class="wk ${done ? 'done' : ''} ${isToday ? 'today' : ''} ${planned ? 'planned' : ''}">
      <small>${WEEKDAYS[i].slice(0, 1)}</small><span>${done ? icons.check : esc(fmtDay(d))}</span></div>`);
  }
  return `<div class="week-strip">${cells.join('')}</div>`;
}

function todayCard() {
  const date = today();
  const summary = sessionSummary(date);
  if (summary) {
    return `<section class="card today-done">
      <div class="today-top"><span class="pill done">${icons.check} تمرین امروز انجام شد</span></div>
      <div class="stat-row">
        <div><b>${fmt(summary.sets)}</b><small>ست</small></div>
        <div><b>${fmtCompact(summary.volume)}</b><small>کیلو حجم</small></div>
        <div><b>${summary.minutes != null ? fmt(summary.minutes) : '–'}</b><small>دقیقه</small></div>
        <div><b>${fmt(summary.prs)}</b><small>رکورد</small></div>
      </div>
      ${photoButton(date)}
      <a class="btn ghost full" href="#workout">ادامه یا ویرایش تمرین</a>
    </section>`;
  }
  const id = state.sessions[date]?.dayId ?? suggestDay(state.days, sessionList(), date, state.settings.cycle);
  const day = state.days.find((d) => d.id === id);
  if (!state.days.length) {
    return `<section class="hero-card"><span class="pill">${icons.list} برنامه</span><h2>هنوز برنامه‌ای نداری</h2>
      <p>روزها و حرکت‌هات رو بساز تا هر جلسه همین‌جا آماده باشه.</p>
      <a class="btn primary big full" href="#program">ساخت برنامه</a></section>`;
  }
  if (!day) {
    return `<section class="hero-card rest"><span class="pill">${icons.moon} روز استراحت</span><h2>امروز ریکاوری</h2>
      <p>عضله‌ها توی استراحت رشد می‌کنن. خواب خوب و آب کافی یادت نره.</p>
      <a class="btn ghost full" href="#workout">با این حال تمرین می‌کنم</a></section>`;
  }
  const muscles = [...new Set(day.items.flatMap((it) => regionsFor(exerciseById(it.exerciseId))[0]))].slice(0, 5);
  const sets = day.items.reduce((n, it) => n + (it.sets || 0), 0);
  return `<section class="hero-card">
    <span class="pill">${icons.bolt} تمرین امروز</span>
    <h2>${esc(day.name)}</h2>
    <div class="hero-meta"><span>${icons.dumbbell}${fmt(day.items.length)} حرکت</span><span>${icons.layers}${fmt(sets)} ست</span><span>${icons.clock}حدود ${fmt(estimateMinutes(day))} دقیقه</span></div>
    ${muscles.length ? `<div class="tags">${muscles.map((r) => `<span>${esc(REGIONS[r])}</span>`).join('')}</div>` : ''}
    <a class="btn primary big full" href="#workout">${icons.play} شروع تمرین</a>
  </section>`;
}

function spark(series, w = 120, h = 40) {
  const ys = series.map((p) => p.y);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const pts = series.map((p, i) => `${((i / Math.max(1, series.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 4 - ((p.y - lo) / (hi - lo || 1)) * (h - 8)).toFixed(1)}`);
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts.join(' ')}"/><circle r="3.5" cx="${pts.at(-1).split(',')[0]}" cy="${pts.at(-1).split(',')[1]}"/></svg>`;
}

function weightCard() {
  const tracker = state.settings.trackers.find((t) => t.id === 'bodyweight' && !t.archived);
  if (!tracker) return '';
  const series = weightSeries(state.daily).filter((p) => p.date >= addDays(today(), -60));
  if (!series.length) {
    return `<a class="card weight-card" href="#stats" data-act="stats-section" data-section="weight">
      <span class="mini-stat">${icons.scale}<span><b>وزن بدن</b><small>وزنت رو ثبت کن تا نمودارش ساخته بشه</small></span></span>${icons.left}</a>`;
  }
  const s = weightStats(series, today());
  return `<a class="card weight-card" href="#stats" data-act="stats-section" data-section="weight">
    <span class="mini-stat">${icons.scale}<span><b>${fmt(s.last.y)} <small>کیلو</small></b>
      <small>${s.days ? `${s.change >= 0 ? '+' : '−'}${fmt(Math.abs(s.change))} کیلو در ${fmt(s.days)} روز` : 'وزن بدن'}</small></span></span>
    ${series.length > 1 ? spark(series) : ''}
  </a>`;
}

function recentRecords() {
  const histories = buildHistories(sessionList().filter(hasWork), timeIds());
  const rows = [];
  for (const [id, hist] of histories) {
    const ex = exerciseById(id);
    if (!ex) continue;
    hist.filter((h) => h.pr && hist.indexOf(h) > 0).forEach((h) => rows.push({ ex, h }));
  }
  rows.sort((a, b) => (a.h.date < b.h.date ? 1 : -1));
  if (!rows.length) return '';
  return `<section class="card">
    <div class="card-head"><h2>رکوردهای اخیر</h2><a class="link" href="#stats">همه آمار</a></div>
    <ul class="pr-list">${rows.slice(0, 3).map(({ ex, h }) => `<li><span class="medal">${icons.trophy}</span>
      <span><strong>${esc(ex.name)}</strong><small>${esc(fmtShort(h.date))}</small></span>
      <b>${setText(ex, { weight: h.topWeight, reps: h.topReps })}</b></li>`).join('')}</ul>
  </section>`;
}

export function homeView() {
  const s = state.settings;
  const name = s.profile?.name;
  const dates = attendedDates();
  const t = today();
  const week = dates.filter((d) => d >= weekStart(t) && d <= t).length;
  const att = attendanceStats(dates, t);
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'صبح بخیر' : hour < 18 ? 'روز بخیر' : 'عصر بخیر';
  return `<header class="home-head">
      <div><small>${esc(fmtLong(t))}</small><h1>${hello}${name ? `، ${esc(name)}` : ''}</h1>
        ${name ? '' : '<a class="link" href="#settings">اسمت رو وارد کن تا مربی صدات کنه</a>'}</div>
      <a class="icon-btn" href="#settings" aria-label="تنظیمات">${icons.gear}</a>
    </header>
    ${coachCard()}
    <section class="card week-card">
      <div class="week-ring">${ring(week, s.weeklyGoal, 104, `${week} از ${s.weeklyGoal} جلسه این هفته`)}
        <div class="ring-label"><b>${fmt(week)}<small>/${fmt(s.weeklyGoal)}</small></b><span>این هفته</span></div></div>
      <div class="week-side">
        <div class="mini-stat">${icons.flame}<span><b>${fmt(att.streakWeeks)}</b><small>هفته پیاپی</small></span></div>
        <div class="mini-stat">${icons.calendar}<span><b>${fmt(dates.length)}</b><small>کل جلسه‌ها</small></span></div>
      </div>
      ${weekStrip()}
    </section>
    ${todayCard()}
    ${weightCard()}
    ${recentRecords()}`;
}

export const homeActions = {
  'coach-refresh': () => {
    generateCoach({ force: true }).then((text) => {
      if (!text) toast(coachError(), 'err');
      app.render();
    });
    app.render();
  },
};
