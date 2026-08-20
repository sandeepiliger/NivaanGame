/**
 * Persistent state: kid profiles, per-level stars, settings, rewards.
 *
 * Everything lives in localStorage under a single key. There is no account and
 * no network call — a child's progress never leaves the device.
 */

import { emit } from './bus.js';
import { unlockAchievement } from './analytics.js';

const KEY = 'nivaan.save.v1';
const SCHEMA = 1;

export const AVATARS = ['🦊', '🐼', '🦄', '🐯', '🐧', '🐸', '🦁', '🐨', '🐵', '🐰', '🐙', '🦖'];

function freshProfile(id, name = 'Player', avatar = '🦊') {
  return {
    id,
    name,
    avatar,
    createdAt: Date.now(),
    lastPlayed: 0,
    /** levelId -> stars earned (1..3). Presence means "completed". */
    stars: {},
    /** skillId -> number of correct answers, used for the skill mastery meter. */
    skillXp: {},
    /** rewardId -> timestamp unlocked. */
    rewards: {},
    totals: { correct: 0, wrong: 0, hints: 0, levels: 0, playMs: 0 },
    /** ISO date string of the last day played, and the current run length. */
    streak: { last: '', days: 0 },
  };
}

function freshSave() {
  const p = freshProfile('p1', 'Player', '🦊');
  return {
    schema: SCHEMA,
    activeProfile: p.id,
    profiles: { [p.id]: p },
    settings: {
      sound: true,
      music: true,
      voice: true,
      haptics: true,
      /** Minutes of play before the "time for a break" reminder. 0 = off. */
      breakAfterMin: 20,
      /** Skip the "which level" map and auto-advance. */
      autoAdvance: true,
      /** 'calm' | 'cheerful' | 'energetic' — see VOICE_STYLES in audio.js. */
      voiceStyle: 'energetic',
      /** A specific SpeechSynthesisVoice.voiceURI, or null to auto-pick the best one. */
      voiceURI: null,
      /** Set by the "Remove Ads" purchase — see core/purchases.js. */
      adsRemoved: false,
    },
    /** Session-scoped, but persisted so a reload does not reset the timer. */
    sessionStartedAt: 0,
    /** Levels completed since the last interstitial — see noteLevelCompleteForAds(). */
    adCounter: 0,
  };
}

let save = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSave();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schema !== SCHEMA) return freshSave();
    // Defensive merge so a partially-written save can never break boot.
    const base = freshSave();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      profiles: Object.keys(parsed.profiles || {}).length ? parsed.profiles : base.profiles,
    };
  } catch {
    return freshSave();
  }
}

let flushTimer = 0;
function persist() {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(save));
    } catch {
      /* Storage full or blocked (private mode) — play continues in memory. */
    }
  }, 120);
}

/* -------------------------------------------------------------------------- */
/* Profiles                                                                    */
/* -------------------------------------------------------------------------- */

export function profile() {
  return save.profiles[save.activeProfile] || Object.values(save.profiles)[0];
}

export function allProfiles() {
  return Object.values(save.profiles);
}

export function switchProfile(id) {
  if (!save.profiles[id]) return;
  save.activeProfile = id;
  persist();
  emit('profile:change', profile());
}

export function addProfile(name, avatar) {
  const id = 'p' + (Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36));
  save.profiles[id] = freshProfile(id, name || 'Player', avatar || AVATARS[0]);
  save.activeProfile = id;
  persist();
  emit('profile:change', profile());
  return save.profiles[id];
}

export function updateProfile(patch) {
  Object.assign(profile(), patch);
  persist();
  emit('profile:change', profile());
}

export function removeProfile(id) {
  if (Object.keys(save.profiles).length <= 1) return false;
  delete save.profiles[id];
  if (save.activeProfile === id) save.activeProfile = Object.keys(save.profiles)[0];
  persist();
  emit('profile:change', profile());
  return true;
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

export function settings() {
  return save.settings;
}

export function setSetting(key, value) {
  save.settings[key] = value;
  persist();
  emit('settings:change', save.settings);
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                    */
/* -------------------------------------------------------------------------- */

export function starsFor(levelId) {
  return profile().stars[levelId] || 0;
}

export function isCompleted(levelId) {
  return starsFor(levelId) > 0;
}

/** Total stars across all levels — the currency that unlocks rewards. */
export function totalStars() {
  return Object.values(profile().stars).reduce((sum, n) => sum + n, 0);
}

export function completedCount() {
  return Object.keys(profile().stars).length;
}

/**
 * Record the result of a finished level. Stars only ever go up, so replaying
 * a level can improve a score but never take one away.
 */
export function recordLevel(levelId, { stars, correct, wrong, hints, ms, skillId }) {
  const p = profile();
  const previous = p.stars[levelId] || 0;
  if (stars > previous) p.stars[levelId] = stars;

  p.totals.correct += correct;
  p.totals.wrong += wrong;
  p.totals.hints += hints;
  p.totals.playMs += ms;
  if (!previous) p.totals.levels += 1;
  if (skillId) p.skillXp[skillId] = (p.skillXp[skillId] || 0) + correct;

  p.lastPlayed = Date.now();
  touchStreak(p);
  persist();
  emit('progress:change', { levelId, stars, gained: Math.max(0, stars - previous) });
  return { previous, gained: Math.max(0, stars - previous) };
}

function touchStreak(p) {
  const today = new Date().toISOString().slice(0, 10);
  if (p.streak.last === today) return;
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  p.streak.days = p.streak.last === yesterday ? p.streak.days + 1 : 1;
  p.streak.last = today;
}

/* -------------------------------------------------------------------------- */
/* Rewards                                                                     */
/* -------------------------------------------------------------------------- */

export function hasReward(id) {
  return Boolean(profile().rewards[id]);
}

export function grantReward(id) {
  const p = profile();
  if (p.rewards[id]) return false;
  p.rewards[id] = Date.now();
  persist();
  emit('reward:unlock', id);
  unlockAchievement(id);
  return true;
}

/* -------------------------------------------------------------------------- */
/* Play-time tracking (for the parental break reminder)                        */
/* -------------------------------------------------------------------------- */

export function startPlayClock() {
  if (!save.sessionStartedAt) {
    save.sessionStartedAt = Date.now();
    persist();
  }
}

export function playClockMinutes() {
  if (!save.sessionStartedAt) return 0;
  return (Date.now() - save.sessionStartedAt) / 60000;
}

export function resetPlayClock() {
  save.sessionStartedAt = Date.now();
  persist();
}

/* -------------------------------------------------------------------------- */
/* Ads                                                                         */
/* -------------------------------------------------------------------------- */

/** Every Nth level completion earns an interstitial, never more often. */
const INTERSTITIAL_EVERY = 3;

/**
 * Call once per finished level. Returns whether this was the Nth one, i.e.
 * whether an interstitial should be shown now. The toddler world never
 * shows one — a 2-4 year old can't reliably navigate an ad away.
 */
export function noteLevelCompleteForAds(categoryId) {
  if (categoryId === 'toddler') return false;
  save.adCounter = (save.adCounter || 0) + 1;
  if (save.adCounter < INTERSTITIAL_EVERY) {
    persist();
    return false;
  }
  save.adCounter = 0;
  persist();
  return true;
}

/* -------------------------------------------------------------------------- */

export function exportSave() {
  return JSON.stringify(save, null, 2);
}

export function resetProgress() {
  const p = profile();
  const keep = { id: p.id, name: p.name, avatar: p.avatar };
  save.profiles[p.id] = { ...freshProfile(keep.id, keep.name, keep.avatar) };
  persist();
  emit('progress:change', { reset: true });
}
