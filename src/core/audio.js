/**
 * Sound.
 *
 * Everything is synthesised at runtime — there are no audio files to download,
 * so the game stays tiny and works offline, and effects can react to what the
 * child just did (a pop rises in pitch as you clear a set, praise climbs with
 * a streak).
 *
 * Signal path:
 *
 *   voices ─┬─► sfxBus ──┐
 *           └─► reverbSend ─► convolver ─► wetGain ─┤
 *                                                   ├─► master ─► compressor ─► out
 *              musicBus ────────────────────────────┘
 *
 * The compressor stops a burst of overlapping effects from clipping on tinny
 * phone speakers, which is where this will actually be played.
 */

import { settings } from './store.js';

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let reverbSend = null;

/** Hard cap on simultaneous oscillators — rapid tapping must never crackle. */
const MAX_VOICES = 28;
let voices = 0;

/* -------------------------------------------------------------------------- */
/* Graph                                                                       */
/* -------------------------------------------------------------------------- */

/** Audio contexts must be created inside a user gesture on iOS and Android. */
export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  ctx = new AudioCtx();

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 22;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.18;
  compressor.connect(ctx.destination);

  master = ctx.createGain();
  master.gain.value = 0.62;
  master.connect(compressor);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = 1;
  sfxBus.connect(master);

  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(master);

  // A small room. Gives every effect a tail so nothing sounds like a bare beep.
  const convolver = ctx.createConvolver();
  convolver.buffer = impulseResponse(1.5, 3.4);
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  reverbSend = ctx.createGain();
  reverbSend.gain.value = 1;
  reverbSend.connect(convolver);
  convolver.connect(wet);
  wet.connect(master);

  return ctx;
}

function impulseResponse(seconds, decay) {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

function ready() {
  return settings().sound && (ctx || unlockAudio());
}

/* -------------------------------------------------------------------------- */
/* Voices                                                                      */
/* -------------------------------------------------------------------------- */

/** Route a voice to the dry bus plus an optional reverb send. */
function out(node, { send = 0.12, pan = 0 } = {}) {
  let tail = node;
  if (pan && ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    tail.connect(panner);
    tail = panner;
  }
  tail.connect(sfxBus);
  if (send > 0) {
    const sendGain = ctx.createGain();
    sendGain.gain.value = send;
    tail.connect(sendGain);
    sendGain.connect(reverbSend);
  }
}

/**
 * One synth note.
 *
 * @param {object} o
 * @param {number} o.freq        start frequency (Hz)
 * @param {number} [o.to]        glide target — a sweep, not a step
 * @param {number} [o.dur=0.18]  seconds
 * @param {OscillatorType} [o.type='sine']
 * @param {number} [o.gain=0.22]
 * @param {number} [o.delay=0]   seconds from now
 * @param {number} [o.attack]    seconds; longer = softer onset
 * @param {'exp'|'lin'} [o.glide='exp']
 * @param {number} [o.cutoff]    lowpass frequency, for a warmer tone
 * @param {number} [o.send]      reverb amount 0–1
 * @param {number} [o.pan]       −1 … 1
 * @param {AudioNode} [o.dest]   override the destination (used by the music bed)
 */
function tone({
  freq,
  to,
  dur = 0.18,
  type = 'sine',
  gain = 0.22,
  delay = 0,
  attack = 0.008,
  glide = 'exp',
  cutoff = 0,
  send = 0.12,
  pan = 0,
  dest = null,
}) {
  if (!ctx || voices >= MAX_VOICES) return;
  voices += 1;

  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, freq), t0);
  if (to) {
    const target = Math.max(20, to);
    if (glide === 'lin') osc.frequency.linearRampToValueAtTime(target, t0 + dur);
    else osc.frequency.exponentialRampToValueAtTime(target, t0 + dur);
  }

  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  let node = env;
  osc.connect(env);
  if (cutoff) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    env.connect(filter);
    node = filter;
  }

  if (dest) node.connect(dest);
  else out(node, { send, pan });

  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
  osc.onended = () => {
    voices -= 1;
    osc.disconnect();
  };
}

