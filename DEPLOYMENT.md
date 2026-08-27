# Publishing to the Play Store

Everything code-side is done: the Android wrapper, Firebase Analytics, AdMob
(Families-Policy compliant), and a "Remove Ads" one-time purchase. What's
left are the accounts and one-time setup steps only you can do — Google
requires the actual developer identity, not an AI session's.

## Try it right now

The [Android Build workflow](../../actions/workflows/android-build.yml)
already builds a working, installable **debug APK** on every push to
`main` — no account setup needed for this part. Open the latest successful
run, scroll to **Artifacts**, download `nivaan-debug-apk`, and sideload it
onto an Android phone (unzip it first, then open the `.apk`; you'll need to
allow "install from this source" once). This is the real native app,
running the real game — a good sanity check before doing any of the
account setup below.

## 1. Google Play Console

Register at [play.google.com/console](https://play.google.com/console) —
a one-time $25 fee, plus identity verification that can take a day or two.
Do this first; everything else can happen while you wait.

## 2. Firebase (Analytics)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. Inside the project, **Add app → Android**. Package name must be exactly
   `com.labs32.nivaangame` (from `capacitor.config.json` — change it there
   first if you want a different one, **before** your first Play Store
   upload; Google treats a package name change afterwards as a new, unrelated app).
3. Download the real `google-services.json` it gives you.
4. In your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - Name: `GOOGLE_SERVICES_JSON`
   - Value: the entire contents of that file, pasted as-is.
5. Push anything to `main` (or re-run the `Android Build` workflow) — the
   next build will pick it up automatically. Nothing else in the code needs
   to change; `src/core/analytics.js` already sends events, it just had
   nowhere real to send them until now.

## 3. AdMob

1. Go to [apps.admob.com](https://apps.admob.com) → **Apps → Add app** →
   Android → "No" (not yet published) → fill in the name.
2. **Under Apps → your app → App settings**, copy the **App ID**
   (`ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`).
3. **Ad units → Add ad unit**: create one **Banner** and one **Interstitial**.
   Copy both ad unit IDs (`ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ`).
4. **Important — Families Policy**: under **App settings → Manage → Users
   under the age of consent** (or your app's content settings), mark the
   app as directed at children / tag ad requests accordingly. This app
   already sends `tagForChildDirectedTreatment`, `tagForUnderAgeOfConsent`,
   and `maxAdContentRating: General` on every ad request
   (`src/core/ads.js`) — the AdMob account side needs the matching setting
   so it only ever serves Families-eligible, non-personalized creatives.
5. Update three places with your real IDs (currently Google's public *test*
   IDs, which only ever show clearly-labelled test ads and are safe to
   leave in until you're ready):
   - `capacitor.config.json` → `plugins.AdMob.appId`
   - `src/core/ads.js` → `BANNER_AD_ID`, `INTERSTITIAL_AD_ID`, and flip
     `USING_TEST_ADS` to `false`
6. Run `npm run android:sync` locally (or just push — CI regenerates
   `android/` from scratch every time) so the patched AndroidManifest.xml
   picks up the new App ID.

## 4. Signing key + release builds

You need a keystore to sign the app for the Play Store. Generate one
**once**, locally, with the JDK's `keytool` (or Android Studio's "Generate
Signed Bundle" wizard, which does the same thing with a GUI):

```
keytool -genkeypair -v -keystore release.keystore -alias nivaan \
  -keyalg RSA -keysize 2048 -validity 10000
```

**Back this file up somewhere safe outside git — losing it means you can
never update the app again under the same listing.** It must never be
committed to the repo (`.gitignore` already excludes `*.keystore`/`*.jks`).

Add four more repo secrets (**Settings → Secrets and variables → Actions**):

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -i release.keystore \| pbcopy` (or equivalent) — the whole keystore file, base64-encoded |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password you chose |
| `ANDROID_KEY_ALIAS` | `nivaan` (or whatever alias you used) |
| `ANDROID_KEY_PASSWORD` | the key password you chose |

Once all four exist, the `Android Build` GitHub Action (`.github/workflows/android-build.yml`)
produces a **signed release AAB** as a downloadable artifact on every run,
in addition to the debug APK it always builds. Download that AAB from the
workflow run's "Artifacts" section and upload it directly to Play Console
— no local Android Studio needed at all, though installing it is still
worth doing for day-to-day debugging (Android Studio → Open → the `android/`
folder, after running `npm run android:sync` locally at least once).

## 5. The "Remove Ads" purchase

1. In Play Console, once the app has its first upload (even just an
   internal-testing one — see step 7): **Monetize → Products → In-app
   products → Create product**.
2. Product ID must be exactly `remove_ads` (matches
   `REMOVE_ADS_PRODUCT_ID` in `src/core/purchases.js`).
3. Set it as a **one-time product** (not a subscription), give it a price,
   and activate it.
4. That's it — `src/core/purchases.js` already talks to Google Play
   Billing directly (no third-party service or account needed for this one
   product) and the parent zone already has a working "Remove ads" button.

## 5b. Privacy policy and store listing art

**Privacy policy.** Play Console requires a publicly reachable privacy
policy URL, and reviews it closely for a Families app. `privacy.html` at
the repo root is served by the existing GitHub Pages workflow, so once
pushed it is live at:

```
https://sandeepiliger.github.io/NivaanGame/privacy.html
```

Before you paste that into Play Console, open it and **replace the contact
address placeholder** with a real support email you actually monitor — a
parent must have somewhere to write. If you rename the app, update the
name in that file too.

**Icons and splash.** `npm run android:assets` renders the launcher icons
and splash screens from the mascot in `tools/make-app-assets.mjs`, and CI
runs it on every build, so the app no longer ships Capacitor's stock logo.
The same command writes `resources/play-store-icon-512.png`, which is the
512×512 icon the Play Store listing asks for.

Still to produce by hand for the listing: a **1024×500 feature graphic**
and **at least two phone screenshots**. Neither is needed for an internal
testing release — only for production.

## 6. Target audience, content rating, and the Data Safety form

This app is genuinely child-directed (ages 2–8, ABCs, counting, a cartoon
mascot) — Google's own review will treat it that way regardless of what
gets self-declared, and COPPA/India's DPDP Act apply based on real
audience too, not a checkbox. In Play Console → **App content**:

- **Target audience and content**: declare the real age range. Don't try
  to dodge the Families Policy classification — see the note above.
- **Ads**: declare that the app shows ads, and that they're configured for
  a children's audience (matches what you set up in AdMob step 3.4).
- **Data safety**: this app collects nothing itself (no accounts, no
  server, everything lives in `localStorage` on-device — see `src/core/store.js`).
  Firebase Analytics and AdMob do collect some data on Google's side even
  in non-personalized mode (basic diagnostics, ad interaction) — declare
  those honestly per each SDK's own disclosure docs (Firebase's and
  AdMob's Play Console listing pages both have exact wording for this).
- **Content rating questionnaire**: answer based on actual content — this
  app has no violence, no user-generated content, no chat.

## 7. First upload

1. **Play Console → your app → Testing → Internal testing → Create a new release**.
2. Upload the release AAB from the GitHub Actions artifact (step 4).
3. Add yourself (and anyone else testing) as a tester by email.
4. Once that's working end-to-end — including a real test purchase of
   "Remove ads" (Play Console's internal testing track lets testers buy
   for real without being charged) — promote to **Production**.

## Quick local reference

```
npm run android:sync   # stage www/, regenerate android/, apply the AdMob patch
npx cap add android    # first time only, if android/ doesn't exist yet
```

`android/`, `www/`, and `node_modules/` are all git-ignored and fully
regenerated on demand — never hand-edit anything under `android/` directly,
since the next sync wipes it. If you need a native-side change that isn't
covered by a Capacitor plugin's own config, add it to `tools/android-patch.mjs`
instead, the same way the AdMob manifest entry is handled.
