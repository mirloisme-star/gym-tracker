import { generateCoach, pickModel, testKey } from './coach.js';
import { GOALS } from './onboarding.js';
import { buildBackup, restoreBackup, saveMeta, state, validateBackup } from './store.js';
import { app, icons, toast } from './ui.js';
import { esc, fmt, fmtShort, iso, parseNum, today, uid } from './util.js';

const TYPES = { check: 'مکمل / بله-خیر', count: 'شمارشی', number: 'عدد', scale: 'امتیاز ۱ تا ۵' };

let persisted = null;
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
});

export function settingsView() {
  navigator.storage?.persisted?.().then((p) => {
    if (p !== persisted) {
      persisted = p;
      if (location.hash === '#settings') app.render();
    }
  });
  const s = state.settings;
  const last = s.lastBackupAt ? fmtShort(iso(new Date(s.lastBackupAt))) : 'هنوز نگرفتی';
  const trackers = s.trackers
    .map((t, i) => (t.archived ? '' : `<div class="tracker-edit">
        <span><strong>${esc(t.name)}</strong><small>${TYPES[t.type]}${t.unit ? `، ${esc(t.unit)}` : ''}</small></span>
        <button class="icon-btn" data-act="tracker-del" data-i="${i}" aria-label="حذف ${esc(t.name)}">${icons.trash}</button>
      </div>`))
    .join('');
  const ai = s.ai || {};
  const canShare = !!navigator.canShare?.({ files: [new File(['x'], 'x.json', { type: 'application/json' })] });
  return `<div class="page-head"><a class="icon-btn" href="#home" aria-label="برگشت">${icons.right}</a><h1>تنظیمات</h1><span></span></div>
    <section class="card">
      <h2>پروفایل</h2>
      <label class="field"><span>اسم</span><input data-in="profile-name" value="${esc(s.profile?.name || '')}" maxlength="30" placeholder="اسمت"></label>
      <label class="field"><span>هدف</span><select data-change="profile-goal">${Object.entries(GOALS).map(([k, [t]]) => `<option value="${k}" ${s.profile?.goal === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="field"><span>هدف هفتگی (جلسه)</span><input class="num" inputmode="numeric" data-in="weekly-goal" value="${s.weeklyGoal}"></label>
    </section>
    <section class="card" id="ai">
      <h2>${icons.spark} مربی هوشمند</h2>
      <p class="muted">هر روز یه پیام کوتاه از روی تمرین‌ها و عادت‌هات ساخته می‌شه. مربی برای همه فعاله و به کلید نیازی نداری.</p>
      <p class="muted">برای ساختن پیام، خلاصه‌ای از تمرین‌ها، عادت‌ها و اسمت از سرور مربی به GapGPT فرستاده می‌شه و جایی ذخیره نمی‌شه.</p>
      <p class="muted">اگه کلید GapGPT خودت رو داری و می‌خوای مستقیم از حساب خودت استفاده کنی یا مدل رو خودت انتخاب کنی، اینجا بزنش. کلید فقط روی همین گوشی می‌مونه.</p>
      <form class="add-tracker" data-submit="ai-key">
        <input name="key" type="password" dir="ltr" autocomplete="off" placeholder="${ai.key ? 'کلید ذخیره شده. برای عوض کردن، کلید جدید رو بزن' : 'کلید API گپ جی‌پی‌تی'}" aria-label="کلید API">
        <button class="btn primary full">${icons.key} ذخیره و امتحان کلید</button>
      </form>
      ${ai.key && ai.models?.length ? `<label class="field"><span>مدل</span>
        <select dir="ltr" data-change="ai-model">${ai.models.map((m) => `<option ${m === ai.model ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>` : ''}
      ${ai.key ? '<button class="btn ghost full" data-act="ai-remove">حذف کلید و خاموش کردن مربی</button>' : ''}
    </section>
    <section class="card">
      <h2>بک‌آپ</h2>
      <p class="muted">داده‌هات فقط روی همین گوشی ذخیره می‌شن. اگه گوشی عوض بشه یا داده‌های مرورگر پاک بشه، فقط با این فایل برمی‌گردن.</p>
      <p>آخرین بک‌آپ: <strong>${esc(last)}</strong></p>
      <p class="muted">${persisted === true ? 'حافظه دائمی فعاله و مرورگر داده‌ها رو خودکار پاک نمی‌کنه.' : 'حافظه دائمی هنوز تأیید نشده. نصب اپ روی صفحه اصلی معمولاً فعالش می‌کنه.'}</p>
      <div class="btn-row">
        ${canShare ? '<button class="btn primary" data-act="backup-share">ارسال بک‌آپ…</button>' : ''}
        <button class="btn ${canShare ? 'ghost' : 'primary'}" data-act="backup-save">ذخیره فایل</button>
        <label class="btn ghost">بازگردانی<input type="file" accept="application/json,.json" hidden data-change="backup-restore"></label>
      </div>
    </section>
    ${installPrompt ? `<section class="card"><h2>نصب</h2><button class="btn primary full" data-act="install">نصب روی گوشی</button></section>` : ''}
    <section class="card">
      <h2>مواردی که هر روز ثبت می‌کنی</h2>
      ${trackers}
      <form class="add-tracker" data-submit="tracker-add">
        <input name="name" placeholder="اسم، مثلاً کراتین ۵ گرم" aria-label="اسم مورد جدید" required>
        <div class="row">
          <select name="type" aria-label="نوع">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <input name="unit" placeholder="واحد (اختیاری)" aria-label="واحد">
        </div>
        <button class="btn ghost full">${icons.plus} افزودن</button>
      </form>
    </section>
    <section class="card">
      <h2>عمومی</h2>
      <label class="field"><span>استراحت پیش‌فرض (ثانیه)</span><input class="num" inputmode="numeric" data-in="default-rest" value="${s.defaultRest}"></label>
      <label class="field"><span>روز استراحت بعد از هر دور برنامه</span><input class="num" inputmode="numeric" data-in="cycle-rest" value="${s.cycle?.rest ?? 0}"></label>
      <label class="field"><span>ظاهر</span>
        <select data-change="theme">${[['auto', 'مطابق گوشی'], ['dark', 'تیره'], ['light', 'روشن']].map(([k, v]) => `<option value="${k}" ${s.theme === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </label>
    </section>
    <p class="hint center">${fmt(Object.keys(state.sessions).length)} جلسه و ${fmt(Object.keys(state.daily).length)} روز ثبت شده</p>`;
}

const backupFile = () =>
  new File([JSON.stringify(buildBackup())], `gym-backup-${today()}.json`, { type: 'application/json' });

function markBackedUp() {
  state.settings.lastBackupAt = new Date().toISOString();
  saveMeta('settings');
  app.render();
}

export const applyTheme = () => {
  const t = state.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
};

export const settingsActions = {
  'backup-save': () => {
    const url = URL.createObjectURL(backupFile());
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    markBackedUp();
    toast('فایل بک‌آپ دانلود شد');
  },
  'backup-share': async () => {
    try {
      await navigator.share({ files: [backupFile()], title: 'بک‌آپ باشگاه' });
      markBackedUp();
    } catch (e) {
      if (e.name !== 'AbortError') toast('ارسال نشد. «ذخیره فایل» رو امتحان کن.', 'err');
    }
  },
  install: async () => {
    await installPrompt?.prompt();
    installPrompt = null;
    app.render();
  },
  'ai-remove': () => {
    if (!confirm('کلید API از این گوشی پاک بشه؟')) return;
    delete state.settings.ai;
    saveMeta('settings');
    app.render();
  },
  'tracker-del': (el) => {
    const t = state.settings.trackers[Number(el.dataset.i)];
    if (!confirm(`«${t.name}» از لیست ثبت روزانه برداشته بشه؟ داده‌های قبلیش نگه داشته می‌شن.`)) return;
    t.archived = true;
    saveMeta('settings');
    app.render();
  },
};

export const settingsInputs = {
  'profile-name': (el) => {
    state.settings.profile = { ...state.settings.profile, name: el.value.trim() };
    saveMeta('settings');
  },
  'weekly-goal': (el) => {
    const n = parseNum(el.value);
    if (n >= 1 && n <= 7) {
      state.settings.weeklyGoal = n;
      saveMeta('settings');
    }
  },
  'cycle-rest': (el) => {
    state.settings.cycle.rest = parseNum(el.value) || 0;
    saveMeta('settings');
  },
  'default-rest': (el) => {
    state.settings.defaultRest = parseNum(el.value) || 0;
    saveMeta('settings');
  },
};

export const settingsChanges = {
  'ai-model': (el) => {
    state.settings.ai.model = el.value;
    saveMeta('settings');
    state.coach = null;
    toast(`مدل عوض شد: ${el.value}`);
  },
  'profile-goal': (el) => {
    state.settings.profile = { ...state.settings.profile, goal: el.value };
    saveMeta('settings');
  },
  theme: (el) => {
    state.settings.theme = el.value;
    saveMeta('settings');
    applyTheme();
  },
  'backup-restore': async (el) => {
    const file = el.files[0];
    if (!file) return;
    let obj;
    try {
      obj = JSON.parse(await file.text());
    } catch {
      toast('این فایل قابل خواندن نیست.', 'err');
      return;
    }
    const problem = validateBackup(obj);
    if (problem) {
      toast(problem, 'err');
      return;
    }
    const d = obj.data;
    const when = obj.exportedAt ? fmtShort(iso(new Date(obj.exportedAt))) : 'نامشخص';
    if (!confirm(`بک‌آپ ${when} با ${Object.keys(d.sessions).length} جلسه جایگزین همه داده‌های فعلی این گوشی بشه؟`)) return;
    try {
      await restoreBackup(obj);
      applyTheme();
      toast('داده‌ها برگشتن', 'win');
      app.render();
    } catch {
      toast('بازگردانی انجام نشد و داده‌های فعلی دست نخورده موندن.', 'err');
    }
  },
};

export const settingsSubmits = {
  'ai-key': async (form) => {
    const key = form.elements.key.value.trim();
    if (!key) return;
    toast('در حال امتحان کلید…');
    const { models, error } = await testKey(key);
    if (error) {
      toast(error, 'err');
      return;
    }
    state.settings.ai = { key, models, model: pickModel(models) };
    saveMeta('settings');
    state.coach = null;
    toast(`کلید درسته. مدل: ${state.settings.ai.model}`, 'win');
    generateCoach({ force: true });
    location.hash = '#home';
  },
  'tracker-add': (form) => {
    const name = form.elements.name.value.trim();
    if (!name) return;
    const type = form.elements.type.value;
    state.settings.trackers.push({ id: uid(), name, type, unit: form.elements.unit.value.trim(), step: 1 });
    saveMeta('settings');
    app.render();
    toast(`«${name}» اضافه شد`);
  },
};
