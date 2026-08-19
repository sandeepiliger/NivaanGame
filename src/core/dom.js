/**
 * Tiny DOM helpers. No framework — the whole game builds nodes directly, which
 * keeps startup instant on low-end phones and the bundle at zero bytes.
 */

/**
 * Create an element.
 *
 *   h('div.card', { onclick: fn }, 'hello')
 *   h('button.btn.btn--green', { 'aria-label': 'Play' }, icon, label)
 *
 * Tag syntax supports `tag.class.class` and `tag#id`. Props starting with `on`
 * are attached as listeners; `style` accepts an object; everything else becomes
 * an attribute (or a property for `value`/`checked`).
 */
export function h(spec, props, ...children) {
  const [head, ...classes] = String(spec).split('.');
  const [tag, id] = head.split('#');
  const el = document.createElement(tag || 'div');

  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');

  if (props && (typeof props !== 'object' || Array.isArray(props) || props instanceof Node)) {
    children.unshift(props);
    props = null;
  }

  for (const key in props) {
    const value = props[key];
    if (value === null || value === undefined || value === false) continue;

    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value);
    } else if (key === 'style' && typeof value === 'object') {
      for (const prop in value) {
        if (prop.startsWith('--')) el.style.setProperty(prop, value[prop]);
        else el.style[prop] = value[prop];
      }
    } else if (key === 'class' || key === 'className') {
      el.className = [el.className, value].filter(Boolean).join(' ');
    } else if (key === 'html') {
      el.innerHTML = value;
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value);
    } else if (key === 'value' || key === 'checked' || key === 'disabled') {
      el[key] = value;
    } else {
      el.setAttribute(key, value === true ? '' : value);
    }
  }

  append(el, children);
  return el;
}

/** Append a nested array of nodes/strings/nullish to a parent. */
export function append(parent, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false || child === true) continue;
    if (Array.isArray(child)) append(parent, child);
    else parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/** Create an SVG element with attributes (namespaced correctly). */
export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const key in attrs) {
    const value = attrs[key];
    if (value === null || value === undefined || value === false) continue;
    el.setAttribute(key, value);
  }
  append(el, children);
  return el;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Announce a message to screen readers without changing the visual UI. */
export function announce(message) {
  const live = document.getElementById('live');
  if (live) live.textContent = message;
}

/** Promise that resolves after `ms`. */
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Run a callback on the next animation frame (after layout has settled). */
export function nextFrame(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

/**
 * Normalised pointer position within an element, in element-local pixels.
 * Works for mouse, touch and pen because we only ever use Pointer Events.
 */
export function localPoint(event, el) {
  const rect = el.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top, rect };
}
