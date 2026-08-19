/**
 * Seeded pseudo-random number generator.
 *
 * Levels are generated from a seed so that a given level always produces the
 * same puzzles — a child who replays "Counting 3" sees the puzzle they
 * remember, and the smoke tests can verify every level deterministically.
 * Pass a fresh seed to reshuffle (used by "play again").
 */

/** Hash an arbitrary string into a 32-bit seed. */
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good enough distribution for puzzle generation. */
export function makeRng(seed) {
  let a = (typeof seed === 'string' ? hashSeed(seed) : seed >>> 0) || 1;

  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng = {
    /** Float in [0, 1). */
    next,
    /** Integer in [min, max] inclusive. */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** Random element of an array. */
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** `true` with probability p. */
    chance: (p = 0.5) => next() < p,
    /** New array, shuffled (Fisher–Yates). */
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    /** `n` distinct elements from `arr` (or all of them if n >= length). */
    sample(arr, n) {
      return rng.shuffle(arr).slice(0, Math.min(n, arr.length));
    },
    /**
     * `n` distinct integers in [min, max], excluding anything in `avoid`.
     * Returns fewer than `n` only if the range genuinely cannot supply more.
     */
    distinctInts(n, min, max, avoid = []) {
      const pool = [];
      for (let v = min; v <= max; v++) if (!avoid.includes(v)) pool.push(v);
      return rng.sample(pool, n);
    },
  };

  return rng;
}
