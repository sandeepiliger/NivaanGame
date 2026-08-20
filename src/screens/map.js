/**
 * Category map — a winding path of level nodes.
 *
 * All of tier 1 is open from the start so a child can try every game type
 * immediately; after that each level unlocks the next one along.
 */

import { h } from '../core/dom.js';
import { go, href } from '../core/router.js';
import { categoryById, levelsFor } from '../data/catalog.js';
import { starsFor, isCompleted } from '../core/store.js';
import { sfx, speak } from '../core/audio.js';

export function isUnlocked(level) {
  const levels = levelsFor(level.categoryId);
  // Every tier-1 level is available from the beginning.
  if (level.tier === 1) return true;
  const previous = levels[level.index - 1];
  return !previous || isCompleted(previous.id);
}

export function nextPlayableLevel(categoryId) {
  const levels = levelsFor(categoryId);
  return (
    levels.find((l) => isUnlocked(l) && !isCompleted(l.id)) ||
    levels.find((l) => isUnlocked(l) && starsFor(l.id) < 3) ||
    levels[0]
  );
}

export function mapScreen(params) {
  const category = categoryById(params.cat);
  if (!category) {
    return { el: h('div.screen.center', h('p', { style: { color: '#fff' } }, 'Unknown world.')) };
  }

  const levels = levelsFor(category.id);
  const doneCount = levels.filter((l) => isCompleted(l.id)).length;
  const starCount = levels.reduce((sum, l) => sum + starsFor(l.id), 0);

  // Nodes make their own sounds, so opt out of the global click handler.
  const path = h('div.map__path', { 'data-quiet': '' });
  let lastTier = 0;

  levels.forEach((level) => {
    if (level.tier !== lastTier) {
      lastTier = level.tier;
      path.appendChild(
        h(
          'div.map__banner',
          h('span.map__bannerline'),
          h('span.map__bannertext', `${tierName(level.tier)}`),
          h('span.map__bannerline'),
        ),
      );
    }

    const unlocked = isUnlocked(level);
    const stars = starsFor(level.id);
    const side = level.index % 4;

    const node = h(
      unlocked ? 'a.mapnode' : 'div.mapnode.mapnode--locked',
      {
        ...(unlocked ? { href: href('play', { level: level.id }) } : {}),
        'data-side': side,
        class: level.challenge ? 'mapnode--challenge' : '',
        onclick: (event) => {
          if (!unlocked) {
            event.preventDefault();
            sfx('oops');
            speak('Finish the level before this one first.');
            node.classList.add('mapnode--shake');
            setTimeout(() => node.classList.remove('mapnode--shake'), 400);
            return;
          }
          sfx('press');
        },
      },
      h(
        'span.mapnode__disc',
        unlocked ? h('span.mapnode__emoji', level.emoji) : h('span.mapnode__lock', '🔒'),
        level.challenge ? h('span.mapnode__crown', '👑') : null,
      ),
      h(
        'span.mapnode__info',
        h('span.mapnode__num', `${level.number}. ${level.skillName}`),
        h('span.mapnode__blurb', level.blurb),
        h(
          'span.stars.mapnode__stars',
          [0, 1, 2].map((i) =>
            h('span' + (i < stars ? '' : '.star--off'), '⭐'),
          ),
        ),
      ),
    );

    path.appendChild(node);
  });

  const el = h(
    'div.screen.map',
    { style: { '--theme': category.color, '--edge': category.edge, '--ink': category.ink } },
    h(
      'div.topbar',
      h('button.iconbtn', { type: 'button', 'aria-label': 'Back', onclick: () => go('home') }, '←'),
      h('div.topbar__title', `${category.emoji} ${category.name}`),
      h('div.chip', `⭐ ${starCount}`),
    ),
    h(
      'div.screen__scroll.map__scroll',
      h(
        'div.map__head',
        h('p.map__tag', category.tagline),
        h(
          'div.map__progress',
          h('div.bar', h('div.bar__fill', { style: { width: (doneCount / levels.length) * 100 + '%' } })),
          h('span.map__count', `${doneCount}/${levels.length}`),
        ),
      ),
      path,
      h('div.map__end', h('span', '🏁'), h('p', 'More worlds to explore on the home screen!')),
    ),
    h(
      'div.map__cta',
      h(
        'button.btn.btn--lg.btn--green.btn--block',
        {
          type: 'button',
          onclick: () => {
            go('play', { level: nextPlayableLevel(category.id).id });
          },
        },
        '▶ Play next level',
      ),
    ),
  );

  return {
    el,
    // The level names on this screen are plain text a pre-reader can't use,
    // so say which world they've landed in — the same pattern Home uses for
    // its mascot line. Tapping a level then speaks that puzzle's own prompt.
    onEnter() {
      speak(`${category.name}! ${category.tagline}`);
    },
  };
}

function tierName(tier) {
  return ['Starter', 'Getting good', 'Clever', 'Tricky', 'Champion'][tier - 1] || `Tier ${tier}`;
}

