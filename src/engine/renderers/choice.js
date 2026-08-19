/**
 * Choice renderer — the workhorse of the game.
 *
 * Handles two puzzle types:
 *   'choice' — tap the one right answer
 *   'multi'  — tap every option that matches (round ends when all are found)
 *
 * Puzzle fields:
 *   stem      visual spec shown above the options (optional)
 *   options   [{ id, visual, label?, caption? }]
 *   answer    id of the correct option            (type 'choice')
 *   answers   [ids] of every correct option       (type 'multi')
 *   columns   preferred column count (2–4); auto when omitted
 */

import { h } from '../../core/dom.js';
import { renderVisual } from '../visual.js';
import { sfx, haptic } from '../../core/audio.js';
import { shake, pulse } from '../../core/fx.js';

export function renderChoice(puzzle, api) {
  const multi = puzzle.type === 'multi';
  const answers = new Set(multi ? puzzle.answers : [puzzle.answer]);
  const found = new Set();
  let locked = false;

  const options = puzzle.options || [];
  const columns =
    puzzle.columns ||
    (options.length <= 2 ? 2 : options.length <= 4 ? 2 : options.length <= 6 ? 3 : 4);

  const buttons = new Map();

  const grid = h('div.opts', {
    style: { '--cols': columns },
    'data-count': options.length,
    role: multi ? 'group' : 'radiogroup',
  });

  for (const opt of options) {
    const btn = h(
      'button.opt',
      {
        type: 'button',
        'data-id': opt.id,
        'aria-label': opt.label || opt.caption || 'option',
        onclick: () => choose(opt, btn),
      },
      h('span.opt__inner', renderVisual(opt.visual, { size: puzzle.optionSize })),
      opt.caption ? h('span.opt__caption', opt.caption) : null,
    );
    buttons.set(opt.id, btn);
    grid.appendChild(btn);
  }

  function choose(opt, btn) {
    if (locked || btn.classList.contains('opt--done') || btn.disabled) return;

    if (answers.has(opt.id)) {
      found.add(opt.id);
      btn.classList.add('opt--right', 'opt--done');
      pulse(btn);
      haptic(14);

      if (multi && found.size < answers.size) {
        sfx('count', found.size - 1);
        api.partial?.(found.size / answers.size);
        return;
      }
      locked = true;
      api.correct({ from: btn });
    } else {
      btn.classList.add('opt--wrong');
      shake(btn);
      haptic([18, 40, 18]);
      sfx('wrong');
      api.wrong({ from: btn });
      // Wrong options stay tappable but fade, so a child can keep exploring.
      setTimeout(() => btn.classList.remove('opt--wrong'), 420);
      btn.classList.add('opt--dim');
    }
  }

  /** Hint: eliminate a wrong option, or spotlight the answer if only one is left. */
  function hint() {
    const wrongLeft = options.filter(
      (o) => !answers.has(o.id) && !buttons.get(o.id).classList.contains('opt--out'),
    );
    if (wrongLeft.length > 1) {
      const victim = wrongLeft[Math.floor(api.rng.next() * wrongLeft.length)];
      const btn = buttons.get(victim.id);
      btn.classList.add('opt--out');
      btn.disabled = true;
      return true;
    }
    for (const id of answers) {
      if (!found.has(id)) {
        buttons.get(id)?.classList.add('opt--glow');
        return true;
      }
    }
    return false;
  }

  /** Used by the "show me" path so a stuck child is never trapped. */
  function solve() {
    for (const id of answers) {
      const btn = buttons.get(id);
      if (btn && !found.has(id)) {
        found.add(id);
        btn.classList.add('opt--right', 'opt--done');
      }
    }
    locked = true;
  }

  const el = h(
    'div.play__body',
    puzzle.stem ? h('div.stem', renderVisual(puzzle.stem, { size: puzzle.stemSize || 'lg' })) : null,
    puzzle.stemCaption ? h('div.stem__caption', puzzle.stemCaption) : null,
    grid,
  );

  return { el, hint, solve };
}
