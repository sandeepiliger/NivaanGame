/**
 * Little Ones — the world for two- to four-year-olds.
 *
 * Everything here follows toddler rules, which are genuinely different from
 * the rest of the game:
 *
 *   - two or three options, never more, and always huge;
 *   - one idea per screen, spoken aloud, with no reading required;
 *   - the answer is something they already know (a dog, a ball, red) rather
 *     than something to work out;
 *   - a wrong tap wiggles and invites another go — the levels are marked
 *     `forgiving`, so nothing a toddler does costs them a star.
 *
 * Only three tiers: at this age difficulty means "one more option" or "one more
 * thing to count", not new concepts.
 */

import { V } from '../engine/visual.js';
import {
  FIRST_ANIMALS,
  FIRST_WORDS,
  ANIMAL_FOOD,
  BASIC_COLOR_IDS,
  COLOR_OBJECTS,
  colorById,
  numberWord,
} from '../data/content.js';
import { choiceFrom, byTier, group } from './util.js';

/** Toddler choice puzzles are always big and always two or three wide. */
const BIG = { optionSize: 'xl', columns: 2 };

/**
 * Walk a parametric curve and drop a waypoint every `spacing` units.
 *
 * Evenly spaced dots matter: the trace renderer only claims a waypoint once the
 * finger is within reach of it, so a gap wider than that reach would break the
 * trail, and dots bunched together would all pop from a single touch.
 */
function resample(curve, spacing) {
  const dense = Array.from({ length: 401 }, (_, i) => curve(i / 400));
  const path = [dense[0]];
  let last = dense[0];

  for (const point of dense) {
    if (Math.hypot(point.x - last.x, point.y - last.y) < spacing) continue;
    path.push(point);
    last = point;
  }

  // Always finish exactly on the destination, unless that lands on top of the
  // previous dot — in which case replace it rather than crowd it.
  const end = dense[dense.length - 1];
  if (Math.hypot(end.x - last.x, end.y - last.y) < spacing * 0.5) path.pop();
  path.push(end);

  return path.map((p) => ({
    x: Math.round(p.x * 10) / 10,
    y: Math.round(p.y * 10) / 10,
  }));
}

/* -------------------------------------------------------------------------- */
/* 1. Pop the bubbles                                                          */
/* -------------------------------------------------------------------------- */

