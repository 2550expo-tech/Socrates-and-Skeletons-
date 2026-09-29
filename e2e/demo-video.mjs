// Records a short demo video of MindPay on the exported web app, with the same
// in-memory Supabase stand-in as the browser test (no real account, email or
// AI is used). Handy for the class presentation.
//
//   npm run e2e:web            # builds dist/ (or any web export)
//   node e2e/demo-video.mjs dist demo-video [light|dark] [android|web]
//
// android (default): the phone-app flow. A stand-in photo gallery (sample
//   images from e2e/fixtures) takes the place of the phone's photos, so the
//   automatic scan on opening the app runs exactly as on Android: no photo
//   is picked.
// web: the website flow, where the browser asks the user to pick photos once.
//
// Output: demo-video/mindpay-demo-<flow>-<scheme>.webm (convert to .mp4 with ffmpeg if needed).
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createFakeSupabase, installTestGallery, routeQrDecoder, serveDist, SUPA } from './fake-backend.mjs';

const DIST = process.argv[2] ?? 'dist';
const OUT = process.argv[3] ?? 'demo-video';
const SCHEME = process.argv[4] === 'dark' ? 'dark' : 'light';
const FLOW = process.argv[5] === 'web' ? 'web' : 'android';
const FIXTURES = new URL('./fixtures/', import.meta.url).pathname;
const SIZE = { width: 390, height: 844 };

await rm(join(OUT, 'raw'), { recursive: true, force: true });
await mkdir(join(OUT, 'raw'), { recursive: true });
const { app: APP, close } = await serveDist(DIST, 4180);
const { state, supabase } = createFakeSupabase();
state.confirmEmail = false;
state.aiDelayMs = 700;

const bkkDay = (daysAgo) => new Date(Date.now() + 7 * 3600e3 - daysAgo * 86400e3).toISOString().slice(0, 10);
const slip = (amount, direction, daysAgo, time, counterparty, bank, reference) => ({
  isSlip: true, direction, amount, dateText: 'x', dateIso: bkkDay(daysAgo), time, counterparty, bank, reference,
  confidence: { amount: 0.98, date: 0.96, counterparty: 0.95 },
});
// In the order the slips are read: newest photo first.
state.slipReadings = [
  slip('120.00', 'expense', 0, '08:10', 'ร้านป้าแดง', 'KBank', 'DEMO0001'),
  slip('500.00', 'income', 1, '18:05', 'แม่', 'SCB', 'DEMO0002'),
  slip('89.00', 'expense', 0, '12:40', '7-Eleven', 'KBank', 'DEMO0003'),
  slip('250.00', 'expense', 2, '19:30', 'ร้านหนังสือ', 'Krungthai', 'DEMO0004'),
];
const coachSays = (spent) => ({
  status: 200,
  body: {
    text: `สัปดาห์นี้ใช้ไป ฿${spent} ส่วนใหญ่เป็นค่ากินกับของใช้ ถือว่าคุมได้ดีมากนะ ถ้ายังใช้ประมาณนี้ เงินพออีกหลายเดือนเลย ลองตั้งงบกินวันละ ฿150 ไว้ จะเหลือเก็บเพิ่มได้อีก ตัดสินใจได้เลยว่าอยากเก็บไว้ทำอะไร`,
  },
});
state.coach = coachSays(459);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: SIZE,
  deviceScaleFactor: 1,
  locale: 'th-TH',
  colorScheme: SCHEME,
  recordVideo: { dir: join(OUT, 'raw'), size: SIZE },
});
const page = await ctx.newPage();
await page.route(`${SUPA}/**`, supabase);
await routeQrDecoder(page);
if (FLOW === 'android') {
  // Photos on the "phone": three slips with a slip QR and three ordinary photos (skipped, never sent).
  await installTestGallery(page, [
    { name: 'slip-qr.jpg', minutesAgo: 15 },
    { name: 'photo-1.jpg', minutesAgo: 30, width: 600, height: 1000 },
    { name: 'slip-qr-2.jpg', minutesAgo: 60 * 20 },
    { name: 'photo-2.jpg', minutesAgo: 60 * 22, width: 600, height: 1000 },
    { name: 'slip-qr-3.jpg', minutesAgo: 60 * 30 },
    { name: 'photo-3.jpg', minutesAgo: 60 * 50, width: 600, height: 1000 },
  ]);
  state.slipReadings = state.slipReadings.slice(0, 3);
  state.coach = coachSays(209);
}
const pause = (ms) => page.waitForTimeout(ms);
const button = (name) => page.getByRole('button', { name, exact: false }).first();
const typeSlowly = async (selector, text) => {
  await page.click(selector);
  await page.keyboard.type(text, { delay: 35 });
};

