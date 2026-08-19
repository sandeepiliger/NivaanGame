/**
 * Pointer-based drag helper shared by the drag-and-drop style games.
 *
 * Small children are not reliable draggers, so every draggable also supports
 * tap-to-pick / tap-to-place. Both paths funnel into the same `onDrop`.
 */

import { h } from '../core/dom.js';

const DRAG_THRESHOLD = 6; // px before a press becomes a drag rather than a tap

/**
 * @param {HTMLElement} el         the source element
 * @param {object} o
 * @param {() => HTMLElement} o.ghost  builds the floating element that follows the finger
 * @param {(target: HTMLElement|null, ctx: object) => void} o.onDrop
 * @param {() => void} [o.onTap]   called when the press never became a drag
 * @param {string} [o.dropSelector='[data-drop]']
 * @param {() => boolean} [o.enabled]
 */
export function makeDraggable(el, o) {
  const dropSelector = o.dropSelector || '[data-drop]';
  let ghost = null;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let pointerId = null;
  let lastTarget = null;

  el.style.touchAction = 'none';

  el.addEventListener('pointerdown', (event) => {
    if (o.enabled && !o.enabled()) return;
    if (pointerId !== null) return;
    if (event.button !== undefined && event.button !== 0) return;

    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dragging = false;
    el.setPointerCapture?.(pointerId);
    event.preventDefault();
  });

  el.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;

    if (!dragging) {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      dragging = true;
      ghost = o.ghost();
      ghost.classList.add('drag-ghost');
      document.body.appendChild(ghost);
      el.classList.add('is-dragging-source');
    }

    moveGhost(event.clientX, event.clientY);
    const target = hitTest(event.clientX, event.clientY);
    if (target !== lastTarget) {
      lastTarget?.classList.remove('drop--over');
      target?.classList.add('drop--over');
      lastTarget = target;
    }
  });

  const finish = (event) => {
    if (event.pointerId !== pointerId) return;
    el.releasePointerCapture?.(pointerId);
    pointerId = null;

    if (!dragging) {
      o.onTap?.();
      return;
    }

    const target = hitTest(event.clientX, event.clientY);
    lastTarget?.classList.remove('drop--over');
    lastTarget = null;
    ghost?.remove();
    ghost = null;
    el.classList.remove('is-dragging-source');
    dragging = false;
    o.onDrop(target, { x: event.clientX, y: event.clientY });
  };

  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', (event) => {
    if (event.pointerId !== pointerId) return;
    el.releasePointerCapture?.(pointerId);
    pointerId = null;
    lastTarget?.classList.remove('drop--over');
    lastTarget = null;
    ghost?.remove();
    ghost = null;
    el.classList.remove('is-dragging-source');
    dragging = false;
  });

  function moveGhost(x, y) {
    if (!ghost) return;
    ghost.style.left = x + 'px';
    ghost.style.top = y + 'px';
  }

  function hitTest(x, y) {
    // The ghost sits under the finger, so it must not shadow the drop zones.
    if (ghost) ghost.style.display = 'none';
    const node = document.elementFromPoint(x, y);
    if (ghost) ghost.style.display = '';
    return node?.closest(dropSelector) || null;
  }
}

/** Build a floating copy of an element for the drag ghost. */
export function cloneGhost(el) {
  const rect = el.getBoundingClientRect();
  const clone = el.cloneNode(true);
  clone.style.width = rect.width + 'px';
  clone.style.height = rect.height + 'px';
  return h('div', { style: { width: rect.width + 'px', height: rect.height + 'px' } }, clone);
}

/**
 * Fly an element from its current position to a target rect, then run `after`.
 * Used to animate a piece snapping into its slot.
 */
export function flyTo(el, targetRect, after) {
  const from = el.getBoundingClientRect();
  const dx = targetRect.left + targetRect.width / 2 - (from.left + from.width / 2);
  const dy = targetRect.top + targetRect.height / 2 - (from.top + from.height / 2);
  const anim = el.animate(
    [{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px, ${dy}px)` }],
    { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' },
  );
  anim.addEventListener('finish', () => after?.());
}