/**
 * A burst of filtered noise — the "air" in a pop, a whoosh, a clap.
 * @param {'lowpass'|'highpass'|'bandpass'} [o.filter]
 */
function noise({
  dur = 0.2,
  gain = 0.15,
  delay = 0,
  filter = 'bandpass',
  freq = 1200,
  to = 0,
  q = 1,
  send = 0.1,
  pan = 0,
  shape = 'decay',
}) {
  if (!ctx || voices >= MAX_VOICES) return;
  voices += 1;

  const t0 = ctx.currentTime + delay;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    const p = i / frames;
    // `swell` rises then falls (applause); `decay` is a percussive hit.
    const envelope = shape === 'swell' ? Math.sin(Math.PI * p) : Math.pow(1 - p, 2);
    data[i] = (Math.random() * 2 - 1) * envelope;
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const biquad = ctx.createBiquadFilter();
  biquad.type = filter;
  biquad.frequency.setValueAtTime(freq, t0);
  biquad.Q.value = q;
  if (to) biquad.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);

  const env = ctx.createGain();
  env.gain.value = gain;

  src.connect(biquad);
  biquad.connect(env);
  out(env, { send, pan });

  src.start(t0);
  src.onended = () => {
    voices -= 1;
    src.disconnect();
  };
}

/** Several notes at once. */
function chord(freqs, opts = {}) {
  freqs.forEach((freq, i) => tone({ ...opts, freq, delay: (opts.delay || 0) + i * 0.004 }));
}

/** Notes in sequence. */
function arp(freqs, step = 0.075, opts = {}) {
  freqs.forEach((freq, i) => tone({ ...opts, freq, delay: (opts.delay || 0) + i * step }));
}

/* -------------------------------------------------------------------------- */
/* The sound library                                                           */
/* -------------------------------------------------------------------------- */

const C = 261.63;
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
/** Semitones above middle C → Hz. */
const note = (semitones) => C * Math.pow(2, semitones / 12);
/** Degree of a C-major scale (can exceed 7 to go up octaves). */
const deg = (n) => note(MAJOR[n % 7] + 12 * Math.floor(n / 7));

const rand = (min, max) => min + Math.random() * (max - min);

