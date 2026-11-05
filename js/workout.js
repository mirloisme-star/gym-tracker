import { buildHistories, setScore, suggestDay, workSets } from './stats.js';
import { ensureEntry, ensureSession, exerciseById, kindOf, saveSession, sessionList, setText, state, timeIds } from './store.js';
import { startTimer } from './timer.js';
import { app, dateBar, icons, pickExercise, toast, ui } from './ui.js';
import { esc, fmt, fmtShort, parseNum, today } from './util.js';

// A day picked before anything is logged; there's no session to hold it yet.
const dayChoice = {};

function currentDayId(date) {
  const session = state.sessions[date];
  if (session) return session.dayId;
  if (date in dayChoice) return dayChoice[date];
  return suggestDay(state.days, sessionList(), date, state.settings.cycle);
}

const historiesBefore = (date) => buildHistories(sessionList().filter((s) => s.date < date), timeIds());

function placeholderFor(i, entry, prevSets, item, ex) {
  const kind = kindOf(ex);
  let weight = null;
  if (kind.weight) {
    // In a pyramid the weight changes on purpose, so the same set last time is the better guide.
    if (!item?.repScheme) {
      for (let j = i - 1; j >= 0 && weight == null; j--) weight = entry?.sets[j]?.weight ?? null;
    }
    weight ??= prevSets[i]?.weight ?? (item?.repScheme ? null : prevSets.at(-1)?.weight) ?? item?.targetWeight ?? null;
  }
  const reps = item?.repScheme?.[i] ?? prevSets[i]?.reps ?? prevSets.at(-1)?.reps ?? item?.repsMax ?? null;
  return { weight, reps };
}

function targetText(item, ex) {
  const kind = kindOf(ex);
  const parts = [`${fmt(item.sets)} ست`];
  if (item.repScheme?.length) {
    parts.push(`${item.repScheme.map(fmt).join('، ')} ${kind.reps}`);
  } else if (item.repsMin || item.repsMax) {
    const range = item.repsMin && item.repsMax && item.repsMin !== item.repsMax
      ? `${fmt(item.repsMin)}–${fmt(item.repsMax)}`
      : fmt(item.repsMax || item.repsMin);
    parts.push(`${range} ${kind.reps}`);
  }
  if (ex?.kind === 'cardio' && item.targetWeight) parts.push(`سرعت ${fmt(item.targetWeight)}`);
  if (item.rest) parts.push(`استراحت ${fmt(item.rest)} ثانیه`);
  return parts.join('، ');
}

function setRow(ex, i, set, ph, removable) {
  const exId = ex.id;
  const kind = kindOf(ex);
  const done = !!set?.done;
  const warm = !!set?.warmup;
  return `<div class="set-row ${done ? 'done' : ''} ${warm ? 'warm' : ''} ${kind.weight ? '' : 'one-field'}">
    <button class="set-no" data-act="set-warm" data-ex="${exId}" data-i="${i}" aria-label="تغییر نوع ست ${i + 1}">${warm ? 'گرم' : fmt(i + 1)}</button>
    ${kind.weight ? `<input class="num" inputmode="decimal" aria-label="${kind.weight} ست ${i + 1}" data-in="set-field" data-field="weight" data-ex="${exId}" data-i="${i}"
      value="${set?.weight ?? ''}" placeholder="${ph.weight ?? ''}">` : ''}
    <input class="num" inputmode="decimal" aria-label="${kind.reps} ست ${i + 1}" data-in="set-field" data-field="reps" data-ex="${exId}" data-i="${i}"
      value="${set?.reps ?? ''}" placeholder="${ph.reps ?? ''}">
    <button class="set-check" data-act="set-done" data-ex="${exId}" data-i="${i}" aria-pressed="${done}" aria-label="ثبت ست ${i + 1}">${icons.check}</button>
    ${removable ? `<button class="set-del" data-act="set-del" data-ex="${exId}" data-i="${i}" aria-label="حذف ست ${i + 1}">${icons.x}</button>` : '<span class="set-del"></span>'}
  </div>`;
}

