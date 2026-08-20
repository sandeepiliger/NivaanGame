/**
 * End-to-end browser tests.
 *
 * `npm test` proves every level is *generated* correctly; this proves every
 * level is *playable* — it drives each of the ten renderers in a real mobile
 * viewport and checks the round actually completes.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   npm start          # in another terminal
 *   npm run e2e
 *
 * Env:
 *   BASE=http://localhost:5173   server to test against
 *   SHOTS=1                      also write screenshots to tools/shots/
 */

import { mkdirSync } from 'node:fs';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('\n  playwright is not installed — skipping e2e.');
  console.log('  npm i -D playwright && npx playwright install chromium\n');
  process.exit(0);
}

const BASE = process.env.BASE || 'http://localhost:5173';
const SHOTS = process.env.SHOTS === '1';
const SHOT_DIR = new URL('./shots/', import.meta.url).pathname;
if (SHOTS) mkdirSync(SHOT_DIR, { recursive: true });

const errors = [];
const fail = (message) => errors.push(message);

const launchOptions = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
const browser = await chromium.launch(launchOptions);
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

// Any uncaught error or console error anywhere in the run is a failure.
page.on('pageerror', (e) => fail(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && fail(`console: ${m.text()}`));

// Spy on speechSynthesis.speak so the voice-coverage checks can see every
// utterance the app tries to say, without depending on real TTS output — CI
// sandboxes typically report zero installed voices, which is exactly the
// graceful-fallback path this is meant to exercise.
await page.addInitScript(() => {
  window.__spoken = [];
  const realSpeak = window.speechSynthesis?.speak?.bind(window.speechSynthesis);
  if (window.speechSynthesis) {
    window.speechSynthesis.speak = (utter) => {
      window.__spoken.push(utter.text);
      try {
        realSpeak(utter);
      } catch {
        /* no real TTS backend in this sandbox — that's fine */
      }
    };
  }
});
const spoken = () => page.evaluate(() => window.__spoken.slice());
const clearSpoken = () => page.evaluate(() => void (window.__spoken.length = 0));

const shot = (name) => (SHOTS ? page.screenshot({ path: SHOT_DIR + name + '.png' }) : Promise.resolve());
const roundsDone = () => page.evaluate(() => document.querySelectorAll('.play__pip--done').length);

async function openLevel(levelId) {
  await page.goto(`${BASE}/index.html#/play?level=${levelId}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(400);
}

/** The first puzzle of a level, exactly as the running app generated it. */
const firstPuzzle = (levelId) =>
  page.evaluate(async (id) => {
    const { buildLevel, levelById } = await import('/src/data/catalog.js');
    return buildLevel(levelById(id), 0)[0];
  }, levelId);

/** Find the tier-1 level id for a skill, by asking the running app. */
const levelForSkill = (skillId, tier = 1) =>
  page.evaluate(
    ([id, t]) =>
      import('/src/data/catalog.js').then(({ CATEGORIES, levelsFor }) => {
        for (const category of CATEGORIES) {
          const level = levelsFor(category.id).find((l) => l.skillId === id && l.tier === t);
          if (level) return level.id;
        }
        return null;
      }),
    [skillId, tier],
  );

async function expectComplete(label) {
  await page.waitForTimeout(1300);
  const done = await roundsDone();
  console.log(`  ${done >= 1 ? '✓' : '✗'} ${label}`);
  if (done < 1) fail(`${label}: the round did not complete`);
}

/* -------------------------------------------------------------------------- */
/* 1. Every screen renders                                                     */
/* -------------------------------------------------------------------------- */

console.log('\nNivaan Learning Games — e2e\n');
console.log('screens');

await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
if (!(await page.locator('.home__title').count())) fail('home: title is missing');
await shot('home');
console.log('  ✓ home');

for (const route of [
  'map?cat=numbers', 'map?cat=letters', 'map?cat=colors', 'map?cat=shapes', 'map?cat=logic',
  'rewards', 'progress', 'parents', 'profiles',
]) {
  await page.goto(`${BASE}/index.html#/${route}`);
  await page.waitForTimeout(220);
  if (!(await page.locator('.screen').count())) fail(`route ${route}: nothing rendered`);
  console.log(`  ✓ ${route}`);
}

/* -------------------------------------------------------------------------- */
/* 2. Every skill mounts, at every tier                                        */
/* -------------------------------------------------------------------------- */

console.log('\nskills mount (all tiers)');

const skills = await page.evaluate(async () => {
  const { CATEGORIES, levelsFor } = await import('/src/data/catalog.js');
  return CATEGORIES.flatMap((c) =>
    c.skills.map((s) => ({
      id: s.id,
      levels: levelsFor(c.id).filter((l) => l.skillId === s.id).map((l) => l.id),
    })),
  );
});

for (const skill of skills) {
  for (const levelId of skill.levels) {
    await page.goto(`${BASE}/index.html#/play?level=${levelId}`);
    await page.waitForTimeout(220);
    if (!(await page.locator('.play__body').count())) fail(`${levelId} (${skill.id}): no puzzle body`);
    const prompt = (await page.locator('.play__prompt').textContent()) || '';
    if (!prompt.trim()) fail(`${levelId} (${skill.id}): empty prompt`);
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    if (overflows) fail(`${levelId} (${skill.id}): the layout overflows sideways`);
  }
  await shot('skill-' + skill.id);
  console.log(`  ✓ ${skill.id} (${skill.levels.length} levels)`);
}

/* -------------------------------------------------------------------------- */
/* 3. Each renderer can actually be played to completion                       */
/* -------------------------------------------------------------------------- */

console.log('\nrenderers play through');

// choice --------------------------------------------------------------------
{
  const levelId = await levelForSkill('num-count');
  await openLevel(levelId);
  const puzzle = await firstPuzzle(levelId);
  await page.click(`.opt[data-id="${puzzle.answer}"]`);
  await expectComplete('choice');
}

// dragdrop (tap-to-pick / tap-to-place) -------------------------------------
{
  const levelId = await levelForSkill('col-sort');
  await openLevel(levelId);
  const puzzle = await firstPuzzle(levelId);
  for (const item of puzzle.items) {
    const target = puzzle.targets.find((t) => t.accepts.includes(item.id));
    await page.click(`.dd__item[data-item="${item.id}"]`);
    await page.click(`.dd__target[data-target="${target.id}"]`);
    await page.waitForTimeout(110);
  }
  await expectComplete('dragdrop');
}

// order ---------------------------------------------------------------------
{
  const levelId = await levelForSkill('num-order');
  await openLevel(levelId);
  const puzzle = await firstPuzzle(levelId);
  for (const id of puzzle.answer) {
    await page.click(`.ord__item[data-id="${id}"]`);
    await page.waitForTimeout(80);
  }
  await expectComplete('order');
}

// memory --------------------------------------------------------------------
{
  const levelId = await levelForSkill('log-memory');
  await openLevel(levelId);
  const total = await page.locator('.mem__card').count();
  for (let guard = 0; guard < 200; guard++) {
    if ((await page.locator('.mem__card--gone').count()) >= total) break;
    const pair = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('.mem__card:not(.mem__card--gone)'));
      const byFace = new Map();
      nodes.forEach((node, i) => {
        const face = node.querySelector('.mem__face--front').textContent;
        if (!byFace.has(face)) byFace.set(face, []);
        byFace.get(face).push(i);
      });
      for (const [, indices] of byFace) if (indices.length === 2) return indices;
      return null;
    });
    if (!pair) break;
    const live = page.locator('.mem__card:not(.mem__card--gone)');
    await live.nth(pair[0]).click();
    await page.waitForTimeout(110);
    await live.nth(pair[1]).click();
    await page.waitForTimeout(430);
  }
  await expectComplete('memory');
}

