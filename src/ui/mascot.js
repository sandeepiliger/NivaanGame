/**
 * Nivi — the game's mascot. A friendly little robot drawn entirely in SVG so it
 * scales crisply on any screen and adds nothing to the download.
 */

import { svg, h } from '../core/dom.js';

export function mascot({ mood = 'happy', size = 160 } = {}) {
  const eyes =
    mood === 'wink'
      ? [svg('circle', { cx: 40, cy: 52, r: 7, fill: '#0f2b3d' }), svg('path', { d: 'M55,52 q7,-6 14,0', stroke: '#0f2b3d', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' })]
      : mood === 'think'
        ? [svg('circle', { cx: 42, cy: 50, r: 7, fill: '#0f2b3d' }), svg('circle', { cx: 66, cy: 50, r: 7, fill: '#0f2b3d' })]
        : [svg('circle', { cx: 40, cy: 52, r: 8, fill: '#0f2b3d' }), svg('circle', { cx: 64, cy: 52, r: 8, fill: '#0f2b3d' })];

  const mouth =
    mood === 'think'
      ? svg('path', { d: 'M44,72 q8,4 16,0', stroke: '#0f2b3d', 'stroke-width': 4, fill: 'none', 'strokeLinecap': 'round' })
      : svg('path', {
          d: 'M38,68 q14,16 28,0 z',
          fill: '#ff4f81',
          stroke: '#0f2b3d',
          'stroke-width': 3,
          'stroke-linejoin': 'round',
        });

  const art = svg(
    'svg',
    { viewBox: '0 0 104 120', width: size, height: size, class: 'mascot', role: 'img', 'aria-label': 'Nivi the robot' },
    // antennae
    svg('line', { x1: 26, y1: 26, x2: 14, y2: 8, stroke: '#4a2fb0', 'stroke-width': 5, 'stroke-linecap': 'round' }),
    svg('line', { x1: 78, y1: 26, x2: 90, y2: 8, stroke: '#4a2fb0', 'stroke-width': 5, 'stroke-linecap': 'round' }),
    svg('circle', { cx: 14, cy: 8, r: 7, fill: '#ff4f81' }),
    svg('circle', { cx: 90, cy: 8, r: 7, fill: '#35d0e8' }),
    // body
    svg('rect', { x: 22, y: 86, width: 60, height: 30, rx: 14, fill: '#ffcc29', stroke: '#0f2b3d', 'stroke-width': 3 }),
    svg('circle', { cx: 52, cy: 101, r: 6, fill: '#fff', stroke: '#0f2b3d', 'stroke-width': 2.5 }),
    // head
    svg('rect', { x: 12, y: 20, width: 80, height: 72, rx: 30, fill: '#ffffff', stroke: '#0f2b3d', 'stroke-width': 3.5 }),
    // visor
    svg('rect', { x: 22, y: 36, width: 60, height: 34, rx: 17, fill: '#c9f4ff', stroke: '#0f2b3d', 'stroke-width': 3 }),
    ...eyes,
    svg('circle', { cx: 37, cy: 49, r: 2.6, fill: '#fff' }),
    svg('circle', { cx: 61, cy: 49, r: 2.6, fill: '#fff' }),
    // cheeks
    svg('circle', { cx: 24, cy: 72, r: 6, fill: '#ffb3c9', opacity: 0.9 }),
    svg('circle', { cx: 80, cy: 72, r: 6, fill: '#ffb3c9', opacity: 0.9 }),
    mouth,
  );

  return h('div.mascot-wrap', { style: { width: size + 'px', height: size + 'px' } }, art);
}

/** A speech bubble beside the mascot. */
export function speechBubble(text) {
  return h('div.bubble', h('span', text));
}
