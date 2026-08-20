/**
 * App bootstrap: register routes, wire global listeners, start the router.
 */

import { defineRoute, start } from './core/router.js';
import { unlockAudio, unlockVoice, syncMusic, stopMusic, shutUp, sfx, haptic } from './core/audio.js';
import { startPlayClock } from './core/store.js';

import { homeScreen } from './screens/home.js';
import { mapScreen } from './screens/map.js';
import { playScreen } from './screens/play.js';
import { resultScreen } from './screens/result.js';
import { rewardsScreen } from './screens/rewards.js';
import { progressScreen } from './screens/progress.js';
import { parentsScreen } from './screens/parents.js';
import { profilesScreen } from './screens/profiles.js';

defineRoute('home', homeScreen);
defineRoute('map', mapScreen);
defineRoute('play', playScreen);
defineRoute('result', resultScreen);
defineRoute('rewards', rewardsScreen);
defineRoute('progress', progressScreen);
defineRoute('parents', parentsScreen);
defineRoute('profiles', profilesScreen);

/* -------------------------------------------------------------------------- */

// Browsers block audio until the first gesture; unlock on whichever comes first.
// Voice needs the same treatment: several mobile browsers only let
// speechSynthesis produce sound once it's been used inside a real tap, so a
// prompt spoken automatically a moment *after* the child's last tap (e.g. the
// next round, ~900ms after "Correct!") can otherwise stay silent with no
// error — warming it up here, on the very first tap anywhere, fixes that for
// every later automatic prompt on the page.
const firstGesture = () => {
  unlockAudio();
  unlockVoice();
  syncMusic();
  startPlayClock();
  window.removeEventListener('pointerdown', firstGesture);
  window.removeEventListener('keydown', firstGesture);
};
window.addEventListener('pointerdown', firstGesture, { once: false });
window.addEventListener('keydown', firstGesture, { once: false });

/*
 * Global UI sound. Every button, link and switch clicks, without each screen
 * having to remember to wire it up. Elements that make their own, more
 * specific noise opt out with `data-quiet` (game tiles, cards, maze cells…).
 */
document.addEventListener(
  'pointerdown',
  (event) => {
    const el = event.target.closest?.(
      'button, a[href], .switch, [role="button"], input[type="checkbox"]',
    );
    if (!el || el.disabled || el.closest('[data-quiet]')) return;

    if (el.classList.contains('btn')) sfx('press');
    else if (el.classList.contains('switch') || el.type === 'checkbox') {
      sfx(el.querySelector('input')?.checked ?? el.checked ? 'toggleOff' : 'toggleOn');
    } else if (/^(←|✕|✖)/.test(el.textContent || '')) sfx('back');
    else sfx('tap');

    haptic(8);
  },
  true,
);

// Pause sound when the app is backgrounded — important on phones.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopMusic();
    shutUp();
  } else {
    syncMusic();
  }
});

// Block the double-tap-to-zoom gesture, which otherwise fights fast tapping.
let lastTouch = 0;
document.addEventListener(
  'touchend',
  (event) => {
    const now = Date.now();
    if (now - lastTouch < 300) event.preventDefault();
    lastTouch = now;
  },
  { passive: false },
);

// Keep the CSS viewport unit honest on mobile browsers with dynamic toolbars.
const setVh = () =>
  document.documentElement.style.setProperty('--vh', window.innerHeight * 0.01 + 'px');
setVh();
window.addEventListener('resize', setVh);
window.addEventListener('orientationchange', () => setTimeout(setVh, 120));

start(document.getElementById('app'), 'home');

// Offline support. Registration failures are non-fatal — the game still runs.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
