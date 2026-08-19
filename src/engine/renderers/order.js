/**
 * Order renderer — put things in the right sequence by tapping them in turn.
 *
 * Tapping (rather than dragging) is deliberate: it is far more reliable for a
 * three-year-old, and it makes the "which comes first?" thinking explicit.
 *
 * Puzzle fields:
 *   items   [{ id, visual, caption? }]  shown shuffled
 *   answer  [id, ...]                   the correct order
 *   trayLabel  text above the answer strip
 */

import { h } from '../../core/dom.js';
import { renderVisual } from '../visual.js';
import { sfx, haptic } from '../../core/audio.js';
import { shake, pulse } from '../../core/fx.js';

export function renderOrder(puzzle, api) {
  const answer = puzzle.answer;
  let step = 0;

  const nodes = new Map();
  const slotNodes = [];

  const strip = h(
    'div.ord__strip',
    { style: { '--n': answer.length } },
    answer.map((_, i) => {
      const slot = h('div.ord__slot', h('span.ord__slotnum', i + 1));
      slotNodes.push(slot);
      return slot;
    }),
  );

  const pool = h('div.ord__pool', { style: { '--n': puzzle.items.length } });

  for (const item of puzzle.items) {
    const btn = h(
      'button.ord__item',
      { type: 'button', 'data-id': item.id, onclick: () => tap(item, btn) },
      renderVisual(item.visual, { size: item.visualSize || 'md' }),
      item.caption ? h('span.ord__caption', item.caption) : null,
    );
    nodes.set(item.id, btn);
    pool.appendChild(btn);
  }

  function tap(item, btn) {
    if (btn.classList.contains('ord__item--used')) return;

    if (item.id === answer[step]) {
      btn.classList.add('ord__item--used');
      const slot = slotNodes[step];
      slot.classList.add('ord__slot--filled');
      slot.appendChild(
        h('span.ord__placed', renderVisual(item.visual, { size: 'sm' })),
      );
      pulse(slot);
      sfx('count', step);
      haptic(12);
      step += 1;
      api.partial?.(step / answer.length);
      if (step >= answer.length) api.correct({ from: strip });
    } else {
      shake(btn);
      sfx('wrong');
      haptic([18, 40, 18]);
      btn.classList.add('ord__item--wrong');
      setTimeout(() => btn.classList.remove('ord__item--wrong'), 420);
      api.wrong({ from: btn });
    }
  }

  function hint() {
    const next = nodes.get(answer[step]);
    if (!next) return false;
    next.classList.add('ord__item--glow');
    setTimeout(() => next.classList.remove('ord__item--glow'), 2000);
    return true;
  }

  function solve() {
    while (step < answer.length) {
      const id = answer[step];
      const item = puzzle.items.find((i) => i.id === id);
      const btn = nodes.get(id);
      btn?.classList.add('ord__item--used');
      const slot = slotNodes[step];
      slot.classList.add('ord__slot--filled');
      slot.appendChild(h('span.ord__placed', renderVisual(item.visual, { size: 'sm' })));
      step += 1;
    }
  }

  const el = h(
    'div.play__body.play__body--ord',
    puzzle.stem ? h('div.stem.stem--sm', renderVisual(puzzle.stem, { size: 'lg' })) : null,
    h('div.ord__label', puzzle.trayLabel || 'Tap them in order'),
    strip,
    pool,
  );

  return { el, hint, solve };
}
