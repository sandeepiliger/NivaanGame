/**
 * The visual layer.
 *
 * Every game describes what to draw with a plain data object ("visual spec")
 * and this module turns it into DOM. Because all games speak the same visual
 * language, a new game type only has to describe content — never markup.
 *
 * Spec shapes:
 *   { kind:'emoji',  value:'🍎', size?:'sm|md|lg|xl' }
 *   { kind:'text',   value:'7', size? }
 *   { kind:'letter', value:'A', lower?:bool }
 *   { kind:'shape',  shape:'circle', color?:'#f2333d', outline?:bool, rotate?:deg, scale?:0..1 }
 *   { kind:'swatch', color:'#f2333d', label?:'Red' }
 *   { kind:'count',  value:'🍎', n:5, layout?:'scatter|row|frame' }
 *   { kind:'dots',   n:5 }
 *   { kind:'stack',  items:[spec, ...], dir?:'row|col' }
 *   { kind:'blank' }
 *   { kind:'op',     value:'+' }
 */

import { h, svg } from '../core/dom.js';
import { shapeById } from '../data/content.js';

const SIZE_CLASS = { xs: 'v--xs', sm: 'v--sm', md: 'v--md', lg: 'v--lg', xl: 'v--xl' };

export function renderVisual(spec, opts = {}) {
  if (!spec) return h('span.v.v--blank');
  const size = SIZE_CLASS[spec.size || opts.size || 'md'] || 'v--md';

  switch (spec.kind) {
    case 'emoji':
      return h(
        'span.v.v--emoji.' + size,
        {
          'aria-hidden': 'true',
          // `scale` lets the size-ordering game show one emoji at several sizes.
          style: spec.scale ? { '--scale': spec.scale } : null,
        },
        spec.value,
      );

    case 'balance':
      return balanceNode(spec);

    case 'text':
      return h('span.v.v--text.' + size, spec.value);

    case 'op':
      return h('span.v.v--op.' + size, spec.value);

    case 'letter':
      return h(
        'span.v.v--letter.' + size,
        { style: spec.color ? { color: spec.color } : null },
        spec.lower ? String(spec.value).toLowerCase() : String(spec.value).toUpperCase(),
      );

    case 'shape':
      return shapeNode(spec, size);

    case 'swatch':
      return h(
        'span.v.v--swatch.' + size,
        { style: { background: spec.color }, 'aria-hidden': 'true' },
        spec.label ? h('span.v__swatchlabel', spec.label) : null,
      );

    case 'count':
      return countNode(spec);

    case 'dots':
      return dotsNode(spec.n);

    case 'stack':
      return h(
        'span.v.v--stack' + (spec.dir === 'col' ? '.v--stack-col' : ''),
        (spec.items || []).map((s) => renderVisual(s, opts)),
      );

    case 'blank':
      return h('span.v.v--blank.' + size, '?');

    default:
      return h('span.v.' + size, String(spec.value ?? ''));
  }
}

/* -------------------------------------------------------------------------- */

function shapeNode(spec, size) {
  const def = shapeById(spec.shape) || shapeById('circle');
  const fill = spec.outline ? 'none' : spec.color || '#6c4ce0';
  const stroke = spec.outline ? spec.color || '#2a2350' : 'rgba(0,0,0,.16)';
  const strokeWidth = spec.outline ? 7 : 3;

  let node;
  const common = {
    fill,
    stroke,
    'stroke-width': strokeWidth,
    'stroke-linejoin': 'round',
    ...(spec.outline && spec.dashed ? { 'stroke-dasharray': '9 7' } : {}),
  };

  if (def.kind === 'circle') node = svg('circle', { cx: 50, cy: 50, r: def.r, ...common });
  else if (def.kind === 'ellipse')
    node = svg('ellipse', { cx: 50, cy: 50, rx: def.rx, ry: def.ry, ...common });
  else if (def.kind === 'path') node = svg('path', { d: def.d, ...common });
  else node = svg('polygon', { points: def.points, ...common });

  const scale = spec.scale ?? 1;
  const transform = [];
  if (spec.rotate) transform.push(`rotate(${spec.rotate} 50 50)`);
  if (scale !== 1) transform.push(`translate(${50 * (1 - scale)} ${50 * (1 - scale)}) scale(${scale})`);
  if (spec.flip) transform.push('translate(100 0) scale(-1 1)');
  if (transform.length) node.setAttribute('transform', transform.join(' '));

  return h(
    'span.v.v--shape.' + size,
    { 'aria-hidden': 'true' },
    svg('svg', { viewBox: '0 0 100 100', width: '100%', height: '100%' }, node),
  );
}

