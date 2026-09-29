// Draws the MindPay app icon, Android adaptive icon, splash and web icons
// from น้องกล้า's own drawing (src/ui/kla/art.tsx), so the icon always
// matches the character in the app.
//
// Usage: node scripts/kla-icons/make.mjs
// Then: python3 scripts/kla-icons/finish.py (removes the alpha channel the
// iOS icon must not have). New icons reach phones with the next app build
// (an over-the-air update cannot change the icon or splash).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { rolldown } from 'rolldown';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const tmp = join(root, 'node_modules', '.cache', 'kla-icons');
mkdirSync(tmp, { recursive: true });

// 1. Bundle the drawing with a plain-SVG stand-in for react-native-svg.
const bundle = await rolldown({
  input: join(here, 'pictures.tsx'),
  platform: 'node',
  external: [/^react($|\/)/, /^react-dom($|\/)/],
  resolve: { alias: { 'react-native-svg': join(here, 'svg-shim.tsx') } },
  transform: { jsx: 'react-jsx' },
});
const outFile = join(tmp, 'pictures.mjs');
await bundle.write({ file: outFile, format: 'esm' });
const pics = await import(pathToFileURL(outFile).href);

// 2. Render each picture to PNG in Chromium.
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function png(svg, size, file, { transparent = false, mono = false } = {}) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
  let buf = await page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
  if (mono) {
    // Android themed icon: one colour. Keep the shape, cut the eyes and mouth out.
    const data = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < d.data.length; i += 4) {
        const lum = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
        const a = lum < 95 ? 0 : d.data[i + 3];
        d.data[i] = d.data[i + 1] = d.data[i + 2] = 255;
        d.data[i + 3] = a;
      }
      ctx.putImageData(d, 0, 0);
      return c.toDataURL('image/png').split(',')[1];
    }, buf.toString('base64'));
    buf = Buffer.from(data, 'base64');
  }
  writeFileSync(join(root, file), buf);
  console.log('wrote', file);
}

await png(pics.icon(1024), 1024, 'assets/icon.png');
await png(pics.adaptiveForeground(1024), 1024, 'assets/android-icon-foreground.png', { transparent: true });
await png(pics.adaptiveBackground(1024), 1024, 'assets/android-icon-background.png');
await png(pics.adaptiveForeground(1024), 1024, 'assets/android-icon-monochrome.png', { transparent: true, mono: true });
await png(pics.splash(1024), 1024, 'assets/splash-icon.png', { transparent: true });
await png(pics.webIcon(48), 48, 'assets/favicon.png');
await png(pics.webIcon(180), 180, 'assets/web/apple-touch-icon.png');
await png(pics.webIcon(192), 192, 'assets/web/icon-192.png');
await png(pics.webIcon(512), 512, 'assets/web/icon-512.png');
await browser.close();
