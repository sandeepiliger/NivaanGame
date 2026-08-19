/**
 * Trace renderer — drag a finger along a path from one character to another.
 *
 * This is the pre-writing skill (controlled, directed finger movement) that
 * comes before any letter formation, and it is one of the few things a
 * two-year-old can succeed at immediately. The tolerance is deliberately
 * generous and leaving the path never fails the round — the child just picks
 * the trail back up.
 *
 * Puzzle fields:
 *   path       [{ x, y }] waypoints in order, 0–100 coordinates
 *   startEmoji / endEmoji  characters at each end
 *   trailEmoji decoration dropped along the completed trail
 */

import { h, svg } from '../../core/dom.js';
import { sfx, haptic } from '../../core/audio.js';
import { sparkle, pulse } from '../../core/fx.js';

/** How close (in 0–100 units) a finger must get to claim a waypoint. */
const REACH = 11;

export function renderTrace(puzzle, api) {
  const path = puzzle.path;
  let reached = 0; // waypoints claimed so far
  let dragging = false;
  let finished = false;

  const board = svg('svg', {
    viewBox: '0 0 100 100',
    class: 'trace__svg',
    preserveAspectRatio: 'xMidYMid meet',
  });

  board.appendChild(svg('rect', { x: 0, y: 0, width: 100, height: 100, rx: 5, fill: '#fff8e6' }));

  const points = path.map((p) => `${p.x},${p.y}`).join(' ');

  // The road: a wide dashed guide the child follows.
  board.appendChild(
    svg('polyline', {
      points,
      fill: 'none',
      stroke: '#e6e1ff',
      'stroke-width': 11,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
  );
  board.appendChild(
    svg('polyline', {
      points,
      fill: 'none',
      stroke: '#c9bdff',
      'stroke-width': 2,
      'stroke-dasharray': '4 4',
      'stroke-linecap': 'round',
    }),
  );

  // The trail the child has actually drawn, laid over the road.
  const drawn = svg('polyline', {
    points: '',
    fill: 'none',
    stroke: '#35d0e8',
    'stroke-width': 9,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  board.appendChild(drawn);

  const dots = path.map((p, i) =>
    board.appendChild(
      svg('circle', {
        cx: p.x,
        cy: p.y,
        r: i === 0 || i === path.length - 1 ? 0 : 2.4,
        fill: '#ffcc29',
        class: 'trace__dot',
      }),
    ),
  );

  const endNode = svg(
    'text',
    {
      x: path[path.length - 1].x,
      y: path[path.length - 1].y + 4,
      'text-anchor': 'middle',
      'font-size': 11,
    },
    puzzle.endEmoji || '🏁',
  );
  board.appendChild(endNode);

  const heroNode = svg(
    'text',
    {
      x: path[0].x,
      y: path[0].y + 4,
      'text-anchor': 'middle',
      'font-size': 12,
      class: 'trace__hero',
    },
    puzzle.startEmoji || '🐭',
  );
  board.appendChild(heroNode);

  function redraw() {
    drawn.setAttribute('points', path.slice(0, reached + 1).map((p) => `${p.x},${p.y}`).join(' '));
    const at = path[reached];
    heroNode.setAttribute('x', at.x);
    heroNode.setAttribute('y', at.y + 4);
  }

  function toBoard(event) {
    const rect = board.getBoundingClientRect();
    const side = Math.min(rect.width, rect.height);
    const offX = rect.left + (rect.width - side) / 2;
    const offY = rect.top + (rect.height - side) / 2;
    return {
      x: ((event.clientX - offX) / side) * 100,
      y: ((event.clientY - offY) / side) * 100,
    };
  }

  function follow(event) {
    if (finished) return;
    const point = toBoard(event);

    // Claim as many waypoints as the finger has swept past this frame.
    let advanced = false;
    while (reached < path.length - 1) {
      const next = path[reached + 1];
      if (Math.hypot(next.x - point.x, next.y - point.y) > REACH) break;
      reached += 1;
      advanced = true;
      dots[reached]?.classList.add('trace__dot--on');
      sfx('draw', reached);
      haptic(5);
    }

    if (!advanced) return;
    redraw();

    if (reached >= path.length - 1) {
      finished = true;
      pulse(endNode, 1.4);
      sparkle(wrap, '🎉', 10);
      api.correct({ from: wrap });
    } else {
      api.partial?.(reached / (path.length - 1));
    }
  }

  const wrap = h('div.trace', board);
  wrap.style.touchAction = 'none';

  wrap.addEventListener('pointerdown', (event) => {
    dragging = true;
    wrap.setPointerCapture?.(event.pointerId);
    follow(event);
    event.preventDefault();
  });
  wrap.addEventListener('pointermove', (event) => dragging && follow(event));
  const stop = () => (dragging = false);
  wrap.addEventListener('pointerup', stop);
  wrap.addEventListener('pointercancel', stop);

  function hint() {
    if (finished) return false;
    const next = dots[reached + 1];
    next?.classList.add('trace__dot--glow');
    setTimeout(() => next?.classList.remove('trace__dot--glow'), 2000);
    return true;
  }

  function solve() {
    reached = path.length - 1;
    finished = true;
    dots.forEach((d) => d.classList.add('trace__dot--on'));
    redraw();
  }

  redraw();

  return {
    el: h(
      'div.play__body.play__body--trace',
      puzzle.stemCaption ? h('div.stem__caption', puzzle.stemCaption) : null,
      wrap,
    ),
    hint,
    solve,
  };
}
