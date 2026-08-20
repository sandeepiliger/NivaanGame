/**
 * Hash router with a screen stack.
 *
 * Screens are functions `(params) => { el, onEnter?, onLeave? }`. Only one is
 * mounted at a time; the hash keeps the phone's hardware back button working,
 * which is essential once this is wrapped as a native app.
 */

import { clear } from './dom.js';
import { shutUp } from './audio.js';
import { screenView } from './analytics.js';

const routes = new Map();
let mount = null;
let current = null;
let navigating = false;

export function defineRoute(name, factory) {
  routes.set(name, factory);
}

export function start(mountEl, fallback = 'home') {
  mount = mountEl;
  const render = () => renderFromHash(fallback);
  window.addEventListener('hashchange', render);
  render();
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  if (!raw) return { name: '', params: {} };
  const [path, query = ''] = raw.split('?');
  const params = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [k, v = ''] = pair.split('=');
    params[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return { name: path, params };
}

function renderFromHash(fallback) {
  const { name, params } = parseHash();
  const routeName = routes.has(name) ? name : fallback;
  const factory = routes.get(routeName);
  if (!factory) return;

  shutUp();
  if (current?.onLeave) {
    try {
      current.onLeave();
    } catch (err) {
      console.error('[router] onLeave failed', err);
    }
  }

  let screen;
  try {
    screen = factory(params) || {};
  } catch (err) {
    console.error(`[router] screen "${routeName}" failed to build`, err);
    screen = { el: errorScreen(err) };
  }

  current = screen;
  clear(mount);
  if (screen.el) {
    screen.el.classList.add('screen-enter');
    mount.appendChild(screen.el);
  }
  // Land at the top of every new screen.
  screen.el?.querySelector('.screen__scroll')?.scrollTo?.(0, 0);
  screen.onEnter?.();
  screenView(routeName || 'home');
}

function errorScreen(err) {
  const el = document.createElement('div');
  el.className = 'screen center';
  el.style.padding = '24px';
  el.style.color = '#fff';
  el.innerHTML =
    '<div style="text-align:center"><div style="font-size:52px">🛠️</div>' +
    '<p style="font-size:18px">Something went wrong loading this game.</p>' +
    '<a class="btn btn--paper" href="#/home" style="text-decoration:none">Back to menu</a></div>';
  console.error(err);
  return el;
}

/** Build a hash URL from a route name + params. */
export function href(name, params = {}) {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `#/${name}${query ? '?' + query : ''}`;
}

export function go(name, params = {}, { replace = false } = {}) {
  if (navigating) return;
  navigating = true;
  requestAnimationFrame(() => {
    navigating = false;
  });
  const url = href(name, params);
  if (replace) location.replace(url);
  else location.hash = url;
}

export function back(fallback = 'home') {
  if (history.length > 1) history.back();
  else go(fallback, {}, { replace: true });
}

export function currentRoute() {
  return parseHash();
}
