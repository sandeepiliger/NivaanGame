/**
 * Stages the static site into www/ for Capacitor's webDir.
 *
 * This app has no bundler step — www/ is just a curated copy of the files
 * that actually ship, mirroring what the GitHub Pages workflow deploys.
 * Regenerated on demand; never committed (see .gitignore).
 */
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const www = join(root, 'www');

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

const entries = ['index.html', 'manifest.webmanifest', 'sw.js', 'src', 'styles', 'assets'];
for (const entry of entries) {
  const from = join(root, entry);
  if (!existsSync(from)) continue;
  cpSync(from, join(www, entry), { recursive: true });
}

console.log(`Staged ${entries.join(', ')} into www/`);