const SFX = {
  /* --- interface ------------------------------------------------------- */

  /** Generic tap on anything. Tiny, dry, never tiring. */
  tap: () => {
    noise({ dur: 0.03, gain: 0.06, filter: 'highpass', freq: 3000, send: 0.03 });
    tone({ freq: 880, to: 1320, dur: 0.05, type: 'triangle', gain: 0.1, send: 0.05 });
  },

  /** A chunky button press — more body than `tap`. */
  press: () => {
    noise({ dur: 0.05, gain: 0.09, filter: 'lowpass', freq: 1800, send: 0.05 });
    tone({ freq: 420, to: 620, dur: 0.09, type: 'triangle', gain: 0.16, cutoff: 2600 });
  },

  back: () => arp([deg(4), deg(2)], 0.055, { dur: 0.12, type: 'triangle', gain: 0.13 }),

  open: () => {
    noise({ dur: 0.3, gain: 0.06, filter: 'bandpass', freq: 500, to: 2600, q: 0.7 });
    arp([deg(2), deg(4), deg(6)], 0.045, { dur: 0.2, type: 'sine', gain: 0.11, send: 0.25 });
  },

  close: () => {
    noise({ dur: 0.26, gain: 0.055, filter: 'bandpass', freq: 2400, to: 400, q: 0.7 });
    arp([deg(4), deg(1)], 0.05, { dur: 0.16, type: 'sine', gain: 0.11 });
  },

  toggleOn: () => arp([deg(3), deg(5)], 0.06, { dur: 0.13, type: 'triangle', gain: 0.15 }),
  toggleOff: () => arp([deg(5), deg(3)], 0.06, { dur: 0.13, type: 'triangle', gain: 0.13 }),

  tick: () => tone({ freq: 1500, dur: 0.025, type: 'square', gain: 0.05, send: 0.02 }),

  /* --- handling pieces -------------------------------------------------- */

  pickup: () => {
    tone({ freq: 520, to: 760, dur: 0.1, type: 'triangle', gain: 0.14, cutoff: 3000 });
    noise({ dur: 0.05, gain: 0.05, filter: 'highpass', freq: 2600 });
  },

  drop: () => {
    tone({ freq: 300, to: 190, dur: 0.11, type: 'sine', gain: 0.14, cutoff: 1400 });
    noise({ dur: 0.06, gain: 0.06, filter: 'lowpass', freq: 900 });
  },

  /** A piece clicking home. Satisfying, slightly bright. */
  snap: () => {
    noise({ dur: 0.035, gain: 0.1, filter: 'highpass', freq: 3400, send: 0.06 });
    tone({ freq: deg(7), dur: 0.14, type: 'triangle', gain: 0.17, send: 0.22 });
    tone({ freq: deg(9), dur: 0.2, type: 'sine', gain: 0.1, delay: 0.02, send: 0.3 });
  },

  flip: () => {
    noise({ dur: 0.13, gain: 0.07, filter: 'bandpass', freq: 900, to: 2600, q: 0.8 });
    tone({ freq: 500, to: 820, dur: 0.09, type: 'triangle', gain: 0.1 });
  },

  /* --- bubbles & popping ------------------------------------------------ */

  /**
   * Bubble pop. `step` walks it up a scale, so clearing a set of bubbles
   * plays a little tune rather than the same blip over and over.
   */
  pop: (step = 0) => {
    const base = deg(3 + (step % 8));
    tone({
      freq: base * 0.55,
      to: base * 1.9,
      dur: 0.085,
      type: 'sine',
      gain: 0.24,
      attack: 0.004,
      send: 0.18,
      pan: rand(-0.4, 0.4),
    });
    noise({ dur: 0.05, gain: 0.09, filter: 'bandpass', freq: 2200, to: 5200, q: 1.6 });
  },

  /** Deeper, wetter bloop — used when a bubble is only nudged. */
  bloop: () => {
    tone({ freq: 300, to: 700, dur: 0.13, type: 'sine', gain: 0.2, send: 0.22 });
  },

  /** Counting up: pitch climbs with each item found. */
  count: (step = 0) =>
    tone({
      freq: deg(step % 8),
      dur: 0.16,
      type: 'triangle',
      gain: 0.19,
      send: 0.2,
    }),

  /* --- outcomes --------------------------------------------------------- */

  /** Correct. `streak` lifts the whole flourish an octave over five in a row. */
  correct: (streak = 0) => {
    const lift = Math.min(4, streak) * 2; // semitones
    const up = (semi) => note(semi + lift);
    arp([up(0), up(4), up(7), up(12)], 0.062, {
      dur: 0.26,
      type: 'triangle',
      gain: 0.2,
      send: 0.3,
    });
    // Sparkle on top.
    arp([up(24), up(28), up(31)], 0.045, {
      dur: 0.2,
      delay: 0.1,
      type: 'sine',
      gain: 0.07,
      send: 0.45,
    });
  },

  /** Gentle "not that one" — a soft boing, never a buzzer. */
  wrong: () => {
    tone({ freq: 330, to: 247, dur: 0.16, type: 'triangle', gain: 0.15, cutoff: 1600 });
    tone({ freq: 247, to: 208, dur: 0.22, delay: 0.12, type: 'triangle', gain: 0.12, cutoff: 1400 });
  },

  /** Toddler "oops" — even softer, with an upward lilt so it stays friendly. */
  oops: () => {
    tone({ freq: 400, to: 300, dur: 0.13, type: 'sine', gain: 0.13, cutoff: 1500 });
    tone({ freq: 330, to: 420, dur: 0.18, delay: 0.1, type: 'sine', gain: 0.11 });
  },

  match: () => {
    chord([deg(2), deg(4), deg(6)], { dur: 0.4, type: 'sine', gain: 0.13, send: 0.35 });
  },

  star: (index = 0) => {
    const base = deg(7 + index * 2);
    tone({ freq: base, dur: 0.28, type: 'triangle', gain: 0.2, send: 0.35 });
    tone({ freq: base * 2, dur: 0.5, delay: 0.03, type: 'sine', gain: 0.09, send: 0.5 });
    noise({ dur: 0.22, gain: 0.05, filter: 'highpass', freq: 5200, send: 0.3 });
  },

  sparkle: () => {
    for (let i = 0; i < 5; i++) {
      tone({
        freq: rand(1600, 4200),
        dur: rand(0.1, 0.24),
        delay: i * 0.035,
        type: 'sine',
        gain: 0.055,
        send: 0.5,
        pan: rand(-0.7, 0.7),
      });
    }
  },

  coin: () => {
    tone({ freq: deg(9), dur: 0.08, type: 'square', gain: 0.11 });
    tone({ freq: deg(13), dur: 0.3, delay: 0.06, type: 'square', gain: 0.1, send: 0.3 });
  },

  /* --- big moments ------------------------------------------------------ */

  win: () => {
    const melody = [0, 4, 7, 12, 7, 12, 16, 19];
    melody.forEach((semi, i) =>
      tone({
        freq: note(semi),
        dur: i === melody.length - 1 ? 0.7 : 0.22,
        delay: i * 0.11,
        type: 'triangle',
        gain: 0.2,
        send: 0.3,
      }),
    );
    chord([note(0), note(7), note(16), note(19)], {
      dur: 1.1,
      delay: 0.77,
      type: 'sine',
      gain: 0.1,
      send: 0.45,
    });
    SFX.applause(0.5);
  },

  unlock: () => {
    arp([deg(0), deg(2), deg(4), deg(6), deg(7), deg(9)], 0.06, {
      dur: 0.4,
      type: 'sine',
      gain: 0.14,
      send: 0.45,
    });
    noise({ dur: 0.9, gain: 0.045, filter: 'bandpass', freq: 900, to: 6000, q: 0.6, send: 0.4, shape: 'swell' });
  },

  fanfare: () => {
    arp([note(7), note(7), note(7), note(12)], 0.11, {
      dur: 0.28,
      type: 'sawtooth',
      gain: 0.11,
      cutoff: 2600,
      send: 0.3,
    });
  },

  /** Synthesised clapping: many short noise bursts under a swell. */
  applause: (delay = 0) => {
    for (let i = 0; i < 22; i++) {
      noise({
        dur: rand(0.03, 0.07),
        gain: rand(0.02, 0.05),
        delay: delay + rand(0, 0.85),
        filter: 'bandpass',
        freq: rand(1400, 3600),
        q: 1.2,
        send: 0.35,
        pan: rand(-0.9, 0.9),
      });
    }
    noise({
      dur: 1.1,
      gain: 0.035,
      delay,
      filter: 'bandpass',
      freq: 2200,
      q: 0.5,
      send: 0.4,
      shape: 'swell',
    });
  },

  /* --- movement --------------------------------------------------------- */

  step: () => {
    tone({ freq: 200, to: 150, dur: 0.06, type: 'square', gain: 0.07, cutoff: 900 });
    noise({ dur: 0.04, gain: 0.04, filter: 'lowpass', freq: 700 });
  },

  bump: () => {
    tone({ freq: 150, to: 90, dur: 0.16, type: 'sine', gain: 0.2, cutoff: 700 });
    noise({ dur: 0.1, gain: 0.08, filter: 'lowpass', freq: 400 });
  },

  whoosh: () =>
    noise({ dur: 0.34, gain: 0.075, filter: 'bandpass', freq: 380, to: 3400, q: 0.6, send: 0.25 }),

  /** Something being revealed — used by peekaboo. */
  reveal: () => {
    noise({ dur: 0.2, gain: 0.06, filter: 'bandpass', freq: 700, to: 3000, q: 0.7 });
    arp([deg(2), deg(4), deg(7)], 0.05, { dur: 0.3, type: 'sine', gain: 0.14, send: 0.4 });
  },

  /** Drawing / tracing — a soft continuous-feeling tick. */
  draw: (step = 0) =>
    tone({
      freq: 600 + (step % 12) * 45,
      dur: 0.05,
      type: 'sine',
      gain: 0.07,
      send: 0.15,
    }),
};