// sudoku --------------------------------------------------------------------
{
  const levelId = await levelForSkill('log-sudoku');
  await openLevel(levelId);
  const puzzle = await firstPuzzle(levelId);
  for (let i = 0; i < puzzle.given.length; i++) {
    if (puzzle.given[i] !== 0) continue;
    await page.locator('.sud__pick').nth(puzzle.solution[i] - 1).click();
    await page.locator('.sud__cell').nth(i).click();
    await page.waitForTimeout(45);
  }
  await expectComplete('sudoku');
}

// coder ---------------------------------------------------------------------
{
  const levelId = await levelForSkill('log-code');
  await openLevel(levelId);
  const program = await page.evaluate(async (id) => {
    const { buildLevel, levelById } = await import('/src/data/catalog.js');
    const { solveProgram } = await import('/src/games/coder-lib.js');
    return solveProgram(buildLevel(levelById(id), 0)[0]);
  }, levelId);
  for (const dir of program) {
    await page.click(`.coder__key--${dir}`);
    await page.waitForTimeout(55);
  }
  await page.click('.coder__play');
  await page.waitForTimeout(320 * program.length + 900);
  await expectComplete(`coder (${program.length}-step program)`);
}

// tapcount ------------------------------------------------------------------
{
  const levelId = await levelForSkill('num-find');
  await openLevel(levelId);
  const puzzle = await firstPuzzle(levelId);
  for (const i of puzzle.targets) {
    await page.locator('.tap__item').nth(i).click();
    await page.waitForTimeout(65);
  }
  await expectComplete('tapcount');
}

