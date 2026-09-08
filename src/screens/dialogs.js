/**
 * Shared modal dialogs: confirmations, the parental gate and the break
 * reminder that the parent zone can schedule.
 */

import { h } from '../core/dom.js';
import { sfx, speak } from '../core/audio.js';
import { resetPlayClock } from '../core/store.js';
import { suspendBanner, restoreBanner } from '../core/ads.js';

function openModal(content, { dismissable = true } = {}) {
  const box = h('div.modal__box', content);
  const modal = h(
    'div.modal',
    {
      onclick: (event) => {
        if (dismissable && event.target === modal) close();
      },
    },
    box,
  );
  document.body.appendChild(modal);
  sfx('open');
  // Every dialog in the app opens through here, so this is the one place that
  // has to get the ad banner out of the way — it is a native view above the
  // WebView and would paint over the dialog otherwise. See ads.js.
  suspendBanner();

  let closed = false;
  function close() {
    // Idempotent: a second close() must not unbalance the suspend depth and
    // bring the banner back while another dialog is still open.
    if (closed) return;
    closed = true;
    sfx('close');
    modal.remove();
    document.removeEventListener('keydown', onKey);
    restoreBanner();
  }
  const onKey = (event) => {
    if (event.key === 'Escape' && dismissable) close();
  };
  document.addEventListener('keydown', onKey);

  return { modal, box, close };
}

export function confirmDialog({
  title,
  text,
  confirmLabel = 'Yes',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  // Pre-readers can't parse a dialog's title/body text on their own, so any
  // dialog a child (rather than a parent) might hit passes what to say aloud.
  speak: speakText,
}) {
  if (speakText) speak(speakText);
  const { close } = openModal([
    h('div.modal__emoji', '🤔'),
    h('h2.modal__title', title),
    text ? h('p.modal__text', text) : null,
    h(
      'div.modal__actions',
      h(
        'button.btn.btn--pink',
        {
          type: 'button',
          onclick: () => {
            close();
            onConfirm?.();
          },
        },
        confirmLabel,
      ),
      h(
        'button.btn.btn--paper',
        {
          type: 'button',
          onclick: () => {
            close();
            onCancel?.();
          },
        },
        cancelLabel,
      ),
    ),
  ]);
}

export function infoDialog({
  emoji = '🎉',
  title,
  text,
  actionLabel = 'OK',
  onAction,
  speak: speakText,
}) {
  if (speakText) speak(speakText);
  const { close } = openModal([
    h('div.modal__emoji', emoji),
    h('h2.modal__title', title),
    text ? h('p.modal__text', text) : null,
    h(
      'div.modal__actions',
      h(
        'button.btn.btn--green',
        {
          type: 'button',
          onclick: () => {
            close();
            onAction?.();
          },
        },
        actionLabel,
      ),
    ),
  ]);
}

/**
 * Parental gate — a small multiplication a young child cannot do, guarding the
 * settings and progress area. Deliberately not a security boundary, just the
 * standard "grown-ups only" speed bump.
 */
export function parentGate(onPass) {
  const a = 3 + Math.floor(Math.random() * 6);
  const b = 4 + Math.floor(Math.random() * 6);
  const answer = a * b;

  const input = h('input.gate__input', {
    type: 'number',
    inputmode: 'numeric',
    autocomplete: 'off',
    'aria-label': 'Answer',
  });
  const error = h('p.gate__error');

  const { close } = openModal([
    h('div.modal__emoji', '🔒'),
    h('h2.modal__title', 'Grown-ups only'),
    h('p.modal__text', `To continue, what is ${a} × ${b}?`),
    input,
    error,
    h(
      'div.modal__actions',
      h('button.btn.btn--purple', { type: 'button', onclick: submit }, 'Continue'),
      h('button.btn.btn--paper', { type: 'button', onclick: () => close() }, 'Cancel'),
    ),
  ]);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submit();
  });
  setTimeout(() => input.focus(), 60);

  function submit() {
    if (Number(input.value) === answer) {
      close();
      onPass();
    } else {
      error.textContent = 'That is not right — try again.';
      input.value = '';
      input.focus();
      sfx('wrong');
    }
  }
}

export function showBreakReminder() {
  resetPlayClock();
  speak('Time for a little break! Stand up and stretch.');
  infoDialog({
    emoji: '🧘',
    title: 'Time for a break!',
    text: 'You have been playing for a while. Stand up, stretch and rest your eyes — then come back for more.',
    actionLabel: 'OK!',
  });
}

export { openModal };
