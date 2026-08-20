/**
 * Patches the freshly-generated android/ project with the one manual native
 * edit @capacitor-community/admob's docs call for (it isn't auto-applied by
 * `cap sync`, unlike its plugin registration): the AdMob App ID meta-data
 * tag in AndroidManifest.xml, plus the matching string resource.
 *
 * Idempotent — safe to run again after `cap add android` regenerates the
 * platform from scratch (which is why android/ isn't committed; see
 * DEPLOYMENT.md).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
