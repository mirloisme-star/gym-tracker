import { hasWork } from './stats.js';
import { activeTrackers, ensureDaily, saveDaily, state } from './store.js';
import { app, dateBar, icons, ui } from './ui.js';
import { esc, fmt, parseNum } from './util.js';

function trackerRow(t, values) {
  const v = values?.[t.id];
  if (t.type === 'scale') {
    const options = [1, 2, 3, 4, 5]
      .map((n) => `<button aria-pressed="${v === n}" data-act="daily-scale" data-id="${t.id}" data-n="${n}">${fmt(n)}</button>`)
      .join('');
    return `<div class="tracker"><span class="tracker-name">${esc(t.name)}</span><div class="scale" role="group" aria-label="${esc(t.name)} از ۱ تا ۵">${options}</div></div>`;
  }
  const value = v ?? '';
  return `<div class="tracker">
    <span class="tracker-name">${esc(t.name)}${t.unit ? `<small>${esc(t.unit)}</small>` : ''}</span>
    <div class="stepper">
      <button class="icon-btn" data-act="daily-step" data-id="${t.id}" data-n="1" aria-label="بیشتر">${icons.plus}</button>
      <input class="num" inputmode="decimal" aria-label="${esc(t.name)}" data-in="daily-value" data-id="${t.id}" value="${value}" placeholder="–">
      <button class="icon-btn" data-act="daily-step" data-id="${t.id}" data-n="-1" aria-label="کمتر">${icons.minus}</button>
    </div>
  </div>`;
}

export function dailyView() {
  const record = state.daily[ui.date];
  const fromWorkout = hasWork(state.sessions[ui.date]);
  const went = fromWorkout || !!record?.gym;
  const trackers = activeTrackers();
  const checks = trackers.filter((t) => t.type === 'check');
  const others = trackers.filter((t) => t.type !== 'check');
  return `${dateBar()}
    <button class="gym-toggle" aria-pressed="${went}" data-act="daily-gym" ${fromWorkout ? 'disabled' : ''}>
      <span class="gym-mark">${icons.check}</span>
      <span><strong>${went ? 'باشگاه رفتم' : 'باشگاه نرفتم'}</strong>
      <small>${fromWorkout ? 'از روی تمرین ثبت‌شده' : 'برای تغییر لمس کن'}</small></span>
    </button>
    <section class="card">
      <h2>مکمل‌ها</h2>
      ${checks.length ? checks.map((t) => `<button class="check-row" aria-pressed="${!!record?.values?.[t.id]}" data-act="daily-check" data-id="${t.id}">
          <span class="box">${icons.check}</span><span>${esc(t.name)}${t.unit ? ` <small>${esc(t.unit)}</small>` : ''}</span>
        </button>`).join('') : '<p class="muted">هنوز مکملی تعریف نکردی.</p><a class="btn ghost full" href="#settings">افزودن مکمل</a>'}
    </section>
    <section class="card">
      <h2>امروز چطور بود</h2>
      ${others.map((t) => trackerRow(t, record?.values)).join('')}
    </section>
    <label class="field note"><span>یادداشت روز</span>
      <textarea rows="3" data-in="daily-note" placeholder="استرس، بیماری، سفر، آسیب‌دیدگی…">${esc(record?.note || '')}</textarea>
    </label>
    <a class="link center block" href="#settings">ویرایش مواردی که ثبت می‌کنی</a>`;
}

const setValue = (id, value) => {
  const record = ensureDaily(ui.date);
  if (value == null) delete record.values[id];
  else record.values[id] = value;
  saveDaily(ui.date);
};

export const dailyActions = {
  'daily-gym': () => {
    const record = ensureDaily(ui.date);
    record.gym = !record.gym;
    saveDaily(ui.date);
    app.render();
  },
  'daily-check': (el) => {
    setValue(el.dataset.id, state.daily[ui.date]?.values[el.dataset.id] ? null : true);
    app.render();
  },
  'daily-scale': (el) => {
    const n = Number(el.dataset.n);
    setValue(el.dataset.id, state.daily[ui.date]?.values[el.dataset.id] === n ? null : n);
    app.render();
  },
  'daily-step': (el) => {
    const tracker = state.settings.trackers.find((t) => t.id === el.dataset.id);
    const step = tracker.step || 1;
    const current = state.daily[ui.date]?.values[tracker.id];
    // Start number fields from the latest value, so body weight isn't stepped up from zero.
    const base = current ?? (tracker.type === 'number' ? lastValue(tracker.id) : 0) ?? 0;
    const next = Math.max(0, Math.round((base + Number(el.dataset.n) * step) * 10) / 10);
    setValue(tracker.id, next);
    app.render();
  },
};

function lastValue(id) {
  const dates = Object.keys(state.daily).filter((d) => d < ui.date).sort();
  for (let i = dates.length - 1; i >= 0; i--) {
    const v = state.daily[dates[i]].values?.[id];
    if (v != null) return v;
  }
  return null;
}

export const dailyInputs = {
  'daily-value': (el) => setValue(el.dataset.id, parseNum(el.value)),
  'daily-note': (el) => {
    ensureDaily(ui.date).note = el.value;
    saveDaily(ui.date);
  },
};
