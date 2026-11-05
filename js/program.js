import { KINDS, MUSCLES, exerciseById, kindOf, saveMeta, state } from './store.js';
import { app, icons, pickExercise, toast } from './ui.js';
import { WEEKDAYS, esc, fmt, parseNum, parseRepsText, repsToText, uid } from './util.js';

const move = (arr, i, delta) => {
  const j = i + delta;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
};

export function programView() {
  const list = state.days
    .map((d, i) => {
      const names = d.items.map((it) => exerciseById(it.exerciseId)?.name).filter(Boolean);
      const when = d.weekdays?.length ? d.weekdays.map((w) => WEEKDAYS[w]).join('، ') : 'بدون روز ثابت';
      return `<article class="card day-card">
        <a class="day-link" href="#program/${d.id}">
          <h2>${esc(d.name)}</h2>
          <p class="muted">${esc(when)}، ${fmt(d.items.length)} حرکت</p>
          ${names.length ? `<p class="day-names">${names.map(esc).join('، ')}</p>` : ''}
        </a>
        <div class="reorder">
          <button class="icon-btn" data-act="day-move" data-i="${i}" data-n="-1" ${i === 0 ? 'disabled' : ''} aria-label="بالاتر">${icons.up}</button>
          <button class="icon-btn" data-act="day-move" data-i="${i}" data-n="1" ${i === state.days.length - 1 ? 'disabled' : ''} aria-label="پایین‌تر">${icons.down}</button>
        </div>
      </article>`;
    })
    .join('');
  return `<div class="page-head"><h1>برنامه تمرینی</h1><a class="icon-btn" href="#settings" aria-label="تنظیمات">${icons.gear}</a></div>
    ${list || '<p class="muted center pad">هر روز تمرینی رو جدا بساز، مثلاً «سینه و پشت‌بازو».</p>'}
    <button class="btn primary full" data-act="day-new">${icons.plus} روز تمرینی جدید</button>
    ${state.days.length ? '<p class="hint">اگه برای روزها، روز هفته تعیین کنی اپ همون روز رو باز می‌کنه. اگه نکنی، به ترتیب این لیست می‌چرخه.</p>' : ''}`;
}

