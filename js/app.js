import { bindChartEvents } from './charts.js';
import { dailyActions, dailyInputs, dailyView } from './daily.js';
import { dashboardActions, dashboardChanges, dashboardView } from './dashboard.js';
import { dayEditorView, programActions, programChanges, programInputs, programView } from './program.js';
import { seedProgram } from './seed.js';
import { applyTheme, settingsActions, settingsChanges, settingsInputs, settingsSubmits, settingsView } from './settings.js';
import { initStore, setWriteErrorHandler } from './store.js';
import { timerActions } from './timer.js';
import { app, dateActions, icons, toast } from './ui.js';
import { workoutActions, workoutInputs, workoutView } from './workout.js';

const actions = { ...dateActions, ...workoutActions, ...dailyActions, ...programActions, ...settingsActions, ...timerActions, ...dashboardActions };
const inputs = { ...workoutInputs, ...dailyInputs, ...programInputs, ...settingsInputs };
const changes = { ...programChanges, ...settingsChanges, ...dashboardChanges };
const submits = settingsSubmits;

const TABS = [
  ['workout', 'تمرین', icons.dumbbell],
  ['daily', 'روزانه', icons.daily],
  ['stats', 'آمار', icons.chart],
  ['program', 'برنامه', icons.list],
];

function route() {
  const [tab = 'workout', sub] = location.hash.slice(1).split('/');
  return { tab: tab || 'workout', sub };
}

let lastRoute = '';

app.render = () => {
  const { tab, sub } = route();
  const main = document.getElementById('view');
  const views = {
    workout: workoutView,
    daily: dailyView,
    stats: dashboardView,
    program: () => (sub ? dayEditorView(sub) : programView()),
    settings: settingsView,
  };
  main.innerHTML = (views[tab] || workoutView)();
  document.getElementById('tabs').innerHTML = TABS.map(
    ([id, label, icon]) => `<a href="#${id}" ${id === tab || (tab === 'settings' && id === 'program') ? 'aria-current="page"' : ''}>${icon}<span>${label}</span></a>`,
  ).join('');
  const key = `${tab}/${sub || ''}`;
  if (key !== lastRoute) {
    if (lastRoute) scrollTo(0, 0);
    lastRoute = key;
  }
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && !el.disabled) actions[el.dataset.act]?.(el, e);
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-in]');
  if (el) inputs[el.dataset.in]?.(el);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el) changes[el.dataset.change]?.(el);
});
document.addEventListener('submit', (e) => {
  const el = e.target.closest('[data-submit]');
  if (el) {
    e.preventDefault();
    submits[el.dataset.submit]?.(el);
  }
});
// Tapping a pre-filled number should replace it, not append to it.
document.addEventListener('focusin', (e) => {
  if (e.target.matches?.('input.num')) e.target.select();
});
window.addEventListener('hashchange', app.render);

let lastWidth = innerWidth;
window.addEventListener('resize', () => {
  if (innerWidth !== lastWidth && route().tab === 'stats') app.render(); // charts are sized in pixels
  lastWidth = innerWidth;
});

setWriteErrorHandler(() => toast('ذخیره نشد! فضای گوشی رو چک کن و از داده‌ها بک‌آپ بگیر.', 'err'));
bindChartEvents();

try {
  await initStore();
  seedProgram();
  applyTheme();
  app.render();
} catch (err) {
  document.getElementById('view').innerHTML = `<div class="card empty"><h2>حافظه در دسترس نیست</h2><p>اپ نتونست داده‌ها رو باز کنه. حالت ناشناس مرورگر رو ببند و دوباره امتحان کن.</p></div>`;
  console.error(err);
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.error);
