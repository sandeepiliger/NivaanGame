/**
 * Banner-placement checks for src/core/ads.js.
 *
 * The banner is a native view stacked above the WebView, so it paints over
 * anything the page draws — a bug here puts an ad on top of the parental
 * gate, or leaves the home screen's footer links stranded underneath one.
 * Neither suite catches that: smoke.mjs never loads a screen, and e2e runs
 * in a plain browser where window.Capacitor doesn't exist, so every ad call
 * no-ops. So this drives the real module against a fake AdMob plugin.
 *
 * Runs in Node with just enough of a DOM for ads.js to talk to.
 */

const calls = [];
let sizeListener = null;

const fakeAdMob = {
  initialize: async () => calls.push('initialize'),
  showBanner: async () => calls.push('showBanner'),
  hideBanner: async () => calls.push('hideBanner'),
  resumeBanner: async () => calls.push('resumeBanner'),
  removeBanner: async () => calls.push('removeBanner'),
  prepareInterstitial: async () => calls.push('prepareInterstitial'),
  showInterstitial: async () => calls.push('showInterstitial'),
  addListener: async (name, fn) => {
    if (name === 'bannerAdSizeChanged') sizeListener = fn;
  },
};

const cssVars = {};
globalThis.window = { Capacitor: { Plugins: { AdMob: fakeAdMob } } };
globalThis.document = {
  documentElement: { style: { setProperty: (k, v) => (cssVars[k] = v) } },
};
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);

const ads = await import('../src/core/ads.js');

/** Let pending promises, timers and the deferred resume all run out. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
const reserved = () => cssVars['--banner-h'];

let failures = 0;
let checks = 0;

function check(label, actual, expected) {
  checks++;
  if (String(actual) === String(expected)) return;
  failures++;
  console.error(`  ✗ ${label} — got ${actual}, expected ${expected}`);
}

console.log('\nBrainySparks — ad banner placement\n');

// Home asks for a banner, and the page reserves the height it reports.
await ads.showHomeBanner();
sizeListener?.({ width: 360, height: 62 });
await settle();
check('banner shown on home', calls.includes('showBanner'), true);
check('height reserved for it', reserved(), '62px');

// A dialog opens: the banner must get out of the way, or it covers the
// parental gate's question and lands beside its buttons once the soft
// keyboard pushes the native view up.
calls.length = 0;
ads.suspendBanner();
await settle();
check('hidden while a dialog is open', calls.join(','), 'hideBanner');
check('its reserved space released', reserved(), '0px');

// ...and comes back when that dialog closes.
calls.length = 0;
ads.restoreBanner();
await settle();
check('resumed when the dialog closes', calls.join(','), 'resumeBanner');
check('space reserved again', reserved(), '62px');

// Dialogs nest (gate → confirm → info), so only the last close resumes.
calls.length = 0;
ads.suspendBanner();
ads.suspendBanner();
await settle();
ads.restoreBanner();
await settle();
check('still hidden under a nested dialog', calls.join(','), 'hideBanner');
ads.restoreBanner();
await settle();
check('resumed only at the last close', calls.join(','), 'hideBanner,resumeBanner');

// Passing the gate closes the dialog *and* navigates. `go()` sets
// location.hash, so the route change removing the banner lands a task later
// than the close — the banner must not flash back in that gap.
calls.length = 0;
ads.suspendBanner();
await settle();
ads.restoreBanner();
ads.hideBanner();
await settle();
check('no flash back when closing into a navigation', calls.includes('resumeBanner'), false);
check('banner removed on leaving home', calls.includes('removeBanner'), true);
check('nothing reserved off home', reserved(), '0px');

// Cold boot: initialize() is slow enough for the gate to be open before it
// resolves, which is what put an ad over a dialog in the first place.
calls.length = 0;
ads.suspendBanner();
await ads.showHomeBanner();
await settle();
check('never shown on top of an open dialog', calls.includes('showBanner'), false);
ads.restoreBanner();
await settle();
check('shown once that dialog closes', calls.includes('showBanner'), true);

// Leaving home tears it down.
calls.length = 0;
await ads.hideBanner();
check('removed on leave', calls.join(','), 'removeBanner');
check('no space left reserved', reserved(), '0px');

if (failures) {
  console.error(`\n  ✗ ${failures} of ${checks} banner checks failed\n`);
  process.exit(1);
}
console.log(`  ads: ${checks} banner placement checks passed`);
