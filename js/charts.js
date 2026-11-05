// Small SVG charts. Time runs left to right, numbers and tooltips use the app font.
import { diffDays, esc, fmt, fmtCompact, fmtShort, parseDate } from './util.js';

let nextId = 0;
const registry = new Map();
export const resetCharts = () => registry.clear();

const MARGIN = { top: 22, right: 14, bottom: 26, left: 54 };

function niceTicks(min, max, count = 4) {
  if (min === max) {
    min = min === 0 ? 0 : min * 0.9;
    max = max === 0 ? 1 : max * 1.1;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t * 1000) / 1000);
  return ticks;
}

function yAxis(ticks, y, width, format) {
  return ticks
    .map((t) => `<line class="grid" x1="${MARGIN.left}" x2="${width - MARGIN.right}" y1="${y(t)}" y2="${y(t)}"/>
      <text class="tick" x="${MARGIN.left - 6}" y="${y(t) + 4}" text-anchor="end">${format(t)}</text>`)
    .join('');
}

function frame(id, width, height, body, label) {
  return `<figure class="chart" data-chart="${id}" tabindex="0" role="img" aria-label="${esc(label)}">
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}
      <g class="hover" hidden><line class="cross" y1="${MARGIN.top - 8}" y2="${height - MARGIN.bottom}"/><circle class="ring" r="5"/></g>
    </svg></figure>`;
}

// points: [{ date, y, tip, mark }]; mark draws a dot, used for records.
export function lineChart({ points, width, height = 180, label, format = fmtCompact, endLabel }) {
  const id = `c${nextId++}`;
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const first = points[0].date;
  const span = Math.max(1, diffDays(points.at(-1).date, first));
  const ticks = niceTicks(Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.y)));
  const lo = ticks[0];
  const hi = ticks.at(-1);
  const x = (d) => (points.length === 1 ? MARGIN.left + plotW / 2 : MARGIN.left + (diffDays(d, first) / span) * plotW);
  const y = (v) => MARGIN.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  const coords = points.map((p) => ({ px: x(p.date), py: y(p.y), tip: p.tip }));
  const path = coords.map((c, i) => `${i ? 'L' : 'M'}${c.px.toFixed(1)} ${c.py.toFixed(1)}`).join('');
  const area = `${path}L${coords.at(-1).px.toFixed(1)} ${height - MARGIN.bottom}L${coords[0].px.toFixed(1)} ${height - MARGIN.bottom}Z`;
  const last = coords.at(-1);
  const dots = points.map((p, i) => (p.mark || i === points.length - 1 ? `<circle class="dot" cx="${coords[i].px}" cy="${coords[i].py}" r="4"/>` : '')).join('');
  const dateLabels = [points[0].date];
  if (span > 30 && points.length > 2) dateLabels.push(points[Math.floor(points.length / 2)].date);
  if (points.length > 1) dateLabels.push(points.at(-1).date);
  const xTicks = dateLabels
    .map((d, i) => `<text class="tick" x="${x(d)}" y="${height - 8}" text-anchor="${i === 0 ? (points.length === 1 ? 'middle' : 'start') : i === dateLabels.length - 1 ? 'end' : 'middle'}">${esc(fmtShort(d))}</text>`)
    .join('');
  const end = endLabel ?? format(points.at(-1).y);
  const body = `${yAxis(ticks, y, width, format)}${points.length > 1 ? `<path class="area" d="${area}"/><path class="line" d="${path}"/>` : ''}${dots}
    <text class="end-label" x="${Math.min(last.px, width - MARGIN.right)}" y="${Math.max(last.py - 10, 12)}" text-anchor="end">${esc(end)}</text>${xTicks}`;
  registry.set(id, coords);
  return frame(id, width, height, body, label);
}

