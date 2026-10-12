// The website hosts two apps: MindPay at the root and "MindPay ใหม่" (the
// redesign, branch v2) under /v2/. GitHub Pages answers every unknown address
// with the root 404.html (a copy of MindPay's index.html for deep links), so a
// reload of a /v2/ page would open the old app. This puts a tiny redirect at
// the top of that 404.html: an unknown /v2/... address goes to the new app's home.
//   node scripts/route-v2.mjs <site folder>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const site = process.argv[2] ?? 'dist';
const file = join(site, '404.html');
if (!existsSync(file)) process.exit(0);
const base = '/Socrates-and-Skeletons-/v2';
const marker = 'data-route="v2"';
let html = readFileSync(file, 'utf8');
if (!html.includes(marker)) {
  const script = `<script ${marker}>(function(){var b='${base}',p=location.pathname;if((p===b||p.indexOf(b+'/')===0)&&p!==b+'/'){location.replace(b+'/');}})();</script>`;
  html = html.replace(/<head([^>]*)>/i, (m) => `${m}${script}`);
  writeFileSync(file, html);
}
console.log('v2 routing in', file);
