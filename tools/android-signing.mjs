/**
 * Adds a release signingConfig to the freshly-generated android/app/build.gradle,
 * reading the keystore path and credentials from environment variables at
 * *build* time (nothing secret ever gets written to a file in the repo or
 * the generated project) — used by the GitHub Actions release build.
 *
 * Idempotent — safe to run again after `cap add android` regenerates the
 * platform from scratch. No-ops if ANDROID_KEYSTORE_PATH isn't set, so a
 * plain `npm run android:sync` locally (no release build intended) is
 * unaffected.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const gradlePath = join(root, 'android/app/build.gradle');

if (!existsSync(gradlePath)) {
  console.log('android/ not found — run `npx cap add android` first. Skipping signing config.');
  process.exit(0);
}
if (!process.env.ANDROID_KEYSTORE_PATH) {
  console.log('ANDROID_KEYSTORE_PATH not set — skipping release signing config (debug-only build).');
  process.exit(0);
}

let gradle = readFileSync(gradlePath, 'utf8');
if (gradle.includes('signingConfigs')) {
  console.log('signingConfigs already present — leaving build.gradle as-is.');
  process.exit(0);
}

const signingConfigs = `    signingConfigs {
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
`;

gradle = gradle.replace(
  /^ {4}buildTypes \{\n {8}release \{\n/m,
  signingConfigs,
);
writeFileSync(gradlePath, gradle);
console.log('Added a release signingConfig reading from ANDROID_KEYSTORE_* env vars.');