// bars: [{ date, value, tip }]; zero-height bars stay in place so gaps are visible.
export function barChart({ bars, width, height = 160, label, format = fmtCompact, tone = '' }) {
  const id = `c${nextId++}`;
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const ticks = niceTicks(0, Math.max(1, ...bars.map((b) => b.value)));
  const hi = ticks.at(-1);
  const y = (v) => MARGIN.top + plotH - (v / hi) * plotH;
  const slot = plotW / bars.length;
  const w = Math.max(2, Math.min(24, slot - 2));
  const coords = [];
  let marks = '';
  bars.forEach((b, i) => {
    const cx = MARGIN.left + slot * i + slot / 2;
    const top = y(b.value);
    coords.push({ px: cx, py: top, tip: b.tip });
    if (b.value > 0) {
      const r = Math.min(4, w / 2, y(0) - top);
      marks += `<path class="bar ${tone}" d="M${cx - w / 2} ${y(0)}V${top + r}Q${cx - w / 2} ${top} ${cx - w / 2 + r} ${top}H${cx + w / 2 - r}Q${cx + w / 2} ${top} ${cx + w / 2} ${top + r}V${y(0)}Z"/>`;
    }
  });
  const anchor = [0, bars.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  const xTicks = anchor
    .map((i) => `<text class="tick" x="${coords[i].px}" y="${height - 8}" text-anchor="${i === 0 && bars.length > 1 ? 'start' : 'end'}">${esc(fmtShort(bars[i].date))}</text>`)
    .join('');
  const body = `${yAxis(ticks, y, width, format)}<line class="axis" x1="${MARGIN.left}" x2="${width - MARGIN.right}" y1="${y(0)}" y2="${y(0)}"/>${marks}${xTicks}`;
  registry.set(id, coords);
  return frame(id, width, height, body, label);
}

export function tableView(headers, rows) {
  if (!rows.length) return '';
  return `<details class="table-view"><summary>نمایش جدول</summary><div class="table-scroll"><table>
    <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div></details>`;
}

// Attendance grid for the most recent weeks. Columns are weeks, rows Saturday to Friday.
const CELL_TIPS = { on: 'باشگاه، ثبت‌شده', plan: 'باشگاه، طبق برنامه', home: 'تمرین در خانه', '': 'بدون تمرین' };

export function heatmap(kindOfDay, endDate, weeks = 20) {
  const startOfThisWeek = parseDate(endDate);
  startOfThisWeek.setDate(startOfThisWeek.getDate() - (startOfThisWeek.getDay() + 1) % 7);
  const cells = [];
  for (let w = weeks - 1; w >= 0; w--) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(startOfThisWeek);
      day.setDate(day.getDate() - w * 7 + d);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      if (key > endDate) cells.push('<i class="cell future"></i>');
      else {
        const kind = kindOfDay(key);
        cells.push(`<i class="cell ${kind}" data-tip="${esc(fmtShort(key))}: ${CELL_TIPS[kind]}"></i>`);
      }
    }
  }
  return `<div class="heatmap" style="--weeks:${weeks}" role="img" aria-label="تقویم تمرین در ${fmt(weeks)} هفته اخیر">${cells.join('')}</div>
    <div class="legend"><span><i class="cell on"></i>ثبت‌شده</span><span><i class="cell plan"></i>طبق برنامه</span><span><i class="cell home"></i>خانه</span><span><i class="cell"></i>بدون تمرین</span></div>
    <p class="caption">هر ستون یک هفته است، از شنبه تا جمعه. ستون راست هفته جاریه.</p>`;
}

function showTip(text, x, y) {
  const tip = document.getElementById('tip');
  tip.textContent = text;
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = `${Math.max(8, Math.min(innerWidth - r.width - 8, x - r.width / 2))}px`;
  tip.style.top = `${Math.max(8, y - r.height - 14)}px`;
}

function hideTips() {
  document.getElementById('tip').hidden = true;
  document.querySelectorAll('.chart .hover').forEach((g) => g.setAttribute('hidden', ''));
}

function highlight(fig, index) {
  const coords = registry.get(fig.dataset.chart);
  if (!coords) return;
  const c = coords[index];
  const g = fig.querySelector('.hover');
  g.removeAttribute('hidden');
  g.querySelector('.cross').setAttribute('x1', c.px);
  g.querySelector('.cross').setAttribute('x2', c.px);
  const ring = g.querySelector('.ring');
  ring.setAttribute('cx', c.px);
  ring.setAttribute('cy', c.py);
  fig.dataset.at = index;
  const box = fig.querySelector('svg').getBoundingClientRect();
  showTip(c.tip, box.left + c.px, box.top + c.py);
}

function nearest(fig, clientX) {
  const coords = registry.get(fig.dataset.chart) || [];
  const x = clientX - fig.querySelector('svg').getBoundingClientRect().left;
  let best = 0;
  coords.forEach((c, i) => {
    if (Math.abs(c.px - x) < Math.abs(coords[best].px - x)) best = i;
  });
  return best;
}

export function bindChartEvents() {
  document.addEventListener('pointermove', (e) => {
    const fig = e.target.closest?.('.chart');
    if (fig) highlight(fig, nearest(fig, e.clientX));
  });
  document.addEventListener('pointerdown', (e) => {
    const fig = e.target.closest?.('.chart');
    const cell = e.target.closest?.('[data-tip]');
    if (fig) highlight(fig, nearest(fig, e.clientX));
    else if (cell) {
      const r = cell.getBoundingClientRect();
      hideTips();
      showTip(cell.dataset.tip, r.left + r.width / 2, r.top);
    } else hideTips();
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'mouse' && e.target.closest?.('.chart') && !e.relatedTarget?.closest?.('.chart')) hideTips();
  });
  document.addEventListener('keydown', (e) => {
    const fig = e.target.closest?.('.chart');
    if (!fig || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const size = registry.get(fig.dataset.chart)?.length || 0;
    const at = Number(fig.dataset.at ?? size - 1) + (e.key === 'ArrowRight' ? 1 : -1);
    highlight(fig, Math.max(0, Math.min(size - 1, at)));
  });
  document.addEventListener('focusin', (e) => {
    if (e.target.classList?.contains('chart')) highlight(e.target, registry.get(e.target.dataset.chart)?.length - 1 || 0);
  });
  window.addEventListener('scroll', hideTips, { passive: true });
}
