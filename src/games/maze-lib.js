/**
 * Maze generation and solving.
 *
 * Mazes are "perfect" (exactly one path between any two cells) which guarantees
 * every generated level is solvable and never has a confusing dead-end loop.
 * `braid` knocks a few walls out again to create alternative routes for the
 * harder levels.
 */

const N = 1, E = 2, S = 4, W = 8;
const OPPOSITE = { [N]: S, [E]: W, [S]: N, [W]: E };
const DELTA = { [N]: [0, -1], [E]: [1, 0], [S]: [0, 1], [W]: [-1, 0] };

/**
 * @param {object} o
 * @param {number} o.w  columns
 * @param {number} o.h  rows
 * @param {object} o.rng  seeded rng from core/rng.js
 * @param {number} [o.braid=0]  0..1 fraction of dead ends to open up
 * @returns {{ w:number, h:number, walls:number[] }}
 */
export function generateMaze({ w, h, rng, braid = 0 }) {
  const total = w * h;
  const walls = new Array(total).fill(N | E | S | W);
  const visited = new Array(total).fill(false);
  const idx = (x, y) => y * w + x;

  // Iterative recursive-backtracker (no recursion limit worries).
  const startCell = rng.int(0, total - 1);
  const stack = [startCell];
  visited[startCell] = true;

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const x = cur % w;
    const y = Math.floor(cur / w);

    const options = [];
    for (const dir of [N, E, S, W]) {
      const [dx, dy] = DELTA[dir];
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (visited[idx(nx, ny)]) continue;
      options.push([dir, idx(nx, ny)]);
    }

    if (!options.length) {
      stack.pop();
      continue;
    }

    const [dir, next] = options[rng.int(0, options.length - 1)];
    walls[cur] &= ~dir;
    walls[next] &= ~OPPOSITE[dir];
    visited[next] = true;
    stack.push(next);
  }

  if (braid > 0) openDeadEnds({ w, h, walls, rng, fraction: braid });

  return { w, h, walls };
}

function openDeadEnds({ w, h, walls, rng, fraction }) {
  const idx = (x, y) => y * w + x;
  const deadEnds = [];
  for (let i = 0; i < w * h; i++) {
    const openCount = [N, E, S, W].filter((d) => !(walls[i] & d)).length;
    if (openCount === 1) deadEnds.push(i);
  }
  for (const cellIndex of rng.shuffle(deadEnds).slice(0, Math.floor(deadEnds.length * fraction))) {
    const x = cellIndex % w;
    const y = Math.floor(cellIndex / w);
    const closed = [N, E, S, W].filter((d) => {
      if (!(walls[cellIndex] & d)) return false;
      const [dx, dy] = DELTA[d];
      const nx = x + dx;
      const ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < w && ny < h;
    });
    if (!closed.length) continue;
    const dir = closed[rng.int(0, closed.length - 1)];
    const [dx, dy] = DELTA[dir];
    walls[cellIndex] &= ~dir;
    walls[idx(x + dx, y + dy)] &= ~OPPOSITE[dir];
  }
}

/** Neighbours of `cell` that are reachable in one step. */
export function openNeighbours({ w, h, walls }, cellIndex) {
  const x = cellIndex % w;
  const y = Math.floor(cellIndex / w);
  const out = [];
  for (const dir of [N, E, S, W]) {
    if (walls[cellIndex] & dir) continue;
    const [dx, dy] = DELTA[dir];
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    out.push(ny * w + nx);
  }
  return out;
}

/** Breadth-first shortest path between two cells, inclusive of both ends. */
export function shortestPath(maze, from, to) {
  if (from === to) return [from];
  const prev = new Map([[from, -1]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const next of openNeighbours(maze, cur)) {
      if (prev.has(next)) continue;
      prev.set(next, cur);
      if (next === to) {
        const path = [next];
        let step = cur;
        while (step !== -1) {
          path.push(step);
          step = prev.get(step);
        }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return null;
}

/** Every cell's distance from `from` (used to place a far-away goal). */
export function distances(maze, from) {
  const dist = new Array(maze.w * maze.h).fill(-1);
  dist[from] = 0;
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const next of openNeighbours(maze, cur)) {
      if (dist[next] !== -1) continue;
      dist[next] = dist[cur] + 1;
      queue.push(next);
    }
  }
  return dist;
}

/**
 * Route from `from` to the next objective: the closest uncollected pickup, or
 * the goal once everything has been collected. Powers hints and "show me".
 */
export function solveMaze(puzzle, from, collected = new Set()) {
  const maze = { w: puzzle.w, h: puzzle.h, walls: puzzle.walls };
  const pending = (puzzle.items || []).map((i) => i.at).filter((at) => !collected.has(at));

  if (!pending.length) return shortestPath(maze, from, puzzle.goal);

  let best = null;
  for (const target of pending) {
    const path = shortestPath(maze, from, target);
    if (path && (!best || path.length < best.length)) best = path;
  }
  return best;
}

/** True when the maze can be completed from the start (used by the tests). */
export function mazeIsSolvable(puzzle) {
  const maze = { w: puzzle.w, h: puzzle.h, walls: puzzle.walls };
  let at = puzzle.start;
  const pending = new Set((puzzle.items || []).map((i) => i.at));
  while (pending.size) {
    let best = null;
    for (const target of pending) {
      const path = shortestPath(maze, at, target);
      if (path && (!best || path.length < best.length)) best = path;
    }
    if (!best) return false;
    at = best[best.length - 1];
    pending.delete(at);
  }
  return Boolean(shortestPath(maze, at, puzzle.goal));
}

export const MAZE_BITS = { N, E, S, W };