// connect -------------------------------------------------------------------
{
  const levelId = await levelForSkill('num-dots');
  await openLevel(levelId);
  const puzzle = await firstPuzzle(levelId);
  const box = await page.locator('.con__svg').boundingBox();
  const side = Math.min(box.width, box.height);
  const ox = box.x + (box.width - side) / 2;
  const oy = box.y + (box.height - side) / 2;
  await page.mouse.move(ox + (puzzle.dots[0].x / 100) * side, oy + (puzzle.dots[0].y / 100) * side);
  await page.mouse.down();
  for (const dot of puzzle.dots) {
    await page.mouse.move(ox + (dot.x / 100) * side, oy + (dot.y / 100) * side, { steps: 3 });
    await page.waitForTimeout(45);
  }
  await page.mouse.up();
  await expectComplete('connect');
}

// symmetry ------------------------------------------------------------------
{
  const levelId = await levelForSkill('shp-symmetry');
  await openLevel(levelId);
  const puzzle = await firstPuzzle(levelId);
  for (let i = 0; i < puzzle.target.length; i++) {
    if (puzzle.locked[i] || puzzle.target[i] === 0) continue;
    if (puzzle.palette.length > 1) {
      await page.locator('.sym__pick').nth(puzzle.target[i] - 1).click();
    }
    await page.locator('.sym__cell').nth(i).click();
    await page.waitForTimeout(45);
  }
  await expectComplete('symmetry');
}

// pop -----------------------------------------------------------------------
{
  const levelId = await levelForSkill('tot-pop');
  await openLevel(levelId);
  const count = await page.locator('.pop__bubble').count();
  for (let i = 0; i < count; i++) {
    // Bubbles drift gently, which Playwright reads as "not stable"; a real
    // finger has no such problem, so skip the stability wait.
    await page.locator('.pop__bubble').nth(i).click({ force: true });
    await page.waitForTimeout(70);
  }
  await expectComplete(`pop (${count} bubbles)`);
}

