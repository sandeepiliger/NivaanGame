/**
 * Player picker — several children can share one device, each with their own
 * stars, badges and difficulty progress.
 */

import { h } from '../core/dom.js';
import { go } from '../core/router.js';
import {
  allProfiles,
  profile,
  switchProfile,
  addProfile,
  updateProfile,
  removeProfile,
  AVATARS,
} from '../core/store.js';
import { sfx } from '../core/audio.js';
import { confirmDialog, openModal } from './dialogs.js';

export function profilesScreen() {
  const el = h('div.screen.profiles');
  render();

  function render() {
    el.textContent = '';
    const me = profile();

    el.appendChild(
      h(
        'div.topbar',
        h('button.iconbtn', { type: 'button', 'aria-label': 'Back', onclick: () => go('home') }, '←'),
        h('div.topbar__title', '👥 Players'),
        h('div', { style: { width: '48px' } }),
      ),
    );

    el.appendChild(
      h(
        'div.screen__scroll.profiles__scroll',
        h(
          'div.profiles__grid',
          allProfiles().map((p) =>
            h(
              'div.pcard' + (p.id === me.id ? '.pcard--on' : ''),
              h(
                'button.pcard__pick',
                {
                  type: 'button',
                  onclick: () => {
                    switchProfile(p.id);
                    sfx('pop');
                    render();
                  },
                },
                h('span.pcard__avatar', p.avatar),
                h('span.pcard__name', p.name),
                h(
                  'span.pcard__stars',
                  `⭐ ${Object.values(p.stars).reduce((s, n) => s + n, 0)}`,
                ),
              ),
              h(
                'div.pcard__tools',
                h(
                  'button.iconbtn.iconbtn--paper',
                  { type: 'button', 'aria-label': 'Edit', onclick: () => editProfile(p, render) },
                  '✏️',
                ),
                allProfiles().length > 1
                  ? h(
                      'button.iconbtn.iconbtn--paper',
                      {
                        type: 'button',
                        'aria-label': 'Delete',
                        onclick: () =>
                          confirmDialog({
                            title: `Remove ${p.name}?`,
                            text: 'Their stars and badges will be deleted.',
                            confirmLabel: 'Remove',
                            onConfirm: () => {
                              removeProfile(p.id);
                              render();
                            },
                          }),
                      },
                      '🗑️',
                    )
                  : null,
              ),
            ),
          ),
        ),
        h(
          'button.btn.btn--green.btn--block.profiles__add',
          { type: 'button', onclick: () => editProfile(null, render) },
          '➕ Add a player',
        ),
      ),
    );
  }

  return { el };
}

function editProfile(existing, onDone) {
  let avatar = existing?.avatar || AVATARS[0];

  const nameInput = h('input.pedit__name', {
    type: 'text',
    maxlength: '14',
    placeholder: 'Name',
    value: existing?.name || '',
    'aria-label': 'Player name',
  });

  const grid = h(
    'div.pedit__avatars',
    AVATARS.map((emoji) => {
      const btn = h(
        'button.pedit__avatar' + (emoji === avatar ? '.pedit__avatar--on' : ''),
        {
          type: 'button',
          onclick: () => {
            avatar = emoji;
            grid.querySelectorAll('.pedit__avatar').forEach((b) =>
              b.classList.toggle('pedit__avatar--on', b.textContent === avatar),
            );
            sfx('tap');
          },
        },
        emoji,
      );
      return btn;
    }),
  );

  const { close } = openModal([
    h('h2.modal__title', existing ? 'Edit player' : 'New player'),
    nameInput,
    grid,
    h(
      'div.modal__actions',
      h(
        'button.btn.btn--green',
        {
          type: 'button',
          onclick: () => {
            const name = nameInput.value.trim() || 'Player';
            if (existing) {
              // updateProfile edits whoever is active, so select them first.
              switchProfile(existing.id);
              updateProfile({ name, avatar });
            } else {
              addProfile(name, avatar);
            }
            close();
            onDone();
          },
        },
        'Save',
      ),
      h('button.btn.btn--paper', { type: 'button', onclick: () => close() }, 'Cancel'),
    ),
  ]);

  setTimeout(() => nameInput.focus(), 60);
}
