/**
 * Connect-the-dots renderer.
 *
 * Touch the dots in order (1, 2, 3 … or A, B, C …) to reveal a hidden picture.
 * It doubles as counting practice and as alphabet-order practice.
 *
 * Puzzle fields:
 *   dots     [{ x, y, label }] in the correct order, x/y in 0..100
 *   reveal   emoji shown once the outline is complete
 */

import { h, svg } from '../../core/dom.js';
import { sfx, haptic } from '../../core/audio.js';
import { shake, sparkle } from '../../core/fx.js';

export function renderConnect(puzzle, api) {
  const dots = puzzle.dots;
  let step = 0;
  let dragging = false;

  const board = svg('svg', {
    viewBox: '0 0 100 100',
    class: 'con__svg',
    preserveAspectRatio: 'xMidYMid meet',
  });

  board.appendChild(svg('rect', { x: 0, y: 0, width: 100, height: 100, rx: 6, fill: '#fff8e6' }));

  const line = svg('polyline', {
    points: '',
    fill: 'none',
    stroke: '#6c4ce0',
    'stroke-width': 1.6,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  board.appendChild(line);

  const revealNode = svg(
    'text',
    {
      x: 50, y: 62, 'text-anchor': 'middle', 'font-size': 34,
      class: 'con__reveal', opacity: 0,
    },
    puzzle.reveal || '⭐',
  );
  board.appendChild(revealNode);

  const dotNodes = dots.map((dot, i) => {
    const group = svg('g', { class: 'con__dot' });
    group.appendChild(svg('circle', { cx: dot.x, cy: dot.y, r: 3.4, fill: '#ffcc29', stroke: '#e0a800', 'stroke-width': 0.8 }));
    group.appendChild(
      svg(
        'text',
        { x: dot.x, y: dot.y + 1.5, 'text-anchor': 'middle', 'font-size': 4, fill: '#2a2350', 'font-weight': 900 },
        String(dot.label ?? i + 1),
      ),
    );
    board.appendChild(group);
    return group;
  });

  function redraw() {
    line.setAttribute('points', dots.slice(0, step).map((d) => `${d.x},${d.y}`).join(' '));
  }

  function hitDot(event) {
    const rect = board.getBoundingClientRect();
    const side = Math.min(rect.width, rect.height);
    const offX = rect.left + (rect.width - side) / 2;
    const offY = rect.top + (rect.height - side) / 2;
    const x = ((event.clientX - offX) / side) * 100;
    const y = ((event.clientY - offY) / side) * 100;
    for (let i = 0; i < dots.length; i++) {
      if (Math.hypot(dots[i].x - x, dots[i].y - y) < 6) return i;
    }
    return -1;
  }

  function touch(i) {
    if (i < 0 || step >= dots.length) return;
    if (i !== step) {
      if (i > step) {
        shake(wrap);
        sfx('oops');
        api.wrong({ from: wrap });
      }
      return;
    }
    step += 1;
    dotNodes[i].classList.add('con__dot--on');
    sfx('count', step - 1);
    haptic(6);
    redraw();
    api.partial?.(step / dots.length);

    if (step >= dots.length) {
      // Close the outline and reveal the picture.
      line.setAttribute(
        'points',
        dots.map((d) => `${d.x},${d.y}`).join(' ') + ` ${dots[0].x},${dots[0].y}`,
      );
      revealNode.setAttribute('opacity', 1);
      sparkle(wrap, '✨', 10);
      api.correct({ from: wrap });
    }
  }

  const wrap = h('div.con', board);
  wrap.style.touchAction = 'none';
  wrap.addEventListener('pointerdown', (e) => {
    dragging = true;
    wrap.setPointerCapture?.(e.pointerId);
    touch(hitDot(e));
    e.preventDefault();
  });
  wrap.addEventListener('pointermove', (e) => dragging && touch(hitDot(e)));
  const stop = () => (dragging = false);
  wrap.addEventListener('pointerup', stop);
  wrap.addEventListener('pointercancel', stop);

  function hint() {
    if (step >= dots.length) return false;
    dotNodes[step].classList.add('con__dot--glow');
    setTimeout(() => dotNodes[step].classList.remove('con__dot--glow'), 2000);
    return true;
  }

  function solve() {
    step = dots.length;
    dotNodes.forEach((n) => n.classList.add('con__dot--on'));
    line.setAttribute(
      'points',
      dots.map((d) => `${d.x},${d.y}`).join(' ') + ` ${dots[0].x},${dots[0].y}`,
    );
    revealNode.setAttribute('opacity', 1);
  }

  redraw();

  return {
    el: h(
      'div.play__body.play__body--con',
      puzzle.stemCaption ? h('div.stem__caption', puzzle.stemCaption) : null,
      wrap,
    ),
    hint,
    solve,
  };
}
