/**
 * The play screen — runs one level from start to finish.
 */

import { h, clear, announce, wait } from '../core/dom.js';
import { go, back } from '../core/router.js';
import { sfx, speak, haptic, unlockAudio } from '../core/audio.js';
import { confetti, floatText, toast } from '../core/fx.js';
import { createSession, mountPuzzle } from '../engine/session.js';
import { buildLevel, buildDailyChallenge, levelById, categoryById, todayKey } from '../data/catalog.js';
import {
  recordLevel,
  settings,
  startPlayClock,
  playClockMinutes,
  resetPlayClock,
} from '../core/store.js';
import { PRAISE, NUDGE, TODDLER_PRAISE } from '../data/content.js';
import { showBreakReminder } from './dialogs.js';

/** Wrong answers on one round before we offer to show the answer. */
const REVEAL_AFTER = 3;

export function playScreen(params) {
  const isDaily = params.daily === '1';
  const level = isDaily ? null : levelById(params.level);

  if (!isDaily && !level) {
    return { el: h('div.screen.center', h('p', { style: { color: '#fff' } }, 'Level not found.')) };
  }

  const category = isDaily ? null : categoryById(level.categoryId);
  const variant = Number(params.v || 0);
  const puzzles = isDaily ? buildDailyChallenge(todayKey()) : buildLevel(level, variant);

  /** Toddler levels never punish a wrong tap — see the Little Ones world. */
  const forgiving = Boolean(level?.forgiving);

  const session = createSession({
    puzzles,
    levelId: isDaily ? `daily-${todayKey()}` : level.id,
    seed: (isDaily ? 'daily' : level.id) + '|' + variant,
    forgiving,
  });

  const theme = category?.color || '#6c4ce0';
  const edge = category?.edge || '#4a2fb0';

  /* --- chrome ----------------------------------------------------------- */

  const pips = h('div.play__pips');
  const barFill = h('div.bar__fill');
  const promptEl = h('div.play__prompt');
  // Renderers make their own, more specific sounds.
  const bodyHost = h('div.play__host.grow', { 'data-quiet': '' });
  const hintBtn = h(
    'button.iconbtn.play__hint',
    { type: 'button', 'aria-label': 'Hint', onclick: useHint },
    '💡',
  );
  const speakBtn = h(
    'button.iconbtn.play__speak',
    { type: 'button', 'aria-label': 'Say it again', onclick: () => sayPrompt(true) },
    '🔊',
  );

  const el = h(
    'div.screen.play',
    { style: { '--theme': theme, '--edge': edge } },
    h(
      'div.topbar.play__top',
      h('button.iconbtn', { type: 'button', 'aria-label': 'Back', onclick: confirmExit }, '✕'),
      h('div.grow.play__meter', h('div.bar', barFill), pips),
      hintBtn,
    ),
    h('div.play__promptrow', promptEl, speakBtn),
    bodyHost,
  );

  let active = null;
  let advancing = false;
  /** Consecutive clean rounds — the praise flourish climbs with it. */
  let streak = 0;

  /* --- rounds ----------------------------------------------------------- */

  function drawPips() {
    clear(pips);
    for (let i = 0; i < session.total; i++) {
      pips.appendChild(
        h(
          'span.play__pip' +
            (i < session.state.index ? '.play__pip--done' : '') +
            (i === session.state.index ? '.play__pip--now' : ''),
        ),
      );
    }
    barFill.style.width = (session.state.index / session.total) * 100 + '%';
  }

  function sayPrompt(force = false) {
    const puzzle = session.puzzle;
    if (!puzzle) return;
    speak(puzzle.speak || puzzle.prompt, force ? { force: true } : {});
  }

  function renderRound() {
    active?.destroy?.();
    const puzzle = session.puzzle;
    if (!puzzle) return;

    promptEl.textContent = puzzle.prompt || '';
    announce(puzzle.prompt || '');
    drawPips();
    hintBtn.classList.remove('play__hint--urgent');
    hintBtn.disabled = false;

    const api = {
      rng: session.rng,
      correct: onCorrect,
      wrong: onWrong,
      partial: () => {},
      note: (msg) => toast(msg, 1600),
    };

    try {
      active = mountPuzzle(puzzle, api);
    } catch (err) {
      console.error('[play] failed to mount puzzle', puzzle, err);
      // Never trap a child on a broken round — skip forward.
      toast('Skipping this one!');
      setTimeout(nextRound, 400);
      return;
    }

    clear(bodyHost);
    bodyHost.appendChild(active.el);
    active.el.classList.add('play__body--in');
    sayPrompt();
  }

  async function onCorrect({ from } = {}) {
    if (advancing) return;
    advancing = true;
    session.recordCorrect();

    const clean = session.state.rounds[session.state.index].wrong === 0;
    streak = clean ? streak + 1 : 0;

    sfx('correct', streak - 1);
    if (streak >= 3) sfx('sparkle');
    haptic([12, 30, 12]);

    const lines = forgiving ? TODDLER_PRAISE : PRAISE;
    const praise = lines[Math.floor(session.rng.next() * lines.length)];
    if (from) floatText(streak >= 3 ? `${streak}× ⭐` : '⭐', from, '#ffcc29');
    confetti({ from: from || bodyHost, count: streak >= 3 ? 40 : 26 });
    showFlash(praise, 'good');
    speak(praise);

    await wait(900);
    nextRound();
  }

  function onWrong() {
    session.recordWrong();
    streak = 0;
    const round = session.state.rounds[session.state.index];
    const nudge = forgiving
      ? 'Try another one!'
      : NUDGE[Math.floor(session.rng.next() * NUDGE.length)];
    showFlash(nudge, forgiving ? 'soft' : 'bad');

    // Toddlers get help sooner, and a nudge rather than a "wrong" banner.
    const revealAfter = forgiving ? 2 : REVEAL_AFTER;
    if (round.wrong >= revealAfter - 1) hintBtn.classList.add('play__hint--urgent');
    if (round.wrong >= revealAfter && !round.revealed) offerReveal();
  }

  function nextRound() {
    advancing = false;
    if (session.next()) {
      renderRound();
      maybeBreak();
    } else {
      finish();
    }
  }

  /* --- help ------------------------------------------------------------- */

  function useHint() {
    if (!active?.hint) return;
    const used = active.hint();
    if (!used) {
      toast('You are nearly there!');
      return;
    }
    session.recordHint();
    sfx('whoosh');
    const puzzle = session.puzzle;
    if (puzzle?.hint) {
      toast(puzzle.hint, 3000);
      speak(puzzle.hint);
    }
  }

  function offerReveal() {
    if (document.querySelector('.play__reveal')) return;
    // A pre-reader can't decode "Show me" on the button, so say what it does
    // the moment it appears.
    speak('If you tap the eye, I will show you the answer!');
    const btn = h(
      'button.btn.btn--paper.play__reveal',
      {
        type: 'button',
        onclick: () => {
          btn.remove();
          session.recordReveal();
          active?.solve?.();
          speak('Here is the answer. Let’s keep going!');
          setTimeout(() => {
            if (!advancing) {
              advancing = true;
              setTimeout(nextRound, 700);
            }
          }, 900);
        },
      },
      '👀 Show me',
    );
    el.appendChild(btn);
    setTimeout(() => btn.classList.add('play__reveal--in'), 20);
  }

  let flashTimer = 0;
  function showFlash(text, kind) {
    document.querySelector('.play__flash')?.remove();
    const node = h('div.play__flash.play__flash--' + kind, text);
    el.appendChild(node);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => node.remove(), kind === 'good' ? 1000 : 1400);
  }

  /* --- exit & finish ---------------------------------------------------- */

  function confirmExit() {
    if (session.state.index === 0 && session.state.correct === 0) {
      back(category ? 'map' : 'home');
      return;
    }
    import('./dialogs.js').then(({ confirmDialog }) => {
      confirmDialog({
        title: 'Leave the game?',
        text: 'Your stars for this level will not be saved.',
        confirmLabel: 'Leave',
        cancelLabel: 'Keep playing',
        // A child hitting the back button unassisted can't read this dialog,
        // so say both choices aloud as soon as it opens.
        speak: 'Do you want to leave? Your stars will not be saved. Or tap Keep Playing to stay!',
        onConfirm: () => (category ? go('map', { cat: category.id }) : go('home')),
      });
    });
  }

  function finish() {
    const summary = session.summary();
    if (!isDaily) {
      recordLevel(level.id, { ...summary, skillId: level.skillId });
    }
    sfx('win');
    go('result', {
      level: isDaily ? '' : level.id,
      daily: isDaily ? '1' : '',
      stars: summary.stars,
      correct: summary.correct,
      wrong: summary.wrong,
      hints: summary.hints,
      ms: summary.ms,
    }, { replace: true });
  }

  function maybeBreak() {
    const limit = settings().breakAfterMin;
    if (!limit) return;
    if (playClockMinutes() < limit) return;
    resetPlayClock();
    showBreakReminder();
  }

  /* --- lifecycle -------------------------------------------------------- */

  return {
    el,
    onEnter() {
      // NOT unlockVoice() here: reaching this screen via a deep link (no
      // prior tap) would consume the one-shot warm-up without a real
      // gesture behind it. main.js's global first-gesture listener is the
      // only place that call belongs; reaching Play normally (tapping a
      // level) already triggers that listener before this ever runs.
      unlockAudio();
      startPlayClock();
      renderRound();
    },
    onLeave() {
      active?.destroy?.();
      document.querySelector('.play__flash')?.remove();
      document.querySelector('.play__reveal')?.remove();
    },
  };
}

