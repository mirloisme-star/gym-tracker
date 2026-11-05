// Shared UI plumbing: rendering hook, toasts, icons, the date bar and the exercise dialog.
import { KINDS, MUSCLES, findOrCreateExercise, state } from './store.js';
import { addDays, esc, fmtLong, today } from './util.js';

export const app = { render: () => {} };
export const ui = { date: today() };

let toastTimer;
export function toast(message, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 3200);
}

const svg = (body) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
export const icons = {
  dumbbell: svg('<path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/>'),
  daily: svg('<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M4 10h16M9 3v4M15 3v4M9 15.5l2 2 4-4"/>'),
  chart: svg('<path d="M4 19h16M7 15l4-5 3 3 5-7"/>'),
  list: svg('<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  right: svg('<path d="M9 5l7 7-7 7"/>'),
  left: svg('<path d="M15 5l-7 7 7 7"/>'),
  up: svg('<path d="M5 15l7-7 7 7"/>'),
  down: svg('<path d="M5 9l7 7 7-7"/>'),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/>'),
  alert: svg('<path d="M12 4l9 16H3zM12 10v4M12 17h.01"/>'),
  good: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
};

export function dateBar() {
  const isToday = ui.date === today();
  return `<div class="date-bar">
    <button class="icon-btn" data-act="date-move" data-n="-1" aria-label="روز قبل">${icons.right}</button>
    <div class="date-label">
      <strong>${esc(fmtLong(ui.date))}</strong>
      ${isToday ? '<span>امروز</span>' : '<button class="link" data-act="date-today">برگشت به امروز</button>'}
    </div>
    <button class="icon-btn" data-act="date-move" data-n="1" ${isToday ? 'disabled' : ''} aria-label="روز بعد">${icons.left}</button>
  </div>`;
}

export const dateActions = {
  'date-move': (el) => {
    const next = addDays(ui.date, Number(el.dataset.n));
    if (next <= today()) {
      ui.date = next;
      app.render();
    }
  },
  'date-today': () => {
    ui.date = today();
    app.render();
  },
};

// Picking an existing name reuses that exercise, which keeps its history connected.
export function pickExercise(title, onPick) {
  const dlg = document.getElementById('dialog');
  dlg.innerHTML = `<form method="dialog">
    <h2>${esc(title)}</h2>
    <label class="field"><span>اسم حرکت</span>
      <input id="ex-name" list="ex-names" autocomplete="off" required>
      <datalist id="ex-names">${state.exercises.map((e) => `<option value="${esc(e.name)}">`).join('')}</datalist>
    </label>
    <label class="field"><span>عضله اصلی</span>
      <select id="ex-muscle">${MUSCLES.map((m) => `<option>${m}</option>`).join('')}</select>
    </label>
    <label class="field"><span>نوع ثبت</span>
      <select id="ex-kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select>
    </label>
    <div class="row-end">
      <button type="button" class="btn ghost" id="ex-cancel">انصراف</button>
      <button type="submit" class="btn primary">افزودن</button>
    </div>
  </form>`;
  dlg.querySelector('#ex-cancel').onclick = () => dlg.close();
  dlg.querySelector('form').onsubmit = () => {
    const name = dlg.querySelector('#ex-name').value;
    if (name.trim()) onPick(findOrCreateExercise(name, dlg.querySelector('#ex-muscle').value, dlg.querySelector('#ex-kind').value));
  };
  dlg.showModal();
}
