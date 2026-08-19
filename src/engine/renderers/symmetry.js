/**
 * Symmetry renderer — complete the mirror image.
 *
 * Half the grid is drawn; the child fills the other half so the picture is
 * symmetrical about the axis. This is spatial reasoning with an instantly
 * checkable answer.
 *
 * Puzzle fields:
 *   w, h      grid size of the WHOLE picture (w must be even for axis 'v')
 *   axis      'v' (left/right) or 'h' (top/bottom)
 *   target    array w*h of colour indices; 0 = empty
 *   palette   [hex] indexed from 1
 *   locked    array w*h of booleans — the pre-drawn half
 */

import { h } from '../../core/dom.js';
import { sfx, haptic } from '../../core/audio.js';
import { shake, pulse, sparkle } from '../../core/fx.js';

export function renderSymmetry(puzzle, api) {
  const { w, h: rows, target, palette, locked } = puzzle;
  const board = target.map((v, i) => (locked[i] ? v : 0));
  const editable = locked.map((l) => !l);
  const needed = target.filter((v, i) => !locked[i] && v !== 0).length;
  let done = 0;
  // Start with a colour already chosen: a child who taps straight away should
  // be painting, not silently defaulting to whichever colour happens to be #1.
  let selected = 1;

  const cellNodes = [];
  const gridEl = h('div.sym__grid', { style: { '--w': w, '--h': rows } });

  for (let i = 0; i < w * rows; i++) {
    const node = h('button.sym__cell', { type: 'button', onclick: () => tap(i) });
    if (locked[i]) {
      node.classList.add('sym__cell--locked');
      if (target[i]) node.style.background = palette[target[i] - 1];
    }
    // Mark the mirror line.
    const x = i % w;
    const y = Math.floor(i / w);
    if (puzzle.axis === 'v' && x === w / 2) node.classList.add('sym__cell--axis');
    if (puzzle.axis === 'h' && y === rows / 2) node.classList.add('sym__cell--axis');

    cellNodes.push(node);
    gridEl.appendChild(node);
  }

  const paletteEl = h(
    'div.sym__palette',
    palette.map((hex, i) =>
      h('button.sym__pick', {
        type: 'button',
        'data-n': i + 1,
        style: { background: hex },
        'aria-label': 'colour ' + (i + 1),
        onclick: () => pick(i + 1),
      }),
    ),
  );
  if (palette.length === 1) paletteEl.classList.add('hidden');
  paint();

  function pick(n) {
    // Re-tapping the active colour switches to "eraser" mode.
    selected = selected === n ? 0 : n;
    paint();
  }

  function paint() {
    Array.from(paletteEl.children).forEach((btn) =>
      btn.classList.toggle('sym__pick--on', Number(btn.dataset.n) === selected),
    );
  }

  function tap(i) {
    if (!editable[i]) return;
    const want = target[i];

    // Undoing is always free — only painting the wrong colour counts as a slip.
    if (board[i] !== 0 && (selected === 0 || selected === board[i])) {
      board[i] = 0;
      done -= 1;
      cellNodes[i].style.background = '';
      cellNodes[i].classList.remove('sym__cell--on');
      sfx('drop');
      return;
    }
    // Eraser selected but the cell is already empty: nothing to do.
    if (selected === 0) return;

    const value = selected;
    if (want !== value) {
      shake(cellNodes[i]);
      sfx('wrong');
      haptic([18, 40, 18]);
      cellNodes[i].classList.add('sym__cell--wrong');
      setTimeout(() => cellNodes[i].classList.remove('sym__cell--wrong'), 420);
      api.wrong({ from: cellNodes[i] });
      return;
    }

    board[i] = value;
    done += 1;
    cellNodes[i].style.background = palette[value - 1];
    cellNodes[i].classList.add('sym__cell--on');
    pulse(cellNodes[i], 1.15);
    sfx('snap');
    haptic(10);
    api.partial?.(done / needed);

    if (done >= needed) {
      sparkle(gridEl, '✨', 10);
      api.correct({ from: gridEl });
    }
  }

  function hint() {
    const i = target.findIndex((v, k) => editable[k] && v !== 0 && board[k] === 0);
    if (i < 0) return false;
    if (palette.length > 1) {
      selected = target[i];
      paint();
    }
    cellNodes[i].classList.add('sym__cell--glow');
    setTimeout(() => cellNodes[i].classList.remove('sym__cell--glow'), 2200);
    return true;
  }

  function solve() {
    for (let i = 0; i < target.length; i++) {
      if (!editable[i] || target[i] === 0 || board[i] !== 0) continue;
      board[i] = target[i];
      done += 1;
      cellNodes[i].style.background = palette[target[i] - 1];
      cellNodes[i].classList.add('sym__cell--on');
    }
  }

  return {
    el: h(
      'div.play__body.play__body--sym',
      puzzle.stemCaption ? h('div.stem__caption', puzzle.stemCaption) : null,
      gridEl,
      paletteEl,
    ),
    hint,
    solve,
  };
}