try {
  // 1. Opening animation and the welcome screen
  await page.goto(APP);
  await page.getByText('ลองใช้ด้วยข้อมูลตัวอย่าง').waitFor({ timeout: 15000 });
  await pause(2600);

  // 2. Sign up (nickname required), celebration
  await page.getByText('สมัครสมาชิก', { exact: true }).click();
  await pause(500);
  await typeSlowly('#name', 'มิ้นท์');
  await typeSlowly('#email', 'mint@example.com');
  await typeSlowly('#password', 'secret123');
  await pause(300);
  await button('สร้างบัญชี').click();
  await page.getByText('สมัครบัญชีสำเร็จ').waitFor({ timeout: 10000 });
  await pause(2600);
  await button('ไปตั้งค่าเงิน').click();

  // 3. Money setup
  await page.locator('#ob-balance').waitFor({ timeout: 10000 });
  await pause(600);
  await typeSlowly('#ob-balance', '12000');
  await pause(300);
  await button('เริ่มใช้ MindPay').click();
  await page.getByText('ยอดคงเหลือ').waitFor({ timeout: 10000 });

  if (FLOW === 'android') {
    // 4a. Nothing to tap: the new slips in the gallery are found and read by themselves.
    await page.getByText('จดให้แล้ว', { exact: false }).first().waitFor({ timeout: 40000 });
    await pause(4200);
  } else {
    // 4b. Website: pick the slips once, the rest is automatic.
    await pause(2400);
    await button('สแกนสลิป').click();
    await page.getByText('เลือกรูปสลิป', { exact: false }).first().waitFor({ timeout: 10000 });
    await pause(900);
    const chooser = page.waitForEvent('filechooser');
    await button('เลือกรูปสลิป').click();
    await (await chooser).setFiles(['photo-1.jpg', 'photo-2.jpg', 'photo-3.jpg', 'slip-qr.jpg'].map((f) => join(FIXTURES, f)));
    await page.getByText('อ่านเสร็จแล้ว', { exact: false }).first().waitFor({ timeout: 30000 });
    await pause(2800);
    await page.mouse.wheel(0, 500);
    await pause(1600);
    await button('เสร็จ').click();
    await page.getByText('ยอดคงเหลือ').waitFor({ timeout: 10000 });
    await pause(3200);
  }

  // 5. Home: periods and charts
  await page.mouse.wheel(0, 620);
  await pause(900);
  for (const label of ['วันนี้', '7 วัน', '1 เดือน']) {
    await page.getByRole('tab', { name: label, exact: true }).first().click();
    await pause(900);
  }
  await page.mouse.wheel(0, 700);
  await pause(1800);
  await page.mouse.wheel(0, -2400);
  await pause(800);

  // 6. Money Runway
  await page.getByRole('tab', { name: 'เงินพอถึง' }).click();
  await pause(3200);

  // 7. Coach
  await page.getByRole('tab', { name: 'โค้ช' }).click();
  await pause(1400);
  await page.getByText('สรุปสัปดาห์นี้ให้หน่อย').first().click();
  await page.getByText('ตัดสินใจได้เลย', { exact: false }).first().waitFor({ timeout: 15000 });
  // น้องกล้า reads the answer out with subtitles, moving its mouth and hands.
  await pause(5200);

  // 8. Back home
  await page.getByRole('tab', { name: 'หน้าหลัก' }).click();
  await pause(1500);
} finally {
  await ctx.close();
  await browser.close();
  close();
}

const [raw] = await readdir(join(OUT, 'raw'));
const out = join(OUT, `mindpay-demo-${FLOW}-${SCHEME}.webm`);
await rename(join(OUT, 'raw', raw), out);
await rm(join(OUT, 'raw'), { recursive: true, force: true });
console.log(out);
