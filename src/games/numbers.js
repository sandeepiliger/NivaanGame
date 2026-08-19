/**
 * Numbers & early maths.
 *
 * Each skill exports `gen(rng, tier)` returning one puzzle. Tier runs 1–5 and
 * controls number range, distractor closeness and the amount of abstraction
 * (objects → dots → numerals → number words).
 */

import { V } from '../engine/visual.js';
import { THEMES, THEME_IDS, numberWord } from '../data/content.js';
import { choiceFrom, numberOptions, group, byTier, scatterScene } from './util.js';

const anyTheme = (rng) => THEMES[rng.pick(THEME_IDS)];

/* -------------------------------------------------------------------------- */
/* 1. Counting                                                                 */
/* -------------------------------------------------------------------------- */

const counting = {
  id: 'num-count',
  name: 'Counting',
  emoji: '🔢',
  blurb: 'How many are there?',
  gen(rng, tier) {
    const max = byTier(tier, [5, 8, 12, 16, 20]);
    const min = byTier(tier, [1, 2, 3, 5, 8]);
    const n = rng.int(min, max);
    const emoji = rng.pick(anyTheme(rng).items);
    const layout = tier <= 2 ? 'row' : tier === 3 ? 'frame' : 'scatter';
    const optionCount = byTier(tier, [3, 3, 4, 4, 4]);

    return choiceFrom(
      rng,
      numberOptions(rng, n, optionCount, 1, Math.max(max, n + 3)),
      (v) => V.text(v, 'lg'),
      n,
      {
        prompt: 'How many?',
        speak: 'How many do you see?',
        stem: group(rng, emoji, n, layout),
        hint: `Touch each one as you count: 1, 2, 3…`,
        columns: optionCount === 3 ? 3 : 4,
      },
    );
  },
};

/* -------------------------------------------------------------------------- */
/* 2. Numeral recognition (numeral ↔ quantity ↔ word)                          */
/* -------------------------------------------------------------------------- */

const numerals = {
  id: 'num-numeral',
  name: 'Number match',
  emoji: '7️⃣',
  blurb: 'Match numbers to amounts',
  gen(rng, tier) {
    const max = byTier(tier, [5, 9, 12, 15, 20]);
    const n = rng.int(1, max);
    const optionCount = byTier(tier, [3, 3, 4, 4, 4]);
    const pool = numberOptions(rng, n, optionCount, 1, Math.max(max, n + 3));
    const emoji = rng.pick(anyTheme(rng).items);

    // Three presentations, unlocked progressively.
    const modes = tier <= 1 ? ['toQuantity'] : tier <= 3 ? ['toQuantity', 'toNumeral'] : ['toQuantity', 'toNumeral', 'fromWord'];
    const mode = rng.pick(modes);

    if (mode === 'toNumeral') {
      return choiceFrom(rng, pool, (v) => V.text(v, 'lg'), n, {
        prompt: 'Which number is this?',
        speak: 'Which number shows how many?',
        stem: V.dots(n),
        hint: 'Count the dots first.',
        columns: optionCount === 3 ? 3 : 4,
      });
    }

    if (mode === 'fromWord') {
      return choiceFrom(rng, pool, (v) => V.text(v, 'lg'), n, {
        prompt: `Find the number "${numberWord(n)}"`,
        speak: `Find the number ${numberWord(n)}`,
        stem: V.text(numberWord(n), 'md'),
        hint: `${numberWord(n)} is written as ${n}.`,
        columns: optionCount === 3 ? 3 : 4,
      });
    }

    return choiceFrom(
      rng,
      pool,
      (v) => group(rng, emoji, v, v <= 10 ? 'row' : 'frame'),
      n,
      {
        prompt: `Find ${n}`,
        speak: `Find the group with ${numberWord(n)}`,
        stem: V.text(n, 'xl'),
        hint: 'Count each group carefully.',
        columns: 2,
        optionSize: 'sm',
      },
    );
  },
};

/* -------------------------------------------------------------------------- */
/* 3. Number sequences                                                         */
/* -------------------------------------------------------------------------- */

