/**
 * Sound: synthesised effects (no audio files to download) plus spoken prompts
 * via the browser's speech synthesis — LogicLike-style voiceovers matter a lot
 * for pre-readers, and this keeps them working offline in every language the
 * device already has installed.
 */

import { settings } from './store.js';

let ctx = null;
let masterGain = null;
let musicGain = null;
let musicTimer = 0;
let musicStep = 0;

/** Audio contexts must be created inside a user gesture on iOS/Android. */
export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  ctx = new AudioCtx();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.0;
  musicGain.connect(masterGain);
  return ctx;
}

function canPlay() {
  return settings().sound && (ctx || unlockAudio());
}

/**
 * Play a single synth tone.
 * @param {object} o
 * @param {number} o.freq      start frequency in Hz
 * @param {number} [o.to]      glide target frequency
 * @param {number} [o.dur]     seconds
 * @param {OscillatorType} [o.type]
 * @param {number} [o.gain]
 * @param {number} [o.delay]   seconds from now
 */
function tone({ freq, to, dur = 0.16, type = 'sine', gain = 0.22, delay = 0, dest }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);

  // Short attack, smooth decay — avoids clicks on cheap phone speakers.
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(g);
  g.connect(dest || masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noise({ dur = 0.2, gain = 0.15, delay = 0 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const frames = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g);
  g.connect(masterGain);
  src.start(t0);
}

/** Named sound effects used across the game. */
const SFX = {
  tap: () => tone({ freq: 620, to: 880, dur: 0.07, type: 'triangle', gain: 0.14 }),
  pop: () => tone({ freq: 420, to: 900, dur: 0.1, type: 'sine', gain: 0.2 }),
  correct: () => {
    [0, 0.09, 0.18].forEach((d, i) =>
      tone({ freq: [660, 880, 1180][i], dur: 0.18, type: 'triangle', gain: 0.2, delay: d }),
    );
  },
  wrong: () => {
    tone({ freq: 300, to: 170, dur: 0.26, type: 'sawtooth', gain: 0.13 });
  },
  star: () => {
    [0, 0.07, 0.14, 0.21].forEach((d, i) =>
      tone({ freq: 880 * Math.pow(1.26, i), dur: 0.2, type: 'sine', gain: 0.17, delay: d }),
    );
  },
  win: () => {
    const melody = [523, 659, 784, 1046, 784, 1046, 1318];
    melody.forEach((f, i) =>
      tone({ freq: f, dur: 0.24, type: 'triangle', gain: 0.19, delay: i * 0.11 }),
    );
  },
  unlock: () => {
    [523, 698, 880, 1174].forEach((f, i) =>
      tone({ freq: f, dur: 0.3, type: 'sine', gain: 0.16, delay: i * 0.08 }),
    );
  },
  whoosh: () => noise({ dur: 0.22, gain: 0.08 }),
  drop: () => tone({ freq: 240, to: 150, dur: 0.12, type: 'square', gain: 0.12 }),
  tick: () => tone({ freq: 1200, dur: 0.03, type: 'square', gain: 0.06 }),
};

export function sfx(name) {
  if (!canPlay()) return;
  SFX[name]?.();
}

/* -------------------------------------------------------------------------- */
/* Background music — a gentle generative loop, no audio assets required.      */
/* -------------------------------------------------------------------------- */

// A pentatonic scale can't produce a sour note, which makes random walks safe.
const PENTATONIC = [523.25, 587.33, 698.46, 783.99, 880.0, 1046.5];
const BASS = [130.81, 174.61, 196.0, 164.81];

export function startMusic() {
  if (!settings().music || !settings().sound) return;
  if (!unlockAudio() || musicTimer) return;
  musicGain.gain.setTargetAtTime(0.085, ctx.currentTime, 1.2);
  musicStep = 0;
  musicTimer = setInterval(() => {
    if (!ctx) return;
    const step = musicStep++;
    if (step % 4 === 0) {
      tone({
        freq: BASS[(step / 4) % BASS.length],
        dur: 0.9,
        type: 'sine',
        gain: 0.5,
        dest: musicGain,
      });
    }
    if (step % 2 === 0 || Math.random() < 0.4) {
      tone({
        freq: PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)],
        dur: 0.5,
        type: 'triangle',
        gain: 0.28,
        dest: musicGain,
      });
    }
  }, 460);
}

export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = 0;
  if (musicGain && ctx) musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
}

export function syncMusic() {
  if (settings().music && settings().sound) startMusic();
  else stopMusic();
}

/* -------------------------------------------------------------------------- */
/* Voice                                                                       */
/* -------------------------------------------------------------------------- */

let voice = null;
let voicesReady = false;

function pickVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  voicesReady = true;
  const lang = (navigator.language || 'en-US').toLowerCase();
  const base = lang.split('-')[0];
  // Prefer a female/child-friendly voice in the user's language when present.
  const score = (v) => {
    let s = 0;
    const vl = (v.lang || '').toLowerCase();
    if (vl === lang) s += 10;
    else if (vl.startsWith(base)) s += 6;
    if (/female|samantha|karen|zira|google us english|aria|ava|kids|child/i.test(v.name)) s += 4;
    if (v.localService) s += 1;
    return s;
  };
  return voices.slice().sort((a, b) => score(b) - score(a))[0] || null;
}

// Guarded so this module can also be imported by the Node smoke tests.
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const refresh = () => {
    voice = pickVoice();
  };
  refresh();
  speechSynthesis.addEventListener?.('voiceschanged', refresh);
}

/**
 * Speak a prompt aloud. Cancels anything already speaking so prompts never
 * queue up and lag behind the child's taps.
 */
export function speak(text, { rate = 0.92, pitch = 1.15, force = false } = {}) {
  if (!text) return;
  if (!force && !settings().voice) return;
  if (!('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(String(text));
    if (!voicesReady) voice = pickVoice();
    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang;
    }
    utter.rate = rate;
    utter.pitch = pitch;
    utter.volume = 1;
    speechSynthesis.speak(utter);
  } catch {
    /* Speech is a progressive enhancement; silence is an acceptable fallback. */
  }
}

export function shutUp() {
  try {
    speechSynthesis?.cancel();
  } catch {
    /* no-op */
  }
}

/* -------------------------------------------------------------------------- */

export function haptic(pattern = 12) {
  if (!settings().haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* no-op */
  }
}
