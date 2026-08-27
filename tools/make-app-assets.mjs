/**
 * Generates the source images @capacitor/assets needs to produce real Android
 * launcher icons and splash screens (`npm run android:assets`).
 *
 * Without this the app ships with Capacitor's own stock logo — `cap add
 * android` writes placeholder mipmaps, and nothing else ever replaces them.
 *
 * Android adaptive icons are two layers (background + foreground) composited
 * behind a mask the device chooses — circle, squircle, rounded square. Only a
 * centred circle roughly 66/108ths of the width is guaranteed to survive every
 * mask, so the mascot is drawn well inside that safe zone here rather than
 * filling the canvas the way assets/icon.svg does.
 *
 * Run after editing the mascot; the PNGs it writes are committed so CI only
 * has to run capacitor-assets, not a rasteriser.
 *
 * These land in resources/, deliberately NOT assets/ — the latter is copied
 * wholesale into www/ by build-www.mjs, and a 2732px splash has no business
 * being downloaded by the web build. resources/ is Capacitor's own convention
 * for native-only source art.
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const assets = join(root, 'resources');
mkdirSync(assets, { recursive: true });

/** The mascot, in its own 0..104 x 0..117 coordinate space. */
const MASCOT = `
  <line x1="26" y1="26" x2="14" y2="8" stroke="#2a1a5e" stroke-width="5" stroke-linecap="round"/>
  <line x1="78" y1="26" x2="90" y2="8" stroke="#2a1a5e" stroke-width="5" stroke-linecap="round"/>
  <circle cx="14" cy="8" r="7" fill="#ff4f81"/>
  <circle cx="90" cy="8" r="7" fill="#35d0e8"/>
  <rect x="22" y="86" width="60" height="30" rx="14" fill="#ffcc29" stroke="#0f2b3d" stroke-width="3"/>
  <circle cx="52" cy="101" r="6" fill="#fff" stroke="#0f2b3d" stroke-width="2.5"/>
  <rect x="12" y="20" width="80" height="72" rx="30" fill="#ffffff" stroke="#0f2b3d" stroke-width="3.5"/>
  <rect x="22" y="36" width="60" height="34" rx="17" fill="#c9f4ff" stroke="#0f2b3d" stroke-width="3"/>
  <circle cx="40" cy="52" r="8" fill="#0f2b3d"/>
  <circle cx="64" cy="52" r="8" fill="#0f2b3d"/>
  <circle cx="37" cy="49" r="2.6" fill="#fff"/>
  <circle cx="61" cy="49" r="2.6" fill="#fff"/>
  <circle cx="24" cy="72" r="6" fill="#ffb3c9"/>
  <circle cx="80" cy="72" r="6" fill="#ffb3c9"/>
  <path d="M38,68 q14,16 28,0 z" fill="#ff4f81" stroke="#0f2b3d" stroke-width="3" stroke-linejoin="round"/>
`;

/** Mascot bounding box in its own units — antenna tips to feet. */
const MASCOT_W = 90;
const MASCOT_H = 115;
const MASCOT_CX = 52;
const MASCOT_CY = 58.5;

const GRADIENT = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#8f77ec"/>
    <stop offset="1" stop-color="#4a2fb0"/>
  </linearGradient>
`;

/** Centre the mascot on a `size` canvas, drawn `targetH` pixels tall. */
function mascotAt(size, targetH) {
  const scale = targetH / MASCOT_H;
  return `<g transform="translate(${size / 2} ${size / 2}) scale(${scale}) translate(${-MASCOT_CX} ${-MASCOT_CY})">${MASCOT}</g>`;
}

function svg(size, body) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`,
  );
}

async function png(name, size, body) {
  const out = join(assets, name);
  // Flat brand colours and a hard-edged mascot palettise losslessly, which
  // turns a 4MB splash into a couple of hundred KB.
  await sharp(svg(size, body), { density: 384 })
    .png({ palette: true, compressionLevel: 9 })
    .toFile(out);
  console.log('wrote', name, `${size}x${size}`);
}

/* -------------------------------------------------------------------------- */

// Adaptive icon, background layer: just the brand gradient.
await png('icon-background.png', 1024, `<defs>${GRADIENT}</defs><rect width="1024" height="1024" fill="url(#bg)"/>`);

// Adaptive icon, foreground layer: the mascot alone on transparency. At 55% of
// the canvas the body sits inside the 66/108 circle every mask preserves, and
// only the antenna tips reach past it — which the rounded-square and squircle
// masks most launchers actually use will keep anyway.
await png('icon-foreground.png', 1024, mascotAt(1024, 560));

// Legacy square icon (older Android, and the Play Store's own 512px listing
// icon) — the full composed design, mascot larger since nothing is masked.
await png(
  'icon.png',
  1024,
  `<defs>${GRADIENT}</defs><rect width="1024" height="1024" fill="url(#bg)"/>${mascotAt(1024, 620)}`,
);

// Splash: the canvas is far larger than any phone screen because Capacitor
// centre-crops it, so the mascot is deliberately small here.
const splashBody = (bg) =>
  `<rect width="2732" height="2732" fill="${bg}"/>${mascotAt(2732, 620)}`;
await png('splash.png', 2732, splashBody('#6c4ce0'));
await png('splash-dark.png', 2732, splashBody('#2a1a5e'));

// The Play Store listing also wants a plain 512px icon; reuse the composed one.
const listing = await sharp(join(assets, 'icon.png')).resize(512, 512).png().toBuffer();
writeFileSync(join(assets, 'play-store-icon-512.png'), listing);
console.log('wrote play-store-icon-512.png 512x512');