/**
 * Play a named effect.
 * @param {string} name
 * @param {number|object} [arg] extra data (streak, index…) for effects that use it
 */
export function sfx(name, arg) {
  if (!ready()) return;
  const effect = SFX[name];
  if (!effect) return;
  try {
    effect(typeof arg === 'number' ? arg : arg?.step ?? arg?.streak ?? arg?.index ?? 0);
  } catch (err) {
    console.warn('[audio] effect failed:', name, err);
  }
}

/** Names available to `sfx` — used by the tests to catch typos. */
export const SFX_NAMES = Object.keys(SFX);

/* -------------------------------------------------------------------------- */
/* Background music — a gentle generative bed, no audio assets                 */
/* -------------------------------------------------------------------------- */

// A pentatonic scale cannot produce a sour note, which makes a random walk safe.
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16];
const BASS_LINE = [-24, -17, -20, -15];

let musicTimer = 0;
let musicStep = 0;

export function startMusic() {
  if (!settings().music || !settings().sound) return;
  if (!unlockAudio() || musicTimer) return;

  musicBus.gain.setTargetAtTime(0.09, ctx.currentTime, 1.4);
  musicStep = 0;

  musicTimer = setInterval(() => {
    if (!ctx) return;
    const step = musicStep++;

    if (step % 4 === 0) {
      tone({
        freq: note(BASS_LINE[(step / 4) % BASS_LINE.length]),
        dur: 1.1,
        type: 'sine',
        gain: 0.42,
        attack: 0.09,
        dest: musicBus,
      });
    }

    if (step % 8 === 0) {
      // A soft pad underneath, so the bed is not just plinking.
      const root = BASS_LINE[(step / 4) % BASS_LINE.length] + 12;
      [0, 7, 16].forEach((interval, i) =>
        tone({
          freq: note(root + interval),
          dur: 2.4,
          delay: i * 0.02,
          type: 'triangle',
          gain: 0.12,
          attack: 0.5,
          cutoff: 1400,
          dest: musicBus,
        }),
      );
    }

    if (step % 2 === 0 || Math.random() < 0.35) {
      tone({
        freq: note(PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)] + 12),
        dur: 0.55,
        type: 'triangle',
        gain: 0.22,
        dest: musicBus,
      });
    }
  }, 460);
}

