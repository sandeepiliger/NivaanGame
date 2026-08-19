/**
 * Celebration effects: confetti, floating score pops, screen shake, toasts.
 * All effects are purely decorative and self-cleaning.
 */

import { h } from './dom.js';

const COLORS = ['#ffcc29', '#ff4f81', '#35d0e8', '#3ecf6d', '#ff8a3d', '#8f77ec', '#ffffff'];

function layer() {
  return document.getElementById('fx');
}

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Burst of confetti. Pass an element to burst from its centre, otherwise it
 * rains from the top of the screen.
 */
export function confetti({ from = null, count = 60, spread = 1 } = {}) {
  const root = layer();
  if (!root || reducedMotion()) return;

  const origin = from
    ? (() => {
        const r = from.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()
    : null;

  for (let i = 0; i < count; i++) {
    const piece = h('div.confetti', {
      style: {
        background: COLORS[i % COLORS.length],
        borderRadius: i % 3 === 0 ? '50%' : '2px',
      },
    });

    const startX = origin ? origin.x : Math.random() * window.innerWidth;
    const startY = origin ? origin.y : -20;
    piece.style.left = startX + 'px';
    piece.style.top = startY + 'px';

    const angle = origin ? Math.random() * Math.PI * 2 : Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    const power = (origin ? 120 + Math.random() * 260 : 40) * spread;
    const dx = Math.cos(angle) * power + (origin ? 0 : (Math.random() - 0.5) * 120);
    const dy = origin
      ? Math.sin(angle) * power + 260
      : window.innerHeight + 80;
    const spin = (Math.random() - 0.5) * 1080;
    const dur = 900 + Math.random() * 900;

    root.appendChild(piece);
    piece
      .animate(
        [
          { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg)`, opacity: 0 },
        ],
        { duration: dur, easing: 'cubic-bezier(.2,.6,.35,1)', fill: 'forwards' },
      )
      .addEventListener('finish', () => piece.remove());
  }
}

/** A little "+1 ⭐" that floats up from a point or element. */
export function floatText(text, target, color = '#ffcc29') {
  const root = layer();
  if (!root) return;
  const rect =
    target instanceof Element
      ? target.getBoundingClientRect()
      : { left: target.x, top: target.y, width: 0, height: 0 };
  const node = h('div.floatup', { style: { color } }, text);
  node.style.left = rect.left + rect.width / 2 + 'px';
  node.style.top = rect.top + 'px';
  root.appendChild(node);
  setTimeout(() => node.remove(), 950);
}

/** Emoji burst — used when a shape snaps into place or a maze is solved. */
export function sparkle(target, emoji = '✨', count = 8) {
  const root = layer();
  if (!root || reducedMotion()) return;
  const r = target instanceof Element ? target.getBoundingClientRect() : target;
  const cx = r.left + (r.width || 0) / 2;
  const cy = r.top + (r.height || 0) / 2;
  for (let i = 0; i < count; i++) {
    const node = h('div', { style: { position: 'absolute', fontSize: '20px' } }, emoji);
    node.style.left = cx + 'px';
    node.style.top = cy + 'px';
    root.appendChild(node);
    const a = (i / count) * Math.PI * 2;
    const d = 40 + Math.random() * 50;
    node
      .animate(
        [
          { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
          {
            transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1.1)`,
            opacity: 0,
          },
        ],
        { duration: 620, easing: 'ease-out', fill: 'forwards' },
      )
      .addEventListener('finish', () => node.remove());
  }
}

export function shake(el) {
  if (!el || reducedMotion()) return;
  el.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-9px)' },
      { transform: 'translateX(8px)' },
      { transform: 'translateX(-6px)' },
      { transform: 'translateX(4px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 340, easing: 'ease-in-out' },
  );
}

export function pulse(el, scale = 1.12) {
  if (!el || reducedMotion()) return;
  el.animate(
    [{ transform: 'scale(1)' }, { transform: `scale(${scale})` }, { transform: 'scale(1)' }],
    { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' },
  );
}

let toastTimer = 0;
export function toast(message, ms = 2200) {
  document.querySelector('.toast')?.remove();
  const node = h('div.toast', message);
  document.body.appendChild(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.remove(), ms);
}
