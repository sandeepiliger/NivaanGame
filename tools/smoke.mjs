/**
 * Smoke tests.
 *
 * Generates every level of every skill at every tier (and several replay
 * variants of each) and asserts that the resulting puzzle is well-formed and
 * actually solvable. This is the safety net that stops a bad generator from
 * shipping a level a child cannot finish.
 *
 *   npm test
 */

import { CATEGORIES, levelsFor, buildLevel, buildDailyChallenge } from '../src/data/catalog.js';
import { RENDERERS } from '../src/engine/session.js';
import { dragDropIsSolvable } from '../src/engine/renderers/dragdrop.js';
import { mazeIsSolvable } from '../src/games/maze-lib.js';
import { solveProgram } from '../src/games/coder-lib.js';
import { SFX_NAMES } from '../src/core/audio.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let checks = 0;
const failures = [];

function fail(context, message) {
  failures.push(`${context}: ${message}`);
}

function assert(condition, context, message) {
  checks += 1;
  if (!condition) fail(context, message);
}

/* -------------------------------------------------------------------------- */
/* Per-type validation                                                         */
/* -------------------------------------------------------------------------- */

const VALIDATORS = {
  choice(p, ctx) {
    assert(Array.isArray(p.options) && p.options.length >= 2, ctx, 'needs at least 2 options');
    const ids = p.options.map((o) => o.id);
    assert(new Set(ids).size === ids.length, ctx, 'option ids must be unique');
    assert(ids.includes(p.answer), ctx, `answer "${p.answer}" is not an option`);
    for (const option of p.options) {
      assert(Boolean(option.visual), ctx, `option ${option.id} has no visual`);
    }
    // Two options that look identical would make the puzzle ambiguous.
    const rendered = p.options.map((o) => JSON.stringify(o.visual));
    const answerVisual = rendered[ids.indexOf(p.answer)];
    const duplicates = rendered.filter((r) => r === answerVisual).length;
    assert(duplicates === 1, ctx, 'another option looks identical to the answer');
  },

  multi(p, ctx) {
    assert(Array.isArray(p.answers) && p.answers.length >= 1, ctx, 'needs answers');
    const ids = p.options.map((o) => o.id);
    for (const a of p.answers) assert(ids.includes(a), ctx, `answer "${a}" is not an option`);
  },

  dragdrop(p, ctx) {
    assert(p.items?.length > 0, ctx, 'needs items');
    assert(p.targets?.length > 0, ctx, 'needs targets');
    const itemIds = p.items.map((i) => i.id);
    assert(new Set(itemIds).size === itemIds.length, ctx, 'item ids must be unique');
    const targetIds = p.targets.map((t) => t.id);
    assert(new Set(targetIds).size === targetIds.length, ctx, 'target ids must be unique');
    for (const target of p.targets) {
      for (const accepted of target.accepts || []) {
        assert(
          accepted === '*' || itemIds.includes(accepted),
          ctx,
          `target ${target.id} accepts unknown item "${accepted}"`,
        );
      }
    }
    assert(dragDropIsSolvable(p), ctx, 'is not solvable');

    // The round only ends when `required` placements happen, so make sure that
    // number is actually reachable.
    const bins = (p.layout || 'bins') === 'bins';
    const capacity = (t) => t.capacity ?? (bins ? Infinity : 1);
    const required =
      p.requires ??
      (bins
        ? p.items.length
        : p.targets.reduce((s, t) => s + (Number.isFinite(capacity(t)) ? capacity(t) : 1), 0));
    assert(required > 0, ctx, 'requires zero placements — would finish instantly');
    assert(required <= p.items.length, ctx, 'requires more placements than there are items');
  },

  order(p, ctx) {
    assert(p.items?.length >= 2, ctx, 'needs at least 2 items');
    assert(Array.isArray(p.answer) && p.answer.length === p.items.length, ctx, 'answer length must match items');
    const ids = new Set(p.items.map((i) => i.id));
    assert(ids.size === p.items.length, ctx, 'item ids must be unique');
    for (const a of p.answer) assert(ids.has(a), ctx, `answer references unknown item "${a}"`);
    assert(new Set(p.answer).size === p.answer.length, ctx, 'answer has duplicates');
  },

  memory(p, ctx) {
    assert(p.pairs?.length >= 2, ctx, 'needs at least 2 pairs');
    const ids = p.pairs.map((x) => x.id);
    assert(new Set(ids).size === ids.length, ctx, 'pair ids must be unique');
    for (const pair of p.pairs) {
      assert(Boolean(pair.a && pair.b), ctx, `pair ${pair.id} is missing a face`);
    }
    // Two pairs whose faces render identically would be indistinguishable.
    const faces = p.pairs.map((x) => JSON.stringify(x.a));
    assert(new Set(faces).size === faces.length, ctx, 'two pairs share the same front face');
  },

  maze(p, ctx) {
    assert(p.w > 1 && p.h > 1, ctx, 'grid too small');
    assert(p.walls?.length === p.w * p.h, ctx, 'walls array has the wrong length');
    assert(p.start !== p.goal, ctx, 'start and goal are the same cell');
    for (const item of p.items || []) {
      assert(item.at !== p.start && item.at !== p.goal, ctx, 'pickup sits on the start or goal');
    }
    assert(mazeIsSolvable(p), ctx, 'maze is not solvable');
  },

  coder(p, ctx) {
    assert(p.w > 0 && p.h > 0, ctx, 'grid too small');
    assert(!p.blocks?.includes(p.start), ctx, 'robot starts inside a block');
    assert(!p.blocks?.includes(p.goal), ctx, 'goal is inside a block');
    const solution = solveProgram(p);
    assert(Boolean(solution), ctx, 'no program can solve this board');
    if (solution) {
      assert(
        solution.length <= p.maxSteps,
        ctx,
        `shortest program (${solution.length}) exceeds maxSteps (${p.maxSteps})`,
      );
    }
  },

  sudoku(p, ctx) {
    const n = p.size;
    assert(p.given?.length === n * n, ctx, 'given grid has the wrong size');
    assert(p.solution?.length === n * n, ctx, 'solution grid has the wrong size');
    assert(p.symbols?.length === n, ctx, 'needs one symbol per value');
    const rendered = (p.symbols || []).map((s) => JSON.stringify(s));
    assert(new Set(rendered).size === rendered.length, ctx, 'two symbols look identical');
    assert(p.given.some((v) => v === 0), ctx, 'puzzle is already complete');

    for (let i = 0; i < n * n; i++) {
      assert(
        p.given[i] === 0 || p.given[i] === p.solution[i],
        ctx,
        `clue at ${i} contradicts the solution`,
      );
    }

    // Rows, columns and boxes must each contain every value exactly once.
    for (let r = 0; r < n; r++) {
      const row = new Set(p.solution.slice(r * n, r * n + n));
      assert(row.size === n, ctx, `row ${r} has repeats`);
      const col = new Set(Array.from({ length: n }, (_, k) => p.solution[k * n + r]));
      assert(col.size === n, ctx, `column ${r} has repeats`);
    }
    for (let by = 0; by < n / p.boxH; by++) {
      for (let bx = 0; bx < n / p.boxW; bx++) {
        const box = new Set();
        for (let dy = 0; dy < p.boxH; dy++) {
          for (let dx = 0; dx < p.boxW; dx++) {
            box.add(p.solution[(by * p.boxH + dy) * n + bx * p.boxW + dx]);
          }
        }
        assert(box.size === n, ctx, `box ${bx},${by} has repeats`);
      }
    }
    assert(countSolutions(p) === 1, ctx, 'puzzle does not have a unique solution');
  },

  symmetry(p, ctx) {
    assert(p.target?.length === p.w * p.h, ctx, 'target grid has the wrong size');
    assert(p.locked?.length === p.w * p.h, ctx, 'locked grid has the wrong size');
    const todo = p.target.filter((v, i) => !p.locked[i] && v !== 0).length;
    assert(todo > 0, ctx, 'nothing left to fill in — would finish instantly');
    for (const v of p.target) {
      assert(v >= 0 && v <= p.palette.length, ctx, `colour index ${v} is out of range`);
    }
    // Verify the target really is symmetrical about the stated axis.
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        const mirrored =
          p.axis === 'v' ? y * p.w + (p.w - 1 - x) : (p.h - 1 - y) * p.w + x;
        assert(p.target[y * p.w + x] === p.target[mirrored], ctx, 'target is not symmetrical');
      }
    }
  },

  tapcount(p, ctx) {
    assert(p.scene?.length > 0, ctx, 'scene is empty');
    assert(p.targets?.length > 0, ctx, 'nothing to find');
    for (const i of p.targets) {
      assert(i >= 0 && i < p.scene.length, ctx, `target index ${i} is out of range`);
    }
    assert(new Set(p.targets).size === p.targets.length, ctx, 'duplicate target indices');
    assert(p.targets.length < p.scene.length, ctx, 'every object is a target — no searching needed');
    for (const item of p.scene) {
      assert(item.x >= 0 && item.x <= 100 && item.y >= 0 && item.y <= 100, ctx, 'object is off-scene');
    }
  },

  pop(p, ctx) {
    assert(p.bubbles?.length >= 2, ctx, 'needs at least 2 bubbles');
    const targets = p.popAll === false ? p.targets || [] : p.bubbles.map((_, i) => i);
    assert(targets.length > 0, ctx, 'nothing to pop');
    for (const i of targets) {
      assert(i >= 0 && i < p.bubbles.length, ctx, `target index ${i} is out of range`);
    }
    for (const b of p.bubbles) {
      assert(b.x >= 0 && b.x <= 100 && b.y >= 0 && b.y <= 100, ctx, 'bubble is off-scene');
    }
    // Bubbles are ~22% wide, so their centres must not sit on top of each other.
    for (let i = 0; i < p.bubbles.length; i++) {
      for (let k = i + 1; k < p.bubbles.length; k++) {
        const d = Math.hypot(p.bubbles[i].x - p.bubbles[k].x, p.bubbles[i].y - p.bubbles[k].y);
        assert(d > 14, ctx, `bubbles ${i} and ${k} overlap (${d.toFixed(1)} apart)`);
      }
    }
  },

  trace(p, ctx) {
    assert(p.path?.length >= 3, ctx, 'needs at least 3 waypoints');
    for (const point of p.path) {
      assert(
        point.x >= 2 && point.x <= 98 && point.y >= 2 && point.y <= 98,
        ctx,
        'a waypoint is off-canvas',
      );
    }
    // Consecutive waypoints must be inside the 11-unit reach, or the trail
    // breaks and the child cannot finish; but not so close they all trigger
    // from one touch.
    for (let i = 1; i < p.path.length; i++) {
      const d = Math.hypot(p.path[i].x - p.path[i - 1].x, p.path[i].y - p.path[i - 1].y);
      assert(d <= 11, ctx, `waypoints ${i - 1}→${i} are ${d.toFixed(1)} apart — out of reach`);
      assert(d >= 3, ctx, `waypoints ${i - 1}→${i} are ${d.toFixed(1)} apart — too close`);
    }
  },

  connect(p, ctx) {
    assert(p.dots?.length >= 3, ctx, 'needs at least 3 dots');
    for (const dot of p.dots) {
      assert(dot.x >= 0 && dot.x <= 100 && dot.y >= 0 && dot.y <= 100, ctx, 'dot is off-canvas');
    }
    // Dots must be far enough apart that the 6-unit hit radius cannot overlap.
    for (let i = 0; i < p.dots.length; i++) {
      for (let k = i + 1; k < p.dots.length; k++) {
        const d = Math.hypot(p.dots[i].x - p.dots[k].x, p.dots[i].y - p.dots[k].y);
        assert(d > 6, ctx, `dots ${i} and ${k} overlap (${d.toFixed(1)} units apart)`);
      }
    }
  },
};

