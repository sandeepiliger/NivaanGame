/**
 * Firebase Analytics — a thin wrapper so the rest of the app never touches
 * Capacitor directly. Every call is fire-and-forget and safe to call from
 * anywhere.
 *
 * This app has no bundler and ships raw ES modules everywhere, including
 * inside the native Android build — so plugins are reached through
 * Capacitor's own global runtime bridge (`window.Capacitor.Plugins`, auto
 * injected by the native shell before this page's scripts run) rather than
 * an npm import, which a plain browser can't resolve. On the GitHub Pages
 * build there is no native shell, `window.Capacitor` is simply undefined,
 * and every call below silently no-ops.
 *
 * Event names follow Google Analytics' own "recommended events for games"
 * (level_start, level_end, unlock_achievement, select_content) so they get
 * GA4's built-in game reports for free, instead of showing up as unmapped
 * custom events.
 */

function firebaseAnalytics() {
  return typeof window !== 'undefined' ? window.Capacitor?.Plugins?.FirebaseAnalytics : null;
}

function logEvent(name, params = {}) {
  const plugin = firebaseAnalytics();
  if (!plugin) return;
  plugin.logEvent({ name, params }).catch((err) => {
    console.warn('[analytics] logEvent failed:', name, err);
  });
}

/** Call once per screen mount — router.js is the one call site. */
export function screenView(screenName) {
  logEvent('screen_view', { screen_name: screenName, screen_class: screenName });
}

/** Once when a level (or the daily challenge) begins — not per round. */
export function levelStart({ levelId, categoryId, tier }) {
  logEvent('level_start', { level_name: levelId, category: categoryId ?? '', tier: tier ?? 0 });
}

export function levelEnd({ levelId, categoryId, success, stars, ms }) {
  logEvent('level_end', {
    level_name: levelId,
    category: categoryId ?? '',
    success,
    stars,
    duration_ms: Math.round(ms || 0),
  });
}

export function selectCategory(categoryId) {
  logEvent('select_content', { content_type: 'category', item_id: categoryId });
}

export function unlockAchievement(achievementId) {
  logEvent('unlock_achievement', { achievement_id: achievementId });
}

/** Fired by the "Remove Ads" purchase flow once it settles. */
export function purchaseRemoveAds() {
  logEvent('purchase', { item_id: 'remove_ads', currency: 'USD' });
}