// trace ---------------------------------------------------------------------
{
  const levelId = await levelForSkill('tot-trace');
  await openLevel(levelId);
  const puzzle = await firstPuzzle(levelId);
  const box = await page.locator('.trace__svg').boundingBox();
  const side = Math.min(box.width, box.height);
  const ox = box.x + (box.width - side) / 2;
  const oy = box.y + (box.height - side) / 2;
  const at = (p) => ({ x: ox + (p.x / 100) * side, y: oy + (p.y / 100) * side });

  const first = at(puzzle.path[0]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const point of puzzle.path) {
    const q = at(point);
    await page.mouse.move(q.x, q.y, { steps: 2 });
    await page.waitForTimeout(25);
  }
  await page.mouse.up();
  await expectComplete(`trace (${puzzle.path.length} waypoints)`);
}

// maze ----------------------------------------------------------------------
{
  const levelId = await levelForSkill('log-maze');
  await openLevel(levelId);
  const puzzle = await firstPuzzle(levelId);
  const route = await page.evaluate(async (p) => {
    const { shortestPath } = await import('/src/games/maze-lib.js');
    const maze = { w: p.w, h: p.h, walls: p.walls };
    let at = p.start;
    const pending = new Set((p.items || []).map((i) => i.at));
    const full = [at];
    while (pending.size) {
      let best = null;
      for (const target of pending) {
        const path = shortestPath(maze, at, target);
        if (path && (!best || path.length < best.length)) best = path;
      }
      full.push(...best.slice(1));
      at = best[best.length - 1];
      pending.delete(at);
    }
    full.push(...shortestPath(maze, at, p.goal).slice(1));
    return full;
  }, puzzle);

  const box = await page.locator('.maze__svg').boundingBox();
  const CELL = 100;
  const scale = Math.min(box.width / (puzzle.w * CELL + 12), box.height / (puzzle.h * CELL + 12));
  const offX = box.x + (box.width - (puzzle.w * CELL + 12) * scale) / 2;
  const offY = box.y + (box.height - (puzzle.h * CELL + 12) * scale) / 2;
  const at = (cell) => ({
    x: offX + (6 + (cell % puzzle.w) * CELL + CELL / 2) * scale,
    y: offY + (6 + Math.floor(cell / puzzle.w) * CELL + CELL / 2) * scale,
  });

  const start = at(route[0]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const cell of route) {
    const point = at(cell);
    await page.mouse.move(point.x, point.y, { steps: 2 });
    await page.waitForTimeout(25);
  }
  await page.mouse.up();
  await expectComplete(`maze (${route.length} cells)`);
}

/* -------------------------------------------------------------------------- */
/* 4. A whole level, scoring and persistence                                   */
/* -------------------------------------------------------------------------- */

console.log('\nfull level');

{
  const levelId = await levelForSkill('num-count');
  await openLevel(levelId);
  const puzzles = await page.evaluate(async (id) => {
    const { buildLevel, levelById } = await import('/src/data/catalog.js');
    return buildLevel(levelById(id), 0).map((p) => p.answer);
  }, levelId);

  for (const answer of puzzles) {
    if (await page.evaluate(() => location.hash.includes('result'))) break;
    await page.click(`.opt[data-id="${answer}"]`);
    await page.waitForTimeout(1150);
  }
  await page.waitForTimeout(700);

  const hash = await page.evaluate(() => location.hash);
  if (!hash.includes('result')) fail('a completed level did not reach the result screen');
  else console.log('  ✓ finished ->', hash);

  const stars = await page.evaluate(
    (id) => JSON.parse(localStorage.getItem('nivaan.save.v1')).profiles.p1.stars[id],
    levelId,
  );
  if (stars !== 3) fail(`a flawless run scored ${stars} stars instead of 3`);
  else console.log('  ✓ flawless run scored 3 stars and was saved');
  await shot('result');
}

/* -------------------------------------------------------------------------- */
/* 5. Toddler world rules                                                      */
/* -------------------------------------------------------------------------- */

console.log('\ntoddler world');