function itemCard(day, item, i) {
  const ex = exerciseById(item.exerciseId);
  const num = (field, label, value) => `<label class="mini-field"><span>${label}</span>
    <input class="num" inputmode="numeric" data-in="item-num" data-day="${day.id}" data-i="${i}" data-field="${field}" value="${value ?? ''}"></label>`;
  return `<article class="card item-card">
    <div class="item-top">
      <input class="item-name" aria-label="اسم حرکت" data-change="ex-rename" data-ex="${ex.id}" value="${esc(ex.name)}">
      <button class="icon-btn" data-act="item-move" data-day="${day.id}" data-i="${i}" data-n="-1" ${i === 0 ? 'disabled' : ''} aria-label="بالاتر">${icons.up}</button>
      <button class="icon-btn" data-act="item-move" data-day="${day.id}" data-i="${i}" data-n="1" ${i === day.items.length - 1 ? 'disabled' : ''} aria-label="پایین‌تر">${icons.down}</button>
      <button class="icon-btn" data-act="item-del" data-day="${day.id}" data-i="${i}" aria-label="حذف از برنامه">${icons.trash}</button>
    </div>
    <div class="mini-grid">
      ${num('sets', 'ست', item.sets)}
      <label class="mini-field"><span>${kindOf(ex).reps}</span>
        <input class="num" inputmode="text" placeholder="12 یا 8,10,12" data-change="item-reps" data-day="${day.id}" data-i="${i}" value="${esc(repsToText(item))}"></label>
      ${ex.kind === 'cardio' ? num('targetWeight', 'سرعت', item.targetWeight) : ''}
      ${num('rest', 'استراحت (ثانیه)', item.rest)}
    </div>
    <div class="item-bottom">
      <select aria-label="عضله اصلی" data-change="ex-muscle" data-ex="${ex.id}">${MUSCLES.map((m) => `<option ${m === ex.muscle ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <select aria-label="نوع ثبت" data-change="ex-kind" data-ex="${ex.id}">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${k === (ex.kind || 'strength') ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
      <input class="item-note" aria-label="یادداشت حرکت" placeholder="یادداشت: سوپرست، دراپ‌ست، تمپو…" data-in="item-note" data-day="${day.id}" data-i="${i}" value="${esc(item.note || '')}">
    </div>
  </article>`;
}

export function dayEditorView(dayId) {
  const day = state.days.find((d) => d.id === dayId);
  if (!day) return programView();
  return `<div class="page-head"><a class="icon-btn" href="#program" aria-label="برگشت">${icons.right}</a><h1>ویرایش روز</h1>
      <button class="icon-btn" data-act="day-del" data-day="${day.id}" aria-label="حذف این روز">${icons.trash}</button></div>
    <label class="field"><span>اسم روز</span><input data-in="day-name" data-day="${day.id}" value="${esc(day.name)}"></label>
    <div class="field"><span>روزهای هفته (اختیاری)</span>
      <div class="chips wrap">${WEEKDAYS.map((w, i) => `<button class="chip" aria-pressed="${!!day.weekdays?.includes(i)}" data-act="day-weekday" data-day="${day.id}" data-i="${i}">${w}</button>`).join('')}</div>
    </div>
    ${day.items.map((it, i) => itemCard(day, it, i)).join('')}
    <button class="btn primary full" data-act="item-add" data-day="${day.id}">${icons.plus} افزودن حرکت</button>`;
}

const dayOf = (el) => state.days.find((d) => d.id === el.dataset.day);

export const programActions = {
  'day-new': () => {
    const day = { id: uid(), name: `روز ${state.days.length + 1}`, weekdays: [], items: [] };
    state.days.push(day);
    saveMeta('days');
    location.hash = `#program/${day.id}`;
  },
  'day-move': (el) => {
    move(state.days, Number(el.dataset.i), Number(el.dataset.n));
    saveMeta('days');
    app.render();
  },
  'day-del': (el) => {
    const day = dayOf(el);
    if (!confirm(`«${day.name}» از برنامه حذف بشه؟ تمرین‌هایی که قبلاً ثبت کردی می‌مونن.`)) return;
    state.days = state.days.filter((d) => d !== day);
    saveMeta('days');
    location.hash = '#program';
  },
  'day-weekday': (el) => {
    const day = dayOf(el);
    const i = Number(el.dataset.i);
    day.weekdays = day.weekdays?.includes(i) ? day.weekdays.filter((w) => w !== i) : [...(day.weekdays || []), i].sort();
    saveMeta('days');
    app.render();
  },
  'item-add': (el) => {
    const day = dayOf(el);
    pickExercise('افزودن حرکت', (ex) => {
      if (day.items.some((it) => it.exerciseId === ex.id)) {
        toast('این حرکت توی همین روز هست');
        return;
      }
      day.items.push({ exerciseId: ex.id, sets: 3, repsMin: 8, repsMax: 12, rest: state.settings.defaultRest, note: '' });
      saveMeta('days');
      app.render();
    });
  },
  'item-move': (el) => {
    move(dayOf(el).items, Number(el.dataset.i), Number(el.dataset.n));
    saveMeta('days');
    app.render();
  },
  'item-del': (el) => {
    dayOf(el).items.splice(Number(el.dataset.i), 1);
    saveMeta('days');
    app.render();
  },
};

export const programInputs = {
  'day-name': (el) => {
    dayOf(el).name = el.value;
    saveMeta('days');
  },
  'item-num': (el) => {
    dayOf(el).items[Number(el.dataset.i)][el.dataset.field] = parseNum(el.value);
    saveMeta('days');
  },
  'item-note': (el) => {
    dayOf(el).items[Number(el.dataset.i)].note = el.value;
    saveMeta('days');
  },
};

// Renaming edits the exercise itself, so a typo fix keeps its whole history.
export const programChanges = {
  'ex-rename': (el) => {
    const ex = exerciseById(el.dataset.ex);
    const name = el.value.trim();
    if (!name || state.exercises.some((e) => e !== ex && e.name === name)) {
      if (name) toast('حرکتی با این اسم از قبل هست');
      el.value = ex.name;
      return;
    }
    ex.name = name;
    saveMeta('exercises');
  },
  'ex-muscle': (el) => {
    exerciseById(el.dataset.ex).muscle = el.value;
    saveMeta('exercises');
  },
  'ex-kind': (el) => {
    exerciseById(el.dataset.ex).kind = el.value;
    saveMeta('exercises');
    app.render();
  },
  'item-reps': (el) => {
    Object.assign(dayOf(el).items[Number(el.dataset.i)], parseRepsText(el.value));
    saveMeta('days');
  },
};