export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = 0;
  if (musicBus && ctx) musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
}

export function syncMusic() {
  if (settings().music && settings().sound) startMusic();
  else stopMusic();
}

/** Duck the music while something important is being said or celebrated. */
export function duckMusic(seconds = 1.6) {
  if (!ctx || !musicBus || !musicTimer) return;
  const now = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(now);
  musicBus.gain.setTargetAtTime(0.025, now, 0.12);
  musicBus.gain.setTargetAtTime(0.09, now + seconds, 0.5);
}

/* -------------------------------------------------------------------------- */
/* Voice                                                                       */
/* -------------------------------------------------------------------------- */

// Android's system WebView (what Capacitor ships the app in) does not
// implement the Web Speech API's speechSynthesis the way a real mobile
// browser does — window.speechSynthesis.getVoices() comes back empty and
// speak() silently does nothing, which is why voice-over worked on the
// GitHub Pages web build but was completely silent in the packaged app.
// @capacitor-community/text-to-speech wraps Android's native TextToSpeech
// engine instead, reached the same way as ads.js/analytics.js: through
// Capacitor's global runtime bridge, not an npm import, so this still needs
// no bundler and no-ops on the web build where window.Capacitor is undefined.
function nativeTTS() {
  return typeof window !== 'undefined' ? window.Capacitor?.Plugins?.TextToSpeech : null;
}

