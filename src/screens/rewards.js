/**
 * Rewards screen — trophies, badges and printable certificates.
 */

import { h } from '../core/dom.js';
import { go } from '../core/router.js';
import { trophyState, badgeState, certificates } from '../data/rewards.js';
import { profile, totalStars } from '../core/store.js';
import { sfx } from '../core/audio.js';
import { openCertificate } from './certificate.js';

export function rewardsScreen() {
  const trophies = trophyState();
  const badges = badgeState();
  const certs = certificates();

  const el = h(
    'div.screen.rewards',
    h(
      'div.topbar',
      h('button.iconbtn', { type: 'button', 'aria-label': 'Back', onclick: () => go('home') }, '←'),
      h('div.topbar__title', '🏆 My Rewards'),
      h('div.chip', `⭐ ${totalStars()}`),
    ),
    h(
      'div.screen__scroll.rewards__scroll',
      h('h2.rewards__head', 'Trophies'),
      h(
        'div.rewards__grid',
        trophies.map((t) =>
          h(
            'div.trophy' + (t.earned ? '.trophy--on' : ''),
            h('span.trophy__emoji', t.earned ? t.emoji : '🔒'),
            h('span.trophy__name', t.name),
            h('span.trophy__req', `${t.stars} ⭐`),
            !t.earned
              ? h(
                  'span.trophy__bar',
                  h('span.trophy__barfill', { style: { width: t.progress * 100 + '%' } }),
                )
              : null,
          ),
        ),
      ),
      h('h2.rewards__head', 'Badges'),
      h(
        'div.rewards__grid.rewards__grid--badges',
        badges.map((b) =>
          h(
            'div.badge' + (b.unlocked ? '.badge--on' : ''),
            h('span.badge__emoji', b.unlocked ? b.emoji : '❓'),
            h('span.badge__name', b.name),
            h('span.badge__hint', b.hint),
          ),
        ),
      ),
      h('h2.rewards__head', 'Certificates'),
      h(
        'div.rewards__certs',
        certs.map((c) =>
          h(
            'button.cert' + (c.earned ? '.cert--on' : ''),
            {
              type: 'button',
              style: { '--c': c.category.color, '--e': c.category.edge },
              onclick: () => {
                sfx(c.earned ? 'unlock' : 'wrong');
                if (c.earned) openCertificate(c, profile());
              },
            },
            h('span.cert__emoji', c.earned ? '📜' : '🔒'),
            h(
              'span.cert__body',
              h('span.cert__name', `${c.category.name} Certificate`),
              h('span.cert__sub', c.earned ? 'Tap to view' : `${c.done}/${c.total} levels done`),
              h(
                'span.cert__bar',
                h('span.cert__barfill', { style: { width: (c.done / c.total) * 100 + '%' } }),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  return { el };
}
