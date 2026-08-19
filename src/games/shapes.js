/**
 * Shapes & geometry: naming, matching, sides and corners, patterns, symmetry
 * and spatial reasoning.
 */

import { V } from '../engine/visual.js';
import { SHAPES, BASIC_SHAPE_IDS, COLORS, BASIC_COLOR_IDS, colorById, shapeById } from '../data/content.js';
import { choiceFrom, byTier, repeatPattern, scatterScene } from './util.js';

function shapePool(tier) {
  if (tier <= 1) return BASIC_SHAPE_IDS.slice(0, 4).map(shapeById);
  if (tier === 2) return BASIC_SHAPE_IDS.map(shapeById);
  if (tier === 3) return SHAPES.slice(0, 10);
  return SHAPES;
}

const colorFor = (rng, tier) =>
  rng.pick(tier <= 2 ? BASIC_COLOR_IDS.map(colorById) : COLORS).hex;

/* -------------------------------------------------------------------------- */
/* 1. Find the shape                                                           */
/* -------------------------------------------------------------------------- */

const findShape = {
  id: 'shp-find',
  name: 'Find the shape',
  emoji: '🔺',
  blurb: 'Tap the shape you hear',
  gen(rng, tier) {
    const pool = shapePool(tier);
    const optionCount = Math.min(byTier(tier, [3, 4, 4, 6, 6]), pool.length);
    const chosen = rng.sample(pool, optionCount);
    const target = rng.pick(chosen);
    // From tier 3 all options share a colour, so only the outline distinguishes.
    const shared = colorFor(rng, tier);

    return choiceFrom(
      rng,
      chosen,
      (s) => V.shape(s.id, tier >= 3 ? shared : colorFor(rng, tier)),
      target,
      {
        key: (s) => s.id,
        prompt: `Find the ${target.name.toLowerCase()}`,
        speak: `Tap the ${target.name}`,
        hint:
          target.sides > 0
            ? `A ${target.name.toLowerCase()} has ${target.sides} sides.`
            : `Look for the ${target.name.toLowerCase()} shape.`,
        columns: optionCount <= 4 ? 2 : 3,
        labelOf: (s) => s.name,
      },
    );
  },
};

/* -------------------------------------------------------------------------- */
/* 2. Fit the shape into its hole                                              */
/* -------------------------------------------------------------------------- */

