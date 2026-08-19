/**
 * Drag-and-drop renderer — sorting bins, shape holes, jigsaw slots and
 * word building all use this one interaction.
 *
 * Puzzle fields:
 *   items    [{ id, visual, accepts? }]  the draggable pieces
 *   targets  [{ id, visual?, label?, accepts:[itemId|'*'], capacity? }]
 *   layout   'bins'  — big buckets under a tray of items (sorting)
 *            'slots' — a row of outlined holes (word building, shape fit)
 *            'board' — free-form grid of holes (jigsaw)
 *   keepItem when true the item stays available after being placed
 */

import { h } from '../../core/dom.js';
import { renderVisual } from '../visual.js';
import { makeDraggable, cloneGhost } from '../drag.js';
import { sfx, haptic } from '../../core/audio.js';
import { shake, pulse, sparkle } from '../../core/fx.js';

export function renderDragDrop(puzzle, api) {
  const layout = puzzle.layout || 'bins';
  const capacityOf = (t) => t.capacity ?? (layout === 'bins' ? Infinity : 1);

  const placed = new Map(); // targetId -> [itemId]
  const itemHome = new Map(); // itemId -> tray element
  const itemNodes = new Map();
  const targetNodes = new Map();
  let selectedId = null;
  let solvedCount = 0;

  // How many successful placements finish the round. Slot layouts can include
  // decoy pieces that never belong anywhere, so they count slots, not items.
  const required =
    puzzle.requires ??
    (layout === 'bins'
      ? puzzle.items.length
      : puzzle.targets.reduce((sum, t) => sum + (Number.isFinite(capacityOf(t)) ? capacityOf(t) : 1), 0));

  /* --- targets ---------------------------------------------------------- */

  const targetsEl = h('div.dd__targets.dd__targets--' + layout, {
    style: { '--cols': puzzle.targetColumns || Math.min(puzzle.targets.length, 4) },
  });

  for (const t of puzzle.targets) {
    placed.set(t.id, []);
    const slot = h('div.dd__slotbody');
    const node = h(
      'div.dd__target.dd__target--' + layout,
      { 'data-drop': '', 'data-target': t.id, onclick: () => tapTarget(t.id) },
      t.visual ? h('div.dd__targetart', renderVisual(t.visual, { size: t.visualSize || 'md' })) : null,
      slot,
      t.label ? h('div.dd__targetlabel', t.label) : null,
    );
    node._slot = slot;
    targetNodes.set(t.id, node);
    targetsEl.appendChild(node);
  }

  /* --- tray ------------------------------------------------------------- */

  const trayEl = h('div.dd__tray');

  for (const item of puzzle.items) {
    const home = h('div.dd__home');
    const node = h(
      'div.dd__item',
      { 'data-item': item.id, role: 'button', tabindex: '0' },
      renderVisual(item.visual, { size: item.visualSize || 'md' }),
    );

    makeDraggable(node, {
      ghost: () => cloneGhost(node),
      enabled: () => !node.classList.contains('dd__item--locked'),
      onTap: () => tapItem(item.id),
      onDrop: (target) => {
        if (!target) return;
        attempt(item.id, target.dataset.target);
      },
    });
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tapItem(item.id);
      }
    });

    home.appendChild(node);
    itemHome.set(item.id, home);
    itemNodes.set(item.id, node);
    trayEl.appendChild(home);
  }

  /* --- interaction ------------------------------------------------------ */

  function tapItem(id) {
    const node = itemNodes.get(id);
    if (node.classList.contains('dd__item--locked')) return;
    if (selectedId === id) {
      setSelected(null);
      return;
    }
    setSelected(id);
    sfx('pickup');
  }

  function tapTarget(targetId) {
    if (!selectedId) return;
    attempt(selectedId, targetId);
  }

  function setSelected(id) {
    if (selectedId) itemNodes.get(selectedId)?.classList.remove('dd__item--picked');
    selectedId = id;
    if (id) itemNodes.get(id)?.classList.add('dd__item--picked');
    targetsEl.classList.toggle('dd__targets--armed', Boolean(id));
  }

  function accepts(target, itemId) {
    const list = target.accepts || [];
    return list.includes('*') || list.includes(itemId);
  }

  function attempt(itemId, targetId) {
    const target = puzzle.targets.find((t) => t.id === targetId);
    const itemNode = itemNodes.get(itemId);
    const targetNode = targetNodes.get(targetId);
    if (!target || !itemNode || itemNode.classList.contains('dd__item--locked')) return;

    setSelected(null);

    const full = placed.get(targetId).length >= capacityOf(target);
    if (!accepts(target, itemId) || full) {
      shake(targetNode);
      sfx('wrong');
      haptic([18, 40, 18]);
      targetNode.classList.add('dd__target--wrong');
      setTimeout(() => targetNode.classList.remove('dd__target--wrong'), 420);
      api.wrong({ from: targetNode });
      return;
    }

    // Correct placement.
    placed.get(targetId).push(itemId);
    itemNode.classList.add('dd__item--locked', 'dd__item--placed');
    targetNode._slot.appendChild(itemNode);
    targetNode.classList.add('dd__target--filled');
    pulse(targetNode, 1.06);
    sparkle(targetNode, '✨', 5);
    sfx('snap');
    haptic(12);
    solvedCount += 1;
    api.partial?.(solvedCount / required);

    if (solvedCount >= required) {
      api.correct({ from: targetsEl });
    }
  }

  function hint() {
    // Highlight the home of the first unplaced item and its correct target.
    const nextItem = puzzle.items.find(
      (i) => !itemNodes.get(i.id).classList.contains('dd__item--locked'),
    );
    if (!nextItem) return false;
    const target = puzzle.targets.find((t) => accepts(t, nextItem.id));
    itemNodes.get(nextItem.id).classList.add('dd__item--glow');
    targetNodes.get(target?.id)?.classList.add('dd__target--glow');
    setTimeout(() => {
      itemNodes.get(nextItem.id)?.classList.remove('dd__item--glow');
      targetNodes.get(target?.id)?.classList.remove('dd__target--glow');
    }, 2200);
    return true;
  }

  function solve() {
    for (const item of puzzle.items) {
      if (itemNodes.get(item.id).classList.contains('dd__item--locked')) continue;
      const target = puzzle.targets.find((t) => accepts(t, item.id));
      if (!target) continue;
      placed.get(target.id).push(item.id);
      const node = itemNodes.get(item.id);
      node.classList.add('dd__item--locked', 'dd__item--placed');
      targetNodes.get(target.id)._slot.appendChild(node);
      targetNodes.get(target.id).classList.add('dd__target--filled');
    }
  }

  const el = h(
    'div.play__body.play__body--dd',
    puzzle.stem ? h('div.stem.stem--sm', renderVisual(puzzle.stem, { size: 'lg' })) : null,
    puzzle.stemCaption ? h('div.stem__caption', puzzle.stemCaption) : null,
    layout === 'slots' ? targetsEl : null,
    trayEl,
    layout !== 'slots' ? targetsEl : null,
  );

  return { el, hint, solve };
}