/**
 * `n` copies of an emoji. `scatter` gives an organic, non-grid arrangement
 * (harder, more like real counting); `frame` uses a ten-frame (maths-teaching
 * convention); `row` is a simple line.
 */
function countNode({ value, n, layout = 'scatter', seedOffsets = null }) {
  const wrap = h('span.v.v--count.v--count-' + layout, { 'aria-hidden': 'true' });
  wrap.dataset.n = n;

  for (let i = 0; i < n; i++) {
    const item = h('span.v__countitem', value);
    if (layout === 'scatter' && seedOffsets) {
      const o = seedOffsets[i] || { x: 0, y: 0, r: 0 };
      item.style.transform = `translate(${o.x}px, ${o.y}px) rotate(${o.r}deg)`;
    }
    wrap.appendChild(item);
  }
  if (layout === 'frame') wrap.classList.toggle('v--count-frame-wide', n > 10);
  return wrap;
}

/**
 * A pair of balance scales. `tilt` is -1 (left down), 0 (level) or 1 (right
 * down); the beam and both pans rotate/translate to match.
 */
function balanceNode({ left = [], right = [], tilt = 0 }) {
  const pan = (items, side) =>
    h(
      'span.v__pan.v__pan--' + side,
      h('span.v__pandish'),
      h(
        'span.v__panitems',
        items.map((e) => h('span.v__panitem', e)),
      ),
    );

  return h(
    'span.v.v--balance',
    { 'aria-hidden': 'true', 'data-tilt': tilt },
    h('span.v__beam'),
    h('span.v__pillar'),
    pan(left, 'left'),
    pan(right, 'right'),
  );
}

function dotsNode(n) {
  const wrap = h('span.v.v--dots', { 'aria-hidden': 'true' });
  // Dice faces up to 6 read instantly; above that fall back to a ten-frame.
  wrap.classList.add(n <= 6 ? 'v--dots-die' : 'v--dots-frame');
  wrap.dataset.n = n;
  for (let i = 0; i < n; i++) wrap.appendChild(h('span.v__dot'));
  return wrap;
}

/* -------------------------------------------------------------------------- */

/**
 * Deterministic jitter offsets so a scattered group of objects looks hand-placed
 * but is identical every time the level is replayed.
 */
export function scatterOffsets(rng, n, spread = 10) {
  return Array.from({ length: n }, () => ({
    x: Math.round((rng.next() - 0.5) * spread * 2),
    y: Math.round((rng.next() - 0.5) * spread * 2),
    r: Math.round((rng.next() - 0.5) * 24),
  }));
}

/** Convenience builders keep game code terse and typo-proof. */
export const V = {
  emoji: (value, size) => ({ kind: 'emoji', value, size }),
  text: (value, size) => ({ kind: 'text', value: String(value), size }),
  op: (value) => ({ kind: 'op', value }),
  letter: (value, lower = false) => ({ kind: 'letter', value, lower }),
  shape: (shape, color, extra = {}) => ({ kind: 'shape', shape, color, ...extra }),
  swatch: (color, label) => ({ kind: 'swatch', color, label }),
  count: (value, n, layout = 'scatter', seedOffsets = null) => ({
    kind: 'count', value, n, layout, seedOffsets,
  }),
  balance: (left, right, tilt = 0) => ({ kind: 'balance', left, right, tilt }),
  dots: (n) => ({ kind: 'dots', n }),
  stack: (items, dir = 'row') => ({ kind: 'stack', items, dir }),
  blank: () => ({ kind: 'blank' }),
};

/** Short spoken/text description of a visual, used for the voiceover. */
export function describeVisual(spec) {
  if (!spec) return '';
  switch (spec.kind) {
    case 'text':
    case 'op':
      return String(spec.value);
    case 'letter':
      return `the letter ${String(spec.value).toUpperCase()}`;
    case 'swatch':
      return spec.label || 'this colour';
    case 'shape':
      return (shapeById(spec.shape)?.name || 'shape').toLowerCase();
    case 'count':
      return `${spec.n}`;
    case 'dots':
      return `${spec.n}`;
    case 'stack':
      return (spec.items || []).map(describeVisual).join(' ');
    default:
      return '';
  }
}
