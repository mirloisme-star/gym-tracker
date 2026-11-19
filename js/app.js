import { bindChartEvents } from './charts.js';
import { dailyActions, dailyInputs, dailyView } from './daily.js';
import { dashboardActions, dashboardChanges, dashboardView } from './dashboard.js';
import { homeActions, homeView } from './home.js';
import { onboardingActions, onboardingInputs, onboardingView } from './onboarding.js';
import { photoChanges } from './photo.js';
import { dayEditorView, programActions, programChanges, programInputs, programView } from './program.js';
import { applyTheme, settingsActions, settingsChanges, settingsInputs, settingsSubmits, settingsView } from './settings.js';
import { initStore, setWriteErrorHandler, state } from './store.js';
import { timerActions } from './timer.js';
import { app, dateActions, icons, toast } from './ui.js';
import { workoutActions, workoutInputs, workoutView } from './workout.js';

const actions = { ...dateActions, ...workoutActions, ...dailyActions, ...programActions, ...settingsActions, ...timerActions, ...dashboardActions, ...homeActions, ...onboardingActions };
const inputs = { ...workoutInputs, ...dailyInputs, ...programInputs, ...settingsInputs, ...onboardingInputs };
const changes = { ...programChanges, ...settingsChanges, ...dashboardChanges, ...photoChanges };
const submits = settingsSubmits;

const TABS = [
  ['home', 'خانه', icons.home],
  ['workout', 'تمرین', icons.dumbbell],
  ['daily', 'روزانه', icons.daily],
  ['stats', 'گزارش', icons.chart],
  ['program', 'برنامه', icons.list],
];

function route() {
  const [tab = 'home', sub] = location.hash.slice(1).split('/');
  return { tab: tab || 'home', sub };
}

let lastRoute = '';

app.render = () => {
  const { tab, sub } = route();
  const main = document.getElementById('view');
  const nav = document.getElementById('tabs');
  if (!state.settings.profile) {
    document.body.classList.add('first-run');
    main.innerHTML = onboardingView();
    nav.innerHTML = '';
    return;
  }
  document.body.classList.remove('first-run');
  const views = {
    home: homeView,
    workout: workoutView,
    daily: dailyView,
    stats: dashboardView,
    program: () => (sub ? dayEditorView(sub) : programView()),
    settings: settingsView,
  };
  main.innerHTML = (views[tab] || homeView)();
  nav.innerHTML = TABS.map(
    ([id, label, icon]) => `<a href="#${id}" ${id === tab || (tab === 'settings' && id === 'home') ? 'aria-current="page"' : ''}>${icon}<span>${label}</span></a>`,
  ).join('');
  const key = `${tab}/${sub || ''}`;
  if (key !== lastRoute) {
    if (lastRoute) scrollTo(0, 0);
    lastRoute = key;
    if (tab === 'settings' && sub) document.getElementById(sub)?.scrollIntoView({ block: 'start' });
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
  applyTheme();
  app.render();
} catch (err) {
  document.getElementById('view').innerHTML = `<div class="card empty"><h2>حافظه در دسترس نیست</h2><p>اپ نتونست داده‌ها رو باز کنه. حالت ناشناس مرورگر رو ببند و دوباره امتحان کن.</p></div>`;
  console.error(err);
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.error);
