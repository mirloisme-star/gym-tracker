// Shared UI plumbing: rendering hook, toasts, icons and the date bar.
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
  home: svg('<path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z"/>'),
  bolt: svg('<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>'),
  spark: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M17.7 6.3l-2.5 2.5M8.8 15.2l-2.5 2.5"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  flame: svg('<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 01-10 0c0-2.5 1.5-4 2.5-5 0 2 1 3 2 3 0-3-1-5.5.5-8z"/>'),
  trophy: svg('<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8.5 20h7M10 17h4"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  play: svg('<path d="M8 5.5v13l10-6.5z"/>'),
  moon: svg('<path d="M19 14.5A7.5 7.5 0 019.5 5a7.5 7.5 0 109.5 9.5z"/>'),
  layers: svg('<path d="M12 4l9 4.5-9 4.5-9-4.5zM3 13l9 4.5 9-4.5"/>'),
  calendar: svg('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
  refresh: svg('<path d="M19.5 12a7.5 7.5 0 11-2.2-5.3M19.5 4.5v4h-4"/>'),
  key: svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>'),
  scale: svg('<rect x="3.5" y="4" width="17" height="16" rx="4"/><path d="M8.5 9.5a5 5 0 017 0M12 12.5l1.5-3"/>'),
  flag: svg('<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>'),
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
