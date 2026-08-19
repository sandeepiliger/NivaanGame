/**
 * Helpers shared by the puzzle generators.
 *
 * Generators are pure functions of (rng, tier) so every puzzle is
 * reproducible and can be validated offline by the smoke tests.
 */

import { V, scatterOffsets } from '../engine/visual.js';
import { COLORS, colorById, NUMBER_WORDS } from '../data/content.js';

/**
 * Build a `choice` puzzle from a list of candidate values.
 *
 * @param {object} rng
 * @param {any[]} values      every option value (must include `answerValue`)
 * @param {(v:any)=>object} toVisual
 * @param {any} answerValue
 * @param {object} extra      merged into the puzzle (prompt, stem, columns…)
 */
export function choiceFrom(rng, values, toVisual, answerValue, extra = {}) {
  const key = extra.key || ((v) => String(v));
  const answerKey = key(answerValue);
  const shuffled = rng.shuffle(values);
  const options = shuffled.map((value, i) => ({
    id: 'o' + i,
    value,
    visual: toVisual(value),
    label: extra.labelOf ? extra.labelOf(value) : String(value),
  }));
  const match = options.find((o) => key(o.value) === answerKey);
  if (!match) throw new Error('choiceFrom: answer is not among the options');
  const { key: _k, labelOf: _l, ...rest } = extra;
  return { type: 'choice', options, answer: match.id, ...rest };
}

/**
 * `count` distinct integers around `answer` inside [min, max], always
 * including `answer`. Distractors sit close to the answer so the puzzle
 * actually tests counting rather than eyeballing extremes.
 */
export function numberOptions(rng, answer, count, min, max) {
  const set = new Set([answer]);
  let radius = 1;
  while (set.size < count && radius < 40) {
    for (const candidate of [answer - radius, answer + radius]) {
      if (candidate >= min && candidate <= max) set.add(candidate);
      if (set.size >= count) break;
    }
    radius += 1;
  }
  // Range too small to fill — widen beyond `max` rather than return too few.
  let extra = max + 1;
  while (set.size < count) set.add(extra++);
  return Array.from(set).slice(0, count);
}

/** A visual group of `n` copies of `emoji`, jittered deterministically. */
export function group(rng, emoji, n, layout = 'scatter') {
  return V.count(emoji, n, layout, layout === 'scatter' ? scatterOffsets(rng, n, 9) : null);
}

/** Pick `n` distinct colours, optionally restricted to a set of ids. */
export function pickColors(rng, n, ids = null) {
  const pool = ids ? ids.map(colorById).filter(Boolean) : COLORS;
  return rng.sample(pool, n);
}

/** Repeat a pattern of items to a given length: [a,b] × 5 -> a,b,a,b,a */
export function repeatPattern(unit, length) {
  return Array.from({ length }, (_, i) => unit[i % unit.length]);
}

/**
 * Build a "what comes next?" pattern puzzle body.
 * Returns { sequence, answer } where sequence ends with a blank slot.
 */
export function patternSequence(rng, unit, visibleLength) {
  const full = repeatPattern(unit, visibleLength + 1);
  return { shown: full.slice(0, visibleLength), answer: full[visibleLength] };
}

/** Scale helper: linearly interpolate an integer across tiers 1..5. */
export function byTier(tier, values) {
  return values[Math.min(values.length - 1, Math.max(0, tier - 1))];
}

/** Turn a number into its spoken word where we have one. */
export const numWord = (n) => NUMBER_WORDS[n] ?? String(n);

/** Random emoji from a themed set, avoiding repeats within a puzzle. */
export function themeItems(rng, theme, n) {
  return rng.sample(theme.items, n);
}

/**
 * Lay objects out in a scene for the tap-and-find games. Positions are kept
 * apart by a simple rejection sample so nothing hides behind anything else.
 */
export function scatterScene(rng, entries, { minDist = 15, pad = 8 } = {}) {
  const placed = [];
  for (const entry of entries) {
    let best = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      const point = {
        x: pad + rng.next() * (100 - pad * 2),
        y: pad + rng.next() * (100 - pad * 2),
      };
      const nearest = placed.reduce(
        (min, p) => Math.min(min, Math.hypot(p.x - point.x, p.y - point.y)),
        Infinity,
      );
      if (nearest > minDist) {
        best = point;
        break;
      }
      if (!best || nearest > best._d) best = { ...point, _d: nearest };
    }
    placed.push({
      ...entry,
      x: Math.round(best.x * 10) / 10,
      y: Math.round(best.y * 10) / 10,
      scale: 0.85 + rng.next() * 0.4,
      rot: Math.round((rng.next() - 0.5) * 30),
    });
  }
  return placed;
}

/** Ids for drag/drop puzzles. */
export const id = (prefix, i) => `${prefix}${i}`;
