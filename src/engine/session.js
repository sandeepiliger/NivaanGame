/**
 * The level runner.
 *
 * Owns the round loop, scoring, hints and the "show me" escape hatch. It knows
 * nothing about how any individual puzzle is drawn — that is the renderers'
 * job — which is what keeps adding a new game type cheap.
 */

import { makeRng } from '../core/rng.js';
import { renderChoice } from './renderers/choice.js';
import { renderDragDrop } from './renderers/dragdrop.js';
import { renderOrder } from './renderers/order.js';
import { renderMemory } from './renderers/memory.js';
import { renderMaze } from './renderers/maze.js';
import { renderCoder } from './renderers/coder.js';
import { renderSudoku } from './renderers/sudoku.js';
import { renderSymmetry } from './renderers/symmetry.js';
import { renderTapCount } from './renderers/tapcount.js';
import { renderConnect } from './renderers/connect.js';

export const RENDERERS = {
  choice: renderChoice,
  multi: renderChoice,
  dragdrop: renderDragDrop,
  order: renderOrder,
  memory: renderMemory,
  maze: renderMaze,
  coder: renderCoder,
  sudoku: renderSudoku,
  symmetry: renderSymmetry,
  tapcount: renderTapCount,
  connect: renderConnect,
};

/** Mistakes allowed per round before the star rating drops a level. */
const STAR_THRESHOLDS = {
  three: 0, // a perfect run
  two: 0.34, // up to a third of rounds had a slip
};

export function createSession({ puzzles, levelId, seed }) {
  const state = {
    levelId,
    puzzles,
    index: 0,
    correct: 0,
    wrong: 0,
    hints: 0,
    revealed: 0,
    startedAt: Date.now(),
    /** Per-round tallies, used for the results breakdown. */
    rounds: puzzles.map(() => ({ wrong: 0, hints: 0, revealed: false })),
  };

  const rng = makeRng(seed || levelId || 'session');

  return {
    state,
    rng,
    get puzzle() {
      return state.puzzles[state.index];
    },
    get total() {
      return state.puzzles.length;
    },
    get isLast() {
      return state.index >= state.puzzles.length - 1;
    },
    get progress() {
      return state.index / state.puzzles.length;
    },

    recordWrong() {
      state.wrong += 1;
      state.rounds[state.index].wrong += 1;
    },
    recordHint() {
      state.hints += 1;
      state.rounds[state.index].hints += 1;
    },
    recordReveal() {
      state.revealed += 1;
      state.rounds[state.index].revealed = true;
    },
    recordCorrect() {
      state.correct += 1;
    },

    next() {
      state.index += 1;
      return state.index < state.puzzles.length;
    },

    /** 1–3 stars. Hints cap the score at two; a revealed answer caps it at one. */
    stars() {
      const roundsWithMistakes = state.rounds.filter((r) => r.wrong > 0).length;
      const ratio = roundsWithMistakes / Math.max(1, state.puzzles.length);
      if (state.revealed > 0) return 1;
      if (ratio <= STAR_THRESHOLDS.three && state.hints === 0) return 3;
      if (ratio <= STAR_THRESHOLDS.two) return 2;
      return 1;
    },

    summary() {
      return {
        levelId,
        stars: this.stars(),
        correct: state.correct,
        wrong: state.wrong,
        hints: state.hints,
        revealed: state.revealed,
        ms: Date.now() - state.startedAt,
        perfect: state.wrong === 0 && state.hints === 0 && state.revealed === 0,
      };
    },
  };
}

/** Build the DOM for one puzzle. Throws for an unknown type. */
export function mountPuzzle(puzzle, api) {
  const renderer = RENDERERS[puzzle.type];
  if (!renderer) throw new Error(`No renderer for puzzle type "${puzzle.type}"`);
  return renderer(puzzle, api);
}