const shapeHoles = {
  id: 'shp-hole',
  name: 'Shape sorter',
  emoji: '🕳️',
  blurb: 'Drop each shape in its hole',
  rounds: 3,
  gen(rng, tier) {
    const count = Math.min(byTier(tier, [2, 3, 4, 4, 5]), shapePool(tier).length);
    const chosen = rng.sample(shapePool(tier), count);
    const rotated = tier >= 4;

    const items = chosen.map((s, i) => ({
      id: 'p' + i,
      shape: s,
      visual: V.shape(s.id, colorFor(rng, tier), rotated ? { rotate: rng.int(1, 3) * 90 } : {}),
    }));

    const targets = rng.shuffle(items).map((item, i) => ({
      id: 'h' + i,
      visual: V.shape(item.shape.id, '#8f77ec', { outline: true, dashed: true }),
      accepts: [item.id],
      capacity: 1,
    }));

    return {
      type: 'dragdrop',
      layout: 'slots',
      prompt: 'Put each shape in its hole',
      speak: 'Drag every shape into the hole with the same outline',
      items: rng.shuffle(items).map(({ id, visual }) => ({ id, visual })),
      targets,
      targetColumns: Math.min(count, 3),
      hint: 'Match the number of corners.',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 3. Sides & corners                                                          */
/* -------------------------------------------------------------------------- */

const sidesAndCorners = {
  id: 'shp-sides',
  name: 'Sides & corners',
  emoji: '📐',
  blurb: 'Count the sides',
  gen(rng, tier) {
    const pool = shapePool(Math.max(tier, 2)).filter((s) => s.sides >= 3 && s.sides <= 8);
    const target = rng.pick(pool);
    const askCorners = tier >= 3 && rng.chance(0.4);
    const answer = target.sides;
    const optionCount = byTier(tier, [3, 3, 4, 4, 4]);

    const candidates = new Set([answer]);
    let radius = 1;
    while (candidates.size < optionCount) {
      if (answer - radius >= 1) candidates.add(answer - radius);
      if (candidates.size < optionCount) candidates.add(answer + radius);
      radius += 1;
    }

    return choiceFrom(rng, Array.from(candidates), (v) => V.text(v, 'lg'), answer, {
      prompt: askCorners ? 'How many corners?' : 'How many sides?',
      speak: askCorners
        ? `How many corners does this ${target.name.toLowerCase()} have?`
        : `How many sides does this ${target.name.toLowerCase()} have?`,
      stem: V.shape(target.id, colorFor(rng, tier)),
      stemCaption: target.name,
      hint: 'Touch each side as you count it.',
      columns: 4,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* 4. Shape patterns                                                           */
/* -------------------------------------------------------------------------- */

const shapePattern = {
  id: 'shp-pattern',
  name: 'Shape pattern',
  emoji: '🔁',
  blurb: 'Continue the pattern',
  gen(rng, tier) {
    const pool = shapePool(tier);
    const unitSize = Math.min(byTier(tier, [2, 2, 3, 3, 4]), pool.length);
    const shown = byTier(tier, [4, 5, 6, 6, 8]);
    const twoColor = tier >= 3;

    const shapeUnit = rng.sample(pool, unitSize);
    const colorUnit = twoColor
      ? rng.sample(tier <= 3 ? BASIC_COLOR_IDS.map(colorById) : COLORS, unitSize === 2 ? 3 : 2)
      : [{ hex: colorFor(rng, tier) }];

    const cell = (i) => ({
      shape: repeatPattern(shapeUnit, shown + 1)[i],
      color: repeatPattern(colorUnit, shown + 1)[i],
    });

    const sequence = Array.from({ length: shown + 1 }, (_, i) => cell(i));
    const answer = sequence[shown];

    // Distractors mix up shape and colour independently — a child must track both.
    const wrongs = new Set();
    const values = [answer];
    let guard = 0;
    while (values.length < byTier(tier, [3, 3, 4, 4, 4]) && guard++ < 80) {
      const candidate = {
        shape: rng.pick(pool),
        color: rng.pick(twoColor ? colorUnit.concat(rng.sample(COLORS, 2)) : [answer.color]),
      };
      const key = candidate.shape.id + candidate.color.hex;
      if (key === answer.shape.id + answer.color.hex || wrongs.has(key)) continue;
      wrongs.add(key);
      values.push(candidate);
    }
    // Guarantee enough options even if the pool was tiny.
    while (values.length < 3) {
      const s = pool[(pool.indexOf(answer.shape) + values.length) % pool.length];
      const key = s.id + answer.color.hex;
      if (wrongs.has(key) || key === answer.shape.id + answer.color.hex) {
        values.push({ shape: s, color: { hex: shadeHex(answer.color.hex, 0.3) } });
      } else {
        wrongs.add(key);
        values.push({ shape: s, color: answer.color });
      }
    }

    return choiceFrom(rng, values, (v) => V.shape(v.shape.id, v.color.hex), answer, {
      key: (v) => v.shape.id + v.color.hex,
      prompt: 'What comes next?',
      speak: 'Which shape comes next in the pattern?',
      stem: V.stack([
        ...sequence.slice(0, shown).map((c) => V.shape(c.shape.id, c.color.hex)),
        V.blank(),
      ]),
      stemSize: 'sm',
      hint: `The pattern repeats every ${Math.max(shapeUnit.length, colorUnit.length)} shapes.`,
      columns: values.length <= 3 ? 3 : 4,
      labelOf: (v) => v.shape.name,
    });
  },
};

function shadeHex(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.max(0, Math.min(255, Math.round(c + (255 - c) * t)));
  return (
    '#' +
    [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Symmetry                                                                 */
/* -------------------------------------------------------------------------- */

const symmetry = {
  id: 'shp-symmetry',
  name: 'Mirror it',
  emoji: '🦋',
  blurb: 'Finish the other half',
  rounds: 3,
  gen(rng, tier) {
    const half = byTier(tier, [2, 3, 3, 4, 4]);
    const w = half * 2;
    const rows = byTier(tier, [3, 4, 5, 5, 6]);
    const colorCount = byTier(tier, [1, 1, 2, 2, 3]);
    const palette = rng
      .sample(tier <= 3 ? BASIC_COLOR_IDS.map(colorById) : COLORS, colorCount)
      .map((c) => c.hex);

    const target = new Array(w * rows).fill(0);
    const locked = new Array(w * rows).fill(false);
    const density = byTier(tier, [0.55, 0.5, 0.5, 0.45, 0.45]);

    let painted = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < half; x++) {
        const value = rng.next() < density ? rng.int(1, colorCount) : 0;
        target[y * w + x] = value;
        locked[y * w + x] = true;
        // Mirror across the vertical axis.
        target[y * w + (w - 1 - x)] = value;
        if (value) painted += 1;
      }
    }

    // A blank puzzle would complete instantly — force at least three cells.
    if (painted < 3) {
      for (let i = 0; i < 3; i++) {
        const y = rng.int(0, rows - 1);
        const x = rng.int(0, half - 1);
        const value = rng.int(1, colorCount);
        target[y * w + x] = value;
        target[y * w + (w - 1 - x)] = value;
      }
    }

    // Drop any colour the picture never actually uses, and renumber the rest,
    // so the palette never offers a swatch that can only ever be wrong.
    const used = Array.from(new Set(target.filter((v) => v !== 0))).sort((a, b) => a - b);
    const remap = new Map(used.map((value, i) => [value, i + 1]));
    const finalTarget = target.map((v) => (v === 0 ? 0 : remap.get(v)));
    const finalPalette = used.map((v) => palette[v - 1]);

    return {
      type: 'symmetry',
      prompt: 'Make it match',
      speak: 'Colour the other side so both halves look the same',
      stemCaption: 'Mirror the picture',
      w,
      h: rows,
      axis: 'v',
      target: finalTarget,
      locked,
      palette: finalPalette,
      hint: 'Look straight across from a coloured square.',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 6. Sort by shape                                                            */
/* -------------------------------------------------------------------------- */

const shapeSort = {
  id: 'shp-sort',
  name: 'Shape sort',
  emoji: '🗂️',
  blurb: 'Group the shapes',
  rounds: 3,
  gen(rng, tier) {
    const binCount = byTier(tier, [2, 2, 3, 3, 4]);
    const perBin = byTier(tier, [2, 3, 2, 3, 2]);
    const byColor = tier >= 4 && rng.chance(0.4);
    const pool = shapePool(tier);

    if (byColor) {
      // Mixed shapes, sorted by colour — forces attention to the other attribute.
      const colors = rng.sample(tier <= 3 ? BASIC_COLOR_IDS.map(colorById) : COLORS, binCount);
      const items = [];
      const targets = colors.map((color, b) => {
        const mine = [];
        for (let i = 0; i < perBin; i++) {
          const itemId = `i${b}_${i}`;
          items.push({ id: itemId, visual: V.shape(rng.pick(pool).id, color.hex) });
          mine.push(itemId);
        }
        return { id: 'bin' + b, label: color.name, visual: V.swatch(color.hex), accepts: mine };
      });
      return {
        type: 'dragdrop',
        layout: 'bins',
        prompt: 'Sort by colour',
        speak: 'Sort the shapes by their colour',
        items: rng.shuffle(items),
        targets,
        targetColumns: Math.min(binCount, 4),
        hint: 'Ignore the shape — look at the colour.',
      };
    }

    const bins = rng.sample(pool, Math.min(binCount, pool.length));
    const items = [];
    const targets = bins.map((shape, b) => {
      const mine = [];
      for (let i = 0; i < perBin; i++) {
        const itemId = `i${b}_${i}`;
        items.push({ id: itemId, visual: V.shape(shape.id, colorFor(rng, tier)) });
        mine.push(itemId);
      }
      return {
        id: 'bin' + b,
        label: shape.name,
        visual: V.shape(shape.id, '#8f77ec', { outline: true }),
        accepts: mine,
      };
    });

    return {
      type: 'dragdrop',
      layout: 'bins',
      prompt: 'Sort by shape',
      speak: 'Put each shape in the matching basket',
      items: rng.shuffle(items),
      targets,
      targetColumns: Math.min(bins.length, 4),
      hint: 'The colours are there to trick you — look at the shape.',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 7. Shape memory                                                             */
/* -------------------------------------------------------------------------- */

const shapeMemory = {
  id: 'shp-memory',
  name: 'Shape pairs',
  emoji: '🃏',
  blurb: 'Find matching shapes',
  rounds: 2,
  gen(rng, tier) {
    const pairCount = Math.min(byTier(tier, [3, 4, 5, 6, 8]), SHAPES.length);
    const chosen = rng.sample(shapePool(Math.max(tier, 3)), pairCount);
    const outlineMode = tier >= 3;

    return {
      type: 'memory',
      prompt: 'Find the matching pairs',
      speak: outlineMode
        ? 'Match each shape with its outline'
        : 'Match the shapes that are the same',
      stemCaption: outlineMode ? 'Shape ➜ outline' : 'Find the twins',
      pairs: chosen.map((s) => {
        const hex = colorFor(rng, tier);
        return {
          id: 'p' + s.id,
          a: V.shape(s.id, hex),
          b: outlineMode ? V.shape(s.id, '#2a2350', { outline: true }) : V.shape(s.id, hex),
        };
      }),
      hint: 'Remember the corners you have seen.',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 8. Count the shapes in a picture                                            */
/* -------------------------------------------------------------------------- */

const shapeHunt = {
  id: 'shp-hunt',
  name: 'Shape hunt',
  emoji: '🔎',
  blurb: 'Find every hidden shape',
  rounds: 3,
  gen(rng, tier) {
    const pool = shapePool(tier);
    const target = rng.pick(pool);
    const targetCount = byTier(tier, [3, 4, 5, 6, 7]);
    const noiseCount = byTier(tier, [4, 6, 9, 12, 16]);
    const others = pool.filter((s) => s.id !== target.id);
    const sameColor = tier >= 3;
    const baseHex = colorFor(rng, tier);

    const entries = [
      ...Array.from({ length: targetCount }, () => ({ shape: target, isTarget: true })),
      ...Array.from({ length: noiseCount }, () => ({ shape: rng.pick(others), isTarget: false })),
    ];

    const scene = scatterScene(rng, rng.shuffle(entries), { minDist: tier >= 4 ? 12 : 15 }).map(
      (s) => ({
        ...s,
        // The tap renderer draws text nodes, so shapes come through as glyph-free
        // markers carrying their own inline SVG via `shapeVisual`.
        emoji: '',
        shapeVisual: V.shape(s.shape.id, sameColor ? baseHex : colorFor(rng, tier)),
      }),
    );

    return {
      type: 'tapcount',
      prompt: `Tap every ${target.name.toLowerCase()}`,
      speak: `Find and tap every ${target.name}`,
      findVisual: V.shape(target.id, sameColor ? baseHex : '#6c4ce0'),
      scene,
      targets: scene.map((s, i) => (s.isTarget ? i : -1)).filter((i) => i >= 0),
      hint: 'Count the corners of each shape.',
    };
  },
};

export const SHAPE_SKILLS = [
  findShape,
  shapeHoles,
  sidesAndCorners,
  shapePattern,
  symmetry,
  shapeSort,
  shapeMemory,
  shapeHunt,
];
