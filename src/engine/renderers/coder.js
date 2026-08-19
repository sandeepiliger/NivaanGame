/**
 * Coder renderer — early algorithmic thinking.
 *
 * The child builds a sequence of arrow commands, presses Play, and watches the
 * robot execute the whole program. Planning ahead (rather than steering live)
 * is the entire point of the exercise.
 *
 * Puzzle fields:
 *   w, h      grid size
 *   start     index of the robot's starting cell
 *   goal      index of the target cell
 *   blocks    [index] impassable cells
 *   gems      [index] cells that must all be visited
 *   maxSteps  program length limit
 *   hero, goalEmoji, blockEmoji
 */

import { h } from '../../core/dom.js';
import { sfx, haptic } from '../../core/audio.js';
import { shake, sparkle, pulse } from '../../core/fx.js';
import { solveProgram, DIRS } from '../../games/coder-lib.js';

const ARROWS = { up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️' };

export function renderCoder(puzzle, api) {
  const { w, h: rows, start, goal } = puzzle;
  const blocks = new Set(puzzle.blocks || []);
  const gems = puzzle.gems || [];
  const maxSteps = puzzle.maxSteps || 10;

  let program = [];
  let running = false;

  /* --- board ------------------------------------------------------------ */

  const cells = [];
  const boardEl = h('div.coder__board', { style: { '--w': w, '--h': rows } });
  for (let i = 0; i < w * rows; i++) {
    const cellEl = h('div.coder__cell' + (blocks.has(i) ? '.coder__cell--block' : ''));
    if (blocks.has(i)) cellEl.textContent = puzzle.blockEmoji || '🌳';
    if (i === goal) {
      cellEl.classList.add('coder__cell--goal');
      cellEl.textContent = puzzle.goalEmoji || '🏠';
    }
    const gem = gems.includes(i);
    if (gem) {
      const gemEl = h('span.coder__gem', puzzle.gemEmoji || '💎');
      cellEl.appendChild(gemEl);
      cellEl._gem = gemEl;
    }
    cells.push(cellEl);
    boardEl.appendChild(cellEl);
  }

  const hero = h('div.coder__hero', puzzle.hero || '🤖');
  boardEl.appendChild(hero);

  function placeHero(index, animate = true) {
    const x = index % w;
    const y = Math.floor(index / w);
    hero.style.setProperty('--x', x);
    hero.style.setProperty('--y', y);
    hero.style.transition = animate ? 'transform 260ms cubic-bezier(.34,1.56,.64,1)' : 'none';
  }
  placeHero(start, false);

  /* --- program strip ---------------------------------------------------- */

  const stripEl = h('div.coder__strip', { style: { '--max': maxSteps } });

  function drawStrip(activeIndex = -1) {
    stripEl.textContent = '';
    for (let i = 0; i < maxSteps; i++) {
      const cmd = program[i];
      stripEl.appendChild(
        h(
          'div.coder__step' +
            (cmd ? '.coder__step--set' : '') +
            (i === activeIndex ? '.coder__step--active' : ''),
          { onclick: () => cmd && !running && removeStep(i) },
          cmd ? ARROWS[cmd] : '',
        ),
      );
    }
    countEl.textContent = `${program.length}/${maxSteps}`;
    playBtn.disabled = running || program.length === 0;
  }

  function addStep(dir) {
    if (running || program.length >= maxSteps) {
      if (program.length >= maxSteps) shake(stripEl);
      return;
    }
    program.push(dir);
    sfx('tap');
    haptic(8);
    drawStrip();
  }

  function removeStep(i) {
    program.splice(i, 1);
    sfx('drop');
    drawStrip();
  }

  /* --- run -------------------------------------------------------------- */

  async function run() {
    if (running || !program.length) return;
    running = true;
    drawStrip();

    let pos = start;
    const got = new Set();
    let crashed = false;

    for (let i = 0; i < program.length; i++) {
      drawStrip(i);
      const [dx, dy] = DIRS[program[i]];
      const x = (pos % w) + dx;
      const y = Math.floor(pos / w) + dy;
      const next = y * w + x;

      if (x < 0 || y < 0 || x >= w || y >= rows || blocks.has(next)) {
        crashed = true;
        break;
      }

      pos = next;
      placeHero(pos);
      if (gems.includes(pos) && !got.has(pos)) {
        got.add(pos);
        cells[pos]._gem?.classList.add('coder__gem--got');
        sfx('coin');
      }
      sfx('step');
      await sleep(280);
    }

    drawStrip();
    const won = !crashed && pos === goal && got.size === gems.length;

    if (won) {
      running = false;
      sparkle(hero, '🎉', 10);
      pulse(hero, 1.3);
      api.correct({ from: hero });
      return;
    }

    shake(boardEl);
    sfx(crashed ? 'bump' : 'oops');
    api.wrong({ from: boardEl });
    api.note?.(crashed ? 'Oops — the robot bumped into something!' : 'Not quite there yet.');
    await sleep(500);
    // Reset for another attempt: children iterate, they do not get it first time.
    placeHero(start);
    cells.forEach((c) => c._gem?.classList.remove('coder__gem--got'));
    running = false;
    drawStrip();
  }

  function reset() {
    if (running) return;
    program = [];
    placeHero(start);
    cells.forEach((c) => c._gem?.classList.remove('coder__gem--got'));
    drawStrip();
  }

  /* --- controls --------------------------------------------------------- */

  const countEl = h('span.coder__count', `0/${maxSteps}`);
  const playBtn = h(
    'button.btn.btn--green.coder__play',
    { type: 'button', onclick: () => { sfx('press'); run(); } },
    '▶ Play',
  );

  const pad = h(
    'div.coder__pad',
    ['up', 'left', 'right', 'down'].map((dir) =>
      h(
        'button.coder__key.coder__key--' + dir,
        { type: 'button', 'aria-label': dir, onclick: () => addStep(dir) },
        ARROWS[dir],
      ),
    ),
  );

  function hint() {
    const solution = solveProgram(puzzle);
    if (!solution) return false;
    // Load the next correct command the child has not entered yet.
    const i = program.length;
    if (i >= solution.length) {
      reset();
      return true;
    }
    // Only extend when the program so far still matches a winning prefix.
    const matches = program.every((cmd, k) => cmd === solution[k]);
    if (!matches) {
      reset();
      api.note?.('Let’s start that program again.');
      return true;
    }
    addStep(solution[i]);
    return true;
  }

  function solve() {
    const solution = solveProgram(puzzle);
    if (!solution) return;
    program = solution.slice(0, maxSteps);
    drawStrip();
    placeHero(goal);
    cells.forEach((c) => c._gem?.classList.add('coder__gem--got'));
  }

  drawStrip();

  return {
    el: h(
      'div.play__body.play__body--coder',
      puzzle.stemCaption ? h('div.stem__caption', puzzle.stemCaption) : null,
      boardEl,
      stripEl,
      h(
        'div.coder__controls',
        pad,
        h(
          'div.coder__actions',
          countEl,
          playBtn,
          h('button.iconbtn.iconbtn--paper', { type: 'button', 'aria-label': 'Clear', onclick: reset }, '↺'),
        ),
      ),
    ),
    hint,
    solve,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
