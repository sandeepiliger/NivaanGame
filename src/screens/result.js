/**
 * Results screen — stars land one by one, then the child chooses what next.
 */

import { h, wait } from '../core/dom.js';
import { go } from '../core/router.js';
import { levelById, levelsFor, categoryById } from '../data/catalog.js';
import { profile, grantReward, totalStars } from '../core/store.js';
import { pendingRewards } from '../data/rewards.js';
import { sfx, speak } from '../core/audio.js';
import { confetti } from '../core/fx.js';
import { mascot } from '../ui/mascot.js';
import { isUnlocked } from './map.js';
import { infoDialog } from './dialogs.js';

const PRAISE_BY_STARS = {
  3: ['Perfect!', 'Amazing work!', 'You are a star!'],
  2: ['Great job!', 'Well done!', 'Nearly perfect!'],
  1: ['Good try!', 'You did it!', 'Keep going!'],
};

export function resultScreen(params) {
  const stars = Math.max(1, Math.min(3, Number(params.stars) || 1));
  const isDaily = params.daily === '1';
  const level = params.level ? levelById(params.level) : null;
  const category = level ? categoryById(level.categoryId) : null;
  const correct = Number(params.correct) || 0;
  const wrong = Number(params.wrong) || 0;
  const hints = Number(params.hints) || 0;
  const seconds = Math.round((Number(params.ms) || 0) / 1000);

  const levels = level ? levelsFor(level.categoryId) : [];
  const nextLevel = level ? levels[level.index + 1] : null;
  const nextAvailable = nextLevel && isUnlocked(nextLevel);

  const headline = PRAISE_BY_STARS[stars][Math.floor(Math.random() * PRAISE_BY_STARS[stars].length)];

  const starNodes = [0, 1, 2].map((i) =>
    h('span.result__star' + (i < stars ? '' : '.result__star--off'), { 'data-i': i }, '⭐'),
  );

  const el = h(
    'div.screen.result',
    {
      style: {
        '--theme': category?.color || '#ffcc29',
        '--edge': category?.edge || '#e0a800',
      },
    },
    h(
      'div.screen__scroll.result__scroll',
      h(
        'div.result__card',
        mascot({ size: 110, mood: stars === 3 ? 'happy' : 'wink' }),
        h('h1.result__title', headline),
        h(
          'p.result__sub',
          isDaily ? 'Daily Challenge complete' : `${level.skillName} · Level ${level.number}`,
        ),
        h('div.result__stars', starNodes),
        h(
          'div.result__stats',
          statPill('✅', correct, 'right'),
          statPill('🔁', wrong, 'retries'),
          statPill('💡', hints, 'hints'),
          statPill('⏱️', formatTime(seconds), ''),
        ),
        h(
          'div.result__actions',
          nextAvailable
            ? h(
                'button.btn.btn--lg.btn--green.btn--block',
                { type: 'button', onclick: () => go('play', { level: nextLevel.id }) },
                '▶ Next level',
              )
            : null,
          h(
            'button.btn.btn--paper.btn--block',
            {
              type: 'button',
              onclick: () =>
                isDaily
                  ? go('play', { daily: 1 })
                  : go('play', { level: level.id, v: Math.floor(Math.random() * 1000) }),
            },
            '🔄 Play again',
          ),
          h(
            'button.btn.btn--ghost.btn--block',
            {
              type: 'button',
              onclick: () => (category ? go('map', { cat: category.id }) : go('home')),
            },
            category ? '🗺️ Back to the map' : '🏠 Home',
          ),
        ),
      ),
    ),
  );

  return {
    el,
    async onEnter() {
      speak(headline);
      // Land the stars one at a time.
      for (let i = 0; i < stars; i++) {
        await wait(320);
        starNodes[i].classList.add('result__star--in');
        sfx('star', i);
      }
      if (stars === 3) {
        confetti({ count: 90 });
        sfx('applause');
      }
      await wait(400);
      celebrateNewRewards();
    },
  };
}

function statPill(emoji, value, label) {
  return h(
    'div.result__pill',
    h('span', emoji),
    h('strong', String(value)),
    label ? h('span.result__pilllabel', label) : null,
  );
}

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

/** Show a popup for anything the level just unlocked, one at a time. */
function celebrateNewRewards() {
  const known = profile().rewards;
  const fresh = pendingRewards(known);
  if (!fresh.length) return;

  const showNext = (i) => {
    if (i >= fresh.length) return;
    const reward = fresh[i];
    grantReward(reward.id);
    sfx('unlock');
    confetti({ count: 60 });
    speak(`You unlocked ${reward.name}!`);
    infoDialog({
      emoji: reward.emoji,
      title: 'New reward!',
      text: `${reward.name} — you now have ${totalStars()} stars.`,
      actionLabel: 'Wow!',
      onAction: () => showNext(i + 1),
    });
  };
  showNext(0);
}

