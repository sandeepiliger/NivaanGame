/**
 * AdMob — a banner on the home screen and an interstitial between levels
 * (never mid-puzzle), gated behind Families-Policy-compliant settings and
 * the "remove ads" purchase.
 *
 * Same pattern as analytics.js: reached through Capacitor's global runtime
 * bridge (window.Capacitor.Plugins.AdMob) rather than an npm import, so
 * this needs no bundler and silently no-ops on the GitHub Pages web build.
 */

import { settings } from './store.js';

// Real AdMob ad units (account "nivaangame"). AdMob's own review can take
// a few days after first traffic before non-test ads actually start
// serving — see DEPLOYMENT.md.
const BANNER_AD_ID = 'ca-app-pub-4919382081912971/3590456253';
const INTERSTITIAL_AD_ID = 'ca-app-pub-4919382081912971/9964292912';
const USING_TEST_ADS = false;

function admob() {
  return typeof window !== 'undefined' ? window.Capacitor?.Plugins?.AdMob : null;
}

function adsAllowed() {
  return Boolean(admob()) && !settings().adsRemoved;
}

/* -------------------------------------------------------------------------- */
/* Banner state                                                               */
/* -------------------------------------------------------------------------- */
//
// The banner is a *native* view stacked above the WebView, not part of the
// page, so it paints over everything the app draws and no z-index can get a
// dialog above it. Two things follow, and both are handled here:
//
//   1. It has to be parked while a modal is open (see suspendBanner(), called
//      from openModal() in screens/dialogs.js). Otherwise it covers the
//      parental gate's question, and — because the native view gets
//      repositioned when the soft keyboard pushes the layout up — lands in
//      the middle of the dialog, right next to its buttons.
//   2. Space for it has to be reserved in the page, or whatever sits at the
//      bottom of the home screen ends up underneath it. The height it
//      actually occupies is published as the --banner-h CSS variable.

/** The current screen wants a banner (home does; nothing else). */
let bannerWanted = false;
/** A native banner view exists — it may be visible or temporarily hidden. */
let bannerShown = false;
/** Open modals. They nest (gate → confirm → info), so this is a depth. */
let suspendDepth = 0;

/**
 * Best known banner height in dp, which the WebView maps 1:1 to CSS px.
 * Seeded with AdMob's standard banner height so the layout still reserves
 * something sane on a device that never reports a size.
 */
let bannerHeight = 50;

/** Mirror the space the banner occupies into CSS, for the page to pad with. */
function publishBannerHeight() {
  if (typeof document === 'undefined') return;
  const visible = bannerShown && suspendDepth === 0;
  document.documentElement.style.setProperty('--banner-h', `${visible ? bannerHeight : 0}px`);
}

/** rAF where there is one (never in Node, where this module only gets parsed). */
function onNextFrame(fn) {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fn);
  else setTimeout(fn, 0);
}

let watchingSize = false;

function watchBannerSize(plugin) {
  if (watchingSize || typeof plugin.addListener !== 'function') return;
  watchingSize = true;
  // An adaptive banner's height depends on the device, so take the real
  // measurement when it arrives. A hidden or failed banner reports 0, which
  // must not overwrite the good value — whether space is reserved is decided
  // by our own state above, not by the event.
  plugin.addListener('bannerAdSizeChanged', ({ height }) => {
    if (height > 0) bannerHeight = height;
    publishBannerHeight();
  });
}

// Unlike Web Audio/speechSynthesis, AdMob's plugin has no browser-gesture
// unlock requirement, so this runs unconditionally at boot (see main.js).
// showHomeBanner()/prepareInterstitial() await this promise before touching
// the plugin — calling AdMob.showBanner() before initialize() has completed
// crashes natively (its ad container view isn't set up yet), which is
// exactly what made the home screen's banner crash the app on cold boot,
// since home is the very first screen shown and its onEnter fires
// synchronously, well before a real gesture could ever reach firstGesture().
let initPromise = null;

