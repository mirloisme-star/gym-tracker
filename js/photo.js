// Post-workout photos. The full photo goes to the phone's gallery as a download; the app
// keeps a small copy so progress can be compared over time.
import { savePhoto, state } from './store.js';
import { app, icons, toast } from './ui.js';
import { esc, fmtShort, today } from './util.js';

const THUMB = 480;

async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, THUMB / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.78);
}

// Android saves downloads to the Download folder, which the gallery shows.
function toGallery(file, date) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gym-${date}-${Date.now().toString(36)}.jpg`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// The camera opens from a file input with capture; the front camera suits a mirror-free selfie.
export function photoButton(date = today(), label = 'عکس بعد از تمرین') {
  const has = !!state.photos[date];
  return `<label class="photo-btn ${has ? 'has' : ''}">
    ${has ? `<img src="${state.photos[date].thumb}" alt="">` : `<span class="photo-icon">${icons.camera}</span>`}
    <span><strong>${has ? 'عکس امروز گرفته شد' : esc(label)}</strong><small>${has ? 'برای عکس جدید دوباره بزن' : 'دوربین باز می‌شه و عکس توی گالری ذخیره می‌شه'}</small></span>
    <input type="file" accept="image/*" capture="user" hidden data-change="photo-take" data-date="${date}">
  </label>`;
}

export function photoStrip(limit = 12) {
  const list = Object.values(state.photos).sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!list.length) return '';
  const first = list.at(-1);
  const last = list[0];
  return `${list.length > 1 ? `<div class="compare">
      <figure><img src="${first.thumb}" alt="عکس ${esc(fmtShort(first.date))}"><figcaption>${esc(fmtShort(first.date))}</figcaption></figure>
      <figure><img src="${last.thumb}" alt="عکس ${esc(fmtShort(last.date))}"><figcaption>${esc(fmtShort(last.date))}</figcaption></figure>
    </div>` : ''}
    <div class="photo-grid">${list.slice(0, limit).map((p) => `<figure><img src="${p.thumb}" alt="" loading="lazy"><figcaption>${esc(fmtShort(p.date))}</figcaption></figure>`).join('')}</div>`;
}

export const photoChanges = {
  'photo-take': async (el) => {
    const file = el.files[0];
    if (!file) return;
    const date = el.dataset.date || today();
    toGallery(file, date);
    try {
      state.photos[date] = { date, thumb: await shrink(file), at: Date.now() };
      savePhoto(date);
      toast('عکس ذخیره شد. توی گالری، پوشه Download', 'win');
      document.dispatchEvent(new CustomEvent('photo-saved', { detail: date }));
    } catch {
      toast('عکس توی گالری ذخیره شد، ولی نسخه داخل اپ ساخته نشد.', 'err');
    }
    app.render();
  },
};