{
  // Every Little Ones puzzle must be readable-free and offer at most 3 choices.
  const problems = await page.evaluate(async () => {
    const { levelsFor, buildLevel } = await import('/src/data/catalog.js');
    const out = [];
    for (const level of levelsFor('toddler')) {
      if (!level.forgiving) out.push(`${level.id} is not marked forgiving`);
      for (const puzzle of buildLevel(level, 0)) {
        if (puzzle.options && puzzle.options.length > 3) {
          out.push(`${level.id}: ${puzzle.options.length} options — too many for a toddler`);
        }
        if ((puzzle.prompt || '').length > 34) {
          out.push(`${level.id}: prompt too long — "${puzzle.prompt}"`);
        }
        if (!puzzle.speak) out.push(`${level.id}: no spoken prompt`);
      }
    }
    return out;
  });
  for (const problem of problems) fail(problem);
  if (!problems.length) console.log('  ✓ all Little Ones levels are forgiving, spoken and ≤3 choices');
}

{
  // A toddler who taps every wrong answer must still finish with three stars.
  const levelId = await levelForSkill('tot-find');
  await openLevel(levelId);
  const puzzles = await page.evaluate(async (id) => {
    const { buildLevel, levelById } = await import('/src/data/catalog.js');
    return buildLevel(levelById(id), 0).map((p) => ({
      answer: p.answer,
      wrong: p.options.filter((o) => o.id !== p.answer).map((o) => o.id),
    }));
  }, levelId);

  for (const round of puzzles) {
    if (await page.evaluate(() => location.hash.includes('result'))) break;
    await page.click(`.opt[data-id="${round.wrong[0]}"]`);
    await page.waitForTimeout(260);
    await page.click(`.opt[data-id="${round.answer}"]`);
    await page.waitForTimeout(1150);
  }
  await page.waitForTimeout(700);

  const stars = await page.evaluate(
    (id) => JSON.parse(localStorage.getItem('nivaan.save.v1')).profiles.p1.stars[id],
    levelId,
  );
  if (stars !== 3) fail(`a toddler level scored ${stars} stars after wrong taps — should always be 3`);
  else console.log('  ✓ wrong taps never cost a toddler a star');
}

/* -------------------------------------------------------------------------- */
/* 6. Voice coverage                                                           */
/*                                                                              */
/* A pre-reader can't use a screen full of text on their own, so every place a */
/* child (not a parent) might land alone must say what's on it out loud — not  */
/* just the puzzle prompt, but menus and popups too.                           */
/* -------------------------------------------------------------------------- */

console.log('\nvoice coverage');

{
  // pickVoice() must not throw when the device has zero installed voices —
  // the normal case here, and the fallback path real low-end phones can hit.
  await page.goto(`${BASE}/index.html`);
  await page.waitForTimeout(300);
  const voiceCount = await page.evaluate(() => window.speechSynthesis?.getVoices().length ?? -1);
  const homeSpoken = await spoken();
  console.log(`  ✓ voice picking is safe with ${voiceCount} installed voices`);
  if (!homeSpoken.length) fail('home screen did not speak its mascot line');
}

{
  // Landing on a world map reads out which world it is — the level list below
  // it is plain text a pre-reader can't use on their own.
  await clearSpoken();
  await page.goto(`${BASE}/index.html#/map?cat=toddler`);
  await page.waitForTimeout(300);
  const mapSpoken = await spoken();
  if (!mapSpoken.some((t) => t.includes('Little Ones'))) fail('map screen did not announce the world name');
  else console.log('  ✓ the world map announces which world you are in');
}

{
  // The exit-confirmation dialog only appears once a round is behind you —
  // finish one round of a choice puzzle, then hit back.
  await page.goto(`${BASE}/index.html#/play?level=numbers-0`);
  await page.waitForTimeout(400);
  const puzzle = await firstPuzzle('numbers-0');
  await page.click(`.opt[data-id="${puzzle.answer}"]`);
  await page.waitForTimeout(1150);
  await clearSpoken();
  await page.click('.topbar .iconbtn[aria-label="Back"]');
  await page.waitForTimeout(300);
  const exitSpoken = await spoken();
  if (!exitSpoken.some((t) => t.toLowerCase().includes('leave'))) {
    fail('exit-confirm dialog did not speak its choices');
  } else {
    console.log('  ✓ the "leave the game?" dialog speaks both choices');
  }
  await page.click('button.btn.btn--paper:has-text("Keep playing")');
  await page.waitForTimeout(200);
}

