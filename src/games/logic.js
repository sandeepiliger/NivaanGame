/**
 * Logic & thinking games: odd one out, patterns, analogies, mazes, sequencing,
 * balance puzzles, classification, memory and beginner coding.
 */

import { V } from '../engine/visual.js';
import {
  THEMES,
  THEME_IDS,
  CONTRAST_THEMES,
  COLORS,
  BASIC_COLOR_IDS,
  colorById,
  SHAPES,
} from '../data/content.js';
import { choiceFrom, byTier, repeatPattern, group } from './util.js';
import { generateMaze, distances, mazeIsSolvable } from './maze-lib.js';
import { solveProgram } from './coder-lib.js';
import { makeLatinPuzzle } from './colors.js';

const HEROES = ['🐭', '🐰', '🐿️', '🐥', '🐸', '🐢', '🦔', '🐨'];
const TREASURES = ['🧀', '🥕', '🌰', '🍓', '🍯', '🍪', '🎁', '🏆'];
const PICKUPS = ['⭐', '💎', '🍬', '🪙', '🌟'];

/* -------------------------------------------------------------------------- */
/* 1. Odd one out                                                              */
/* -------------------------------------------------------------------------- */

const oddOneOut = {
  id: 'log-odd',
  name: 'Odd one out',
  emoji: '🚫',
  blurb: 'Which one does not belong?',
  gen(rng, tier) {
    const count = byTier(tier, [3, 4, 4, 5, 6]);
    const mode = tier >= 3 && rng.chance(0.4) ? 'shape' : 'theme';

    if (mode === 'shape') {
      // Same shape family except one — e.g. four round things and one pointy.
      const [keep, odd] = rng.sample(SHAPES, 2);
      const hex = rng.pick(COLORS).hex;
      const values = [
        { id: 'odd', shape: odd },
        ...Array.from({ length: count - 1 }, (_, i) => ({ id: 's' + i, shape: keep })),
      ];
      return choiceFrom(rng, values, (v) => V.shape(v.shape.id, hex), values[0], {
        key: (v) => v.id,
        prompt: 'Which one is different?',
        speak: 'Which one does not belong?',
        hint: 'Compare the corners.',
        columns: count <= 4 ? 2 : 3,
        labelOf: (v) => v.shape.name,
      });
    }

    const [themeA, themeB] = rng.sample(CONTRAST_THEMES, 2);
    const family = rng.sample(THEMES[themeA].items, count - 1);
    const stranger = rng.pick(THEMES[themeB].items);

    const values = [
      { id: 'odd', emoji: stranger },
      ...family.map((e, i) => ({ id: 'f' + i, emoji: e })),
    ];

    return choiceFrom(rng, values, (v) => V.emoji(v.emoji, 'lg'), values[0], {
      key: (v) => v.id,
      prompt: 'Which one does not belong?',
      speak: 'Which one does not belong with the others?',
      hint: `Most of them are ${THEMES[themeA].name.toLowerCase()}.`,
      columns: count <= 4 ? 2 : 3,
      labelOf: (v) => v.emoji,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* 2. Patterns                                                                 */
/* -------------------------------------------------------------------------- */

const patterns = {
  id: 'log-pattern',
  name: 'Pattern power',
  emoji: '🔁',
  blurb: 'Finish the sequence',
  gen(rng, tier) {
    const theme = THEMES[rng.pick(THEME_IDS)];
    const unitSize = byTier(tier, [2, 2, 3, 3, 4]);
    const shown = byTier(tier, [4, 5, 6, 7, 8]);
    const unit = rng.sample(theme.items, Math.min(unitSize, theme.items.length));
    const full = repeatPattern(unit, shown + 1);

    // From tier 3 the hole can be in the middle instead of at the end.
    const holeIndex = tier >= 3 && rng.chance(0.45) ? rng.int(1, shown - 1) : shown;
    const answer = full[holeIndex];

    const optionCount = byTier(tier, [3, 3, 4, 4, 4]);
    const others = rng.sample(
      theme.items.filter((e) => e !== answer),
      optionCount - 1,
    );

    // Show the run up to (and including) the hole, with the hole blanked out.
    const sequence = full.slice(0, shown + 1).map((e, i) => (i === holeIndex ? null : e));
    if (holeIndex !== shown) sequence.pop();

    return choiceFrom(rng, [answer, ...others], (e) => V.emoji(e, 'lg'), answer, {
      prompt: 'What is missing?',
      speak: 'Which one is missing from the pattern?',
      stem: V.stack(sequence.map((e) => (e === null ? V.blank() : V.emoji(e, 'sm')))),
      stemSize: 'sm',
      hint: `The pattern repeats every ${unit.length}.`,
      columns: optionCount <= 3 ? 3 : 4,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* 3. Analogies                                                                */
/* -------------------------------------------------------------------------- */

/** "A is to B as C is to ?" pairs, grouped so distractors stay plausible. */
const ANALOGY_SETS = [
  { name: 'grown-ups and babies', pairs: [['🐔', '🐤'], ['🦆', '🐥'], ['🐑', '🐏'], ['🦋', '🐛'], ['🐸', '🥚']] },
  { name: 'homes', pairs: [['🐝', '🍯'], ['🐦', '🪹'], ['🐕', '🏠'], ['🐟', '🌊'], ['🐻', '🕳️']] },
  { name: 'food source', pairs: [['🐄', '🥛'], ['🐔', '🥚'], ['🐝', '🍯'], ['🌳', '🍎'], ['🌾', '🍞']] },
  { name: 'tools', pairs: [['✏️', '📝'], ['🔨', '🪵'], ['🥄', '🍲'], ['🖌️', '🎨'], ['✂️', '📄']] },
  { name: 'opposites', pairs: [['☀️', '🌙'], ['🔥', '❄️'], ['⬆️', '⬇️'], ['😀', '😢'], ['🐘', '🐭']] },
  { name: 'travel', pairs: [['🚗', '🛣️'], ['✈️', '☁️'], ['🚂', '🛤️'], ['⛵', '🌊'], ['🚀', '🪐']] },
];

const analogies = {
  id: 'log-analogy',
  name: 'Goes together',
  emoji: '🧠',
  blurb: 'A is to B as C is to…',
  gen(rng, tier) {
    const set = rng.pick(ANALOGY_SETS);
    const [example, question] = rng.sample(set.pairs, 2);
    const optionCount = byTier(tier, [3, 3, 4, 4, 4]);

    const distractorPool = ANALOGY_SETS.filter((s) => s !== set)
      .flatMap((s) => s.pairs.map((p) => p[1]))
      .filter((e) => e !== question[1] && e !== example[1]);

    const others = rng.sample(Array.from(new Set(distractorPool)), optionCount - 1);

    return choiceFrom(rng, [question[1], ...others], (e) => V.emoji(e, 'lg'), question[1], {
      prompt: 'What goes with it?',
      speak: 'Look at the first pair. Which one finishes the second pair?',
      stem: V.stack([
        V.stack([V.emoji(example[0], 'md'), V.op('→'), V.emoji(example[1], 'md')]),
        V.stack([V.emoji(question[0], 'md'), V.op('→'), V.blank()]),
      ], 'col'),
      stemSize: 'sm',
      hint: `Think about ${set.name}.`,
      columns: optionCount <= 3 ? 3 : 4,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* 4. Mazes                                                                    */
/* -------------------------------------------------------------------------- */

const mazes = {
  id: 'log-maze',
  name: 'Maze runner',
  emoji: '🌀',
  blurb: 'Find the way through',
  rounds: 3,
  gen(rng, tier) {
    const size = byTier(tier, [4, 5, 6, 7, 8]);
    // Taller than wide, so the board fills a portrait phone instead of leaving
    // a band of dead space above and below a square grid.
    const cols = size;
    const rows = size + 2;
    const cellCount = cols * rows;
    const braid = byTier(tier, [0.6, 0.4, 0.25, 0.1, 0]);
    const pickupCount = byTier(tier, [0, 0, 1, 2, 3]);

    let maze;
    let start;
    let goal;
    let dist;

    // Retry until the exit is genuinely far from the start, so easy mazes are
    // still a journey rather than two steps.
    for (let attempt = 0; attempt < 12; attempt++) {
      maze = generateMaze({ w: cols, h: rows, rng, braid });
      start = rng.int(0, cellCount - 1);
      dist = distances(maze, start);
      const far = dist
        .map((d, i) => ({ d, i }))
        .filter((c) => c.d >= size)
        .sort((a, b) => b.d - a.d);
      if (far.length) {
        goal = rng.pick(far.slice(0, Math.max(1, Math.floor(far.length / 3)))).i;
        break;
      }
      goal = dist.indexOf(Math.max(...dist));
    }

    // Place pickups on reachable cells that are neither the start nor the goal.
    const candidates = dist
      .map((d, i) => ({ d, i }))
      .filter((c) => c.d >= 2 && c.i !== start && c.i !== goal)
      .map((c) => c.i);
    const items = rng
      .sample(candidates, Math.min(pickupCount, candidates.length))
      .map((at) => ({ at, emoji: rng.pick(PICKUPS) }));

    const hero = rng.pick(HEROES);
    const goalEmoji = rng.pick(TREASURES);
    const treasureWord = items.length === 1 ? 'treasure' : 'treasures';

    const puzzle = {
      type: 'maze',
      prompt: items.length
        ? `Collect ${items.length} ${treasureWord}, then reach ${goalEmoji}`
        : `Find the way to ${goalEmoji}`,
      speak: items.length
        ? 'Slide your finger through the maze, collect everything, then reach the goal'
        : 'Slide your finger through the maze to reach the goal',
      stemCaption: items.length
        ? `Pick up ${items.length === 1 ? 'the treasure' : `all ${items.length} treasures`} on the way!`
        : null,
      w: cols,
      h: rows,
      walls: maze.walls,
      start,
      goal,
      items,
      hero,
      goalEmoji,
      hint: 'Follow the open gaps — no crossing the walls!',
    };

    return puzzle;
  },
  validate: mazeIsSolvable,
};

/* -------------------------------------------------------------------------- */
/* 5. Robot coding                                                             */
/* -------------------------------------------------------------------------- */

const coding = {
  id: 'log-code',
  name: 'Robot road',
  emoji: '🤖',
  blurb: 'Program the robot',
  rounds: 3,
  gen(rng, tier) {
    const w = byTier(tier, [3, 4, 4, 5, 5]);
    const rows = byTier(tier, [3, 3, 4, 4, 5]);
    const blockCount = byTier(tier, [0, 1, 2, 3, 5]);
    const gemCount = byTier(tier, [0, 0, 1, 1, 2]);

    for (let attempt = 0; attempt < 40; attempt++) {
      const cells = Array.from({ length: w * rows }, (_, i) => i);
      const [start, goal, ...rest] = rng.shuffle(cells);
      if (start === goal) continue;

      const blocks = rest.slice(0, blockCount);
      const gems = rest.slice(blockCount, blockCount + gemCount);

      const draft = {
        w,
        h: rows,
        start,
        goal,
        blocks,
        gems,
        maxSteps: w * rows + 4,
      };

      const solution = solveProgram(draft);
      if (!solution) continue;
      // Too short is boring, too long is frustrating.
      const minLen = byTier(tier, [2, 3, 4, 5, 6]);
      if (solution.length < minLen) continue;

      return {
        type: 'coder',
        prompt: gems.length ? 'Collect the gems, then go home' : 'Get the robot home',
        speak: 'Tap the arrows to build a plan, then press play',
        stemCaption: gems.length
          ? 'Plan a route that picks up every gem'
          : 'Plan the whole route before you press play',
        ...draft,
        maxSteps: Math.max(solution.length + byTier(tier, [3, 3, 2, 2, 2]), solution.length),
        hero: '🤖',
        goalEmoji: '🏠',
        blockEmoji: rng.pick(['🌳', '🪨', '🌵', '🚧']),
        gemEmoji: '💎',
        hint: 'Follow the route with your finger first, then tap the arrows.',
      };
    }

    // Fallback: a trivially solvable straight line (should never be reached).
    return {
      type: 'coder',
      prompt: 'Get the robot home',
      speak: 'Tap the arrows to build a plan, then press play',
      w: 3,
      h: 1,
      start: 0,
      goal: 2,
      blocks: [],
      gems: [],
      maxSteps: 4,
      hero: '🤖',
      goalEmoji: '🏠',
      hint: 'Two steps to the right.',
    };
  },
  validate: (puzzle) => Boolean(solveProgram(puzzle)),
};

/* -------------------------------------------------------------------------- */
/* 6. Classic memory                                                           */
/* -------------------------------------------------------------------------- */

const memoryGame = {
  id: 'log-memory',
  name: 'Memory match',
  emoji: '🧩',
  blurb: 'Remember where things are',
  rounds: 2,
  gen(rng, tier) {
    const pairCount = byTier(tier, [3, 4, 6, 8, 10]);
    const theme = THEMES[rng.pick(THEME_IDS)];
    const pool = theme.items.length >= pairCount
      ? theme.items
      : Array.from(new Set(THEME_IDS.flatMap((t) => THEMES[t].items)));
    const chosen = rng.sample(pool, pairCount);

    return {
      type: 'memory',
      prompt: 'Find every pair',
      speak: 'Turn over two cards at a time and find the matching pairs',
      stemCaption: `${pairCount} pairs to find`,
      pairs: chosen.map((e) => ({ id: 'p' + e, a: V.emoji(e, 'md'), b: V.emoji(e, 'md') })),
      hint: 'Take your time and remember what you saw.',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 7. Size ordering                                                            */
/* -------------------------------------------------------------------------- */

const sizeOrder = {
  id: 'log-size',
  name: 'Big to small',
  emoji: '📏',
  blurb: 'Order things by size',
  rounds: 4,
  gen(rng, tier) {
    const count = byTier(tier, [3, 3, 4, 4, 5]);
    const emoji = rng.pick(THEMES[rng.pick(THEME_IDS)].items);
    const smallestFirst = tier >= 3 && rng.chance(0.45);

    // A wide range keeps neighbouring sizes clearly different even at count 5.
    const scales = Array.from({ length: count }, (_, i) => 0.4 + (i * 1.3) / (count - 1));
    const items = scales.map((scale, i) => ({ id: 'z' + i, scale }));
    const sorted = items
      .slice()
      .sort((a, b) => (smallestFirst ? a.scale - b.scale : b.scale - a.scale));

    return {
      type: 'order',
      prompt: smallestFirst ? 'Smallest to biggest' : 'Biggest to smallest',
      speak: smallestFirst
        ? 'Tap them from smallest to biggest'
        : 'Tap them from biggest to smallest',
      trayLabel: smallestFirst ? '🐜 ➡️ 🐘' : '🐘 ➡️ 🐜',
      items: rng.shuffle(items).map((it) => ({
        id: it.id,
        visual: { kind: 'emoji', value: emoji, size: 'md', scale: it.scale },
      })),
      answer: sorted.map((it) => it.id),
      hint: smallestFirst ? 'Start with the tiniest one.' : 'Start with the largest one.',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 8. Balance scales                                                           */
/* -------------------------------------------------------------------------- */

const balance = {
  id: 'log-balance',
  name: 'Balance it',
  emoji: '⚖️',
  blurb: 'Which side is heavier?',
  gen(rng, tier) {
    const emoji = rng.pick(['🍎', '🍌', '🧱', '🪨', '🧸', '🍪']);
    const mode = tier >= 3 ? rng.pick(['heavier', 'makeBalance']) : 'heavier';

    if (mode === 'makeBalance') {
      // How many more do we need on the light side to make it balance?
      const left = rng.int(3, byTier(tier, [5, 6, 7, 8, 10]));
      const right = rng.int(1, left - 1);
      const answer = left - right;
      const optionCount = byTier(tier, [3, 3, 4, 4, 4]);
      const values = new Set([answer]);
      let radius = 1;
      while (values.size < optionCount) {
        if (answer - radius >= 1) values.add(answer - radius);
        if (values.size < optionCount) values.add(answer + radius);
        radius += 1;
      }

      return choiceFrom(rng, Array.from(values), (v) => V.text(v, 'lg'), answer, {
        prompt: 'How many more to balance?',
        speak: 'How many more do we need on the light side to make it balance?',
        stem: {
          kind: 'balance',
          left: Array.from({ length: left }, () => emoji),
          right: Array.from({ length: right }, () => emoji),
          tilt: -1,
        },
        stemSize: 'md',
        hint: `There are ${left} on one side and ${right} on the other.`,
        columns: 4,
      });
    }

    const max = byTier(tier, [4, 6, 8, 10, 12]);
    let a = rng.int(1, max);
    let b = rng.int(1, max);
    let guard = 0;
    while (a === b && guard++ < 30) b = rng.int(1, max);
    if (a === b) b = Math.max(1, a - 1);
    const wantHeavy = rng.chance();
    const answer = wantHeavy ? Math.max(a, b) : Math.min(a, b);

    // Options mirror the two pans rather than showing bare arrows, so the child
    // picks the group they are looking at instead of decoding a direction.
    return choiceFrom(
      rng,
      [
        { side: 'left', n: a },
        { side: 'right', n: b },
      ],
      (v) => group(rng, emoji, v.n, 'row'),
      { side: a === answer ? 'left' : 'right', n: answer },
      {
        key: (v) => v.side,
        optionSize: 'sm',
        prompt: wantHeavy ? 'Which side is heavier?' : 'Which side is lighter?',
        speak: wantHeavy ? 'Which side of the scales is heavier?' : 'Which side is lighter?',
        stem: {
          kind: 'balance',
          left: Array.from({ length: a }, () => emoji),
          right: Array.from({ length: b }, () => emoji),
          tilt: a > b ? -1 : 1,
        },
        stemSize: 'md',
        hint: 'The heavier side goes down.',
        columns: 2,
        labelOf: (v) => v.side,
      },
    );
  },
};

/* -------------------------------------------------------------------------- */
/* 9. Classify into groups                                                     */
/* -------------------------------------------------------------------------- */

const classify = {
  id: 'log-classify',
  name: 'Sort it out',
  emoji: '🗃️',
  blurb: 'Group things that belong together',
  rounds: 3,
  gen(rng, tier) {
    const binCount = byTier(tier, [2, 2, 3, 3, 4]);
    const perBin = byTier(tier, [2, 3, 2, 3, 2]);
    const themes = rng.sample(CONTRAST_THEMES, binCount);

    const items = [];
    const targets = themes.map((themeId, b) => {
      const theme = THEMES[themeId];
      const picks = rng.sample(theme.items, perBin);
      const mine = picks.map((emoji, i) => {
        const itemId = `i${b}_${i}`;
        items.push({ id: itemId, visual: V.emoji(emoji, 'md') });
        return itemId;
      });
      return {
        id: 'bin' + b,
        label: theme.name,
        visual: V.emoji(BIN_ICONS[themeId] || '📦', 'sm'),
        accepts: mine,
      };
    });

    return {
      type: 'dragdrop',
      layout: 'bins',
      prompt: 'Put them where they belong',
      speak: 'Drag each picture into the group it belongs to',
      items: rng.shuffle(items),
      targets,
      targetColumns: Math.min(binCount, 4),
      hint: 'Think about what each group has in common.',
    };
  },
};

const BIN_ICONS = {
  fruit: '🧺',
  animals: '🐾',
  vehicles: '🛣️',
  clothes: '👚',
  toys: '🧸',
  sports: '🏆',
  music: '🎼',
  food: '🍽️',
};

/* -------------------------------------------------------------------------- */
/* 10. Picture sudoku                                                          */
/* -------------------------------------------------------------------------- */

const pictureSudoku = {
  id: 'log-sudoku',
  name: 'Picture sudoku',
  emoji: '🔢',
  blurb: 'One of each in every line',
  rounds: 2,
  gen(rng, tier) {
    const size = tier >= 4 ? 6 : 4;
    const boxW = size === 4 ? 2 : 3;
    const boxH = 2;
    const clues = byTier(tier, [0.68, 0.6, 0.52, 0.55, 0.46]);
    // One symbol per theme: picking several from the same theme can produce a
    // set of near-identical pictures (four blue clothes, five round fruits).
    // A few emoji appear in two themes, so dedupe and top up from the rest.
    const symbols = [];
    for (const themeId of rng.shuffle(THEME_IDS)) {
      if (symbols.length >= size) break;
      const pick = rng.pick(THEMES[themeId].items);
      if (!symbols.includes(pick)) symbols.push(pick);
    }
    for (const emoji of rng.shuffle(Array.from(new Set(THEME_IDS.flatMap((t) => THEMES[t].items))))) {
      if (symbols.length >= size) break;
      if (!symbols.includes(emoji)) symbols.push(emoji);
    }

    const { given, solution } = makeLatinPuzzle(rng, size, boxW, boxH, clues);

    return {
      type: 'sudoku',
      prompt: 'One of each in every row',
      speak: 'Every row, column and box must have one of each picture',
      stemCaption: 'No repeats in a row, column or box',
      size,
      boxW,
      boxH,
      given,
      solution,
      symbols: symbols.map((e) => V.emoji(e, 'sm')),
      hint: 'Start with the row that has the most pictures already.',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 11. Matching pairs that go together                                         */
/* -------------------------------------------------------------------------- */

const GO_TOGETHER = [
  ['🧦', '👟'], ['🔑', '🔒'], ['🖊️', '📓'], ['☂️', '🌧️'], ['🪥', '🦷'],
  ['🍞', '🧈'], ['🐝', '🌻'], ['🎣', '🐟'], ['🧵', '🪡'], ['🍼', '👶'],
  ['🎸', '🎵'], ['🥄', '🍲'], ['🚿', '🧼'], ['🕯️', '🔥'], ['🐕', '🦴'],
];

const goTogether = {
  id: 'log-pairs',
  name: 'Goes with',
  emoji: '🔗',
  blurb: 'Match things that go together',
  rounds: 3,
  gen(rng, tier) {
    const count = byTier(tier, [2, 3, 3, 4, 5]);
    const chosen = rng.sample(GO_TOGETHER, count);

    const items = chosen.map(([a], i) => ({ id: 'a' + i, visual: V.emoji(a, 'md') }));
    const targets = rng.shuffle(chosen.map(([, b], i) => ({ i, b }))).map(({ i, b }) => ({
      id: 't' + i,
      visual: V.emoji(b, 'md'),
      accepts: ['a' + i],
      capacity: 1,
    }));

    return {
      type: 'dragdrop',
      layout: 'slots',
      prompt: 'What goes with what?',
      speak: 'Drag each picture onto the thing that goes with it',
      items: rng.shuffle(items),
      targets,
      targetColumns: Math.min(count, 3),
      hint: 'Think about when you use them together.',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 12. Colour + shape logic grid                                               */
/* -------------------------------------------------------------------------- */

const attributeLogic = {
  id: 'log-attr',
  name: 'Two clues',
  emoji: '🎯',
  blurb: 'Find the one that matches both',
  gen(rng, tier) {
    const shapes = rng.sample(SHAPES.slice(0, byTier(tier, [4, 5, 6, 8, 12])), 3);
    const colors = rng.sample(
      tier <= 2 ? BASIC_COLOR_IDS.map(colorById) : COLORS,
      3,
    );
    const targetShape = rng.pick(shapes);
    const targetColor = rng.pick(colors);
    const optionCount = byTier(tier, [4, 4, 4, 6, 6]);

    const combos = [];
    for (const s of shapes) {
      for (const c of colors) combos.push({ s, c });
    }
    const answer = combos.find((v) => v.s.id === targetShape.id && v.c.id === targetColor.id);
    const others = rng.sample(
      combos.filter((v) => v !== answer),
      optionCount - 1,
    );

    return choiceFrom(rng, [answer, ...others], (v) => V.shape(v.s.id, v.c.hex), answer, {
      key: (v) => v.s.id + v.c.id,
      prompt: `Find the ${targetColor.name.toLowerCase()} ${targetShape.name.toLowerCase()}`,
      speak: `Find the ${targetColor.name} ${targetShape.name}`,
      hint: 'It has to match BOTH the colour and the shape.',
      columns: optionCount <= 4 ? 2 : 3,
      labelOf: (v) => `${v.c.name} ${v.s.name}`,
    });
  },
};

export const LOGIC_SKILLS = [
  oddOneOut,
  patterns,
  analogies,
  mazes,
  coding,
  memoryGame,
  sizeOrder,
  balance,
  classify,
  pictureSudoku,
  goTogether,
  attributeLogic,
];