function countSolutions(p, limit = 2) {
  const { size: n, boxW, boxH } = p;
  const grid = p.given.slice();
  let found = 0;
  const ok = (index, value) => {
    const x = index % n;
    const y = Math.floor(index / n);
    for (let i = 0; i < n; i++) {
      if (grid[y * n + i] === value || grid[i * n + x] === value) return false;
    }
    const bx = Math.floor(x / boxW) * boxW;
    const by = Math.floor(y / boxH) * boxH;
    for (let dy = 0; dy < boxH; dy++) {
      for (let dx = 0; dx < boxW; dx++) {
        if (grid[(by + dy) * n + bx + dx] === value) return false;
      }
    }
    return true;
  };
  const step = () => {
    const index = grid.indexOf(0);
    if (index === -1) return ++found >= limit;
    for (let v = 1; v <= n; v++) {
      if (!ok(index, v)) continue;
      grid[index] = v;
      if (step()) return true;
      grid[index] = 0;
    }
    return false;
  };
  step();
  return found;
}

/* -------------------------------------------------------------------------- */
/* Generic checks                                                              */
/* -------------------------------------------------------------------------- */

function checkPuzzle(puzzle, ctx) {
  assert(Boolean(puzzle), ctx, 'generator returned nothing');
  if (!puzzle) return;
  assert(typeof puzzle.type === 'string', ctx, 'missing type');
  assert(Boolean(RENDERERS[puzzle.type]), ctx, `no renderer for type "${puzzle.type}"`);
  assert(
    typeof puzzle.prompt === 'string' && puzzle.prompt.length > 0,
    ctx,
    'missing prompt',
  );
  assert(
    !puzzle.hint || typeof puzzle.hint === 'string',
    ctx,
    'hint must be a string',
  );

  const validator = VALIDATORS[puzzle.type];
  if (validator) validator(puzzle, ctx);
}