function exerciseCard(exId, item, entry, hist) {
  const ex = exerciseById(exId) || { id: exId, name: 'حرکت حذف‌شده' };
  const kind = kindOf(ex);
  const prev = hist?.at(-1);
  const prevSets = prev?.sets || [];
  const target = item?.sets || 0;
  const rows = Math.max(target, entry?.sets.length || 0, 1);
  const doneCount = (entry?.sets || []).filter((s) => s.done).length;
  const finished = doneCount >= rows;
  const prevText = prev
    ? `دفعه قبل (${esc(fmtShort(prev.date))}): ${prevSets.map((s) => setText(ex, s)).join('، ')}`
    : 'بار اول این حرکت';
  let html = '';
  for (let i = 0; i < rows; i++) {
    html += setRow(ex, i, entry?.sets[i], placeholderFor(i, entry, prevSets, item, ex), i >= target && rows > 1);
  }
  return `<article class="card ex-card ${finished ? 'finished' : ''}" id="ex-${exId}">
    <header>
      <button class="ex-name" data-act="ex-stats" data-ex="${exId}">${esc(ex.name)}</button>
      <span class="ex-count">${fmt(doneCount)}/${fmt(rows)}</span>
    </header>
    ${item ? `<p class="ex-target">${targetText(item, ex)}</p>` : ''}
    ${item?.note ? `<p class="ex-note">${esc(item.note)}</p>` : ''}
    <p class="ex-prev">${prevText}</p>
    <div class="set-head ${kind.weight ? '' : 'one-field'}"><span>ست</span>${kind.weight ? `<span>${kind.weight}</span>` : ''}<span>${kind.reps}</span></div>
    ${html}
    <button class="btn ghost full" data-act="set-add" data-ex="${exId}">${icons.plus} ست اضافه</button>
  </article>`;
}

export function workoutView() {
  const date = ui.date;
  const dayId = currentDayId(date);
  const day = state.days.find((d) => d.id === dayId);
  const session = state.sessions[date];
  const items = day?.items || [];
  const extras = (session?.entries || []).filter((e) => !items.some((it) => it.exerciseId === e.exerciseId));
  const histories = historiesBefore(date);
  const cards = [
    ...items.map((it) => exerciseCard(it.exerciseId, it, session?.entries.find((e) => e.exerciseId === it.exerciseId), histories.get(it.exerciseId))),
    ...extras.map((e) => exerciseCard(e.exerciseId, null, e, histories.get(e.exerciseId))),
  ].join('');

  let planned = items.reduce((n, it) => n + (it.sets || 0), 0);
  let doneSets = 0;
  for (const e of session?.entries || []) {
    const n = e.sets.filter((s) => s.done).length;
    doneSets += n;
    if (!items.some((it) => it.exerciseId === e.exerciseId)) planned += Math.max(n, 1);
  }
  const chips = state.days.map((d) => `<button class="chip" aria-pressed="${d.id === dayId}" data-act="day-pick" data-day="${d.id}">${esc(d.name)}</button>`).join('');

  return `${dateBar()}
    ${backupBanner()}
    ${state.days.length ? `<div class="chips" role="group" aria-label="روز تمرین">${chips}<button class="chip" aria-pressed="${!dayId}" data-act="day-pick" data-day="">بدون برنامه</button></div>` : `
      <div class="card empty">
        <h2>هنوز برنامه‌ای نداری</h2>
        <p>روزها و حرکت‌هات رو یک بار وارد کن تا هر جلسه همین‌جا جلوت باشه.</p>
        <a class="btn primary" href="#program">ساخت برنامه تمرینی</a>
      </div>`}
    ${planned ? `<div class="progress"><div class="progress-bar"><i style="width:${Math.min(100, (doneSets / planned) * 100)}%"></i></div><span>${fmt(doneSets)} از ${fmt(planned)} ست</span></div>` : ''}
    ${!items.length && !extras.length && state.days.length ? '<p class="muted center pad">طبق چرخه تمرینت این روز استراحته. اگه تمرین می‌کنی، روزش رو از بالا انتخاب کن یا یه حرکت اضافه کن.</p>' : ''}
    ${cards}
    <button class="btn ghost full" data-act="ex-add">${icons.plus} افزودن حرکت به این جلسه</button>
    ${session ? `<label class="field note"><span>یادداشت جلسه</span><textarea rows="2" data-in="session-note" placeholder="درد، حال، هر چیزی که بعداً به کارت میاد">${esc(session.note || '')}</textarea></label>` : ''}
    <p class="hint">مقدار کم‌رنگ پیشنهاد از جلسه قبله. اگه همون رو زدی فقط تیک بزن. با لمس شماره ست، اون ست «گرم‌کردن» می‌شه و توی آمار حساب نمی‌شه.</p>`;
}