const bubbles = {
  id: 'tot-pop',
  name: 'Pop the bubbles',
  emoji: '🫧',
  blurb: 'Touch them all!',
  rounds: 3,
  gen(rng, tier) {
    const count = byTier(tier, [4, 6, 8]);
    const withFaces = rng.chance(0.6);
    const faces = rng.sample(FIRST_ANIMALS, Math.min(count, FIRST_ANIMALS.length));

    // Lay the bubbles out on a loose grid spread across the whole play area, so
    // none of them overlap and none is stranded in a corner.
    const cols = count <= 4 ? 2 : 3;
    const rows = Math.ceil(count / cols);
    const spread = (i, n, from, to) =>
      n <= 1 ? (from + to) / 2 : from + (i / (n - 1)) * (to - from);

    const list = Array.from({ length: count }, (_, i) => ({
      emoji: withFaces ? faces[i % faces.length].emoji : '',
      x: Math.round((spread(i % cols, cols, 20, 80) + (rng.next() - 0.5) * 6) * 10) / 10,
      y: Math.round((spread(Math.floor(i / cols), rows, 16, 84) + (rng.next() - 0.5) * 6) * 10) / 10,
      size: 0.85 + rng.next() * 0.35,
      hue: rng.int(0, 359),
    }));

    return {
      type: 'pop',
      prompt: 'Pop all the bubbles!',
      speak: 'Pop all the bubbles with your finger!',
      bubbles: list,
      countAloud: true,
      hint: 'Touch a bubble to pop it!',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 2. Where is the…?                                                           */
/* -------------------------------------------------------------------------- */

const findIt = {
  id: 'tot-find',
  name: 'Where is it?',
  emoji: '👀',
  blurb: 'Find the animal',
  gen(rng, tier) {
    const optionCount = byTier(tier, [2, 2, 3]);
    const useAnimals = rng.chance(0.6);
    const pool = useAnimals ? FIRST_ANIMALS : FIRST_WORDS;
    const chosen = rng.sample(pool, optionCount);
    const target = rng.pick(chosen);

    return choiceFrom(rng, chosen, (t) => V.emoji(t.emoji, 'xl'), target, {
      key: (t) => t.name,
      prompt: `Where is the ${target.name}?`,
      speak: `Can you find the ${target.name}?`,
      hint: `The ${target.name}!`,
      labelOf: (t) => t.name,
      ...BIG,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* 3. Animal sounds                                                            */
/* -------------------------------------------------------------------------- */

const animalSounds = {
  id: 'tot-sound',
  name: 'Animal sounds',
  emoji: '🔊',
  blurb: 'Who says moo?',
  gen(rng, tier) {
    const optionCount = byTier(tier, [2, 2, 3]);
    const chosen = rng.sample(FIRST_ANIMALS, optionCount);
    const target = rng.pick(chosen);

    return choiceFrom(rng, chosen, (a) => V.emoji(a.emoji, 'xl'), target, {
      key: (a) => a.name,
      prompt: `Who says "${target.sound}"?`,
      speak: `${target.sound}! Who says ${target.sound}?`,
      stem: V.text(target.sound + '!', 'md'),
      hint: `The ${target.name} says ${target.sound}.`,
      labelOf: (a) => a.name,
      ...BIG,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* 4. Find the same one                                                        */
/* -------------------------------------------------------------------------- */

const findSame = {
  id: 'tot-same',
  name: 'Find the same',
  emoji: '👯',
  blurb: 'Which one matches?',
  gen(rng, tier) {
    const optionCount = byTier(tier, [2, 3, 3]);
    const pool = rng.chance() ? FIRST_ANIMALS : FIRST_WORDS;
    const chosen = rng.sample(pool, optionCount);
    const target = rng.pick(chosen);

    return choiceFrom(rng, chosen, (t) => V.emoji(t.emoji, 'xl'), target, {
      key: (t) => t.name,
      prompt: 'Find the same one',
      speak: 'Which one is the same as the picture at the top?',
      stem: V.emoji(target.emoji, 'xl'),
      hint: 'Look at the big picture, then find its twin.',
      labelOf: (t) => t.name,
      ...BIG,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* 5. First colours                                                            */
/* -------------------------------------------------------------------------- */

const firstColors = {
  id: 'tot-color',
  name: 'Colours',
  emoji: '🎨',
  blurb: 'Tap the red one',
  gen(rng, tier) {
    const optionCount = byTier(tier, [2, 2, 3]);
    // Red, blue and yellow first — the three a toddler learns before any other.
    const pool = (tier === 1 ? ['red', 'blue', 'yellow'] : BASIC_COLOR_IDS).map(colorById);
    const chosen = rng.sample(pool, Math.min(optionCount, pool.length));
    const target = rng.pick(chosen);
    const asObjects = tier >= 2 && rng.chance(0.4);

    if (asObjects) {
      const values = chosen.map((c) => ({ color: c, emoji: COLOR_OBJECTS[c.id][0] }));
      return choiceFrom(rng, values, (v) => V.emoji(v.emoji, 'xl'), values.find((v) => v.color.id === target.id), {
        key: (v) => v.color.id,
        prompt: `Tap the ${target.name.toLowerCase()} one`,
        speak: `Can you find something ${target.name}?`,
        hint: `Look for ${target.name.toLowerCase()}!`,
        labelOf: (v) => v.color.name,
        ...BIG,
      });
    }

    return choiceFrom(rng, chosen, (c) => V.swatch(c.hex), target, {
      key: (c) => c.id,
      prompt: `Tap ${target.name.toLowerCase()}`,
      speak: `Where is ${target.name}?`,
      hint: `${target.name}!`,
      labelOf: (c) => c.name,
      ...BIG,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* 6. First shapes                                                             */
/* -------------------------------------------------------------------------- */

const firstShapes = {
  id: 'tot-shape',
  name: 'Shapes',
  emoji: '⭕',
  blurb: 'Tap the circle',
  gen(rng, tier) {
    const optionCount = byTier(tier, [2, 2, 3]);
    // Circle, square and triangle only — everything else comes years later.
    const pool = ['circle', 'square', 'triangle', 'star', 'heart'].slice(0, tier === 1 ? 3 : 5);
    const chosen = rng.sample(pool, Math.min(optionCount, pool.length));
    const target = rng.pick(chosen);
    const hex = rng.pick(BASIC_COLOR_IDS.map(colorById)).hex;
    const NAMES = { circle: 'circle', square: 'square', triangle: 'triangle', star: 'star', heart: 'heart' };

    return choiceFrom(rng, chosen, (id) => V.shape(id, hex), target, {
      prompt: `Tap the ${NAMES[target]}`,
      speak: `Where is the ${NAMES[target]}?`,
      hint: `The ${NAMES[target]}!`,
      labelOf: (id) => NAMES[id],
      ...BIG,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* 7. Counting to three                                                        */
/* -------------------------------------------------------------------------- */

const countThree = {
  id: 'tot-count',
  name: 'How many?',
  emoji: '☝️',
  blurb: 'Count to three',
  gen(rng, tier) {
    const max = byTier(tier, [3, 4, 5]);
    const n = rng.int(1, max);
    const emoji = rng.pick(FIRST_WORDS).emoji;

    // Two or three answers, always adjacent numbers so the choice is fair.
    const pool = new Set([n]);
    let radius = 1;
    while (pool.size < byTier(tier, [2, 2, 3])) {
      if (n - radius >= 1) pool.add(n - radius);
      if (pool.size < byTier(tier, [2, 2, 3]) && n + radius <= max + 1) pool.add(n + radius);
      radius += 1;
    }

    return choiceFrom(rng, Array.from(pool), (v) => V.text(v, 'xl'), n, {
      prompt: 'How many?',
      speak: 'How many can you see? Count them with your finger.',
      stem: group(rng, emoji, n, 'row'),
      hint: `Count them: ${Array.from({ length: n }, (_, i) => numberWord(i + 1)).join(', ')}.`,
      optionSize: 'xl',
      columns: pool.size,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* 8. Big and small                                                            */
/* -------------------------------------------------------------------------- */

const bigSmall = {
  id: 'tot-size',
  name: 'Big and small',
  emoji: '🐘',
  blurb: 'Which one is big?',
  gen(rng, tier) {
    const wantBig = rng.chance();
    const emoji = rng.pick(FIRST_WORDS).emoji;

    // Deliberately dramatic: at two years old "big" has to be unmistakable, so
    // the largest is roughly three times the smallest, narrowing only slightly
    // by tier 3 when a middle size joins in.
    const scales = byTier(tier, [
      [0.4, 1.3],
      [0.45, 1.2],
      [0.4, 0.75, 1.25],
    ]);
    const optionCount = scales.length;
    const answer = wantBig ? scales[scales.length - 1] : scales[0];

    return choiceFrom(
      rng,
      scales,
      (s) => ({ kind: 'emoji', value: emoji, size: 'xl', scale: s }),
      answer,
      {
        key: (s) => s.toFixed(3),
        prompt: wantBig ? 'Tap the BIG one' : 'Tap the small one',
        speak: wantBig ? 'Which one is big?' : 'Which one is little?',
        hint: wantBig ? 'The biggest one!' : 'The tiniest one!',
        labelOf: () => 'picture',
        columns: optionCount,
      },
    );
  },
};

/* -------------------------------------------------------------------------- */
/* 9. Take me there (tracing)                                                  */
/* -------------------------------------------------------------------------- */

const tracePath = {
  id: 'tot-trace',
  name: 'Take me there',
  emoji: '👆',
  blurb: 'Draw the path',
  rounds: 3,
  gen(rng, tier) {
    const pair = rng.pick(ANIMAL_FOOD);
    // Waviness, not length, is what makes tracing harder for a toddler.
    const waves = byTier(tier, [0, 1.2, 2.2]);
    const amplitude = byTier(tier, [0, 16, 22]);
    const downhill = rng.chance();

    // Shrink the vertical run by however far the wave swings, so the whole
    // route always lands inside the 6–94 safe area of the board.
    const span = 88 - amplitude * 2;
    const top = 6 + amplitude;

    const curve = (t) => ({
      x: 12 + t * 76,
      y: (downhill ? top + t * span : top + span - t * span) + Math.sin(t * Math.PI * waves) * amplitude,
    });

    const path = resample(curve, 6.5);

    return {
      type: 'trace',
      prompt: `Take the ${pair.name} to the food`,
      speak: 'Put your finger on the animal and slide it along the path',
      stemCaption: 'Slide your finger along the dots',
      path,
      startEmoji: pair.animal,
      endEmoji: pair.food,
      hint: 'Keep your finger on the path.',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 10. Feed the animal                                                         */
/* -------------------------------------------------------------------------- */

const feedTime = {
  id: 'tot-feed',
  name: 'Feed the animals',
  emoji: '🍽️',
  blurb: 'Give them their food',
  rounds: 3,
  gen(rng, tier) {
    const count = byTier(tier, [1, 2, 3]);
    const chosen = rng.sample(ANIMAL_FOOD, count);

    const items = chosen.map((pair, i) => ({
      id: 'f' + i,
      visual: V.emoji(pair.food, 'lg'),
      visualSize: 'lg',
    }));
    const targets = rng.shuffle(chosen.map((pair, i) => ({ pair, i }))).map(({ pair, i }) => ({
      id: 'a' + i,
      visual: V.emoji(pair.animal, 'lg'),
      visualSize: 'lg',
      accepts: ['f' + i],
      capacity: 1,
    }));

    return {
      type: 'dragdrop',
      layout: 'slots',
      prompt: count === 1 ? 'Give the food to the animal' : 'Feed the animals',
      speak: 'Drag the food to the animal that wants it',
      items: rng.shuffle(items),
      targets,
      targetColumns: Math.min(count, 3),
      hint: 'Think about what each animal likes to eat.',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 11. Peekaboo pairs                                                          */
/* -------------------------------------------------------------------------- */

const peekaboo = {
  id: 'tot-peek',
  name: 'Peekaboo',
  emoji: '🙈',
  blurb: 'Find the pairs',
  rounds: 2,
  gen(rng, tier) {
    const pairCount = byTier(tier, [2, 3, 4]);
    const chosen = rng.sample(FIRST_ANIMALS, pairCount);

    return {
      type: 'memory',
      prompt: 'Find the two that match',
      speak: 'Turn over the cards and find the two that are the same',
      stemCaption: 'Who is hiding?',
      columns: pairCount <= 2 ? 2 : pairCount === 3 ? 3 : 4,
      pairs: chosen.map((a) => ({
        id: 'p' + a.name,
        a: V.emoji(a.emoji, 'lg'),
        b: V.emoji(a.emoji, 'lg'),
      })),
      hint: 'Try to remember where you saw each animal.',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 12. Tidy up (two-bin sorting)                                               */
/* -------------------------------------------------------------------------- */

const tidyUp = {
  id: 'tot-sort',
  name: 'Tidy up',
  emoji: '🧺',
  blurb: 'Put things away',
  rounds: 3,
  gen(rng, tier) {
    const perBin = byTier(tier, [1, 2, 2]);
    const groups = [
      { label: 'Animals', icon: '🐾', items: FIRST_ANIMALS.map((a) => a.emoji) },
      { label: 'Food', icon: '🍽️', items: ['🍎', '🍌', '🍰', '🍕', '🍪', '🧀', '🍇', '🥕'] },
      { label: 'Toys', icon: '🧸', items: ['🧸', '⚽', '🎈', '🪀', '🎲', '🚗', '🪁', '🧩'] },
    ];
    const chosen = rng.sample(groups, 2);

    const items = [];
    const targets = chosen.map((bin, b) => {
      const picks = rng.sample(bin.items, perBin);
      const mine = picks.map((emoji, i) => {
        const id = `i${b}_${i}`;
        items.push({ id, visual: V.emoji(emoji, 'lg'), visualSize: 'lg' });
        return id;
      });
      return { id: 'bin' + b, label: bin.label, visual: V.emoji(bin.icon, 'md'), accepts: mine };
    });

    return {
      type: 'dragdrop',
      layout: 'bins',
      prompt: 'Put them in the right basket',
      speak: 'Drag each thing into the basket where it belongs',
      items: rng.shuffle(items),
      targets,
      targetColumns: 2,
      hint: 'Look at the picture on each basket.',
    };
  },
};

export const TODDLER_SKILLS = [
  bubbles,
  findIt,
  animalSounds,
  findSame,
  firstColors,
  firstShapes,
  countThree,
  bigSmall,
  tracePath,
  feedTime,
  peekaboo,
  tidyUp,
];
