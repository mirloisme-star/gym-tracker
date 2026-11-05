// Pure helpers. No DOM here, so stats and tests can import this under Node.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Persian keyboards type ۱۲٫۵, so inputs have to accept those digits.
export function parseNum(raw) {
  const s = String(raw ?? '')
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[٫,]/g, '.')
    .trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Target reps as typed in the editor: "12", "8-12" or a per-set list "8,10,12".
export function parseRepsText(raw) {
  const text = String(raw ?? '').trim();
  const parts = text.split(/[,،\s]+/).map(parseNum).filter((n) => n != null);
  if (parts.length > 1) return { repsMin: Math.min(...parts), repsMax: Math.max(...parts), repScheme: parts };
  const range = text.split(/[-–—]/).map(parseNum);
  if (range.length === 2 && range[0] != null && range[1] != null) {
    return { repsMin: Math.min(...range), repsMax: Math.max(...range), repScheme: null };
  }
  return { repsMin: parts[0] ?? null, repsMax: parts[0] ?? null, repScheme: null };
}

export function repsToText(item) {
  if (item.repScheme?.length) return item.repScheme.join(',');
  if (item.repsMin && item.repsMax && item.repsMin !== item.repsMax) return `${item.repsMin}-${item.repsMax}`;
  return String(item.repsMax ?? item.repsMin ?? '');
}

const numFmt = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const compactFmt = new Intl.NumberFormat('fa-IR', { notation: 'compact', maximumFractionDigits: 1 });
export const fmt = (n) => (n == null || Number.isNaN(n) ? '–' : numFmt.format(n));
export const fmtCompact = (n) => (n == null || Number.isNaN(n) ? '–' : compactFmt.format(n));

// Dates are local 'YYYY-MM-DD' strings. Noon avoids DST edge cases.
export const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
export const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => iso(new Date());
export const addDays = (s, n) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const diffDays = (a, b) => Math.round((parseDate(a) - parseDate(b)) / 86400000);
// 0 = Saturday, the first day of the Persian week.
export const weekdayIndex = (s) => (parseDate(s).getDay() + 1) % 7;
export const weekStart = (s) => addDays(s, -weekdayIndex(s));
export const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

const fa = (opts) => new Intl.DateTimeFormat('fa-IR-u-ca-persian', opts);
const longFmt = fa({ weekday: 'long', day: 'numeric', month: 'long' });
const shortFmt = fa({ day: 'numeric', month: 'long' });
export const fmtLong = (s) => longFmt.format(parseDate(s));
export const fmtShort = (s) => shortFmt.format(parseDate(s));

export const median = (arr) => {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
export const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
