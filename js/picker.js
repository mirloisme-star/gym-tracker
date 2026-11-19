// Exercise picker: search the library in Persian or English, filter by muscle, pick several at
// once, or add a custom exercise. Lives inside the shared <dialog>.
import { LIBRARY, normalize, searchLibrary } from './library.js';
import { KINDS, MUSCLES, findOrCreateExercise, state } from './store.js';
import { icons } from './ui.js';
import { esc, fmt } from './util.js';

const MUSCLE_ORDER = ['سینه', 'پشت', 'سرشانه', 'جلوبازو', 'پشت‌بازو', 'ساعد', 'پا', 'ساق', 'شکم', 'کاردیو', 'اصلاحی', 'سایر'];

let pick = null; // { title, onPick, single, query, muscle, chosen: Map<fa, entry>, custom }

// The user's own exercises that aren't in the library, shaped like library entries.
function ownEntries() {
  const lib = new Set(LIBRARY.map((x) => normalize(x.fa)));
  return state.exercises
    .filter((ex) => !lib.has(normalize(ex.name)))
    .map((ex) => ({ fa: ex.name, en: ex.en || '', muscle: ex.muscle, kind: ex.kind || 'strength', own: true }));
}

function rows() {
  const all = [...ownEntries(), ...LIBRARY];
  const filtered = searchLibrary(pick.query, all).filter((x) => pick.muscle === 'all' || x.muscle === pick.muscle);
  const used = new Set(state.exercises.map((ex) => normalize(ex.name)));
  const exact = all.some((x) => normalize(x.fa) === normalize(pick.query));
  const custom = pick.query.trim() && !exact
    ? `<button type="button" class="pick-row custom" data-p="custom"><span class="pick-check">${icons.plus}</span>
        <span><strong>«${esc(pick.query.trim())}» به‌عنوان حرکت جدید</strong><small>توی لیست نیست؟ خودت اضافه‌اش کن</small></span></button>`
    : '';
  if (!filtered.length) return `${custom}<p class="muted center pad">حرکتی پیدا نشد.</p>`;
  return custom + filtered.slice(0, 120).map((x) => {
    const on = pick.chosen.has(x.fa);
    return `<button type="button" class="pick-row" data-p="toggle" data-fa="${esc(x.fa)}" aria-pressed="${on}">
      <span class="pick-check">${icons.check}</span>
      <span class="pick-names"><strong>${esc(x.fa)}</strong>${x.en ? `<small dir="ltr">${esc(x.en)}</small>` : ''}</span>
      <span class="pick-tag">${esc(x.muscle)}${used.has(normalize(x.fa)) ? ' ✓' : ''}</span>
    </button>`;
  }).join('') + (filtered.length > 120 ? `<p class="muted center pad">${fmt(filtered.length - 120)} حرکت دیگه. دقیق‌تر جستجو کن.</p>` : '');
}

function footer() {
  const n = pick.chosen.size;
  return `<button type="button" class="btn ghost" data-p="close">انصراف</button>
    <button type="button" class="btn primary" data-p="done" ${n ? '' : 'disabled'}>${n ? `افزودن ${fmt(n)} حرکت` : 'حرکت رو انتخاب کن'}</button>`;
}

function customForm() {
  return `<div class="pick-custom">
    <h3>حرکت جدید: ${esc(pick.query.trim())}</h3>
    <label class="field"><span>عضله اصلی</span><select id="pick-muscle">${MUSCLES.map((m) => `<option>${m}</option>`).join('')}</select></label>
    <label class="field"><span>نوع ثبت</span><select id="pick-kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></label>
    <div class="row-end"><button type="button" class="btn ghost" data-p="custom-cancel">برگشت</button><button type="button" class="btn primary" data-p="custom-add">اضافه کن</button></div>
  </div>`;
}

function render() {
  const dlg = document.getElementById('dialog');
  const muscles = MUSCLE_ORDER.filter((m) => LIBRARY.some((x) => x.muscle === m));
  dlg.innerHTML = `<div class="picker">
    <div class="picker-head"><h2>${esc(pick.title)}</h2><button type="button" class="icon-btn" data-p="close" aria-label="بستن">${icons.x}</button></div>
    ${pick.custom ? customForm() : `
    <input class="pick-search" type="search" placeholder="جستجو: پرس سینه، squat، curl…" value="${esc(pick.query)}" aria-label="جستجوی حرکت" autocomplete="off">
    <div class="chips pick-chips">${[['all', 'همه'], ...muscles.map((m) => [m, m])].map(([k, l]) => `<button type="button" class="chip" data-p="muscle" data-m="${esc(k)}" aria-pressed="${pick.muscle === k}">${esc(l)}</button>`).join('')}</div>
    <div class="pick-list">${rows()}</div>
    <div class="pick-foot">${footer()}</div>`}
  </div>`;
}

function refreshList() {
  const dlg = document.getElementById('dialog');
  dlg.querySelector('.pick-list').innerHTML = rows();
  dlg.querySelector('.pick-foot').innerHTML = footer();
}

function finish(entries) {
  const exercises = entries.map((x) => {
    const ex = findOrCreateExercise(x.fa, x.muscle, x.kind);
    if (x.en && !ex.en) ex.en = x.en;
    return ex;
  });
  const { onPick } = pick;
  document.getElementById('dialog').close(); // clears pick
  onPick(exercises);
}

function onClick(e) {
  const el = e.target.closest('[data-p]');
  if (!el || !pick) return;
  const all = [...ownEntries(), ...LIBRARY];
  switch (el.dataset.p) {
    case 'close':
      document.getElementById('dialog').close();
      pick = null;
      return;
    case 'muscle':
      pick.muscle = el.dataset.m;
      render();
      return;
    case 'toggle': {
      const entry = all.find((x) => x.fa === el.dataset.fa);
      if (pick.single) return finish([entry]);
      if (pick.chosen.has(entry.fa)) pick.chosen.delete(entry.fa);
      else pick.chosen.set(entry.fa, entry);
      el.setAttribute('aria-pressed', pick.chosen.has(entry.fa));
      document.getElementById('dialog').querySelector('.pick-foot').innerHTML = footer();
      return;
    }
    case 'custom':
      pick.custom = true;
      render();
      return;
    case 'custom-cancel':
      pick.custom = false;
      render();
      return;
    case 'custom-add': {
      const dlg = document.getElementById('dialog');
      const entry = { fa: pick.query.trim(), en: '', muscle: dlg.querySelector('#pick-muscle').value, kind: dlg.querySelector('#pick-kind').value };
      if (pick.single) return finish([entry]);
      pick.chosen.set(entry.fa, entry);
      pick.custom = false;
      pick.query = '';
      render();
      return;
    }
    case 'done':
      if (pick.chosen.size) finish([...pick.chosen.values()]);
  }
}

function onInput(e) {
  if (!pick || !e.target.classList.contains('pick-search')) return;
  pick.query = e.target.value;
  refreshList();
}

// onPick receives an array of exercises (created if they're new). single closes on the first tap.
export function openPicker(title, onPick, { single = false } = {}) {
  pick = { title, onPick, single, query: '', muscle: 'all', chosen: new Map(), custom: false };
  const dlg = document.getElementById('dialog');
  dlg.className = 'picker-dialog';
  dlg.onclick = onClick;
  dlg.oninput = onInput;
  dlg.onclose = () => {
    dlg.onclick = null;
    dlg.oninput = null;
    dlg.onclose = null;
    pick = null;
  };
  render();
  dlg.showModal();
}
