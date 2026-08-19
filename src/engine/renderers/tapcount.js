/**
 * Tap-count renderer — an attention game.
 *
 * A scene is scattered with objects; the child taps every one of a given kind.
 * Unlike a neat grid this trains visual search, which is exactly what the
 * "find all the butterflies" style levels are for.
 *
 * Puzzle fields:
 *   scene    [{ emoji, x, y, scale, rot }]  x/y are percentages 0..100
 *   targets  [index] indices into `scene` that must be tapped
 *   findEmoji  the emoji being hunted (shown in the prompt badge)
 */

import { h } from '../../core/dom.js';
import { renderVisual } from '../visual.js';
import { sfx, haptic } from '../../core/audio.js';
import { shake, pulse, floatText } from '../../core/fx.js';

export function renderTapCount(puzzle, api) {
  const targets = new Set(puzzle.targets);
  const found = new Set();

  const sceneEl = h('div.tap__scene');
  const nodes = [];

  puzzle.scene.forEach((item, i) => {
    const node = h(
      'button.tap__item',
      {
        type: 'button',
        style: {
          left: item.x + '%',
          top: item.y + '%',
          '--s': item.scale ?? 1,
          '--r': (item.rot ?? 0) + 'deg',
        },
        'aria-label': 'object',
        onclick: () => tap(i, node),
      },
      // Scene items are either an emoji/letter glyph or a drawn shape.
      item.shapeVisual ? renderVisual(item.shapeVisual, { size: 'sm' }) : item.emoji,
    );
    nodes.push(node);
    sceneEl.appendChild(node);
  });

  const counterEl = h(
    'div.tap__counter',
    h(
      'span.tap__badge',
      puzzle.findVisual ? renderVisual(puzzle.findVisual, { size: 'sm' }) : puzzle.findEmoji || '🔍',
    ),
    h('span.tap__count', `0 / ${targets.size}`),
  );

  function tap(i, node) {
    if (node.classList.contains('tap__item--got')) return;

    if (targets.has(i)) {
      found.add(i);
      node.classList.add('tap__item--got');
      pulse(node, 1.3);
      floatText('+1', node, '#3ecf6d');
      sfx('count', found.size - 1);
      haptic(12);
      counterEl.querySelector('.tap__count').textContent = `${found.size} / ${targets.size}`;
      api.partial?.(found.size / targets.size);
      if (found.size >= targets.size) api.correct({ from: sceneEl });
    } else {
      shake(node);
      sfx('oops');
      haptic([18, 40, 18]);
      node.classList.add('tap__item--miss');
      setTimeout(() => node.classList.remove('tap__item--miss'), 420);
      api.wrong({ from: node });
    }
  }

  function hint() {
    const next = puzzle.targets.find((i) => !found.has(i));
    if (next === undefined) return false;
    nodes[next].classList.add('tap__item--glow');
    setTimeout(() => nodes[next].classList.remove('tap__item--glow'), 2000);
    return true;
  }

  function solve() {
    for (const i of puzzle.targets) {
      found.add(i);
      nodes[i].classList.add('tap__item--got');
    }
    counterEl.querySelector('.tap__count').textContent = `${found.size} / ${targets.size}`;
  }

  return {
    el: h('div.play__body.play__body--tap', counterEl, sceneEl),
    hint,
    solve,
  };
}