/* -------------------------------------------------------------------------- */
/* Run                                                                         */
/* -------------------------------------------------------------------------- */

const VARIANTS = Number(process.env.VARIANTS || 3);

console.log('\nBrainySparks — smoke tests\n');

let levelCount = 0;
let puzzleCount = 0;
const byType = new Map();
const started = Date.now();

for (const category of CATEGORIES) {
  const levels = levelsFor(category.id);
  assert(levels.length > 0, category.id, 'category has no levels');

  for (const level of levels) {
    levelCount += 1;
    for (let variant = 0; variant < VARIANTS; variant++) {
      let puzzles;
      try {
        puzzles = buildLevel(level, variant);
      } catch (err) {
        fail(`${level.id} v${variant}`, `threw while generating: ${err.message}`);
        continue;
      }
      assert(
        puzzles.length === level.rounds,
        `${level.id} v${variant}`,
        `expected ${level.rounds} rounds, got ${puzzles.length}`,
      );
      puzzles.forEach((puzzle, i) => {
        puzzleCount += 1;
        byType.set(puzzle.type, (byType.get(puzzle.type) || 0) + 1);
        checkPuzzle(puzzle, `${level.id} v${variant} r${i} [${level.skillId} t${level.tier}]`);
      });
    }
  }
}

// The daily challenge draws from every skill, so exercise a spread of dates.
for (let d = 0; d < 14; d++) {
  const dateKey = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
  let puzzles;
  try {
    puzzles = buildDailyChallenge(dateKey);
  } catch (err) {
    fail(`daily ${dateKey}`, `threw while generating: ${err.message}`);
    continue;
  }
  puzzles.forEach((puzzle, i) => {
    puzzleCount += 1;
    byType.set(puzzle.type, (byType.get(puzzle.type) || 0) + 1);
    checkPuzzle(puzzle, `daily ${dateKey} r${i}`);
  });
}