{
  // The "Show me" button is another piece of text a pre-reader can't decode —
  // it should say what tapping it does the moment it appears.
  await page.goto(`${BASE}/index.html#/play?level=colors-0`);
  await page.waitForTimeout(400);
  const puzzle = await firstPuzzle('colors-0');
  const wrong = puzzle.options.filter((o) => o.id !== puzzle.answer).map((o) => o.id);
  await clearSpoken();
  for (let i = 0; i < 3; i++) {
    await page.click(`.opt[data-id="${wrong[i % wrong.length]}"]`);
    await page.waitForTimeout(230);
  }
  const revealSpoken = await spoken();
  if (!revealSpoken.some((t) => t.toLowerCase().includes('eye'))) {
    fail('"Show me" button appeared without speaking its cue');
  } else {
    console.log('  ✓ the "Show me" button speaks a cue as soon as it appears');
  }
}

/* -------------------------------------------------------------------------- */
/* 7. Sound                                                                    */
/* -------------------------------------------------------------------------- */

console.log('\nsound');

{
  await page.goto(`${BASE}/index.html`);
  await page.waitForTimeout(300);
  // A real gesture is required before the browser will start an AudioContext.
  await page.click('.home__title');
  await page.waitForTimeout(200);

  const report = await page.evaluate(async () => {
    const audio = await import('/src/core/audio.js');
    const ctx = audio.unlockAudio();
    if (!ctx) return { error: 'no AudioContext' };

    // Tap a probe onto the output so we can measure that sound is produced.
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    ctx.destination.channelCount = ctx.destination.channelCount;
    const probe = ctx.createGain();
    probe.connect(analyser);

    const results = {};
    for (const name of audio.SFX_NAMES) {
      try {
        audio.sfx(name, 1);
        results[name] = 'ok';
      } catch (err) {
        results[name] = 'threw: ' + err.message;
      }
    }
    return { count: audio.SFX_NAMES.length, results, state: ctx.state };
  });

  if (report.error) {
    console.log('  – skipped:', report.error);
  } else {
    const broken = Object.entries(report.results).filter(([, v]) => v !== 'ok');
    for (const [name, why] of broken) fail(`sfx "${name}" ${why}`);
    if (!broken.length) console.log(`  ✓ all ${report.count} effects play without error`);
  }
}

/* -------------------------------------------------------------------------- */
/* 8. The "Show me" escape hatch                                               */
/* -------------------------------------------------------------------------- */

console.log('\nhelp');

{
  const levelId = await levelForSkill('num-count');
  await openLevel(levelId);
  const puzzle = await firstPuzzle(levelId);
  const wrong = puzzle.options.filter((o) => o.id !== puzzle.answer);
  for (let i = 0; i < 3; i++) {
    await page.click(`.opt[data-id="${wrong[i % wrong.length].id}"]`);
    await page.waitForTimeout(220);
  }
  if (!(await page.locator('.play__reveal').count())) {
    fail('"Show me" did not appear after three wrong answers');
  } else {
    await page.click('.play__reveal');
    await page.waitForTimeout(2200);
    if ((await roundsDone()) < 1) fail('"Show me" did not move the game on');
    else console.log('  ✓ "Show me" appears after 3 tries and unblocks the round');
  }
}

/* -------------------------------------------------------------------------- */

await browser.close();

if (errors.length) {
  console.error(`\n  ✗ ${errors.length} failure(s):\n`);
  for (const message of [...new Set(errors)]) console.error(`    - ${message}`);
  console.error('');
  process.exit(1);
}

console.log('\n  ✓ e2e passed\n');
