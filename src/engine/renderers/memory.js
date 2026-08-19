/**
 * Memory renderer — flip cards two at a time to find matching pairs.
 *
 * Pairs do not have to be identical: `a` and `b` can be any two visuals, which
 * lets the same renderer teach numeral↔quantity, letter↔picture, shape↔name
 * and colour↔object matching, not just "find the twin".
 *
 * Puzzle fields:
 *   pairs    [{ id, a: visual, b: visual }]
 *   columns  grid width (auto when omitted)
 */

import { h } from '../../core/dom.js';
import { renderVisual } from '../visual.js';
import { sfx, haptic } from '../../core/audio.js';
import { shake, sparkle } from '../../core/fx.js';

const FLIP_BACK_MS = 800;

export function renderMemory(puzzle, api) {
  const cards = [];
  for (const pair of puzzle.pairs) {
    cards.push({ pairId: pair.id, visual: pair.a, key: pair.id + ':a' });
    cards.push({ pairId: pair.id, visual: pair.b, key: pair.id + ':b' });
  }
  const deck = api.rng.shuffle(cards);
  const total = puzzle.pairs.length;

  const columns = puzzle.columns || (deck.length <= 4 ? 2 : deck.length <= 12 ? 4 : deck.length <= 16 ? 4 : 5);

  let first = null;
  let busy = false;
  let matched = 0;

  const grid = h('div.mem__grid', { style: { '--cols': columns } });
  const nodes = new Map();

  for (const card of deck) {
    const face = h('div.mem__face.mem__face--front', renderVisual(card.visual, { size: 'md' }));
    const back = h('div.mem__face.mem__face--back', h('span.mem__mark', '?'));
    const node = h(
      'button.mem__card',
      { type: 'button', 'aria-label': 'card', onclick: () => flip(card, node) },
      h('div.mem__inner', back, face),
    );
    node._card = card;
    nodes.set(card.key, node);
    grid.appendChild(node);
  }

  function flip(card, node) {
    if (busy || node.classList.contains('mem__card--up') || node.classList.contains('mem__card--gone'))
      return;

    node.classList.add('mem__card--up');
    sfx('tap');
    haptic(8);

    if (!first) {
      first = { card, node };
      return;
    }

    const second = { card, node };
    if (first.card.pairId === second.card.pairId) {
      matched += 1;
      busy = true;
      setTimeout(() => {
        [first, second].forEach((c) => {
          c.node.classList.add('mem__card--gone');
          sparkle(c.node, '⭐', 5);
        });
        sfx('correct');
        first = null;
        busy = false;
        api.partial?.(matched / total);
        if (matched >= total) api.correct({ from: grid });
      }, 260);
    } else {
      busy = true;
      shake(node);
      sfx('wrong');
      api.wrong({ from: node });
      const a = first;
      first = null;
      setTimeout(() => {
        a.node.classList.remove('mem__card--up');
        second.node.classList.remove('mem__card--up');
        busy = false;
      }, FLIP_BACK_MS);
    }
  }

  /** Hint briefly reveals every unmatched card. */
  function hint() {
    const hidden = Array.from(nodes.values()).filter(
      (n) => !n.classList.contains('mem__card--gone'),
    );
    if (!hidden.length) return false;
    hidden.forEach((n) => n.classList.add('mem__card--peek'));
    setTimeout(() => hidden.forEach((n) => n.classList.remove('mem__card--peek')), 1400);
    return true;
  }

  function solve() {
    nodes.forEach((n) => n.classList.add('mem__card--up', 'mem__card--gone'));
    matched = total;
  }

  const el = h(
    'div.play__body.play__body--mem',
    puzzle.stemCaption ? h('div.stem__caption', puzzle.stemCaption) : null,
    grid,
  );

  return { el, hint, solve };
}
