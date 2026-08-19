# Nivaan Learning Games

A mobile-first educational game for children aged **2–8**, in the spirit of
[LogicLike](https://play.google.com/store/apps/details?id=com.logicappkids): five
worlds — **Numbers, Letters, Colors, Shapes and Logic** — with **230 levels**,
**46 distinct game types** and thousands of procedurally generated puzzles.

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

| World | Levels | Game types |
|---|---|---|
| 🔢 **Numbers** | 45 | Counting · Number match · What comes next · More or less · Add & take away · Line them up · Dot to dot · Number pairs · Find them all |
| 🔤 **Letters** | 45 | Find the letter · Big & small · First sound · Alphabet order · Build a word · Rhyme time · Letter hunt · Letter pairs · Vowel sort |
| 🎨 **Colors** | 40 | Find the colour · Colour of things · Mix the paint · Colour pattern · Colour sort · Odd colour out · Light to dark · Colour sudoku |
| 🔷 **Shapes** | 40 | Find the shape · Shape sorter · Sides & corners · Shape pattern · Mirror it · Shape sort · Shape pairs · Shape hunt |
| 🧠 **Logic** | 60 | Odd one out · Pattern power · Goes together · Maze runner · Robot road · Memory match · Big to small · Balance it · Sort it out · Picture sudoku · Goes with · Two clues |

Each game type is played at **five difficulty tiers** (Starter → Champion).
Levels interleave the types tier by tier, so a child meets every game at an easy
level before any of them gets harder.

### Ten interaction styles

Every puzzle is described as plain data and drawn by one of ten renderers:

`choice` · `dragdrop` · `order` · `memory` · `maze` · `coder` · `sudoku` ·
`symmetry` · `tapcount` · `connect`

Drag-and-drop puzzles also accept **tap-to-pick / tap-to-place**, because small
children are not reliable draggers.

### Features

- **Spoken instructions** for every prompt (Web Speech API) — the game is
  playable before a child can read.
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
- Synthesised sound effects and generative background music (no audio files).
- Accessible: ARIA labels, live region announcements, keyboard support for the
  maze and drag-and-drop, and `prefers-reduced-motion` handling.

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
- every renderer is reached by real content.

```
$ npm test
  categories : 5
  skills     : 46
  levels     : 230
  puzzles    : 3091
  assertions : 50464
  ✓ all checks passed
```

Turn the dial up to stress rare RNG paths:

```bash
VARIANTS=30 npm test     # ~30,000 puzzles, ~490,000 assertions
```

### Browser tests

`npm run e2e` drives the real app in a mobile-sized Chromium: it opens every
screen, mounts **all 230 levels** (failing on any console error or sideways
overflow), plays a round through **each of the ten renderers** to completion,
finishes a whole level and checks the 3-star score is saved, and verifies the
*Show me* escape hatch appears after three wrong tries.

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