let nativeVoices = [];
let nativeVoicesLoaded = false;

async function loadNativeVoices() {
  const plugin = nativeTTS();
  if (!plugin) return;
  try {
    const { voices: list } = await plugin.getSupportedVoices();
    nativeVoices = list || [];
  } catch (err) {
    console.warn('[audio] getSupportedVoices failed', err);
  }
  nativeVoicesLoaded = true;
  refreshVoice();
  // Mirrors the 'voiceschanged' event the Web Speech branch already fires,
  // so the parent zone's voice list (which listens for either) refreshes
  // once real voices are in, instead of showing "Auto" only forever.
  window.dispatchEvent(new Event('nativevoiceschanged'));
}

// Fetching the voice list is also what actually starts up Android's TTS
// engine — doing this at boot serves the same purpose unlockVoice() serves
// for Web Speech (warming the engine up before the first real prompt), and
// unlike Web Speech, the native engine has no gesture-unlock requirement so
// this can run immediately rather than waiting for a tap.
if (nativeTTS()) loadNativeVoices();

let voice = null;
let voicesReady = false;

// The pause()/resume() nudge below fixes a *desktop* Chrome/ChromeOS bug
// (an utterance stuck queued-but-never-started). On Android Chrome it does
// the opposite: pause() there can leave a perfectly good utterance stuck
// paused, because resume() doesn't reliably un-pause it — producing exactly
// "music plays, voice never does". So it must never run on Android.
const IS_ANDROID = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '');

// Names commonly used for Indian-English voices across platforms (Windows'
// Heera/Ravi, macOS/iOS's Rishi/Sangeeta, and Android/Chrome's network voices,
// which are often just labelled "English (India)").
const INDIAN_VOICE_NAME_RE = /india|heera|ravi|rishi|sangeeta|veena/i;

function isIndianEnglish(v) {
  const vl = (v.lang || '').toLowerCase().replace('_', '-');
  return vl === 'en-in' || (vl.startsWith('en') && INDIAN_VOICE_NAME_RE.test(v.name || ''));
}

/**
 * Rate/pitch presets a parent can pick in the "Voice" section — the Web
 * Speech API has no "mood" of its own, so tone comes entirely from how fast
 * and how high the voice speaks.
 */
export const VOICE_STYLES = {
  calm: { rate: 0.85, pitch: 1.0, label: '😌 Calm' },
  cheerful: { rate: 0.95, pitch: 1.2, label: '🙂 Cheerful' },
  energetic: { rate: 1.08, pitch: 1.35, label: '🤩 Energetic' },
};

/**
 * How well a voice fits, absent a parent's manual pick: Indian-accented
 * English first, then how closely it matches the device's own language,
 * then a warm, kid-friendly tone.
 */
function scoreVoice(v, lang, base) {
  let s = 0;
  const vl = (v.lang || '').toLowerCase().replace('_', '-');
  if (isIndianEnglish(v)) s += 100;
  if (vl === lang) s += 10;
  else if (vl.startsWith(base)) s += 6;
  if (/female|samantha|karen|zira|google us english|aria|ava|kids|child/i.test(v.name)) s += 4;
  if (v.localService) s += 1;
  return s;
}

function pickVoice() {
  const hasWebSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;
  if (!nativeTTS() && !hasWebSpeech) return null;
  const available = nativeTTS() ? nativeVoices : speechSynthesis.getVoices();
  if (!available.length) return null;
  voicesReady = true;

  // A parent's manual pick (see the "Voice" section of the parent zone)
  // always wins over the automatic best-guess, as long as it still exists
  // on this device.
  const chosenURI = settings().voiceURI;
  if (chosenURI) {
    const chosen = available.find((v) => v.voiceURI === chosenURI);
    if (chosen) return chosen;
  }

  const lang = (navigator.language || 'en-US').toLowerCase();
  const base = lang.split('-')[0];
  return available.slice().sort((a, b) => scoreVoice(b, lang, base) - scoreVoice(a, lang, base))[0] || null;
}

