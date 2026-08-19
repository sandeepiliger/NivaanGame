/**
 * Rewards: trophies unlocked by stars, badges for milestones, and a printable
 * certificate for each finished world.
 */

import { CATEGORIES, levelsFor } from './catalog.js';
import { profile, totalStars, starsFor, isCompleted } from '../core/store.js';

export const TROPHIES = [
  { id: 'tr-5', stars: 5, emoji: '🥉', name: 'First Steps' },
  { id: 'tr-15', stars: 15, emoji: '🥈', name: 'Quick Learner' },
  { id: 'tr-30', stars: 30, emoji: '🥇', name: 'Star Collector' },
  { id: 'tr-60', stars: 60, emoji: '🏆', name: 'Puzzle Pro' },
  { id: 'tr-100', stars: 100, emoji: '💎', name: 'Brain Gem' },
  { id: 'tr-160', stars: 160, emoji: '👑', name: 'Game Champion' },
  { id: 'tr-250', stars: 250, emoji: '🚀', name: 'Sky Rocket' },
  { id: 'tr-400', stars: 400, emoji: '🌟', name: 'Superstar' },
  { id: 'tr-600', stars: 600, emoji: '🦄', name: 'Legend' },
];

export const BADGES = [
  {
    id: 'bd-first',
    emoji: '🎉',
    name: 'First Win',
    hint: 'Finish your first level',
    earned: () => Object.keys(profile().stars).length >= 1,
  },
  {
    id: 'bd-perfect',
    emoji: '✨',
    name: 'Perfect!',
    hint: 'Get 3 stars on any level',
    earned: () => Object.values(profile().stars).some((s) => s >= 3),
  },
  {
    id: 'bd-ten',
    emoji: '🔟',
    name: 'Ten Down',
    hint: 'Finish 10 levels',
    earned: () => Object.keys(profile().stars).length >= 10,
  },
  {
    id: 'bd-explorer',
    emoji: '🧭',
    name: 'Explorer',
    hint: 'Play a level in every world',
    earned: () =>
      CATEGORIES.every((c) => levelsFor(c.id).some((l) => isCompleted(l.id))),
  },
  {
    id: 'bd-streak3',
    emoji: '🔥',
    name: 'On Fire',
    hint: 'Play 3 days in a row',
    earned: () => profile().streak.days >= 3,
  },
  {
    id: 'bd-streak7',
    emoji: '☄️',
    name: 'Week Warrior',
    hint: 'Play 7 days in a row',
    earned: () => profile().streak.days >= 7,
  },
  {
    id: 'bd-maze',
    emoji: '🌀',
    name: 'Maze Master',
    hint: 'Answer 40 maze puzzles',
    earned: () => (profile().skillXp['log-maze'] || 0) >= 40,
  },
  {
    id: 'bd-coder',
    emoji: '🤖',
    name: 'Little Coder',
    hint: 'Program the robot 25 times',
    earned: () => (profile().skillXp['log-code'] || 0) >= 25,
  },
  {
    id: 'bd-speller',
    emoji: '📖',
    name: 'Word Builder',
    hint: 'Spell 30 words',
    earned: () => (profile().skillXp['let-spell'] || 0) >= 30,
  },
  {
    id: 'bd-mathlete',
    emoji: '➕',
    name: 'Mathlete',
    hint: 'Solve 60 sums',
    earned: () => (profile().skillXp['num-addsub'] || 0) >= 60,
  },
  {
    id: 'bd-allstars',
    emoji: '🌈',
    name: 'Rainbow Run',
    hint: 'Get 3 stars on 20 levels',
    earned: () => Object.values(profile().stars).filter((s) => s >= 3).length >= 20,
  },
];

/** One certificate per category, earned by completing every level in it. */
export function certificates() {
  return CATEGORIES.map((category) => {
    const levels = levelsFor(category.id);
    const done = levels.filter((l) => isCompleted(l.id)).length;
    const stars = levels.reduce((sum, l) => sum + starsFor(l.id), 0);
    return {
      id: 'cert-' + category.id,
      category,
      done,
      total: levels.length,
      stars,
      maxStars: levels.length * 3,
      earned: done === levels.length,
    };
  });
}

export function trophyState() {
  const stars = totalStars();
  return TROPHIES.map((t) => ({ ...t, earned: stars >= t.stars, progress: Math.min(1, stars / t.stars) }));
}

export function badgeState() {
  return BADGES.map((b) => ({ ...b, unlocked: b.earned() }));
}

/** Newly-earned reward ids since the last check — used for the unlock popup. */
export function pendingRewards(known = {}) {
  const out = [];
  for (const t of trophyState()) if (t.earned && !known[t.id]) out.push({ ...t, kind: 'trophy' });
  for (const b of badgeState()) if (b.unlocked && !known[b.id]) out.push({ ...b, kind: 'badge' });
  for (const c of certificates())
    if (c.earned && !known[c.id]) out.push({ ...c, kind: 'certificate', emoji: '📜', name: `${c.category.name} Certificate` });
  return out;
}
