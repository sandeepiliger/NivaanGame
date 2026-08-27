/**
 * Compile-checks the Java that tools/android-patch.mjs writes into the
 * generated android/ project.
 *
 * A real Gradle build needs the Android SDK from dl.google.com, which isn't
 * reachable from every environment this repo gets developed in — so a bad
 * reference in that generated Java would only surface in CI, a couple of
 * minutes and a red build later. That happened: `BuildConfig.DEBUG`, which
 * Android Gradle Plugin 8 no longer generates unless you ask it to.
 *
 * This compiles the same source against hand-written stubs of just the
 * platform classes it touches. It can't prove the app runs, but it catches
 * typos, missing imports, bad signatures and symbols that don't exist —
 * exactly the class of bug that reached CI — in about a second, using only
 * a JDK. If it can't find javac it skips rather than failing, so the suite
 * still runs anywhere.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { crashApplicationJava, mainActivityJava } from './android-java.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appPackage = JSON.parse(readFileSync(join(root, 'capacitor.config.json'), 'utf8')).appId;

try {
  execSync('command -v javac', { stdio: 'ignore' });
} catch {
  console.log('  android java: skipped (no javac on PATH)');
  process.exit(0);
}

/**
 * Minimal stand-ins for the Android and Capacitor classes the generated code
 * uses. Only the members actually referenced need to exist — if the real
 * platform ever changes one of these signatures the Gradle build catches it;
 * what this guards against is our own code drifting away from them.
 */
const STUBS = {
  'android/content/SharedPreferences.java': `package android.content;
public interface SharedPreferences {
    String getString(String key, String defValue);
    Editor edit();
    interface Editor {
        Editor putString(String key, String value);
        Editor remove(String key);
        boolean commit();
        void apply();
    }
}`,
  'android/content/pm/ApplicationInfo.java': `package android.content.pm;
public class ApplicationInfo {
    public static final int FLAG_DEBUGGABLE = 2;
    public int flags;
}`,
  'android/content/Context.java': `package android.content;
import android.content.pm.ApplicationInfo;
public class Context {
    public static final int MODE_PRIVATE = 0;
    public SharedPreferences getSharedPreferences(String name, int mode) { return null; }
    public ApplicationInfo getApplicationInfo() { return null; }
}`,
  'android/app/Application.java': `package android.app;
import android.content.Context;
public class Application extends Context {}`,
  'android/os/Bundle.java': `package android.os;
public class Bundle {}`,
  'android/app/Activity.java': `package android.app;
import android.content.Context;
import android.os.Bundle;
public class Activity extends Context {
    public void onCreate(Bundle savedInstanceState) {}
}`,
  'android/view/View.java': `package android.view;
public class View {
    public void setPadding(int l, int t, int r, int b) {}
}`,
  'android/view/ViewGroup.java': `package android.view;
public class ViewGroup extends View {
    public void addView(View child) {}
}`,
  'android/widget/TextView.java': `package android.widget;
import android.content.Context;
import android.view.View;
public class TextView extends View {
    public TextView(Context c) {}
    public void setText(CharSequence t) {}
    public void setTextIsSelectable(boolean s) {}
}`,
  'android/widget/ScrollView.java': `package android.widget;
import android.content.Context;
import android.view.ViewGroup;
public class ScrollView extends ViewGroup {
    public ScrollView(Context c) {}
}`,
  'android/content/DialogInterface.java': `package android.content;
public interface DialogInterface {
    interface OnClickListener { void onClick(DialogInterface d, int which); }
}`,
  'android/app/AlertDialog.java': `package android.app;
import android.content.Context;
import android.content.DialogInterface;
import android.view.View;
public class AlertDialog {
    public static class Builder {
        public Builder(Context c) {}
        public Builder setTitle(CharSequence t) { return this; }
        public Builder setView(View v) { return this; }
        public Builder setPositiveButton(CharSequence t, DialogInterface.OnClickListener l) { return this; }
        public Builder setCancelable(boolean c) { return this; }
        public AlertDialog show() { return null; }
    }
}`,
  'com/getcapacitor/BridgeActivity.java': `package com.getcapacitor;
import android.app.Activity;
public class BridgeActivity extends Activity {}`,
};

const dir = mkdtempSync(join(tmpdir(), 'android-java-check-'));
try {
  for (const [path, source] of Object.entries(STUBS)) {
    const file = join(dir, 'stubs', path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, source);
  }

  const appDir = join(dir, 'app', ...appPackage.split('.'));
  mkdirSync(appDir, { recursive: true });
  writeFileSync(join(appDir, 'CrashApplication.java'), crashApplicationJava(appPackage));
  writeFileSync(join(appDir, 'MainActivity.java'), mainActivityJava(appPackage));

  const sources = [
    ...Object.keys(STUBS).map((p) => join(dir, 'stubs', p)),
    join(appDir, 'CrashApplication.java'),
    join(appDir, 'MainActivity.java'),
  ];

  try {
    execFileSync('javac', ['-nowarn', '-d', join(dir, 'out'), ...sources], {
      stdio: 'pipe',
      encoding: 'utf8',
    });
  } catch (err) {
    console.error('\n  ✗ generated Android Java does not compile:\n');
    console.error(String(err.stderr || err.stdout || err.message));
    process.exit(1);
  }

  console.log('  android java: CrashApplication + MainActivity compile clean');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
