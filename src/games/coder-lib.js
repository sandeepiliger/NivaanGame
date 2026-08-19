/**
 * Solver for the robot-programming game.
 *
 * State is (cell, set-of-collected-gems), so a breadth-first search returns the
 * shortest command sequence that both collects every gem and finishes on the
 * goal. Generators use it to guarantee each puzzle is solvable within its step
 * limit, and hints replay it one command at a time.
 */

export const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const DIR_NAMES = ['up', 'down', 'left', 'right'];

/**
 * @returns {string[]|null} shortest winning program, or null if impossible
 */
export function solveProgram(puzzle) {
  const { w, h, start, goal } = puzzle;
  const blocks = new Set(puzzle.blocks || []);
  const gems = puzzle.gems || [];
  const gemIndex = new Map(gems.map((cell, i) => [cell, i]));
  const allGems = (1 << gems.length) - 1;
  const maxSteps = puzzle.maxSteps ?? Infinity;

  const startMask = gemIndex.has(start) ? 1 << gemIndex.get(start) : 0;
  const key = (pos, mask) => pos * (allGems + 1) + mask;

  const seen = new Set([key(start, startMask)]);
  let frontier = [{ pos: start, mask: startMask, program: [] }];

  while (frontier.length) {
    const next = [];
    for (const node of frontier) {
      if (node.pos === goal && node.mask === allGems) return node.program;
      if (node.program.length >= maxSteps) continue;

      for (const dir of DIR_NAMES) {
        const [dx, dy] = DIRS[dir];
        const x = (node.pos % w) + dx;
        const y = Math.floor(node.pos / w) + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const cell = y * w + x;
        if (blocks.has(cell)) continue;

        const mask = gemIndex.has(cell) ? node.mask | (1 << gemIndex.get(cell)) : node.mask;
        const k = key(cell, mask);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ pos: cell, mask, program: node.program.concat(dir) });
      }
    }
    frontier = next;
  }

  return null;
}

/** Shortest program length, or Infinity when unsolvable. */
export function programLength(puzzle) {
  const solution = solveProgram(puzzle);
  return solution ? solution.length : Infinity;
}
