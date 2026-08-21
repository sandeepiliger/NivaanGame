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

const crashApplicationJava = `package ${appPackage};

import android.app.Application;
import android.content.SharedPreferences;

import java.io.PrintWriter;
import java.io.StringWriter;

/**
 * Registered as android:name in AndroidManifest.xml by tools/android-patch.mjs.
 * Persists the full stack trace of any uncaught exception to SharedPreferences
 * so MainActivity can show it on the next launch — there's no adb/device-log
 * access in this app's support workflow, so this is the only way to see why a
 * build crashed on a real device.
 */
public class CrashApplication extends Application {

    private static final String PREFS = "crash_log";
    private static final String KEY_TRACE = "last_trace";

    public CrashApplication() {
        super();
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            try {
                StringWriter sw = new StringWriter();
                throwable.printStackTrace(new PrintWriter(sw));
                SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
                prefs.edit().putString(KEY_TRACE, sw.toString()).commit();
            } catch (Throwable ignored) {
                // Saving the trace must never block the crash from being reported normally.
            }
            if (previous != null) {
                previous.uncaughtException(thread, throwable);
            } else {
                Runtime.getRuntime().exit(10);
            }
        });
    }
}
`;

const mainActivityJava = `package ${appPackage};

import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.widget.ScrollView;
import android.widget.TextView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String PREFS = "crash_log";
    private static final String KEY_TRACE = "last_trace";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showLastCrashIfAny();
    }

    private void showLastCrashIfAny() {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        String trace = prefs.getString(KEY_TRACE, null);
        if (trace == null) return;
        prefs.edit().remove(KEY_TRACE).apply();

        TextView text = new TextView(this);
        text.setText(trace);
        text.setPadding(24, 24, 24, 24);
        text.setTextIsSelectable(true);
        ScrollView scroll = new ScrollView(this);
        scroll.addView(text);

        new AlertDialog.Builder(this)
                .setTitle("Last crash details")
                .setView(scroll)
                .setPositiveButton("OK", null)
                .setCancelable(true)
                .show();
    }
}
`;

writeFileSync(join(packageDir, 'CrashApplication.java'), crashApplicationJava);
writeFileSync(join(packageDir, 'MainActivity.java'), mainActivityJava);
console.log('Wrote CrashApplication.java and MainActivity.java (crash-trace-on-next-launch handler)');
