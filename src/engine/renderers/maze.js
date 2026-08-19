/**
 * Maze renderer — trace a path with your finger from the start to the goal,
 * picking up everything on the way.
 *
 * Puzzle fields:
 *   w, h      grid size
 *   walls     Uint8-style array, one entry per cell, bit 1=N 2=E 4=S 8=W
 *   start     index of the starting cell
 *   goal      index of the goal cell
 *   items     [{ at:index, emoji }] optional pickups that must all be collected
 *   hero      emoji for the traveller
 *   goalEmoji emoji shown at the goal
 */

import { h, svg } from '../../core/dom.js';
import { sfx, haptic } from '../../core/audio.js';
import { sparkle, shake } from '../../core/fx.js';
import { solveMaze } from '../../games/maze-lib.js';

const N = 1, E = 2, S = 4, W = 8;

export function renderMaze(puzzle, api) {
  const { w, h: rows, walls, start, goal } = puzzle;
  const items = puzzle.items || [];
  const needed = new Set(items.map((i) => i.at));
  const collected = new Set();

  let current = start;
  let path = [start];
  let finished = false;
  let dragging = false;

  const cell = (i) => ({ x: i % w, y: Math.floor(i / w) });
  const idx = (x, y) => y * w + x;

  /* --- board ------------------------------------------------------------ */

  const CELL = 100; // SVG units per cell; CSS scales the whole board
  const board = svg('svg', {
    viewBox: `-6 -6 ${w * CELL + 12} ${rows * CELL + 12}`,
    class: 'maze__svg',
    preserveAspectRatio: 'xMidYMid meet',
  });

  // Floor
  board.appendChild(
    svg('rect', {
      x: -6, y: -6, width: w * CELL + 12, height: rows * CELL + 12,
      rx: 18, fill: '#fff8e6',
    }),
  );

  // Goal tile highlight
  const g = cell(goal);
  board.appendChild(
    svg('rect', {
      x: g.x * CELL + 6, y: g.y * CELL + 6, width: CELL - 12, height: CELL - 12,
      rx: 14, fill: 'rgba(62,207,109,.22)',
    }),
  );

  // Path trail (drawn behind the walls)
  const trail = svg('polyline', {
    class: 'maze__trail',
    points: '',
    fill: 'none',
    stroke: '#35d0e8',
    'stroke-width': 26,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    opacity: '0.55',
  });
  board.appendChild(trail);

  // Walls
  const wallGroup = svg('g', {
    stroke: '#6c4ce0',
    'stroke-width': 9,
    'stroke-linecap': 'round',
  });
  for (let i = 0; i < w * rows; i++) {
    const { x, y } = cell(i);
    const px = x * CELL;
    const py = y * CELL;
    const bits = walls[i];
    if (bits & N) wallGroup.appendChild(svg('line', { x1: px, y1: py, x2: px + CELL, y2: py }));
    if (bits & W) wallGroup.appendChild(svg('line', { x1: px, y1: py, x2: px, y2: py + CELL }));
    // Only draw S/E on the last row/column; interior edges are covered by the
    // neighbour's N/W wall, so this halves the number of lines.
    if (y === rows - 1 && bits & S)
      wallGroup.appendChild(svg('line', { x1: px, y1: py + CELL, x2: px + CELL, y2: py + CELL }));
    if (x === w - 1 && bits & E)
      wallGroup.appendChild(svg('line', { x1: px + CELL, y1: py, x2: px + CELL, y2: py + CELL }));
  }
  board.appendChild(wallGroup);

  // Pickups
  const itemNodes = new Map();
  for (const item of items) {
    const c = cell(item.at);
    const node = svg(
      'text',
      {
        x: c.x * CELL + CELL / 2, y: c.y * CELL + CELL / 2 + 16,
        'text-anchor': 'middle', 'font-size': 44, class: 'maze__item',
      },
      item.emoji,
    );
    itemNodes.set(item.at, node);
    board.appendChild(node);
  }

  // Goal marker
  board.appendChild(
    svg(
      'text',
      {
        x: g.x * CELL + CELL / 2, y: g.y * CELL + CELL / 2 + 18,
        'text-anchor': 'middle', 'font-size': 50,
      },
      puzzle.goalEmoji || '🏁',
    ),
  );

  // Hero
  const s = cell(start);
  const hero = svg(
    'text',
    {
      x: s.x * CELL + CELL / 2, y: s.y * CELL + CELL / 2 + 18,
      'text-anchor': 'middle', 'font-size': 52, class: 'maze__hero',
    },
    puzzle.hero || '🐭',
  );
  board.appendChild(hero);

  /* --- movement --------------------------------------------------------- */

  function redraw() {
    trail.setAttribute(
      'points',
      path.map((i) => {
        const c = cell(i);
        return `${c.x * CELL + CELL / 2},${c.y * CELL + CELL / 2}`;
      }).join(' '),
    );
    const c = cell(current);
    hero.setAttribute('x', c.x * CELL + CELL / 2);
    hero.setAttribute('y', c.y * CELL + CELL / 2 + 18);
  }

  function open(from, to) {
    const a = cell(from);
    const b = cell(to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
    if (dx === 1) return !(walls[from] & E);
    if (dx === -1) return !(walls[from] & W);
    if (dy === 1) return !(walls[from] & S);
    return !(walls[from] & N);
  }

  function moveTo(next) {
    if (finished) return;
    if (next === current) return;
    if (!open(current, next)) {
      if (!moveTo._warned) {
        moveTo._warned = true;
        setTimeout(() => (moveTo._warned = false), 500);
        shake(wrap);
        sfx('wrong');
      }
      return;
    }

    // Stepping back retraces the path instead of adding a loop.
    if (path.length > 1 && path[path.length - 2] === next) path.pop();
    else path.push(next);

    current = next;
    haptic(6);
    sfx('tick');

    if (needed.has(current) && !collected.has(current)) {
      collected.add(current);
      const node = itemNodes.get(current);
      node?.classList.add('maze__item--got');
      sfx('pop');
      api.partial?.(collected.size / (needed.size + 1));
    }

    redraw();

    if (current === goal) {
      if (collected.size < needed.size) {
        // Reaching the exit early is not a failure — just a nudge.
        api.note?.(`Collect all ${needed.size} first!`);
        return;
      }
      finished = true;
      sparkle(wrap, '🎉', 10);
      api.correct({ from: wrap });
    }
  }

  function cellFromEvent(event) {
    const rect = board.getBoundingClientRect();
    // Map client px into viewBox units, accounting for the 6-unit padding.
    const vbW = w * CELL + 12;
    const vbH = rows * CELL + 12;
    const scale = Math.min(rect.width / vbW, rect.height / vbH);
    const offX = (rect.width - vbW * scale) / 2;
    const offY = (rect.height - vbH * scale) / 2;
    const vx = (event.clientX - rect.left - offX) / scale - 6;
    const vy = (event.clientY - rect.top - offY) / scale - 6;
    const x = Math.floor(vx / CELL);
    const y = Math.floor(vy / CELL);
    if (x < 0 || y < 0 || x >= w || y >= rows) return -1;
    return idx(x, y);
  }

  const wrap = h('div.maze', { style: { '--w': w, '--h': rows } }, board);
  wrap.style.touchAction = 'none';

  wrap.addEventListener('pointerdown', (event) => {
    dragging = true;
    wrap.setPointerCapture?.(event.pointerId);
    const i = cellFromEvent(event);
    if (i >= 0) moveTo(i);
    event.preventDefault();
  });
  wrap.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const i = cellFromEvent(event);
    if (i >= 0) moveTo(i);
  });
  const stop = () => (dragging = false);
  wrap.addEventListener('pointerup', stop);
  wrap.addEventListener('pointercancel', stop);
  wrap.addEventListener('pointerleave', stop);

  // Keyboard support (also handy on desktop).
  const onKey = (event) => {
    const delta = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[
      event.key
    ];
    if (!delta) return;
    event.preventDefault();
    const c = cell(current);
    const nx = c.x + delta[0];
    const ny = c.y + delta[1];
    if (nx < 0 || ny < 0 || nx >= w || ny >= rows) return;
    moveTo(idx(nx, ny));
  };
  window.addEventListener('keydown', onKey);

  /* --- hints ------------------------------------------------------------ */

  function hint() {
    const route = solveMaze(puzzle, current, collected);
    if (!route || route.length < 2) return false;
    // Show the next two steps as glowing breadcrumbs.
    for (const i of route.slice(1, 3)) {
      const c = cell(i);
      const dot = svg('circle', {
        cx: c.x * CELL + CELL / 2, cy: c.y * CELL + CELL / 2, r: 12,
        fill: '#ffcc29', class: 'maze__crumb',
      });
      board.appendChild(dot);
      setTimeout(() => dot.remove(), 2400);
    }
    return true;
  }

  function solve() {
    const route = solveMaze(puzzle, current, collected);
    if (!route) return;
    finished = true;
    path = path.concat(route.slice(1));
    current = goal;
    itemNodes.forEach((node) => node.classList.add('maze__item--got'));
    redraw();
  }

  redraw();

  return {
    el: h(
      'div.play__body.play__body--maze',
      puzzle.stemCaption ? h('div.stem__caption', puzzle.stemCaption) : null,
      wrap,
    ),
    hint,
    solve,
    destroy: () => window.removeEventListener('keydown', onKey),
  };
}