/**
 * Exported for the tests: can this puzzle actually be finished?
 *
 * Bin layouts need a home for every item. Slot layouts need a distinct item for
 * every slot, but may also carry decoy items that belong nowhere.
 */
export function dragDropIsSolvable(puzzle) {
  const bins = (puzzle.layout || 'bins') === 'bins';
  const capacityOf = (t) => t.capacity ?? (bins ? Infinity : 1);
  const accepts = (t, itemId) => (t.accepts || []).some((a) => a === '*' || a === itemId);

  if (bins) {
    const used = new Map(puzzle.targets.map((t) => [t.id, 0]));
    for (const item of puzzle.items) {
      const target = puzzle.targets.find(
        (t) => accepts(t, item.id) && used.get(t.id) < capacityOf(t),
      );
      if (!target) return false;
      used.set(target.id, used.get(target.id) + 1);
    }
    return true;
  }

  // Slots: greedily match the most constrained slot first, which is exact for
  // the small, tree-like accept sets these puzzles produce.
  const taken = new Set();
  const slots = puzzle.targets
    .filter((t) => capacityOf(t) > 0)
    .map((t) => ({ t, need: capacityOf(t) }))
    .sort((a, b) => (a.t.accepts || []).length - (b.t.accepts || []).length);

  for (const { t, need } of slots) {
    for (let k = 0; k < need; k++) {
      const pick = puzzle.items.find((i) => !taken.has(i.id) && accepts(t, i.id));
      if (!pick) return false;
      taken.add(pick.id);
    }
  }
  return true;
}