/** Re-run voice selection — call after the parent zone changes voiceURI. */
export function refreshVoice() {
  voice = pickVoice();
}

/**
 * English voices available on this device, best-sounding first, for the
 * parent zone's "Voice" picker. Falls back to every voice on the rare
 * device with no English ones at all.
 */
export function listVoices() {
  const hasWebSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;
  if (!nativeTTS() && !hasWebSpeech) return [];
  const available = nativeTTS() ? nativeVoices : speechSynthesis.getVoices();
  if (!available.length) return [];
  const lang = (navigator.language || 'en-US').toLowerCase();
  const base = lang.split('-')[0];
  const english = available.filter((v) => (v.lang || '').toLowerCase().startsWith('en'));
  const pool = english.length ? english : available;
  return pool
    .slice()
    .sort((a, b) => scoreVoice(b, lang, base) - scoreVoice(a, lang, base))
    .map((v) => ({
      voiceURI: v.voiceURI,
      name: v.name,
      lang: v.lang,
      localService: v.localService,
      recommended: isIndianEnglish(v),
    }));
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
 * "Warms up" the speech engine inside a real tap.
 *
 * Most puzzle prompts are spoken automatically a moment *after* the child's
 * last tap (once a round finishes, `nextRound()` waits ~900ms before the next
 * prompt), which on several mobile browsers is no longer close enough to a
 * genuine user gesture for `speechSynthesis.speak()` to actually produce
 * sound — the call succeeds silently, with no error to catch. Speaking one
 * utterance from directly inside the *first* real tap keeps the engine
 * "open" for every later, gesture-less call on the same page.
 *
 * That utterance has to have real text and a non-zero volume. A genuinely
 * blank one (whitespace-only text, volume 0 — what this used to send) is a
 * no-op on some Android TTS bridges: it never actually engages the engine,
 * so every later automatic prompt stays silent until something *real* gets
 * spoken — confirmed on a real device where a proper test utterance fixed
 * voice for the rest of the session, but this silent one never did. Keeping
 * the volume very low (rather than 0) still makes it a genuine utterance
 * while staying essentially inaudible on the very first tap.
 */
let voiceUnlocked = false;
export function unlockVoice() {
  if (voiceUnlocked) return;
  voiceUnlocked = true;
  // The native engine has no gesture-unlock requirement — loadNativeVoices()
  // at boot already does the equivalent warm-up (see its comment above).
  if (nativeTTS()) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const warm = new SpeechSynthesisUtterance('Hi');
    warm.volume = 0.01;
    if (!voicesReady) voice = pickVoice();
    if (voice) {
      warm.voice = voice;
      warm.lang = voice.lang;
    }
    speechSynthesis.speak(warm);
  } catch {
    /* best-effort — a failed warm-up just means speak() falls back silently */
  }
}

/** True once a `speak()` call has actually reported an error for this utterance batch. */
function fireUtterance(text, { rate, pitch, useVoice, retryOnError }) {
  const utter = new SpeechSynthesisUtterance(String(text));
  if (useVoice && voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  }
  utter.rate = rate;
  utter.pitch = pitch;
  utter.volume = 1;
  utter.onerror = (e) => {
    // 'canceled'/'interrupted' just means a newer prompt cut this one off —
    // not a real failure. Anything else (voice engine missing, network voice
    // that failed to fetch its audio, …) is worth one retry on the device's
    // plain default voice, which is far more likely to be installed locally
    // than a fancier accented one.
    if (retryOnError && e.error !== 'canceled' && e.error !== 'interrupted') {
      console.warn('[audio] speech failed, retrying on the default voice:', e.error);
      fireUtterance(text, { rate, pitch, useVoice: false, retryOnError: false });
    }
  };
  speechSynthesis.speak(utter);
  if (!IS_ANDROID) {
    // Desktop Chrome/ChromeOS-only bug: an utterance can be queued in a
    // paused state and never actually start; nudging pause then resume
    // immediately after speak() is the standard workaround. See IS_ANDROID
    // above for why this must not run on Android.
    speechSynthesis.pause();
    speechSynthesis.resume();
  }
}