/** Call once at boot. */
export function initAds() {
  const plugin = admob();
  if (!plugin) return Promise.resolve();
  if (!initPromise) {
    initPromise = plugin
      .initialize({
        initializeForTesting: USING_TEST_ADS,
        // This is a children's app: no behavioural ad targeting, ever. These
        // three together are what Google's own Families Policy requires.
        tagForChildDirectedTreatment: true,
        tagForUnderAgeOfConsent: true,
        maxAdContentRating: 'General',
      })
      .catch((err) => console.warn('[ads] initialize failed', err))
      .then(() => watchBannerSize(plugin))
      .then(prepareInterstitial);
  }
  return initPromise;
}

export async function showHomeBanner() {
  bannerWanted = true;
  if (!adsAllowed()) return;
  await initAds();
  // initialize() is slow on a cold boot — slow enough for the child to have
  // opened the parental gate in the meantime, or navigated off home. Neither
  // is a reason to put an ad on screen now, so re-check rather than trusting
  // the state this started with.
  if (!bannerWanted || suspendDepth > 0 || bannerShown) return;
  try {
    await admob().showBanner({
      adId: BANNER_AD_ID,
      isTesting: USING_TEST_ADS,
      adSize: 'ADAPTIVE_BANNER',
      position: 'BOTTOM_CENTER',
      // Non-personalized ads only — required alongside the child-directed
      // flags in initAds() above.
      npa: true,
    });
    bannerShown = true;
    publishBannerHeight();
  } catch (err) {
    console.warn('[ads] showBanner failed', err);
  }
}

export async function hideBanner() {
  bannerWanted = false;
  const plugin = admob();
  if (!plugin) return;
  bannerShown = false;
  publishBannerHeight();
  try {
    await plugin.removeBanner();
  } catch {
    /* nothing to remove */
  }
}

/**
 * Park the banner while a modal dialog is open — it is a native view above
 * the WebView, so it would otherwise paint straight over the dialog. Paired
 * with restoreBanner(); openModal() in screens/dialogs.js calls both, which
 * covers every dialog in the app.
 *
 * Uses hideBanner()/resumeBanner() rather than remove/show so the loaded ad
 * survives: no fresh request, no wasted impression, nothing to reload.
 */
export async function suspendBanner() {
  suspendDepth += 1;
  publishBannerHeight();
  if (suspendDepth > 1 || !bannerShown) return;
  try {
    await admob().hideBanner();
  } catch (err) {
    console.warn('[ads] hideBanner failed', err);
  }
}

/** Undo one suspendBanner(). The banner returns once the last modal closes. */
export function restoreBanner() {
  if (suspendDepth === 0) return;
  suspendDepth -= 1;
  publishBannerHeight();
  if (suspendDepth > 0) return;

  // A dialog frequently closes straight into a navigation — passing the
  // parental gate opens the parent zone — and `go()` sets location.hash, so
  // the route change that takes the banner away only lands a task later.
  // Giving the resume a frame's grace, and re-checking after it, keeps the
  // banner from flashing back onto the screen it is about to leave.
  onNextFrame(() => {
    if (suspendDepth > 0 || !bannerWanted) return;
    if (!bannerShown) {
      // Init finished while the dialog was up, so it was never shown at all.
      showHomeBanner();
      return;
    }
    admob()
      ?.resumeBanner()
      .catch((err) => console.warn('[ads] resumeBanner failed', err));
  });
}

let interstitialReady = false;

async function prepareInterstitial() {
  // Called only after initAds() has already resolved (from within its own
  // .then, or from maybeShowInterstitial() below, well after boot) — must
  // NOT await initAds() itself here, or it'd await its own still-pending
  // promise and deadlock.
  if (!adsAllowed()) return;
  try {
    await admob().prepareInterstitial({ adId: INTERSTITIAL_AD_ID, isTesting: USING_TEST_ADS, npa: true });
    interstitialReady = true;
  } catch (err) {
    console.warn('[ads] prepareInterstitial failed', err);
  }
}

/**
 * Shown only at a natural pause point (the results screen, after the star
 * celebration, and never when a new reward is also being celebrated) — see
 * the one call site in result.js.
 */
export async function maybeShowInterstitial() {
  if (!adsAllowed()) return;
  await initAds();
  if (!interstitialReady) return;
  interstitialReady = false;
  try {
    await admob().showInterstitial();
  } catch (err) {
    console.warn('[ads] showInterstitial failed', err);
  } finally {
    prepareInterstitial();
  }
}
