/**
 * Picture sudoku — a 4×4 (or 6×6) grid where every row, column and box must
 * contain each symbol exactly once. Symbols are shapes, colours or emoji rather
 * than digits, so it works long before a child can read numbers.
 *
 * Puzzle fields:
 *   size      4 or 6
 *   boxW/boxH box dimensions (2×2 for size 4, 3×2 for size 6)
 *   given     array of size*size, 0 = empty, 1..size = symbol number
 *   solution  array of size*size, fully filled
 *   symbols   [visual] indexed 0..size-1 (symbol n uses symbols[n-1])
 */

import { h } from '../../core/dom.js';
import { renderVisual } from '../visual.js';
import { sfx, haptic } from '../../core/audio.js';
import { shake, pulse } from '../../core/fx.js';

export function renderSudoku(puzzle, api) {
  const { size, given, solution, symbols } = puzzle;
  const boxW = puzzle.boxW || 2;
  const boxH = puzzle.boxH || 2;

  const board = given.slice();
  const blanks = board.filter((v) => v === 0).length;
  let filled = 0;
  let selected = 0; // currently chosen palette symbol (1-based), 0 = none

  const cellNodes = [];
  const gridEl = h('div.sud__grid', { style: { '--n': size, '--bw': boxW, '--bh': boxH } });

  for (let i = 0; i < size * size; i++) {
    const fixed = given[i] !== 0;
    const node = h('button.sud__cell' + (fixed ? '.sud__cell--fixed' : ''), {
      type: 'button',
      onclick: () => tapCell(i),
    });
    // Thicker borders at box boundaries make the sub-grids readable.
    const x = i % size;
    const y = Math.floor(i / size);
    if (x % boxW === 0) node.classList.add('sud__cell--bl');
    if (y % boxH === 0) node.classList.add('sud__cell--bt');
    if (x === size - 1) node.classList.add('sud__cell--br');
    if (y === size - 1) node.classList.add('sud__cell--bb');

    if (fixed) node.appendChild(renderVisual(symbols[given[i] - 1], { size: 'sm' }));
    cellNodes.push(node);
    gridEl.appendChild(node);
  }

  const paletteEl = h(
    'div.sud__palette',
    symbols.map((visual, i) =>
      h(
        'button.sud__pick',
        { type: 'button', 'data-n': i + 1, onclick: () => pick(i + 1) },
        renderVisual(visual, { size: 'sm' }),
      ),
    ),
  );

  function pick(n) {
    // No toggling: re-tapping the active symbol keeps it selected, so a child
    // filling several cells with the same picture never loses their choice.
    selected = n;
    Array.from(paletteEl.children).forEach((btn) =>
      btn.classList.toggle('sud__pick--on', Number(btn.dataset.n) === selected),
    );
    sfx('tap');
  }

  function tapCell(i) {
    if (given[i] !== 0) return;

    // Tapping a cell you filled yourself always takes it back out.
    if (board[i] !== 0) {
      board[i] = 0;
      filled -= 1;
      cellNodes[i].textContent = '';
      cellNodes[i].classList.remove('sud__cell--set');
      sfx('drop');
      return;
    }

    if (!selected) {
      api.note?.('Pick a picture first!');
      return;
    }

    if (solution[i] !== selected) {
      shake(cellNodes[i]);
      sfx('wrong');
      haptic([18, 40, 18]);
      cellNodes[i].classList.add('sud__cell--wrong');
      setTimeout(() => cellNodes[i].classList.remove('sud__cell--wrong'), 420);
      api.wrong({ from: cellNodes[i] });
      return;
    }

    filled += 1;
    board[i] = selected;
    cellNodes[i].textContent = '';
    cellNodes[i].appendChild(renderVisual(symbols[selected - 1], { size: 'sm' }));
    cellNodes[i].classList.add('sud__cell--set');
    pulse(cellNodes[i]);
    sfx('pop');
    haptic(10);
    api.partial?.(filled / blanks);

    if (filled >= blanks) api.correct({ from: gridEl });
  }

  function hint() {
    const i = board.findIndex((v, k) => v === 0 && given[k] === 0);
    if (i < 0) return false;
    pick(solution[i]);
    cellNodes[i].classList.add('sud__cell--glow');
    setTimeout(() => cellNodes[i].classList.remove('sud__cell--glow'), 2200);
    return true;
  }

  function solve() {
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== 0) continue;
      board[i] = solution[i];
      filled += 1;
      cellNodes[i].textContent = '';
      cellNodes[i].appendChild(renderVisual(symbols[solution[i] - 1], { size: 'sm' }));
      cellNodes[i].classList.add('sud__cell--set');
    }
  }

  return {
    el: h(
      'div.play__body.play__body--sud',
      puzzle.stemCaption ? h('div.stem__caption', puzzle.stemCaption) : null,
      gridEl,
      h('div.sud__hint', 'Pick a picture, then tap a square'),
      paletteEl,
    ),
    hint,
    solve,
  };
}
