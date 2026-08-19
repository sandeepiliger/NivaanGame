/**
 * The level catalog.
 *
 * Categories own a list of skills; every skill is played across that
 * category's difficulty tiers (five for the main worlds, three for the
 * toddler one). Levels interleave the skills tier by tier, so a child meets
 * each game type at an easy level before any of them gets harder — the same
 * "spiral" curriculum used by the app this is modelled on.
 */

import { TODDLER_SKILLS } from '../games/toddler.js';
import { NUMBER_SKILLS } from '../games/numbers.js';
import { LETTER_SKILLS } from '../games/letters.js';
import { COLOR_SKILLS } from '../games/colors.js';
import { SHAPE_SKILLS } from '../games/shapes.js';
import { LOGIC_SKILLS } from '../games/logic.js';
import { makeRng } from '../core/rng.js';

export const TIERS = 5;

/** Rounds per level, by tier, when a skill does not override it. */
const DEFAULT_ROUNDS = [5, 5, 6, 6, 7];

/** Toddlers get shorter levels — attention spans are measured in minutes. */
const TODDLER_ROUNDS = [3, 4, 4];

export const CATEGORIES = [
  {
    id: 'toddler',
    name: 'Little Ones',
    tagline: 'First games for toddlers',
    emoji: '🧸',
    color: '#ff8a3d',
    edge: '#e06716',
    ink: '#40210a',
    ages: '2–4',
    /**
     * Three tiers, not five: at this age harder means "one more option", and
     * `forgiving` means a wrong tap never costs a star — a two-year-old is
     * exploring, not being assessed.
     */
    tiers: 3,
    forgiving: true,
    rounds: TODDLER_ROUNDS,
    skills: TODDLER_SKILLS,
  },
  {
    id: 'numbers',
    name: 'Numbers',
    tagline: 'Counting, adding and number sense',
    emoji: '🔢',
    color: '#ffcc29',
    edge: '#e0a800',
    ink: '#4a3a00',
    ages: '2–8',
    skills: NUMBER_SKILLS,
  },
  {
    id: 'letters',
    name: 'Letters',
    tagline: 'ABC, sounds and first words',
    emoji: '🔤',
    color: '#35d0e8',
    edge: '#1aa5bd',
    ink: '#04333a',
    ages: '3–8',
    skills: LETTER_SKILLS,
  },
  {
    id: 'colors',
    name: 'Colors',
    tagline: 'Naming, mixing and sorting colours',
    emoji: '🎨',
    color: '#ff4f81',
    edge: '#d92e60',
    ink: '#ffffff',
    ages: '2–7',
    skills: COLOR_SKILLS,
  },
  {
    id: 'shapes',
    name: 'Shapes',
    tagline: 'Geometry, patterns and symmetry',
    emoji: '🔷',
    color: '#8f77ec',
    edge: '#5b3fc4',
    ink: '#ffffff',
    ages: '2–8',
    skills: SHAPE_SKILLS,
  },
  {
    id: 'logic',
    name: 'Logic',
    tagline: 'Puzzles, mazes, memory and coding',
    emoji: '🧠',
    color: '#3ecf6d',
    edge: '#23a951',
    ink: '#053d1c',
    ages: '4–8',
    skills: LOGIC_SKILLS,
  },
];

export const categoryById = (id) => CATEGORIES.find((c) => c.id === id);

/** Every skill across every category, keyed by id. */
export const SKILL_INDEX = new Map(
  CATEGORIES.flatMap((c) =>
    c.skills.map((s) => [s.id, { ...s, categoryId: c.id, maxTier: c.tiers ?? TIERS }]),
  ),
);

export const skillById = (id) => SKILL_INDEX.get(id);

/* -------------------------------------------------------------------------- */
/* Levels                                                                      */
/* -------------------------------------------------------------------------- */

const levelCache = new Map();

/**
 * The ordered list of levels for a category.
 * Level ids are stable (`numbers-7`) so saved progress survives content edits
 * as long as the skill order does not change.
 */
export function levelsFor(categoryId) {
  if (levelCache.has(categoryId)) return levelCache.get(categoryId);

  const category = categoryById(categoryId);
  if (!category) return [];

  const levels = [];
  const tierCount = category.tiers ?? TIERS;
  const roundsByTier = category.rounds ?? DEFAULT_ROUNDS;

  for (let tier = 1; tier <= tierCount; tier++) {
    category.skills.forEach((skill, skillIndex) => {
      const index = levels.length;
      levels.push({
        id: `${categoryId}-${index}`,
        index,
        number: index + 1,
        categoryId,
        skillId: skill.id,
        skillName: skill.name,
        emoji: skill.emoji,
        blurb: skill.blurb,
        tier,
        forgiving: Boolean(category.forgiving),
        rounds: skill.rounds ?? roundsByTier[tier - 1] ?? roundsByTier[roundsByTier.length - 1],
        // Every fifth level is a "star challenge": same content, no hints shown
        // by default and a bonus reward for a clean run.
        challenge: (index + 1) % 10 === 0,
        skillIndex,
      });
    });
  }

  levelCache.set(categoryId, levels);
  return levels;
}

export function levelById(levelId) {
  const categoryId = String(levelId).split('-').slice(0, -1).join('-');
  return levelsFor(categoryId).find((l) => l.id === levelId) || null;
}

export function totalLevels() {
  return CATEGORIES.reduce((sum, c) => sum + levelsFor(c.id).length, 0);
}

/* -------------------------------------------------------------------------- */
/* Puzzle generation                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Build the puzzles for one level.
 *
 * `variant` reshuffles the content for a replay while keeping the same skill
 * and difficulty. Generators may declare a `validate` function; if a generated
 * puzzle fails it, we regenerate with a nudged seed rather than shipping an
 * unsolvable board.
 */
export function buildLevel(level, variant = 0) {
  const skill = skillById(level.skillId);
  if (!skill) throw new Error(`Unknown skill: ${level.skillId}`);

  const puzzles = [];
  for (let i = 0; i < level.rounds; i++) {
    puzzles.push(buildPuzzle(skill, level.tier, `${level.id}|${variant}|${i}`));
  }
  return puzzles;
}

/** One puzzle from a skill at a tier, retried until it validates. */
export function buildPuzzle(skill, tier, seed) {
  let lastError = null;
  for (let attempt = 0; attempt < 25; attempt++) {
    const rng = makeRng(`${seed}#${attempt}`);
    try {
      const puzzle = skill.gen(rng, tier);
      if (skill.validate && !skill.validate(puzzle)) continue;
      puzzle.skillId = skill.id;
      puzzle.tier = tier;
      return puzzle;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error(`Could not generate a puzzle for ${skill.id} at tier ${tier}`);
}

/**
 * A mixed set of puzzles drawn from every category — used by the daily
 * challenge on the home screen.
 */
export function buildDailyChallenge(dateKey, count = 8) {
  const rng = makeRng('daily|' + dateKey);
  // The daily mix is for readers and near-readers; the toddler world has its
  // own pace and does not belong in a timed-feeling challenge.
  const skills = Array.from(SKILL_INDEX.values()).filter((s) => s.categoryId !== 'toddler');
  const puzzles = [];
  for (let i = 0; i < count; i++) {
    const skill = rng.pick(skills);
    // Ramp up through the set, but never past what that skill actually has.
    const tier = Math.min(skill.maxTier, rng.int(1, 3) + Math.floor(i / 3));
    puzzles.push(buildPuzzle(skill, tier, `daily|${dateKey}|${i}`));
  }
  return puzzles;
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
