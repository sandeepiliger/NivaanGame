/**
 * Pop renderer — the simplest possible loop, built for two- and three-year-olds.
 *
 * Bubbles drift on screen; touching one pops it. There is no wrong answer and
 * nothing to read: it is pure cause and effect, which is exactly the skill a
 * toddler is practising. Optionally the count is spoken as each one goes, which
 * turns it into first counting practice without ever feeling like a test.
 *
 * Puzzle fields:
 *   bubbles     [{ emoji, x, y, size, hue }]  x/y are percentages 0–100
 *   countAloud  speak "one, two, three…" as they pop
 *   popAll      false to require only the tagged ones (defaults to true)
 *   targets     [index] when popAll is false
 */

import { h } from '../../core/dom.js';
import { sfx, haptic, speak } from '../../core/audio.js';
import { sparkle, floatText, pulse, shake } from '../../core/fx.js';
import { numberWord } from '../../data/content.js';

export function renderPop(puzzle, api) {
  const popAll = puzzle.popAll !== false;
  const targets = new Set(popAll ? puzzle.bubbles.map((_, i) => i) : puzzle.targets || []);
  const popped = new Set();

  const sceneEl = h('div.pop__scene');
  const nodes = [];

  puzzle.bubbles.forEach((bubble, i) => {
    const node = h(
      'button.pop__bubble',
      {
        type: 'button',
        'aria-label': 'bubble',
        style: {
          left: bubble.x + '%',
          top: bubble.y + '%',
          '--size': (bubble.size ?? 1).toFixed(2),
          '--hue': bubble.hue ?? Math.floor(Math.random() * 360),
          // Staggered drift so the group never pulses in lockstep.
          '--drift': (2.6 + (i % 5) * 0.45).toFixed(2) + 's',
          '--offset': (-(i % 7) * 0.4).toFixed(2) + 's',
        },
        onclick: () => pop(i, node),
      },
      h('span.pop__shine'),
      bubble.emoji ? h('span.pop__face', bubble.emoji) : null,
    );
    nodes.push(node);
    sceneEl.appendChild(node);
  });

  const counterEl = h('div.pop__counter', `0 / ${targets.size}`);

  function pop(i, node) {
    if (popped.has(i)) return;

    if (!targets.has(i)) {
      // Only reachable in "pop just these" mode; still gentle.
      shake(node);
      sfx('bloop');
      api.wrong({ from: node });
      return;
    }

    popped.add(i);
    node.classList.add('pop__bubble--gone');
    node.disabled = true;

    // Each pop is a step up the scale, so clearing the set plays a tune.
    sfx('pop', popped.size - 1);
    haptic(14);
    sparkle(node, '💧', 6);
    if (puzzle.countAloud) {
      floatText(String(popped.size), node, '#ffffff');
      speak(numberWord(popped.size));
    }

    counterEl.textContent = `${popped.size} / ${targets.size}`;
    pulse(counterEl, 1.16);
    api.partial?.(popped.size / targets.size);

    if (popped.size >= targets.size) api.correct({ from: sceneEl });
  }

  function hint() {
    const next = [...targets].find((i) => !popped.has(i));
    if (next === undefined) return false;
    nodes[next].classList.add('pop__bubble--glow');
    setTimeout(() => nodes[next]?.classList.remove('pop__bubble--glow'), 2000);
    return true;
  }

  function solve() {
    for (const i of targets) {
      popped.add(i);
      nodes[i].classList.add('pop__bubble--gone');
      nodes[i].disabled = true;
    }
    counterEl.textContent = `${popped.size} / ${targets.size}`;
  }

  return {
    el: h(
      'div.play__body.play__body--pop',
      counterEl,
      sceneEl,
    ),
    hint,
    solve,
  };
}
