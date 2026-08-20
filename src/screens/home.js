/**
 * Home screen — pick a category, see progress, jump into the daily challenge.
 */

import { h } from '../core/dom.js';
import { go, href } from '../core/router.js';
import { CATEGORIES, levelsFor, totalLevels } from '../data/catalog.js';
import { profile, totalStars, completedCount, starsFor, settings, setSetting } from '../core/store.js';
import { MASCOT_LINES } from '../data/content.js';
import { mascot, speechBubble } from '../ui/mascot.js';
import { sfx, speak, unlockAudio, unlockVoice, syncMusic } from '../core/audio.js';
import { parentGate } from './dialogs.js';

export function homeScreen() {
  const me = profile();
  const line = MASCOT_LINES[Math.floor(Math.random() * MASCOT_LINES.length)];

  const categoryCards = CATEGORIES.map((category) => {
    const levels = levelsFor(category.id);
    const done = levels.filter((l) => starsFor(l.id) > 0).length;
    const pct = Math.round((done / levels.length) * 100);

    return h(
      'a.catcard',
      {
        href: href('map', { cat: category.id }),
        style: { '--c': category.color, '--e': category.edge, '--ink': category.ink },
      },
      h('span.catcard__emoji', category.emoji),
      h(
        'span.catcard__body',
        h('span.catcard__name', category.name),
        h('span.catcard__tag', category.tagline),
        h(
          'span.catcard__meter',
          h('span.catcard__meterfill', { style: { width: pct + '%' } }),
        ),
        h('span.catcard__count', `${done} / ${levels.length} levels`),
      ),
      h('span.catcard__go', '▶'),
    );
  });

  const el = h(
    'div.screen.home',
    h(
      'div.topbar',
      h(
        'button.home__profile',
        { type: 'button', onclick: () => go('profiles') },
        h('span.home__avatar', me.avatar),
        h('span.home__name', me.name),
      ),
      h('div.grow'),
      soundToggle(),
      h(
        'button.iconbtn',
        { type: 'button', 'aria-label': 'Grown-ups', onclick: () => parentGate(() => go('parents')) },
        '⚙️',
      ),
    ),
    h(
      'div.screen__scroll',
      h(
        'header.home__hero',
        mascot({ size: 128 }),
        h(
          'div.home__herotext',
          h('h1.home__title', 'Nivaan Learning Games'),
          speechBubble(line),
        ),
      ),
      h(
        'div.home__stats',
        stat('⭐', totalStars(), 'stars'),
        stat('🏅', completedCount(), `of ${totalLevels()}`),
        stat('🔥', me.streak.days, 'day streak'),
      ),
      h(
        'button.daily',
        { type: 'button', onclick: () => go('play', { daily: 1 }) },
        h('span.daily__emoji', '🎁'),
        h(
          'span.daily__body',
          h('span.daily__title', 'Daily Challenge'),
          h('span.daily__sub', '8 mixed puzzles — a new set every day'),
        ),
        h('span.daily__go', '▶'),
      ),
      h('h2.home__section', 'Choose a world'),
      h('div.home__cats', categoryCards),
      h(
        'div.home__footer',
        h(
          'a.home__link',
          { href: href('rewards') },
          '🏆 My rewards',
        ),
        h(
          'a.home__link',
          { href: href('progress') },
          '📊 My progress',
        ),
      ),
    ),
  );

  return {
    el,
    onEnter() {
      // NOT unlockVoice() here: this fires on cold boot too, before any real
      // tap — see the warm-up note in main.js's first-gesture listener, which
      // is the one place this must run.
      unlockAudio();
      syncMusic();
      speak(line);
    },
  };
}

function stat(emoji, value, label) {
  return h(
    'div.stat',
    h('span.stat__emoji', emoji),
    h('span.stat__value', String(value)),
    h('span.stat__label', label),
  );
}

function soundToggle() {
  const btn = h('button.iconbtn', {
    type: 'button',
    'aria-label': 'Sound',
    'aria-pressed': String(settings().sound),
  });
  const paint = () => {
    btn.textContent = settings().sound ? '🔊' : '🔇';
    btn.setAttribute('aria-pressed', String(settings().sound));
  };
  btn.addEventListener('click', () => {
    unlockAudio();
    unlockVoice();
    setSetting('sound', !settings().sound);
    paint();
    syncMusic();
    if (settings().sound) sfx('toggleOn');
  });
  paint();
  return btn;
}
