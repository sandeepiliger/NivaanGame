/**
 * Progress screen — a per-skill mastery view a parent (or a proud child) can
 * read at a glance.
 */

import { h } from '../core/dom.js';
import { go } from '../core/router.js';
import { CATEGORIES, levelsFor, TIERS } from '../data/catalog.js';
import { profile, starsFor, isCompleted, totalStars } from '../core/store.js';

export function progressScreen() {
  const me = profile();

  const sections = CATEGORIES.map((category) => {
    const levels = levelsFor(category.id);
    const perSkill = category.skills.map((skill) => {
      const mine = levels.filter((l) => l.skillId === skill.id);
      const done = mine.filter((l) => isCompleted(l.id)).length;
      const stars = mine.reduce((sum, l) => sum + starsFor(l.id), 0);
      return {
        skill,
        done,
        total: mine.length,
        stars,
        maxStars: mine.length * 3,
        xp: me.skillXp[skill.id] || 0,
      };
    });

    const catDone = perSkill.reduce((s, r) => s + r.done, 0);
    const catTotal = perSkill.reduce((s, r) => s + r.total, 0);

    return h(
      'section.prog__cat',
      { style: { '--c': category.color, '--e': category.edge } },
      h(
        'header.prog__cathead',
        h('span.prog__catemoji', category.emoji),
        h('span.prog__catname', category.name),
        h('span.prog__catcount', `${catDone}/${catTotal}`),
      ),
      h(
        'div.prog__skills',
        perSkill.map((row) =>
          h(
            'div.prog__skill',
            h('span.prog__skillemoji', row.skill.emoji),
            h(
              'div.prog__skillbody',
              h('span.prog__skillname', row.skill.name),
              h(
                'span.prog__skillbar',
                h('span.prog__skillfill', {
                  style: { width: (row.stars / Math.max(1, row.maxStars)) * 100 + '%' },
                }),
              ),
            ),
            h(
              'span.prog__skillmeta',
              h('span', `⭐ ${row.stars}`),
              h('span.prog__skilllvl', `${row.done}/${row.total}`),
            ),
          ),
        ),
      ),
    );
  });

  const el = h(
    'div.screen.prog',
    h(
      'div.topbar',
      h('button.iconbtn', { type: 'button', 'aria-label': 'Back', onclick: () => go('home') }, '←'),
      h('div.topbar__title', '📊 My Progress'),
      h('div.chip', `⭐ ${totalStars()}`),
    ),
    h(
      'div.screen__scroll.prog__scroll',
      h(
        'div.prog__summary',
        summaryTile('✅', me.totals.correct, 'answers right'),
        summaryTile('🎯', accuracy(me), 'accuracy'),
        summaryTile('🏅', me.totals.levels, 'levels done'),
        summaryTile('⏱️', Math.round(me.totals.playMs / 60000) + 'm', 'time played'),
        summaryTile('🔥', me.streak.days, 'day streak'),
        summaryTile('🧗', `${TIERS}`, 'difficulty tiers'),
      ),
      sections,
    ),
  );

  return { el };
}

function accuracy(me) {
  const total = me.totals.correct + me.totals.wrong;
  if (!total) return '—';
  return Math.round((me.totals.correct / total) * 100) + '%';
}

function summaryTile(emoji, value, label) {
  return h(
    'div.prog__tile',
    h('span.prog__tileemoji', emoji),
    h('strong.prog__tileval', String(value)),
    h('span.prog__tilelabel', label),
  );
}
