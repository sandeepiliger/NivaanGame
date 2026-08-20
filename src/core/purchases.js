/**
 * "Remove Ads" — a single non-consumable Google Play purchase.
 *
 * Same pattern as analytics.js/ads.js: reached through Capacitor's global
 * runtime bridge (window.Capacitor.Plugins.NativePurchases) rather than an
 * npm import, so this needs no bundler and silently no-ops on the GitHub
 * Pages web build — there is nothing to purchase there anyway.
 *
 * This talks to Google Play Billing directly (no third-party account like
 * RevenueCat needed) — the product itself is set up once in Play Console;
 * see DEPLOYMENT.md.
 */

import { setSetting } from './store.js';
import { purchaseRemoveAds as trackPurchase } from './analytics.js';

/** Must match the one-time product ID created in Play Console. */
export const REMOVE_ADS_PRODUCT_ID = 'remove_ads';

function purchases() {
  return typeof window !== 'undefined' ? window.Capacitor?.Plugins?.NativePurchases : null;
}

/**
 * Call once at boot. Re-checks Google Play's own purchase record so the
 * entitlement survives a reinstall or a new device signed into the same
 * Play account — this app has no account system of its own to key it to.
 */
export async function restorePurchases() {
  const plugin = purchases();
  if (!plugin) return;
  try {
    const { purchases: owned } = await plugin.getPurchases();
    if (owned.some((p) => p.productIdentifier === REMOVE_ADS_PRODUCT_ID)) {
      setSetting('adsRemoved', true);
    }
  } catch (err) {
    console.warn('[purchases] restore failed', err);
  }
}

/** Price string ("$1.99" etc.) for the parent zone's purchase button, or null if unavailable. */
export async function removeAdsPrice() {
  const plugin = purchases();
  if (!plugin) return null;
  try {
    const { product } = await plugin.getProduct({ productIdentifier: REMOVE_ADS_PRODUCT_ID });
    return product?.priceString ?? null;
  } catch (err) {
    console.warn('[purchases] getProduct failed', err);
    return null;
  }
}

/** Returns true if the purchase went through (or was already owned). */
export async function buyRemoveAds() {
  const plugin = purchases();
  if (!plugin) return false;
  try {
    await plugin.purchaseProduct({ productIdentifier: REMOVE_ADS_PRODUCT_ID });
    setSetting('adsRemoved', true);
    trackPurchase();
    return true;
  } catch (err) {
    // The user cancelling the purchase sheet also lands here — not an error
    // worth logging loudly.
    console.warn('[purchases] purchase did not complete', err);
    return false;
  }
}
