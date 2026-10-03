/**
 * Screenshot one screen of the web build in any colour theme and light/dark mode, with the demo data
 * (fake Supabase, nothing leaves the computer). For checking a screen against docs/DESIGN_SYSTEM.md.
 *
 *   npm run e2e:web            # builds dist/ once
 *   node scripts/theme-shot.mjs <path> <scrollY> <name> [light|dark] [theme] [buttonLabelToTap]
 *   e.g. node scripts/theme-shot.mjs /skins 0 skins-rose dark rose   -> theme-shots/skins-rose.png
 */
import { chromium } from 'playwright';
import { createFakeSupabase, serveDist, SUPA, routeQrDecoder } from '../e2e/fake-backend.mjs';
const [path = '', scroll = '0', name = 'shot', scheme = 'light', color = 'halloween', click = ''] = process.argv.slice(2);
const OUT = new URL('../theme-shots/', import.meta.url).pathname;
await import('node:fs').then((fs) => fs.mkdirSync(OUT, { recursive: true }));
const { app, close } = await serveDist(new URL('../dist', import.meta.url).pathname, 4191);
const { supabase } = createFakeSupabase();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'th-TH', colorScheme: scheme });
await ctx.addInitScript((c) => { try { localStorage.setItem('mindpay.colorTheme', c); } catch {} }, color);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.route(`${SUPA}/**`, supabase);
await routeQrDecoder(page);
await page.goto(app);
await page.getByText('ลองใช้ด้วยข้อมูลตัวอย่าง').first().waitFor();
await page.getByLabel('กำลังเปิด MindPay').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
if (name.startsWith('welcome')) { await page.waitForTimeout(2500); await page.screenshot({ path: `${OUT}${name}.png` }); await browser.close(); close(); process.exit(0); }
await page.getByText('ลองใช้ด้วยข้อมูลตัวอย่าง').click();
await page.getByText('ยอดคงเหลือ').first().waitFor();
if (path) {
  await page.goto(app + path);
  await page.getByLabel('กำลังเปิด MindPay').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
}
await page.waitForTimeout(2200);
if (click) { await page.getByRole('button', { name: click }).first().click().catch((e) => console.log('click', e.message.slice(0, 100))); await page.waitForTimeout(900); }
if (Number(scroll)) {
  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, Number(scroll));
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: `${OUT}${name}.png` });
await browser.close();
close();
