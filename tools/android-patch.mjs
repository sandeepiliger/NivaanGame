/**
 * Patches the freshly-generated android/ project with the manual native
 * edits that aren't auto-applied by `cap sync`:
 *   - the AdMob App ID meta-data tag in AndroidManifest.xml (per
 *     @capacitor-community/admob's docs), plus the matching string resource.
 *   - a CrashApplication that persists any uncaught exception's stack trace
 *     to SharedPreferences, and a MainActivity that displays it on the next
 *     launch — this app's support workflow has no adb/device-log access, so
 *     this is the only way to see why a release build crashed on a device.
 *
 * Idempotent — safe to run again after `cap add android` regenerates the
 * platform from scratch (which is why android/ isn't committed; see
 * DEPLOYMENT.md).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { crashApplicationJava, mainActivityJava } from './android-java.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifestPath = join(root, 'android/app/src/main/AndroidManifest.xml');
const stringsPath = join(root, 'android/app/src/main/res/values/strings.xml');
const configPath = join(root, 'capacitor.config.json');

if (!existsSync(manifestPath)) {
  console.log('android/ not found — run `npx cap add android` first. Skipping AdMob patch.');
  process.exit(0);
}

const config = JSON.parse(readFileSync(configPath, 'utf8'));
const appId = config.plugins?.AdMob?.appId;
if (!appId) {
  console.log('No plugins.AdMob.appId in capacitor.config.json — skipping AdMob patch.');
  process.exit(0);
}

let strings = readFileSync(stringsPath, 'utf8');
if (!strings.includes('name="admob_app_id"')) {
  strings = strings.replace('</resources>', `    <string name="admob_app_id">${appId}</string>\n</resources>`);
  writeFileSync(stringsPath, strings);
  console.log('Added admob_app_id to strings.xml');
} else {
  // Keep it in sync if the App ID in capacitor.config.json ever changes.
  strings = strings.replace(
    /<string name="admob_app_id">.*<\/string>/,
    `<string name="admob_app_id">${appId}</string>`,
  );
  writeFileSync(stringsPath, strings);
}

let manifest = readFileSync(manifestPath, 'utf8');
if (!manifest.includes('com.google.android.gms.ads.APPLICATION_ID')) {
  manifest = manifest.replace(
    /(<application[^>]*>)/,
    `$1\n\n        <meta-data\n            android:name="com.google.android.gms.ads.APPLICATION_ID"\n            android:value="@string/admob_app_id" />`,
  );
  writeFileSync(manifestPath, manifest);
  console.log('Added AdMob APPLICATION_ID meta-data to AndroidManifest.xml');
}

// Point the app at CrashApplication so it's in place before anything else
// (including Firebase's auto-init ContentProvider) can crash. The generated
// manifest's <application> tag has no android:name yet, so just add one.
if (!manifest.includes('android:name=".CrashApplication"')) {
  manifest = manifest.replace('<application', '<application android:name=".CrashApplication"');
  writeFileSync(manifestPath, manifest);
  console.log('Registered CrashApplication in AndroidManifest.xml');
}

const appPackage = config.appId; // e.g. com.labs32.nivaangame
const packageDir = join(root, 'android/app/src/main/java', ...appPackage.split('.'));
mkdirSync(packageDir, { recursive: true });

writeFileSync(join(packageDir, 'CrashApplication.java'), crashApplicationJava(appPackage));
writeFileSync(join(packageDir, 'MainActivity.java'), mainActivityJava(appPackage));
console.log('Wrote CrashApplication.java and MainActivity.java (crash-trace-on-next-launch handler)');

// Android app version, driven from package.json's version — otherwise every
// build carries Capacitor's stock "versionCode 1 / versionName 1.0" forever,
// since android/ is regenerated from scratch each time and nothing else ever
// touches these. Play Console rejects any upload whose versionCode isn't
// strictly greater than the last one, so a fixed versionCode would mean the
// very first update after a real Play upload fails outright.
const gradlePath = join(root, 'android/app/build.gradle');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
// major.minor.patch -> a monotonically increasing integer as long as semver
// itself only increases (safe as long as minor/patch each stay under 100,
// true for any realistic release cadence).
const versionCode = major * 10000 + minor * 100 + patch;

let gradle = readFileSync(gradlePath, 'utf8');
gradle = gradle
  .replace(/versionCode \d+/, `versionCode ${versionCode}`)
  .replace(/versionName "[^"]*"/, `versionName "${pkg.version}"`);
writeFileSync(gradlePath, gradle);
console.log(`Set Android version to ${pkg.version} (versionCode ${versionCode})`);
