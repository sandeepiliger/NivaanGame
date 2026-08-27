/**
 * The Java that gets written into the generated android/ project.
 *
 * Kept separate from android-patch.mjs (which applies it) so that
 * check-android-java.mjs can compile-check the exact same source without
 * needing android/ to exist or triggering any file writes.
 */

/**
 * Catches uncaught exceptions app-wide and persists the stack trace.
 *
 * Registered via android:name on <application>, and installs its handler in
 * the constructor rather than onCreate — a ContentProvider (Firebase's
 * auto-init one, for instance) runs before Application.onCreate, and a crash
 * that early would otherwise go unrecorded.
 */
export function crashApplicationJava(appPackage) {
  return `package ${appPackage};

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
}

/**
 * Capacitor's activity, plus a debug-only dialog showing the last saved crash.
 */
export function mainActivityJava(appPackage) {
  return `package ${appPackage};

import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
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

    /**
     * True for debug builds, false for the release build that reaches Play.
     *
     * Deliberately reads the manifest flag the build injects rather than
     * BuildConfig.DEBUG: Android Gradle Plugin 8 stops generating BuildConfig
     * unless android.buildFeatures.buildConfig is switched back on, so
     * referencing it here would mean patching build.gradle as well.
     */
    private boolean isDebuggable() {
        return (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    private void showLastCrashIfAny() {
        // Debug builds only. CrashApplication still records the trace in
        // release, but showing a parent a raw Java stack trace would be worse
        // than the crash itself — in release the saved trace is simply
        // cleared on the next launch.
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        String trace = prefs.getString(KEY_TRACE, null);
        if (trace == null) return;
        prefs.edit().remove(KEY_TRACE).apply();
        if (!isDebuggable()) return;

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
}
