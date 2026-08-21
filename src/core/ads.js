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

let initialized = false;

/** Call once at boot, after the app's first real user gesture. */
export async function initAds() {
  const plugin = admob();
  if (!plugin || initialized) return;
  initialized = true;
  try {
    await plugin.initialize({
      initializeForTesting: USING_TEST_ADS,
      // This is a children's app: no behavioural ad targeting, ever. These
      // three together are what Google's own Families Policy requires.
      tagForChildDirectedTreatment: true,
      tagForUnderAgeOfConsent: true,
      maxAdContentRating: 'General',
    });
  } catch (err) {
    console.warn('[ads] initialize failed', err);
  }
  prepareInterstitial();
}

export async function showHomeBanner() {
  if (!adsAllowed()) return;
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
  } catch (err) {
    console.warn('[ads] showBanner failed', err);
  }
}

export async function hideBanner() {
  const plugin = admob();
  if (!plugin) return;
  try {
    await plugin.removeBanner();
  } catch {
    /* nothing to remove */
  }
}

let interstitialReady = false;

async function prepareInterstitial() {
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
  if (!adsAllowed() || !interstitialReady) return;
  interstitialReady = false;
  try {
    await admob().showInterstitial();
  } catch (err) {
    console.warn('[ads] showInterstitial failed', err);
  } finally {
    prepareInterstitial();
  }
}
