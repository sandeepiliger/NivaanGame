/**
 * Colours: naming, matching, mixing, sorting and colour logic.
 */

import { V } from '../engine/visual.js';
import {
  COLORS,
  BASIC_COLOR_IDS,
  COLOR_MIXES,
  COLOR_OBJECTS,
  colorById,
} from '../data/content.js';
import { choiceFrom, byTier, repeatPattern } from './util.js';

function palette(rng, tier) {
  return tier <= 2 ? BASIC_COLOR_IDS.map(colorById) : COLORS;
}

/* -------------------------------------------------------------------------- */
/* 1. Name the colour                                                          */
/* -------------------------------------------------------------------------- */

const findColor = {
  id: 'col-find',
  name: 'Find the colour',
  emoji: '🎨',
  blurb: 'Tap the colour you hear',
  gen(rng, tier) {
    const pool = palette(rng, tier);
    const optionCount = byTier(tier, [3, 4, 4, 6, 6]);
    const chosen = rng.sample(pool, Math.min(optionCount, pool.length));
    const target = rng.pick(chosen);

    return choiceFrom(rng, chosen, (c) => V.swatch(c.hex), target, {
      key: (c) => c.id,
      prompt: `Find ${target.name.toLowerCase()}`,
      speak: `Tap the colour ${target.name}`,
      hint: `Look for the ${target.name.toLowerCase()} one.`,
      columns: optionCount <= 4 ? 2 : 3,
      labelOf: (c) => c.name,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* 2. What colour is it?                                                       */
/* -------------------------------------------------------------------------- */

const objectColor = {
  id: 'col-object',
  name: 'Colour of things',
  emoji: '🍎',
  blurb: 'What colour is this?',
  gen(rng, tier) {
    const pool = palette(rng, tier).filter((c) => (COLOR_OBJECTS[c.id] || []).length);
    const target = rng.pick(pool);
    const optionCount = byTier(tier, [3, 3, 4, 4, 6]);
    const others = rng.sample(pool.filter((c) => c.id !== target.id), optionCount - 1);
    const reverse = tier >= 3 && rng.chance(0.4);

    if (reverse) {
      // Show a colour, pick the object that is that colour.
      const values = [target, ...others].map((c) => ({
        color: c,
        emoji: rng.pick(COLOR_OBJECTS[c.id]),
      }));
      return choiceFrom(rng, values, (v) => V.emoji(v.emoji, 'lg'), values[0], {
        key: (v) => v.color.id,
        prompt: `Which one is ${target.name.toLowerCase()}?`,
        speak: `Which thing is ${target.name}?`,
        stem: V.swatch(target.hex),
        hint: `Think about which one is ${target.name.toLowerCase()}.`,
        columns: optionCount <= 4 ? 2 : 3,
        labelOf: (v) => v.emoji,
      });
    }

    const emoji = rng.pick(COLOR_OBJECTS[target.id]);
    return choiceFrom(rng, [target, ...others], (c) => V.swatch(c.hex), target, {
      key: (c) => c.id,
      prompt: 'What colour is it?',
      speak: 'What colour is this?',
      stem: V.emoji(emoji, 'xl'),
      hint: `It is ${target.name.toLowerCase()}.`,
      columns: optionCount <= 4 ? 2 : 3,
      labelOf: (c) => c.name,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* 3. Colour mixing                                                            */
/* -------------------------------------------------------------------------- */

const mixing = {
  id: 'col-mix',
  name: 'Mix the paint',
  emoji: '🖌️',
  blurb: 'What colour do you get?',
  gen(rng, tier) {
    const mix = rng.pick(tier <= 2 ? COLOR_MIXES.slice(0, 3) : COLOR_MIXES);
    const a = colorById(mix.a);
    const b = colorById(mix.b);
    const result = colorById(mix.result);
    const optionCount = byTier(tier, [3, 3, 4, 4, 4]);
    const others = rng.sample(
      COLORS.filter((c) => ![mix.a, mix.b, mix.result].includes(c.id)),
      optionCount - 1,
    );

    return choiceFrom(rng, [result, ...others], (c) => V.swatch(c.hex), result, {
      key: (c) => c.id,
      prompt: `${a.name} + ${b.name} = ?`,
      speak: `What do you get when you mix ${a.name} and ${b.name}?`,
      stem: V.stack([V.swatch(a.hex), V.op('+'), V.swatch(b.hex), V.op('=')]),
      stemSize: 'md',
      hint: `${a.name} and ${b.name} make ${result.name.toLowerCase()}.`,
      columns: optionCount <= 3 ? 3 : 4,
      labelOf: (c) => c.name,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* 4. Colour patterns                                                          */
/* -------------------------------------------------------------------------- */

const colorPattern = {
  id: 'col-pattern',
  name: 'Colour pattern',
  emoji: '🌈',
  blurb: 'What comes next?',
  gen(rng, tier) {
    const pool = palette(rng, tier);
    const unitSize = byTier(tier, [2, 2, 3, 3, 4]);
    const shown = byTier(tier, [4, 5, 6, 6, 8]);
    const unit = rng.sample(pool, Math.min(unitSize, pool.length));
    const full = repeatPattern(unit, shown + 1);
    const answer = full[shown];

    const optionCount = byTier(tier, [3, 3, 4, 4, 4]);
    const others = rng.sample(
      pool.filter((c) => c.id !== answer.id),
      optionCount - 1,
    );

    return choiceFrom(rng, [answer, ...others], (c) => V.swatch(c.hex), answer, {
      key: (c) => c.id,
      prompt: 'What comes next?',
      speak: 'Which colour comes next in the pattern?',
      stem: V.stack([...full.slice(0, shown).map((c) => V.swatch(c.hex, null)), V.blank()]),
      stemSize: 'sm',
      hint: `The pattern repeats every ${unit.length} colours.`,
      columns: optionCount <= 3 ? 3 : 4,
      labelOf: (c) => c.name,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* 5. Sort by colour                                                           */
/* -------------------------------------------------------------------------- */

const sorting = {
  id: 'col-sort',
  name: 'Colour sort',
  emoji: '🧺',
  blurb: 'Put things in the right basket',
  rounds: 3,
  gen(rng, tier) {
    const binCount = byTier(tier, [2, 2, 3, 3, 4]);
    const perBin = byTier(tier, [2, 3, 2, 3, 2]);
    const pool = palette(rng, tier).filter((c) => (COLOR_OBJECTS[c.id] || []).length >= 2);
    const bins = rng.sample(pool, Math.min(binCount, pool.length));

    const items = [];
    const targets = bins.map((color, b) => {
      const mine = [];
      for (let i = 0; i < perBin; i++) {
        const itemId = `i${b}_${i}`;
        items.push({
          id: itemId,
          visual: V.emoji(COLOR_OBJECTS[color.id][i % COLOR_OBJECTS[color.id].length], 'md'),
        });
        mine.push(itemId);
      }
      return {
        id: 'bin' + b,
        label: color.name,
        visual: V.swatch(color.hex),
        accepts: mine,
      };
    });

    return {
      type: 'dragdrop',
      layout: 'bins',
      prompt: 'Sort them by colour',
      speak: 'Drag each thing into the basket with the matching colour',
      items: rng.shuffle(items),
      targets,
      targetColumns: Math.min(bins.length, 4),
      hint: 'Look at the colour of each basket first.',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 6. Odd colour out                                                           */
/* -------------------------------------------------------------------------- */

const oddColor = {
  id: 'col-odd',
  name: 'Odd colour out',
  emoji: '🚫',
  blurb: 'Which one is different?',
  gen(rng, tier) {
    const count = byTier(tier, [3, 4, 4, 5, 6]);
    const pool = palette(rng, tier);
    const [same, odd] = rng.sample(pool, 2);
    // At higher tiers the odd one is a near-shade rather than a different hue.
    // Very light or very dark bases can't be shaded in one direction without
    // clipping back to themselves, so pick the direction with room to move.
    const oddHex = tier >= 4 ? nearShade(same.hex, rng) : odd.hex;

    const values = [
      { id: 'odd', hex: oddHex },
      ...Array.from({ length: count - 1 }, (_, i) => ({ id: 's' + i, hex: same.hex })),
    ];

    return choiceFrom(rng, values, (v) => V.swatch(v.hex), values[0], {
      key: (v) => v.id,
      prompt: 'Which one is different?',
      speak: 'Which colour is not like the others?',
      hint: 'Compare them two at a time.',
      columns: count <= 4 ? 2 : 3,
      labelOf: () => 'colour',
    });
  },
};

/**
 * A visibly different but same-family shade — guaranteed not to round back to
 * the original, which would make the "odd one out" unanswerable.
 */
function nearShade(hex, rng) {
  const value = parseInt(hex.slice(1), 16);
  const luma = (((value >> 16) & 255) + ((value >> 8) & 255) + (value & 255)) / 3;
  // Head away from whichever end we are already close to.
  const directions = luma > 200 ? [-1] : luma < 60 ? [1] : rng.chance() ? [1, -1] : [-1, 1];
  for (const sign of directions) {
    for (const amount of [0.22, 0.3, 0.4]) {
      const candidate = shade(hex, sign * amount);
      if (candidate !== hex) return candidate;
    }
  }
  return shade(hex, -0.5);
}

/** Lighten (t>0) or darken (t<0) a hex colour. */
function shade(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) =>
    Math.max(0, Math.min(255, Math.round(t > 0 ? c + (255 - c) * t : c * (1 + t))));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/* -------------------------------------------------------------------------- */
/* 7. Light to dark                                                            */
/* -------------------------------------------------------------------------- */

const shades = {
  id: 'col-shade',
  name: 'Light to dark',
  emoji: '🌗',
  blurb: 'Order the shades',
  rounds: 4,
  gen(rng, tier) {
    const count = byTier(tier, [3, 3, 4, 4, 5]);
    const base = rng.pick(palette(rng, tier));
    const darkFirst = tier >= 3 && rng.chance(0.4);

    // Evenly spaced tints from light to dark.
    const steps = Array.from({ length: count }, (_, i) => 0.65 - (i * 1.15) / (count - 1));
    const swatches = steps.map((t, i) => ({ id: 's' + i, hex: shade(base.hex, t), t }));
    const sorted = swatches.slice().sort((a, b) => (darkFirst ? a.t - b.t : b.t - a.t));

    return {
      type: 'order',
      prompt: darkFirst ? 'Darkest to lightest' : 'Lightest to darkest',
      speak: darkFirst
        ? 'Tap them from darkest to lightest'
        : 'Tap them from lightest to darkest',
      trayLabel: darkFirst ? '⬛ ➡️ ⬜' : '⬜ ➡️ ⬛',
      items: rng.shuffle(swatches).map((s) => ({ id: s.id, visual: V.swatch(s.hex) })),
      answer: sorted.map((s) => s.id),
      hint: darkFirst ? 'Start with the deepest colour.' : 'Start with the palest colour.',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 8. Colour sudoku                                                            */
/* -------------------------------------------------------------------------- */

const colorSudoku = {
  id: 'col-sudoku',
  name: 'Colour sudoku',
  emoji: '🟦',
  blurb: 'One of each colour in every line',
  rounds: 2,
  gen(rng, tier) {
    const size = tier >= 4 ? 6 : 4;
    const boxW = size === 4 ? 2 : 3;
    const boxH = 2;
    const clues = byTier(tier, [0.68, 0.6, 0.5, 0.55, 0.45]);
    const chosen = rng.sample(palette(rng, Math.max(tier, 3)), size);

    const { given, solution } = makeLatinPuzzle(rng, size, boxW, boxH, clues);

    return {
      type: 'sudoku',
      prompt: 'Fill every row and column',
      speak: 'Each colour must appear once in every row, column and box',
      stemCaption: 'One of each colour per row, column and box',
      size,
      boxW,
      boxH,
      given,
      solution,
      symbols: chosen.map((c) => V.swatch(c.hex)),
      hint: 'Find a row that is nearly full.',
    };
  },
};

/**
 * Build a valid sudoku-style grid and remove cells to make the puzzle.
 * Uses a shifted-band Latin square, then shuffles rows/columns/symbols within
 * their bands so the arrangement stays valid but looks freshly generated.
 */
export function makeLatinPuzzle(rng, size, boxW, boxH, clueFraction) {
  const base = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      // Standard construction: shift each row by the box pattern.
      const band = Math.floor(r / boxH);
      const rowInBand = r % boxH;
      const shift = (rowInBand * boxW + band) % size;
      row.push(((c + shift) % size) + 1);
    }
    base.push(row);
  }

  // Permute symbols.
  const symbolMap = rng.shuffle(Array.from({ length: size }, (_, i) => i + 1));
  let grid = base.map((row) => row.map((v) => symbolMap[v - 1]));

  // Permute rows within each band and columns within each stack.
  for (let band = 0; band < size / boxH; band++) {
    const rows = rng.shuffle(Array.from({ length: boxH }, (_, i) => band * boxH + i));
    const copy = rows.map((r) => grid[r]);
    for (let i = 0; i < boxH; i++) grid[band * boxH + i] = copy[i];
  }
  for (let stack = 0; stack < size / boxW; stack++) {
    const cols = rng.shuffle(Array.from({ length: boxW }, (_, i) => stack * boxW + i));
    grid = grid.map((row) => {
      const copy = cols.map((c) => row[c]);
      const out = row.slice();
      for (let i = 0; i < boxW; i++) out[stack * boxW + i] = copy[i];
      return out;
    });
  }

  const solution = grid.flat();
  const cellCount = size * size;
  const keep = Math.max(size, Math.round(cellCount * clueFraction));
  const order = rng.shuffle(Array.from({ length: cellCount }, (_, i) => i));
  const keepIndices = new Set(order.slice(0, keep));
  const given = solution.map((v, i) => (keepIndices.has(i) ? v : 0));

  // A puzzle with more than one answer would mark a legitimate choice wrong, so
  // reveal extra cells until exactly one solution remains.
  for (const i of order.slice(keep)) {
    if (countSolutions(given, size, boxW, boxH, 2) === 1) break;
    given[i] = solution[i];
  }

  return { given, solution };
}

/** Count solutions up to `limit` with simple backtracking (grids are ≤ 6×6). */
function countSolutions(given, size, boxW, boxH, limit = 2) {
  const grid = given.slice();
  let found = 0;

  const ok = (index, value) => {
    const x = index % size;
    const y = Math.floor(index / size);
    for (let i = 0; i < size; i++) {
      if (grid[y * size + i] === value) return false;
      if (grid[i * size + x] === value) return false;
    }
    const bx = Math.floor(x / boxW) * boxW;
    const by = Math.floor(y / boxH) * boxH;
    for (let dy = 0; dy < boxH; dy++) {
      for (let dx = 0; dx < boxW; dx++) {
        if (grid[(by + dy) * size + bx + dx] === value) return false;
      }
    }
    return true;
  };

  const step = () => {
    const index = grid.indexOf(0);
    if (index === -1) {
      found += 1;
      return found >= limit;
    }
    for (let v = 1; v <= size; v++) {
      if (!ok(index, v)) continue;
      grid[index] = v;
      if (step()) return true;
      grid[index] = 0;
    }
    return false;
  };

  step();
  return found;
}

export const COLOR_SKILLS = [
  findColor,
  objectColor,
  mixing,
  colorPattern,
  sorting,
  oddColor,
  shades,
  colorSudoku,
];