const sequences = {
  id: 'num-sequence',
  name: 'What comes next',
  emoji: '➡️',
  blurb: 'Fill the missing number',
  gen(rng, tier) {
    const step = byTier(tier, [1, 1, 2, 2, 5]);
    const back = tier >= 3 && rng.chance(0.35);
    const length = byTier(tier, [4, 4, 5, 5, 5]);
    const max = byTier(tier, [10, 15, 20, 30, 50]);

    const startMax = Math.max(1, max - step * (length - 1));
    const start = rng.int(1, startMax);
    const values = Array.from({ length }, (_, i) =>
      back ? start + step * (length - 1) - step * i : start + step * i,
    );

    const holeIndex = tier <= 2 ? length - 1 : rng.int(1, length - 1);
    const answer = values[holeIndex];

    const stem = V.stack(
      values.map((v, i) => (i === holeIndex ? V.blank() : V.text(v, 'md'))),
    );

    return choiceFrom(
      rng,
      numberOptions(rng, answer, byTier(tier, [3, 3, 4, 4, 4]), 1, max + step * 2),
      (v) => V.text(v, 'lg'),
      answer,
      {
        prompt: 'Which number is missing?',
        speak: 'Which number is missing?',
        stem,
        hint: back
          ? `The numbers are going down by ${step}.`
          : `The numbers are going up by ${step}.`,
        columns: 4,
      },
    );
  },
};

/* -------------------------------------------------------------------------- */
/* 4. Comparing                                                                */
/* -------------------------------------------------------------------------- */

const comparing = {
  id: 'num-compare',
  name: 'More or less',
  emoji: '⚖️',
  blurb: 'Which has more?',
  gen(rng, tier) {
    const max = byTier(tier, [6, 9, 12, 20, 40]);
    const wantMore = rng.chance();
    const abstract = tier >= 4;

    let a = rng.int(1, max);
    let b = rng.int(1, max);
    // Keep a visible difference at the easy tiers.
    const minGap = byTier(tier, [3, 2, 2, 1, 1]);
    let guard = 0;
    while (Math.abs(a - b) < minGap && guard++ < 50) b = rng.int(1, max);
    if (a === b) b = Math.min(max, a + minGap);

    const answer = wantMore ? Math.max(a, b) : Math.min(a, b);
    const emoji = rng.pick(anyTheme(rng).items);

    if (abstract) {
      return choiceFrom(rng, [a, b], (v) => V.text(v, 'xl'), answer, {
        prompt: wantMore ? 'Tap the bigger number' : 'Tap the smaller number',
        speak: wantMore ? 'Which number is bigger?' : 'Which number is smaller?',
        hint: 'The bigger number is further along when you count.',
        columns: 2,
      });
    }

    return choiceFrom(
      rng,
      [a, b],
      (v) => group(rng, emoji, v, v <= 10 ? 'row' : 'frame'),
      answer,
      {
        prompt: wantMore ? 'Which group has MORE?' : 'Which group has FEWER?',
        speak: wantMore ? 'Which group has more?' : 'Which group has fewer?',
        hint: 'Count both groups and compare.',
        columns: 2,
        optionSize: 'sm',
      },
    );
  },
};

/* -------------------------------------------------------------------------- */
/* 5. Adding & taking away                                                     */
/* -------------------------------------------------------------------------- */

const arithmetic = {
  id: 'num-addsub',
  name: 'Add & take away',
  emoji: '➕',
  blurb: 'Simple sums with pictures',
  gen(rng, tier) {
    const max = byTier(tier, [5, 10, 10, 15, 20]);
    const subtract = tier >= 2 && rng.chance(tier >= 3 ? 0.5 : 0.3);
    const emoji = rng.pick(anyTheme(rng).items);
    const pictures = tier <= 3;

    let a;
    let b;
    let answer;
    if (subtract) {
      a = rng.int(2, max);
      b = rng.int(1, a - 1);
      answer = a - b;
    } else {
      a = rng.int(1, Math.max(1, max - 1));
      b = rng.int(1, max - a);
      answer = a + b;
    }

    const sign = subtract ? '−' : '+';
    const stem = pictures
      ? V.stack([
          group(rng, emoji, a, 'row'),
          V.op(sign),
          group(rng, emoji, b, 'row'),
          V.op('='),
          V.blank(),
        ])
      : V.stack([V.text(a, 'lg'), V.op(sign), V.text(b, 'lg'), V.op('='), V.blank()]);

    return choiceFrom(
      rng,
      numberOptions(rng, answer, byTier(tier, [3, 3, 4, 4, 4]), 0, max + 2),
      (v) => V.text(v, 'lg'),
      answer,
      {
        prompt: subtract ? 'How many are left?' : 'How many altogether?',
        speak: `What is ${a} ${subtract ? 'take away' : 'plus'} ${b}?`,
        stem,
        stemSize: 'md',
        hint: subtract
          ? `Start at ${a} and count back ${b}.`
          : `Start at ${a} and count on ${b} more.`,
        columns: 4,
      },
    );
  },
};

/* -------------------------------------------------------------------------- */
/* 6. Ordering numbers                                                         */
/* -------------------------------------------------------------------------- */

