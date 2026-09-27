// Makes the exported web build installable on a phone home screen:
// iPhone Safari "Add to Home Screen" and Android Chrome "Install app" get the
// MindPay name and icon, and the app opens full screen without browser bars.
//
// Usage (after `expo export --platform web --output-dir dist`):
//   EXPO_WEB_BASE_URL=/Socrates-and-Skeletons- node scripts/web-home-screen.mjs dist
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const base = (process.env.EXPO_WEB_BASE_URL ?? '').replace(/\/$/, '');
const FOREST = '#0E3B2C';

for (const name of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
  copyFileSync(join('assets', 'web', name), join(dist, name));
}

const manifest = {
  name: 'MindPay',
  short_name: 'MindPay',
  description: 'เพื่อนการเงินที่อ่านสลิปและบอกว่าเงินพอถึงวันไหน',
  lang: 'th',
  start_url: `${base}/`,
  scope: `${base}/`,
  display: 'standalone',
  background_color: FOREST,
  theme_color: FOREST,
  icons: [
    { src: `${base}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `${base}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
  ],
};
writeFileSync(join(dist, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

const tags = [
  `<link rel="manifest" href="${base}/manifest.webmanifest">`,
  `<link rel="apple-touch-icon" href="${base}/apple-touch-icon.png">`,
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="MindPay">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  // Brand green while the app loads, so the page does not flash white before the opening animation.
  `<style>html, body { background-color: ${FOREST}; }</style>`,
].join('\n    ');

const indexPath = join(dist, 'index.html');
const html = readFileSync(indexPath, 'utf8');
if (!html.includes('</head>')) throw new Error(`${indexPath} has no </head>`);
if (!html.includes('rel="manifest"')) {
  writeFileSync(indexPath, html.replace('</head>', `    ${tags}\n  </head>`));
}
console.log(`Home-screen settings added (base "${base || '/'}")`);