/**
 * Speak a prompt aloud. Cancels anything already speaking so prompts never
 * queue up and lag behind the child's taps. Rate/pitch default to the
 * parent zone's chosen voice style (energetic by default); pass either to
 * override for a specific line.
 */
export function speak(text, { rate, pitch, force = false } = {}) {
  if (!text) return;
  if (!force && !settings().voice) return;
  const style = VOICE_STYLES[settings().voiceStyle] || VOICE_STYLES.energetic;
  const effectiveRate = rate ?? style.rate;
  const effectivePitch = pitch ?? style.pitch;

  const plugin = nativeTTS();
  if (plugin) {
    if (!voicesReady) voice = pickVoice();
    duckMusic(Math.min(6, 1 + String(text).length / 12));
    const idx = voice ? nativeVoices.indexOf(voice) : -1;
    plugin
      .speak({
        text: String(text),
        lang: voice?.lang || 'en-US',
        rate: effectiveRate,
        pitch: effectivePitch,
        volume: 1,
        voice: idx >= 0 ? idx : undefined,
        queueStrategy: 0, // Flush — cuts off anything still speaking, same as speechSynthesis.cancel() below
      })
      .catch((err) => console.warn('[audio] native speak failed', err));
    return;
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    if (!voicesReady) voice = pickVoice();
    duckMusic(Math.min(6, 1 + String(text).length / 12));
    // Chrome can drop an utterance queued in the same tick as cancel() — a
    // beat later is enough for the cancel to actually flush first.
    setTimeout(
      () => fireUtterance(text, { rate: effectiveRate, pitch: effectivePitch, useVoice: true, retryOnError: true }),
      30,
    );
  } catch {
    /* Speech is a progressive enhancement; silence is an acceptable fallback. */
  }
}

const PREVIEW_LINE = 'Woohoo! Let’s find the shapes together!';

/**
 * Speak a sample line with a specific voice + style, without touching the
 * saved settings — used by the parent zone's picker so a voice/style can be
 * auditioned before committing to it.
 */
export function previewVoice(voiceURI, styleKey) {
  const style = VOICE_STYLES[styleKey] || VOICE_STYLES.energetic;

  const plugin = nativeTTS();
  if (plugin) {
    const previewed = voiceURI ? nativeVoices.find((v) => v.voiceURI === voiceURI) : voice;
    const idx = previewed ? nativeVoices.indexOf(previewed) : -1;
    plugin
      .speak({
        text: PREVIEW_LINE,
        lang: previewed?.lang || 'en-US',
        rate: style.rate,
        pitch: style.pitch,
        volume: 1,
        voice: idx >= 0 ? idx : undefined,
        queueStrategy: 0,
      })
      .catch((err) => console.warn('[audio] native preview failed', err));
    return;
  }

  if (!('speechSynthesis' in window)) return;
  const available = speechSynthesis.getVoices();
  const previewed = voiceURI ? available.find((v) => v.voiceURI === voiceURI) : voice;
  try {
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(PREVIEW_LINE);
    if (previewed) {
      utter.voice = previewed;
      utter.lang = previewed.lang;
    }
    utter.rate = style.rate;
    utter.pitch = style.pitch;
    utter.volume = 1;
    setTimeout(() => {
      speechSynthesis.speak(utter);
      if (!IS_ANDROID) {
        speechSynthesis.pause();
        speechSynthesis.resume();
      }
    }, 30);
  } catch {
    /* Preview is best-effort. */
  }
}

export function shutUp() {
  const plugin = nativeTTS();
  if (plugin) {
    plugin.stop().catch(() => {});
    return;
  }
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
