// First run: a few questions, then a program. Nothing is saved until the last step.
import { freshJourney, saveMeta, state } from './store.js';
import { TEMPLATES, applyTemplate } from './templates.js';
import { app, icons, toast } from './ui.js';
import { esc, fmt, today } from './util.js';

export const GOALS = {
  muscle: ['عضله‌سازی', 'حجم و فرم بدن'],
  strength: ['قدرت', 'وزنه‌های سنگین‌تر'],
  fat: ['کاهش چربی', 'بدن خشک‌تر'],
  fit: ['سلامت و آمادگی', 'انرژی و تحرک بیشتر'],
};
export const LEVELS = { beginner: 'مبتدی', mid: 'متوسط', pro: 'حرفه‌ای' };

const draft = { step: 0, name: '', goal: 'muscle', level: 'beginner', template: 'full3', goalDays: 3 };
const STEPS = 4;

const choice = (act, value, selected, title, sub = '') =>
  `<button class="choice" data-act="${act}" data-v="${value}" aria-pressed="${selected}"><strong>${esc(title)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;

function stepView() {
  if (draft.step === 0) {
    return `<div class="ob-hero">
        <img class="ob-logo" src="icons/icon-192.png" alt="">
        <h1>باشگاه</h1>
        <p>برنامه‌ات جلوی چشمت، هر ست ثبت می‌شه، پیشرفتت رو می‌بینی و هر روز یه مربی هوشمند همراهته.</p>
      </div>
      <ul class="ob-points">
        <li>${icons.dumbbell}<span>ثبت ست و وزنه با یه لمس، با تایمر استراحت بزرگ</span></li>
        <li>${icons.chart}<span>نمودار پیشرفت، رکوردها و نقشه عضله‌ها</span></li>
        <li>${icons.spark}<span>پیام روزانه هوش مصنوعی از روی عادت‌ها و تمرین‌هات</span></li>
      </ul>
      <div class="ob-actions">
        <button class="btn primary full big" data-act="ob-next">شروع کنیم</button>
        <label class="btn ghost full">بک‌آپ دارم، برگردونش<input type="file" accept="application/json,.json" hidden data-change="backup-restore"></label>
      </div>`;
  }
  if (draft.step === 1) {
    return `<h2 class="ob-q">اسمت چیه؟</h2>
      <p class="muted">مربی هوشمند با این اسم صدات می‌کنه.</p>
      <input class="ob-input" data-in="ob-name" value="${esc(draft.name)}" placeholder="مثلاً علی" autocomplete="given-name" maxlength="30">
      <h2 class="ob-q">هدفت چیه؟</h2>
      <div class="choices two">${Object.entries(GOALS).map(([k, [t, s]]) => choice('ob-goal', k, draft.goal === k, t, s)).join('')}</div>
      <h2 class="ob-q">سابقه تمرین</h2>
      <div class="choices three">${Object.entries(LEVELS).map(([k, t]) => choice('ob-level', k, draft.level === k, t)).join('')}</div>`;
  }
  if (draft.step === 2) {
    return `<h2 class="ob-q">با چه برنامه‌ای شروع کنی؟</h2>
      <p class="muted">بعداً هر حرکت، ست یا روزی رو می‌تونی عوض کنی.</p>
      <div class="choices">${TEMPLATES.map((t) => `<button class="choice program" data-act="ob-template" data-v="${t.id}" aria-pressed="${draft.template === t.id}">
          <span class="choice-top"><strong>${esc(t.name)}</strong><em>${esc(t.tag)}</em></span>
          <small>${esc(t.about)}</small>
          <small class="choice-meta">${fmt(t.days.length)} روز تمرین، ${fmt(t.rest)} روز استراحت</small>
        </button>`).join('')}
        ${choice('ob-template', 'none', draft.template === 'none', 'خودم می‌سازم', 'برنامه خالی، حرکت‌ها رو خودت اضافه کن')}
      </div>`;
  }
  return `<h2 class="ob-q">هفته‌ای چند جلسه؟</h2>
    <p class="muted">هدف هفتگیت. حلقه صفحه اصلی با همین پر می‌شه.</p>
    <div class="choices five">${[2, 3, 4, 5, 6].map((n) => choice('ob-days', n, draft.goalDays === n, fmt(n))).join('')}</div>
    <div class="card ob-summary">
      <p><span>اسم</span><b>${esc(draft.name || '–')}</b></p>
      <p><span>هدف</span><b>${GOALS[draft.goal][0]}</b></p>
      <p><span>برنامه</span><b>${esc(TEMPLATES.find((t) => t.id === draft.template)?.name || 'برنامه خالی')}</b></p>
      <p><span>شروع</span><b>امروز</b></p>
    </div>`;
}

export function onboardingView() {
  const last = draft.step === STEPS - 1;
  return `<div class="onboarding">
    ${draft.step ? `<div class="ob-bar"><button class="icon-btn" data-act="ob-back" aria-label="قبلی">${icons.right}</button>
      <div class="ob-dots">${Array.from({ length: STEPS - 1 }, (_, i) => `<i class="${i < draft.step ? 'on' : ''}"></i>`).join('')}</div><span></span></div>` : ''}
    <div class="ob-body">${stepView()}</div>
    ${draft.step ? `<div class="ob-foot"><button class="btn primary full big" data-act="${last ? 'ob-finish' : 'ob-next'}">${last ? 'بزن بریم' : 'ادامه'}</button></div>` : ''}
  </div>`;
}

function finish() {
  const template = TEMPLATES.find((t) => t.id === draft.template);
  const start = today();
  const s = state.settings;
  s.profile = { name: draft.name.trim(), goal: draft.goal, level: draft.level, createdAt: start };
  s.weeklyGoal = draft.goalDays;
  const rest = template?.rest ?? 1;
  s.cycle = { start, rest };
  s.journey = freshJourney(start, (template?.days.length || 3) + rest, rest);
  if (template) applyTemplate(template);
  saveMeta('settings');
  location.hash = '#home';
  app.render();
  toast(`خوش اومدی${s.profile.name ? `، ${s.profile.name}` : ''}!`, 'win');
}

const pick = (key, cast = String) => (el) => {
  draft[key] = cast(el.dataset.v);
  app.render();
};

export const onboardingActions = {
  'ob-next': () => {
    draft.step += 1;
    app.render();
    scrollTo(0, 0);
  },
  'ob-back': () => {
    draft.step = Math.max(0, draft.step - 1);
    app.render();
  },
  'ob-goal': pick('goal'),
  'ob-level': pick('level'),
  'ob-template': pick('template'),
  'ob-days': pick('goalDays', Number),
  'ob-finish': finish,
};

export const onboardingInputs = {
  'ob-name': (el) => (draft.name = el.value),
};
