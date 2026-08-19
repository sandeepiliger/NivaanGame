/**
 * App bootstrap: register routes, wire global listeners, start the router.
 */

import { defineRoute, start } from './core/router.js';
import { unlockAudio, syncMusic, stopMusic, shutUp } from './core/audio.js';
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
const firstGesture = () => {
  unlockAudio();
  syncMusic();
  startPlayClock();
  window.removeEventListener('pointerdown', firstGesture);
  window.removeEventListener('keydown', firstGesture);
};
window.addEventListener('pointerdown', firstGesture, { once: false });
window.addEventListener('keydown', firstGesture, { once: false });

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
