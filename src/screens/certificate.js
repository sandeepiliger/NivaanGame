/**
 * Printable certificate. Rendered as a normal DOM node with a print stylesheet
 * so "Print" works from any browser without generating a PDF ourselves.
 */

import { h } from '../core/dom.js';
import { openModal } from './dialogs.js';
import { confetti } from '../core/fx.js';

export function openCertificate(cert, kid) {
  const date = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const sheet = h(
    'div.certsheet',
    { style: { '--c': cert.category.color, '--e': cert.category.edge } },
    h('div.certsheet__border'),
    h('div.certsheet__seal', '🏅'),
    h('p.certsheet__eyebrow', 'Certificate of Achievement'),
    h('h1.certsheet__name', kid.avatar + ' ' + kid.name),
    h('p.certsheet__body', 'has completed every level in'),
    h('h2.certsheet__world', `${cert.category.emoji} ${cert.category.name}`),
    h('p.certsheet__stars', `⭐ ${cert.stars} of ${cert.maxStars} stars`),
    h(
      'div.certsheet__foot',
      h('span', date),
      h('span', 'BrainySparks'),
    ),
  );

  const { close } = openModal(
    [
      sheet,
      h(
        'div.modal__actions',
        h('button.btn.btn--purple', { type: 'button', onclick: () => window.print() }, '🖨️ Print'),
        h('button.btn.btn--paper', { type: 'button', onclick: () => close() }, 'Close'),
      ),
    ],
  );

  document.body.classList.add('printing-cert');
  const observer = new MutationObserver(() => {
    if (!document.querySelector('.certsheet')) {
      document.body.classList.remove('printing-cert');
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });

  confetti({ count: 70 });
}