function backupBanner() {
  const last = state.settings.lastBackupAt;
  // Only earlier days count: appearing mid-workout would shift the rows under the user's thumb.
  const hasData = Object.keys(state.sessions).some((d) => d < today());
  const stale = !last || Date.now() - new Date(last).getTime() > 14 * 86400000;
  if (!hasData || !stale) return '';
  return `<a class="banner" href="#settings">${icons.alert}<span>${last ? 'از آخرین بک‌آپت بیشتر از دو هفته گذشته.' : 'هنوز بک‌آپ نگرفتی.'} داده‌ها فقط روی همین گوشی‌ان.</span></a>`;
}

function setAt(exId, i) {
  const entry = ensureEntry(ui.date, exId, currentDayId(ui.date));
  while (entry.sets.length <= i) entry.sets.push({ weight: null, reps: null, done: false });
  return { entry, set: entry.sets[i] };
}

function restFor(exId) {
  const day = state.days.find((d) => d.id === currentDayId(ui.date));
  return day?.items.find((it) => it.exerciseId === exId)?.rest ?? state.settings.defaultRest;
}

export const workoutActions = {
  'day-pick': (el) => {
    const dayId = el.dataset.day || null;
    dayChoice[ui.date] = dayId;
    if (state.sessions[ui.date]) {
      state.sessions[ui.date].dayId = dayId;
      saveSession(ui.date);
    }
    app.render();
  },
  'set-done': (el) => {
    const exId = el.dataset.ex;
    const i = Number(el.dataset.i);
    const histories = historiesBefore(ui.date);
    const hist = histories.get(exId);
    const dayItem = state.days.find((d) => d.id === currentDayId(ui.date))?.items.find((it) => it.exerciseId === exId);
    const { entry, set } = setAt(exId, i);
    if (set.done) {
      set.done = false;
      saveSession(ui.date);
      app.render();
      return;
    }
    const ex = exerciseById(exId);
    const ph = placeholderFor(i, entry, hist?.at(-1)?.sets || [], dayItem, ex);
    const weight = set.weight ?? ph.weight ?? 0;
    const reps = set.reps ?? ph.reps;
    if (!(reps > 0)) {
      toast(`${kindOf(ex).reps} رو وارد کن`);
      saveSession(ui.date);
      document.querySelector(`[data-field="reps"][data-ex="${exId}"][data-i="${i}"]`)?.focus();
      return;
    }
    Object.assign(set, { weight, reps, done: true, at: Date.now() });
    saveSession(ui.date);
    if (!set.warmup && hist?.length) {
      const best = Math.max(...hist.map((h) => h.score));
      const score = setScore(hist, weight, reps);
      const earlierToday = workSets(entry).filter((s) => s !== set).map((s) => setScore(hist, s.weight, s.reps));
      if (score > best && score > Math.max(0, ...earlierToday)) toast(`رکورد جدید! ${setText(ex, set)}`, 'win');
    }
    startTimer(restFor(exId));
    app.render();
  },
  'set-warm': (el) => {
    const { set } = setAt(el.dataset.ex, Number(el.dataset.i));
    set.warmup = !set.warmup;
    saveSession(ui.date);
    app.render();
  },
  'set-add': (el) => {
    const exId = el.dataset.ex;
    const entry = state.sessions[ui.date]?.entries.find((e) => e.exerciseId === exId);
    const day = state.days.find((d) => d.id === currentDayId(ui.date));
    const target = day?.items.find((it) => it.exerciseId === exId)?.sets || 1;
    setAt(exId, Math.max(entry?.sets.length || 0, target));
    saveSession(ui.date);
    app.render();
  },
  'set-del': (el) => {
    const entry = state.sessions[ui.date]?.entries.find((e) => e.exerciseId === el.dataset.ex);
    if (!entry) return;
    entry.sets.splice(Number(el.dataset.i), 1);
    saveSession(ui.date);
    app.render();
  },
  'ex-add': () => {
    pickExercise('افزودن حرکت به جلسه', (ex) => {
      ensureEntry(ui.date, ex.id, currentDayId(ui.date));
      saveSession(ui.date);
      app.render();
      document.getElementById(`ex-${ex.id}`)?.scrollIntoView({ block: 'center' });
    });
  },
};

export const workoutInputs = {
  'set-field': (el) => {
    const { set } = setAt(el.dataset.ex, Number(el.dataset.i));
    set[el.dataset.field] = parseNum(el.value);
    saveSession(ui.date);
  },
  'session-note': (el) => {
    ensureSession(ui.date).note = el.value;
    saveSession(ui.date);
  },
};
