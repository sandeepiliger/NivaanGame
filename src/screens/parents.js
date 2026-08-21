/**
 * Parent zone — reached through the parental gate. Sound, voice, break
 * reminders, profile management and a progress reset.
 */

import { h, clear } from '../core/dom.js';
import { go } from '../core/router.js';
import {
  settings,
  setSetting,
  profile,
  resetProgress,
  exportSave,
  totalStars,
} from '../core/store.js';
import {
  syncMusic,
  speak,
  sfx,
  diagnoseVoice,
  listVoices,
  previewVoice,
  refreshVoice,
  VOICE_STYLES,
} from '../core/audio.js';
import { confirmDialog, infoDialog } from './dialogs.js';
import { toast } from '../core/fx.js';
import { removeAdsPrice, buyRemoveAds } from '../core/purchases.js';

const BREAK_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 10, label: '10 min' },
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
];

const VOICE_STYLE_LIST = Object.entries(VOICE_STYLES).map(([value, v]) => ({ value, label: v.label }));

function styleChipRow() {
  const chips = VOICE_STYLE_LIST.map((option) => {
    const btn = h(
      'button.parents__chip',
      {
        type: 'button',
        'aria-pressed': String(settings().voiceStyle === option.value),
        onclick: () => {
          setSetting('voiceStyle', option.value);
          chips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === settings().voiceStyle)));
          previewVoice(settings().voiceURI, option.value);
        },
      },
      option.label,
    );
    btn.dataset.value = option.value;
    return btn;
  });
  return h('div.parents__chips', chips);
}

function voiceRow(v, voiceListEl) {
  const selected = settings().voiceURI === v.voiceURI;
  return h(
    'div.parents__voicerow' + (selected ? '.parents__voicerow--on' : ''),
    h(
      'button.parents__voicename',
      {
        type: 'button',
        onclick: () => {
          setSetting('voiceURI', v.voiceURI);
          refreshVoice();
          renderVoiceList(voiceListEl);
          previewVoice(v.voiceURI, settings().voiceStyle);
        },
      },
      (v.recommended ? '⭐ ' : '') + v.name + (v.lang ? ` (${v.lang})` : ''),
    ),
    v.voiceURI
      ? h(
          'button.iconbtn',
          {
            type: 'button',
            'aria-label': 'Preview this voice',
            onclick: (event) => {
              event.stopPropagation();
              previewVoice(v.voiceURI, settings().voiceStyle);
            },
          },
          '▶',
        )
      : null,
  );
}

function renderVoiceList(voiceListEl) {
  clear(voiceListEl);
  const voices = listVoices();
  const rows = [voiceRow({ voiceURI: null, name: 'Auto (recommended)' }, voiceListEl)];
  voices.slice(0, 12).forEach((v) => rows.push(voiceRow(v, voiceListEl)));
  voiceListEl.append(...rows);
}

function removeAdsCard() {
  if (settings().adsRemoved) {
    return h(
      'section.card.parents__card',
      h('h2.parents__head', 'Ads'),
      h('p.parents__note', '✅ Ads are removed on this device. Thank you for supporting Nivaan!'),
    );
  }

  const buyBtn = h(
    'button.btn.btn--green.btn--block',
    {
      type: 'button',
      onclick: async () => {
        buyBtn.disabled = true;
        buyBtn.textContent = 'Opening Play Store…';
        const bought = await buyRemoveAds();
        if (bought) {
          sfx('unlock');
          infoDialog({
            emoji: '🎉',
            title: 'Ads removed!',
            text: 'Thanks for supporting Nivaan Learning Games — enjoy the ad-free experience.',
          });
          card.replaceWith(removeAdsCard());
        } else {
          buyBtn.disabled = false;
          buyBtn.textContent = '🚫 Remove ads';
        }
      },
    },
    '🚫 Remove ads',
  );

  removeAdsPrice().then((price) => {
    if (price) buyBtn.textContent = `🚫 Remove ads — ${price}`;
  });

  const card = h(
    'section.card.parents__card',
    h('h2.parents__head', 'Ads'),
    h('p.parents__note', 'A one-time purchase removes all ads from the app, forever.'),
    buyBtn,
  );
  return card;
}

export function parentsScreen() {
  const voiceListEl = h('div.parents__voicelist');
  renderVoiceList(voiceListEl);
  // Voices can still be loading when this screen mounts; refresh once they
  // arrive so the list isn't stuck showing nothing (or too few options).
  // 'nativevoiceschanged' is audio.js's equivalent event for the packaged
  // Android app's native TextToSpeech engine (see loadNativeVoices there).
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.addEventListener?.('voiceschanged', () => renderVoiceList(voiceListEl), { once: true });
  }
  window.addEventListener('nativevoiceschanged', () => renderVoiceList(voiceListEl), { once: true });

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
        h(
          'button.btn.btn--paper.btn--block',
          {
            type: 'button',
            style: { marginTop: '10px' },
            onclick: async () => {
              const info = await diagnoseVoice();
              alert(
                [
                  `Browser: ${info.userAgent}`,
                  `Native TTS (Android app): ${info.nativeTTS}`,
                  `speechSynthesis available: ${info.hasSpeechSynthesis}`,
                  `Voices installed: ${info.voiceCount}`,
                  ...info.voices,
                  `Picked voice: ${info.pickedVoice}`,
                  `"Spoken instructions" setting: ${info.voiceSettingOn}`,
                  `Utterance started: ${info.started}`,
                  `Utterance ended: ${info.ended}`,
                  `Error: ${info.error || 'none'}`,
                  `Took: ${info.ms}ms`,
                ].join('\n'),
              );
            },
          },
          '🔎 Test voice (debug)',
        ),
      ),
      h(
        'section.card.parents__card',
        h('h2.parents__head', 'Voice'),
        h('p.parents__note', 'Pick how excited the voice sounds, and which voice it uses.'),
        styleChipRow(),
        voiceListEl,
      ),
      removeAdsCard(),
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