const ordering = {
  id: 'num-order',
  name: 'Line them up',
  emoji: '📶',
  blurb: 'Put numbers in order',
  rounds: 4,
  gen(rng, tier) {
    const count = byTier(tier, [3, 4, 4, 5, 5]);
    const max = byTier(tier, [9, 12, 20, 30, 50]);
    const descending = tier >= 3 && rng.chance(0.4);

    const values = rng.sample(
      Array.from({ length: max }, (_, i) => i + 1),
      count,
    );
    const sorted = values.slice().sort((x, y) => (descending ? y - x : x - y));

    const items = rng
      .shuffle(values)
      .map((v) => ({ id: 'n' + v, value: v, visual: V.text(v, 'lg') }));

    return {
      type: 'order',
      prompt: descending ? 'Biggest to smallest' : 'Smallest to biggest',
      speak: descending
        ? 'Tap the numbers from biggest to smallest'
        : 'Tap the numbers from smallest to biggest',
      trayLabel: descending ? 'Biggest first ⬇️' : 'Smallest first ⬆️',
      items,
      answer: sorted.map((v) => 'n' + v),
      hint: descending ? 'Find the biggest number first.' : 'Find the smallest number first.',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 7. Connect the dots                                                         */
/* -------------------------------------------------------------------------- */

const dotToDot = {
  id: 'num-dots',
  name: 'Dot to dot',
  emoji: '🪄',
  blurb: 'Join the numbers in order',
  rounds: 3,
  gen(rng, tier) {
    const count = byTier(tier, [5, 6, 8, 10, 12]);
    const theme = anyTheme(rng);
    const reveal = rng.pick(theme.items);

    // Place the dots around a wobbly circle so the outline always looks like a
    // deliberate shape and the numbers never cross awkwardly.
    const cx = 50;
    const cy = 50;
    const dots = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const radius = 30 + (rng.next() - 0.5) * 12;
      return {
        x: Math.round((cx + Math.cos(angle) * radius) * 10) / 10,
        y: Math.round((cy + Math.sin(angle) * radius) * 10) / 10,
        label: i + 1,
      };
    });

    return {
      type: 'connect',
      prompt: `Join 1 to ${count}`,
      speak: 'Join the dots in order, starting at one',
      stemCaption: 'What will it be?',
      dots,
      reveal,
      hint: 'Look for the next number.',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 8. Number memory                                                            */
/* -------------------------------------------------------------------------- */

const numberMemory = {
  id: 'num-memory',
  name: 'Number pairs',
  emoji: '🃏',
  blurb: 'Match the number to the amount',
  rounds: 2,
  gen(rng, tier) {
    const pairCount = byTier(tier, [3, 4, 5, 6, 8]);
    const max = byTier(tier, [5, 8, 10, 12, 20]);
    const values = rng.sample(
      Array.from({ length: max }, (_, i) => i + 1),
      pairCount,
    );
    const emoji = rng.pick(anyTheme(rng).items);

    return {
      type: 'memory',
      prompt: 'Find the matching pairs',
      speak: 'Match each number with the right amount',
      stemCaption: 'Match the number to how many',
      pairs: values.map((v) => ({
        id: 'p' + v,
        a: V.text(v, 'md'),
        b: v <= 6 ? V.dots(v) : group(rng, emoji, v, 'frame'),
      })),
      hint: 'Remember where you saw each card.',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 9. Count and tap (attention + counting)                                     */
/* -------------------------------------------------------------------------- */

const findAndCount = {
  id: 'num-find',
  name: 'Find them all',
  emoji: '🔍',
  blurb: 'Tap every one you can find',
  rounds: 3,
  gen(rng, tier) {
    const targetCount = byTier(tier, [3, 4, 5, 6, 8]);
    const noiseCount = byTier(tier, [4, 6, 9, 12, 16]);
    const theme = anyTheme(rng);
    const [target, ...others] = rng.sample(theme.items, Math.min(theme.items.length, 5));

    const entries = [
      ...Array.from({ length: targetCount }, () => ({ emoji: target, isTarget: true })),
      ...Array.from({ length: noiseCount }, () => ({
        emoji: rng.pick(others.length ? others : theme.items),
        isTarget: false,
      })),
    ];

    const scene = scatterScene(rng, rng.shuffle(entries), { minDist: tier >= 4 ? 11 : 15 });

    return {
      type: 'tapcount',
      prompt: `Tap every ${target}`,
      speak: 'Tap every one that matches the picture at the top',
      findEmoji: target,
      scene,
      targets: scene.map((s, i) => (s.isTarget ? i : -1)).filter((i) => i >= 0),
      hint: 'Look carefully — search row by row.',
    };
  },
};

export const NUMBER_SKILLS = [
  counting,
  numerals,
  sequences,
  comparing,
  arithmetic,
  ordering,
  dotToDot,
  numberMemory,
  findAndCount,
];
