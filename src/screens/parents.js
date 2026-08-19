/**
 * Parent zone — reached through the parental gate. Sound, voice, break
 * reminders, profile management and a progress reset.
 */

import { h } from '../core/dom.js';
import { go } from '../core/router.js';
import {
  settings,
  setSetting,
  profile,
  resetProgress,
  exportSave,
  totalStars,
} from '../core/store.js';
import { syncMusic, speak, sfx } from '../core/audio.js';
import { confirmDialog, infoDialog } from './dialogs.js';
import { toast } from '../core/fx.js';

const BREAK_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 10, label: '10 min' },
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
];

export function parentsScreen() {
  const el = h(
    'div.screen.parents',
    h(
      'div.topbar',
      h('button.iconbtn', { type: 'button', 'aria-label': 'Back', onclick: () => go('home') }, '←'),
      h('div.topbar__title', '⚙️ Grown-ups'),
      h('div.chip', `⭐ ${totalStars()}`),
    ),
    h(
      'div.screen__scroll.parents__scroll',
      h(
        'section.card.parents__card',
        h('h2.parents__head', 'Sound'),
        toggleRow('Sound effects', 'sound', () => syncMusic()),
        toggleRow('Background music', 'music', () => syncMusic()),
        toggleRow('Spoken instructions', 'voice', () => {
          if (settings().voice) speak('Voice is on.', { force: true });
        }),
        toggleRow('Vibration', 'haptics'),
      ),
      h(
        'section.card.parents__card',
        h('h2.parents__head', 'Healthy play'),
        h(
          'p.parents__note',
          'Show a friendly “time for a break” reminder after this much play in one sitting.',
        ),
        h(
          'div.parents__chips',
          BREAK_OPTIONS.map((option) => {
            const btn = h(
              'button.parents__chip',
              {
                type: 'button',
                'aria-pressed': String(settings().breakAfterMin === option.value),
                onclick: () => {
                  setSetting('breakAfterMin', option.value);
                  el.querySelectorAll('.parents__chip').forEach((b) =>
                    b.setAttribute(
                      'aria-pressed',
                      String(Number(b.dataset.value) === settings().breakAfterMin),
                    ),
                  );
                },
              },
              option.label,
            );
            btn.dataset.value = option.value;
            return btn;
          }),
        ),
      ),
      h(
        'section.card.parents__card',
        h('h2.parents__head', 'Players'),
        h(
          'p.parents__note',
          `Currently playing as ${profile().avatar} ${profile().name}. Each player keeps their own stars and progress.`,
        ),
        h(
          'button.btn.btn--purple.btn--block',
          { type: 'button', onclick: () => go('profiles') },
          '👥 Manage players',
        ),
      ),
      h(
        'section.card.parents__card',
        h('h2.parents__head', 'About'),
        h(
          'p.parents__note',
          'Nivaan Learning Games is completely offline. No ads, no accounts, no data ever leaves this device.',
        ),
        h(
          'div.parents__row',
          h(
            'button.btn.btn--paper',
            {
              type: 'button',
              onclick: () => {
                navigator.clipboard
                  ?.writeText(exportSave())
                  .then(() => toast('Progress copied to clipboard'))
                  .catch(() => toast('Could not copy'));
              },
            },
            '📋 Copy progress data',
          ),
          h(
            'button.btn.btn--pink',
            {
              type: 'button',
              onclick: () =>
                confirmDialog({
                  title: 'Reset all progress?',
                  text: `This clears every star and badge for ${profile().name}. It cannot be undone.`,
                  confirmLabel: 'Reset',
                  onConfirm: () => {
                    resetProgress();
                    infoDialog({ emoji: '🧹', title: 'Progress reset', text: 'Everything is back to the start.' });
                  },
                }),
            },
            '🗑️ Reset progress',
          ),
        ),
      ),
    ),
  );

  return { el };
}

function toggleRow(label, key, after) {
  const input = h('input.switch__input', {
    type: 'checkbox',
    checked: Boolean(settings()[key]),
    onchange: (event) => {
      setSetting(key, event.target.checked);
      after?.();
    },
  });
  return h(
    'label.switch',
    h('span.switch__label', label),
    input,
    h('span.switch__track', h('span.switch__thumb')),
  );
}
