# Nivaan Learning Games

A mobile-first educational game for children aged **2–8**, in the spirit of
[LogicLike](https://play.google.com/store/apps/details?id=com.logicappkids): six
worlds — **Little Ones, Numbers, Letters, Colors, Shapes and Logic** — with
**266 levels**, **58 distinct game types** and thousands of procedurally
generated puzzles, all fully voiced.

It is a plain web app: **no build step, no dependencies, no network calls.** It
installs as a PWA today and wraps into a native Android/iOS app with Capacitor
(see [Shipping as a native app](#shipping-as-a-native-app)).

---

## Quick start

```bash
npm start          # http://localhost:5173  (also prints a LAN URL for your phone)
npm test           # generate and validate every level
npm run e2e        # drive the real app in a browser (needs playwright)
```

There is nothing to install — `npm start` runs a small Node static server, and
the app itself is ES modules, CSS and SVG.

To try it on a phone on the same Wi‑Fi, open the **Network** URL that
`npm start` prints, then use *Add to Home Screen*.

---

## What's in the game

### Worlds and game types

| World | Ages | Levels | Game types |
|---|---|---|---|
| 🧸 **Little Ones** | 2–4 | 36 | Pop the bubbles · Where is it? · Animal sounds · Find the same · Colours · Shapes · How many? · Big and small · Take me there · Feed the animals · Peekaboo · Tidy up |
| 🔢 **Numbers** | 2–8 | 45 | Counting · Number match · What comes next · More or less · Add & take away · Line them up · Dot to dot · Number pairs · Find them all |
| 🔤 **Letters** | 3–8 | 45 | Find the letter · Big & small · First sound · Alphabet order · Build a word · Rhyme time · Letter hunt · Letter pairs · Vowel sort |
| 🎨 **Colors** | 2–7 | 40 | Find the colour · Colour of things · Mix the paint · Colour pattern · Colour sort · Odd colour out · Light to dark · Colour sudoku |
| 🔷 **Shapes** | 2–8 | 40 | Find the shape · Shape sorter · Sides & corners · Shape pattern · Mirror it · Shape sort · Shape pairs · Shape hunt |
| 🧠 **Logic** | 4–8 | 60 | Odd one out · Pattern power · Goes together · Maze runner · Robot road · Memory match · Big to small · Balance it · Sort it out · Picture sudoku · Goes with · Two clues |

Each game type is played at **five difficulty tiers** (Starter → Champion) —
three in Little Ones. Levels interleave the types tier by tier, so a child meets
every game at an easy level before any of them gets harder.

### Little Ones: the toddler world

The other five worlds start at four-ish even on their easiest levels. Little
Ones is built to different rules, because a two-year-old is not a small
six-year-old:

- **two or three choices, never more,** and always huge;
- **nothing to read** — every prompt is spoken, and the answer is something they
  already know (a dog, a ball, red) rather than something to work out;
- **wrong taps cost nothing.** These levels are marked `forgiving`: the round
  wiggles and invites another go, help arrives a try sooner, and the level
  always finishes on three stars. A toddler tapping around is exploring, not
  being assessed;
- **short levels** — three or four rounds;
- games built on cause and effect: popping bubbles that count themselves aloud,
  tracing a path from a hungry animal to its food, matching an animal to the
  noise it makes.

### Twelve interaction styles

Every puzzle is described as plain data and drawn by one of twelve renderers:

`choice` · `dragdrop` · `order` · `memory` · `maze` · `coder` · `sudoku` ·
`symmetry` · `tapcount` · `connect` · `pop` · `trace`

Drag-and-drop puzzles also accept **tap-to-pick / tap-to-place**, because small
children are not reliable draggers.

### Features

- **Spoken instructions everywhere a child plays alone** (Web Speech API) — not
  just puzzle prompts, but the world map ("Little Ones! First games for
  toddlers"), the exit-confirmation dialog, and the *Show me* button's cue —
  anywhere pre-readers would otherwise face text they can't use. Prefers an
  Indian-accented English voice (`en-IN`) when the device has one installed,
  with a graceful fallback to whatever's next best otherwise.
- **A full synthesised soundtrack**: 31 distinct effects, all generated at
  runtime — see [Sound](#sound) below.
- **Progressive hints**: a 💡 button that eliminates a wrong option or shows the
  next step, plus a *Show me* escape hatch after three tries so nobody gets stuck.
- **3-star scoring**, per-level stars, and a winding **level map** with unlocking.
- **Daily Challenge** — eight mixed puzzles, a fresh set each day.
- **Rewards**: 9 trophies, 11 badges and a **printable certificate** per world.
- **Multiple players** on one device, each with their own progress.
- **Parent zone** behind a maths gate: sound/music/voice/vibration toggles,
  a healthy-play **break reminder**, progress export and reset.
- **Progress dashboard** with per-skill mastery meters.
- **Offline-first PWA** — service worker caches the whole shell.
- Accessible: ARIA labels, live region announcements, keyboard support for the
  maze and drag-and-drop, and `prefers-reduced-motion` handling.

---

## Sound

There are no audio files. Every sound is synthesised through the Web Audio API
at runtime, which keeps the download tiny, works offline, and — more usefully —
lets effects respond to what the child just did.

**The engine** (`src/core/audio.js`) runs voices through a shared reverb
(a generated impulse response) into a compressor, so a burst of overlapping
effects never clips on a tinny phone speaker. Concurrent oscillators are capped,
so hammering the screen cannot make it crackle.

**31 effects**, each built from layered tones and filtered noise rather than a
single beep: `tap` `press` `back` `open` `close` `toggleOn` `toggleOff` `tick`
`pickup` `drop` `snap` `flip` `pop` `bloop` `count` `correct` `wrong` `oops`
`match` `star` `sparkle` `coin` `win` `unlock` `fanfare` `applause` `step`
`bump` `whoosh` `reveal` `draw`.

**They react to play:**

- `pop` and `count` climb a scale, so clearing a set of bubbles or finding all
  the butterflies plays a rising tune instead of the same blip nine times;
- `correct` lifts by a whole octave across a five-answer streak, and adds a
  sparkle layer from three in a row;
- `star` steps up for each star that lands on the results screen;
- `applause` is real synthesised clapping — two dozen randomised noise bursts
  under a swell — and plays on a three-star finish;
- the music ducks under spoken prompts and celebrations.

**Everything is wired up.** A single delegated listener in `main.js` gives every
button, link and switch in the app a click, so nothing is silent; game pieces
opt out with `data-quiet` and make their own, more specific noise — a card
*flips*, a shape *snaps* home, a robot's feet *step*, a maze wall gives a soft
*bump*. Wrong answers never buzz: they get a gentle two-note fall, and the
toddler world gets a softer one that lilts back upward.

Sound, music, voice and vibration each have their own switch in the parent zone.

### Voice

Spoken prompts use the browser's own text-to-speech (`speechSynthesis`), so
there is nothing to download and it works in whatever languages the device
already has installed. `pickVoice()` in `src/core/audio.js` scores every
installed voice and picks the best one:

1. an **Indian-accented English voice** (`en-IN`, or a name flagged by the
   platform as an India voice — Windows' Heera/Ravi, macOS/iOS's Rishi/
   Sangeeta, Android's network "English (India)" voices) always wins first;
2. failing that, whatever best matches the device's own language;
3. failing that, a warm, kid-friendly-sounding voice, then a local (offline)
   one.

Wording stays plain English throughout — this changes the *accent*, not the
words. A device with no Indian voice installed just falls through to step 2
with no visible difference in behaviour.

Coverage was widened at the same time, since a pre-reader can't parse a
screen's text on their own: beyond every puzzle prompt, the world map now
announces which world you're in on entry, the exit-confirmation dialog speaks
both choices, and the *Show me* button says what tapping it does the moment it
appears. `npm run e2e`'s "voice coverage" section drives all four of these by
spying on `speechSynthesis.speak` and asserts each one fires — including that
voice-picking itself never throws when a device (or this project's CI
sandbox) reports zero installed voices.

The parent zone's **Voice** section lets a grown-up override both halves of
this: a **style** (Calm / Cheerful / Energetic — rate+pitch presets in
`VOICE_STYLES`, `src/core/audio.js`; Energetic is the default) and a specific
**voice** picked from the device's own installed list, with a ▶ button to
preview each one before committing. "Auto (recommended)" — the scored
`pickVoice()` behaviour above — is always the first option. Both choices
persist in `settings()` (`voiceStyle`, `voiceURI`) and apply to every spoken
line in the app immediately, no reload needed.

A **"🔎 Test voice (debug)"** button next to it speaks a fixed test line and
reports installed voice count, the picked voice, and whether the utterance
actually started/ended/errored — useful for root-causing a silent-voice
report on a real device without needing devtools access.

---

## How it is built

```
index.html            app shell
manifest.webmanifest  PWA manifest
sw.js                 offline cache
styles/               base · components · screens · games
src/
  core/               dom, rng, bus, store, audio, router, fx
  data/               content (words, colours, shapes…), catalog, rewards
  engine/
    visual.js         data → DOM for every visual primitive
    session.js        the round loop, scoring, renderer registry
    drag.js           pointer drag + tap-to-place helper
    renderers/        one file per interaction style
  games/              one file per world: pure puzzle generators
                      (toddler, numbers, letters, colors, shapes, logic)
  screens/            home, map, play, result, rewards, progress, parents…
  ui/                 the mascot
tools/                dev server + smoke tests
```

Three ideas keep it small:

1. **Puzzles are data.** A generator is a pure `(rng, tier) => puzzle` function.
   It never touches the DOM, so it can be tested in Node and replayed exactly.
2. **Seeded randomness.** Every level is generated from its id, so a level always
   produces the puzzles a child remembers — and the tests are deterministic.
3. **One visual language.** All artwork is emoji or generated SVG described by a
   small visual spec, so a new game type only has to describe content.

### Adding a new game type

Add a generator to the relevant `src/games/*.js` and export it from the world's
skill list:

```js
const myGame = {
  id: 'num-double',
  name: 'Double it',
  emoji: '✌️',
  blurb: 'Twice as many',
  gen(rng, tier) {
    const n = rng.int(1, byTier(tier, [3, 5, 8, 10, 12]));
    return choiceFrom(rng, numberOptions(rng, n * 2, 4, 1, 30), (v) => V.text(v), n * 2, {
      prompt: `What is double ${n}?`,
      stem: V.text(n, 'xl'),
      hint: `${n} and another ${n}.`,
    });
  },
};
```

That is the whole change: the catalog picks it up, generates five levels for it,
the map shows it, and `npm test` starts validating it.

---

## Testing

`npm test` generates **every level of every skill at every tier**, several
replay variants each, and asserts that the result is well-formed *and solvable*:

- mazes are actually completable, including collecting every pickup
  (breadth-first search);
- robot-coding boards have a winning program within the step limit
  (BFS over position × collected-gems);
- sudoku grids are valid **and have a unique solution** (backtracking count);
- drag-and-drop puzzles have a home for every piece and a piece for every slot;
- multiple-choice puzzles have exactly one option that looks like the answer;
- symmetry targets really are symmetrical; connect-the-dots dots never overlap;
- trace waypoints are inside the finger-reach tolerance and not bunched up, and
  bubbles never cover each other;
- every `sfx()` call names an effect that actually exists;
- every renderer is reached by real content.

```
$ npm test
  categories : 6
  skills     : 58
  levels     : 266
  puzzles    : 3448
  assertions : 56842
  ✓ all checks passed
```

Turn the dial up to stress rare RNG paths:

```bash
VARIANTS=30 npm test     # ~33,000 puzzles, ~550,000 assertions
```

### Browser tests

`npm run e2e` drives the real app in a mobile-sized Chromium: it opens every
screen, mounts **all 266 levels** (failing on any console error or sideways
overflow), plays a round through **each of the twelve renderers** to completion,
finishes a whole level and checks the 3-star score is saved, plays every one of
the 31 sound effects, verifies the *Show me* escape hatch appears after three
wrong tries, and enforces the toddler rules — every Little Ones level spoken,
forgiving, and never more than three choices.

```bash
npm i -D playwright && npx playwright install chromium
npm start &                  # server on :5173
npm run e2e                  # SHOTS=1 npm run e2e  to also save screenshots
```

It skips itself with a note if Playwright is not installed, so it is safe to
wire into CI either way.

---

## Shipping as a native app

The app is a self-contained static site, so packaging is mechanical:

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/android @capacitor/ios
npx cap init "Nivaan Learning Games" ai.32labs.nivaan --web-dir .
npx cap add android          # and/or: npx cap add ios
npx cap sync
npx cap open android
```

`assets/icon.svg` is the source for the launcher icon; export it at 192/512/1024
px (and a maskable 512) into `assets/` to complete the manifest entries.

For the Play Store, the alternative is a **Trusted Web Activity** via
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap), which wraps the
hosted PWA with no code changes at all.

---

## Privacy

There is no analytics, no advertising, no account and no network request of any
kind. Progress lives in `localStorage` on the device and can be exported or
erased from the parent zone.

---

## Licence

MIT.
