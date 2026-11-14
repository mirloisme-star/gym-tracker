// Front and back muscle chart. The artwork lives in body-paths.js; this file only colours it.
import { BACK_PARTS, FRONT_PARTS, OUTLINE_BACK, OUTLINE_FRONT } from './body-paths.js';

// The artwork has one deltoid per view. It is cut in two: the outer part is the side head, and the
// inner part is the front head (front view) or the rear head (back view).
const VIEWS = {
  front: { box: '0 0 724 1448', parts: FRONT_PARTS, outline: OUTLINE_FRONT, inner: 'frontDelt', cut: [228, 500] },
  back: { box: '724 0 724 1448', parts: BACK_PARTS, outline: OUTLINE_BACK, inner: 'rearDelt', cut: [940, 1227] },
};

function shape(d, region, levels, picked, clip) {
  const cls = `m l${levels[region] || 0}${region === picked ? ' picked' : ''}`;
  return `<path d="${d}" class="${cls}"${clip ? ` clip-path="url(#${clip})"` : ''} data-act="body-pick" data-region="${region}"/>`;
}

function figure(side, title, levels, picked) {
  const v = VIEWS[side];
  const [a, b] = v.cut;
  const shapes = v.parts.map(([kind, d]) => {
    if (kind === 'base') return `<path d="${d}" class="part"/>`;
    if (kind === 'hair') return `<path d="${d}" class="hair"/>`;
    if (kind === 'delt') {
      return shape(d, 'sideDelt', levels, picked, `${side}-out`) + shape(d, v.inner, levels, picked, `${side}-in`);
    }
    return shape(d, kind, levels, picked);
  }).join('');
  return `<figure class="body-fig">
    <svg viewBox="${v.box}" role="img" aria-label="${title}">
      <defs>
        <clipPath id="${side}-out"><rect x="0" y="0" width="${a}" height="1448"/><rect x="${b}" y="0" width="1448" height="1448"/></clipPath>
        <clipPath id="${side}-in"><rect x="${a}" y="0" width="${b - a}" height="1448"/></clipPath>
      </defs>
      <path d="${v.outline}" class="outline"/>
      ${shapes}
    </svg>
    <figcaption>${title}</figcaption>
  </figure>`;
}

export function bodyChart(levels, picked) {
  return `<div class="body-charts">
    ${figure('front', 'جلو', levels, picked)}
    ${figure('back', 'پشت', levels, picked)}
  </div>`;
}