/* -------------------------------------------------------------------------- */

const skillCount = CATEGORIES.reduce((sum, c) => sum + c.skills.length, 0);
console.log(`  categories : ${CATEGORIES.length}`);
console.log(`  skills     : ${skillCount}`);
console.log(`  levels     : ${levelCount}`);
console.log(`  puzzles    : ${puzzleCount} (${VARIANTS} variants per level)`);
console.log(`  assertions : ${checks}`);
console.log(`  elapsed    : ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log('\n  puzzle types exercised:');
for (const [type, count] of Array.from(byType).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${type.padEnd(10)} ${count}`);
}

/* -------------------------------------------------------------------------- */
/* Sound: every sfx() call must name an effect that exists                     */
/* -------------------------------------------------------------------------- */

const sourceFiles = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (full.endsWith('.js')) sourceFiles.push(full);
  }
})(join(process.cwd(), 'src'));

const usedSfx = new Set();
for (const file of sourceFiles) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/\bsfx\(\s*'([a-zA-Z]+)'/g)) {
    usedSfx.add(match[1]);
    assert(
      SFX_NAMES.includes(match[1]),
      file.replace(/.*\/src\//, 'src/'),
      `sfx("${match[1]}") is not a real effect`,
    );
  }
}
console.log(`\n  sound effects: ${SFX_NAMES.length} defined, ${usedSfx.size} used`);

// Every renderer must be reachable through real content.
for (const type of Object.keys(RENDERERS)) {
  if (type === 'multi') continue; // shares the choice renderer; optional content
  if (!byType.has(type)) fail('coverage', `no generated puzzle uses the "${type}" renderer`);
}

if (failures.length) {
  console.error(`\n  ✗ ${failures.length} failure(s):\n`);
  for (const message of failures.slice(0, 40)) console.error(`    - ${message}`);
  if (failures.length > 40) console.error(`    … and ${failures.length - 40} more`);
  console.error('');
  process.exit(1);
}

console.log('\n  ✓ all checks passed\n');
