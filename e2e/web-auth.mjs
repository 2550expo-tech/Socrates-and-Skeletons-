// End-to-end check of every sign-in path on the exported web app (browser test).
//
// The app is served from this machine and every request to Supabase is answered
// by an in-memory stand-in below, so no real account, email or data is touched.
//
// Run:
//   EXPO_WEB_BASE_URL=/Socrates-and-Skeletons- npx expo export --platform web --output-dir dist
//   EXPO_WEB_BASE_URL=/Socrates-and-Skeletons- node scripts/web-home-screen.mjs dist && cp dist/index.html dist/404.html
//   npx playwright install chromium   # once
//   node e2e/web-auth.mjs dist e2e-shots
//
// It also runs in .github/workflows/web.yml before the website is published.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';
import { createFakeSupabase, installTestGallery, routeQrDecoder, serveDist, SUPA } from './fake-backend.mjs';

// E2E_BROWSER=webkit runs the same checks on Safari's engine, set up like an iPhone.
const ENGINE = process.env.E2E_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const IN_CI = !!process.env.GITHUB_ACTIONS;
const DIST = process.argv[2] ?? 'dist';
const SHOTS = process.argv[3] ?? 'e2e-shots';
const FIXTURES = new URL('./fixtures/', import.meta.url).pathname;
await mkdir(SHOTS, { recursive: true });
const PORT = 4173;
const { app: APP, close: closeServer } = await serveDist(DIST, PORT);
const { state, supabase, makeUser, session } = createFakeSupabase();

// ---------------------------------------------------------------- helpers
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  // In GitHub Actions a failed check also becomes an annotation on the run.
  if (!ok && IN_CI) console.log(`::error title=${ENGINE} browser test::${name}${detail ? ` (${detail.replace(/\n/g, ' ').slice(0, 300)})` : ''}`);
}
const browser = await (ENGINE === 'webkit' ? webkit : chromium).launch();
const phone = {
  ...(ENGINE === 'webkit' ? { isMobile: true, hasTouch: true } : {}),
  // E2E_SCHEME=dark runs everything with the phone in dark mode.
  colorScheme: process.env.E2E_SCHEME === 'dark' ? 'dark' : 'light',
};
async function freshPage(tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'th-TH', ...phone });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${tag}] pageerror`, e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${tag}] console.error`, m.text().slice(0, 200)); });
  page.on('requestfailed', (r) => { if (!r.url().startsWith(SUPA)) console.log(`[${tag}] request failed`, r.url().slice(0, 160)); });
  await page.route(`${SUPA}/**`, supabase);
  // The web QR reader downloads its decoder from a CDN: serve the same file from node_modules.
  await routeQrDecoder(page);
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: join(SHOTS, `${name}.png`) });
const visible = (page, text, timeout = 6000) => page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout }).then(() => true, () => false);
const gone = (page, text, timeout = 6000) => page.getByText(text, { exact: false }).first().waitFor({ state: 'hidden', timeout }).then(() => true, () => false);
const introGone = (page) => page.getByLabel('กำลังเปิด MindPay').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
const button = (page, name) => page.getByRole('button', { name, exact: false }).first();
/** Waits (up to `timeout`) until the element is visible. */
const shown = (locator, timeout = 6000) => locator.waitFor({ state: 'visible', timeout }).then(() => true, () => false);
/** Choose a period (วันนี้ / 7 วัน / ...) on the segmented control; clicks again if a layout shift ate the first click. */
async function pickPeriod(page, label) {
  const tab = page.getByRole('tab', { name: label, exact: true }).first();
  for (let i = 0; i < 3; i++) {
    await tab.click();
    const selected = await tab.evaluate((el) => el.getAttribute('aria-selected')).catch(() => null);
    if (selected === 'true') return true;
    await page.waitForTimeout(700);
    if ((await tab.getAttribute('aria-selected').catch(() => null)) === 'true') return true;
  }
  return false;
}

// ---------------------------------------------------------------- scenarios
try {
  // 1. Opening animation
  {
    const { ctx, page } = await freshPage('intro');
    await page.goto(APP);
    const introSeen = await page.getByLabel('กำลังเปิด MindPay').waitFor({ state: 'attached', timeout: 8000 }).then(() => true, () => false);
    await page.waitForTimeout(400);
    await shot(page, '01-intro-mid');
    check('Opening animation is shown on launch', introSeen);
    check('Opening animation lifts away and shows the welcome screen', await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000));
    const removed = await page.getByLabel('กำลังเปิด MindPay').waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false);
    check('Opening animation is removed after it ends', removed);
    await shot(page, '02-welcome');
    await ctx.close();
  }

  // 2. Sign up needs a nickname; confirmation ON -> code screen
  {
    state.confirmEmail = true;
    const { ctx, page } = await freshPage('signup');
    await page.goto(APP);
    await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000);
    await introGone(page);
    await page.getByText('สมัครสมาชิก', { exact: true }).click();
    check('Sign-up shows step 1 of 3', await visible(page, 'ขั้นที่ 1 จาก 3'));
    await page.fill('#email', 'mint@example.com');
    await page.fill('#password', 'secret123');
    const before = state.calls.length;
    await button(page, 'สร้างบัญชี').click();
    check('Sign-up without a nickname is blocked with a message', await visible(page, 'ใส่ชื่อเล่นสั้น ๆ'));
    check('...and nothing is sent to the server', !state.calls.slice(before).some((c) => c.includes('/signup')));
    await shot(page, '03-signup-missing-name');
    await page.fill('#name', 'มิ้นท์');
    await page.fill('#password', 'short');
    await button(page, 'สร้างบัญชี').click();
    check('Short password is blocked', await visible(page, 'อย่างน้อย 8 ตัวอักษร'));
    await page.fill('#password', 'secret123');
    await button(page, 'แสดงรหัสผ่าน').click();
    check('Show-password button reveals what was typed', (await page.locator('#password').getAttribute('type')) !== 'password');
    await button(page, 'สร้างบัญชี').click();
    check('Code screen appears after sign-up (email confirmation on)', await visible(page, 'ยืนยันอีเมล'));
    check('Code screen shows step 2 of 3 and the email', (await visible(page, 'ขั้นที่ 2 จาก 3')) && (await visible(page, 'mint@example.com')));
    check('Email links return to the app address', state.redirects.at(-1) === APP, String(state.redirects.at(-1)));
    await shot(page, '04-code-screen');
    await page.fill('#otp', '111111');
    check('Wrong code is explained', await visible(page, 'รหัสไม่ถูกต้องหรือหมดอายุ'));
    await page.fill('#otp', '');
    await page.fill('#otp', '123456');
    check('Right code -> "สมัครบัญชีสำเร็จ" popup', await visible(page, 'สมัครบัญชีสำเร็จ'));
    await page.waitForTimeout(900);
    await shot(page, '05-signed-up-popup');
    check('Popup greets the user by nickname', await visible(page, 'คุณมิ้นท์'));
    await button(page, 'ไปตั้งค่าเงิน').click();
    check('After the popup: money setup (step 3) with the nickname filled in', (await visible(page, 'ขั้นที่ 3 จาก 3')) && (await page.locator('#ob-name').inputValue()) === 'มิ้นท์');
    await shot(page, '06-onboarding');
    await page.fill('#ob-balance', '3500');
    await button(page, 'เริ่มใช้ MindPay').click();
    const home1 = await visible(page, 'ยอดคงเหลือ', 8000);
    await shot(page, '06b-after-onboarding');
    check('Onboarding finishes on the home screen', home1);
    await page.goBack().catch(() => {});
    await page.waitForTimeout(500);
    check('Back button does not return to the sign-up form', !(await page.getByText('สร้างบัญชี').count()));
    await ctx.close();
  }

  // 3. Sign in: wrong password, not confirmed, right password; sign out
  {
    makeUser('late@example.com', 'secret123', 'เลท', false);
    const { ctx, page } = await freshPage('signin');
    await page.goto(APP);
    await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000);
    await introGone(page);
    await page.fill('#email', 'mint@example.com');
    await page.fill('#password', 'wrongpass');
    await button(page, 'เข้าสู่ระบบ').click();
    check('Wrong password: clear message + reset button', (await visible(page, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')) && (await visible(page, 'ลืมรหัสผ่าน ตั้งใหม่ทางอีเมล')));
    await shot(page, '07-wrong-password');
    await page.fill('#email', 'late@example.com');
    await page.fill('#password', 'secret123');
    await button(page, 'เข้าสู่ระบบ').click();
    check('Unconfirmed email: message + resend button', (await visible(page, 'ยังไม่ได้ยืนยันอีเมล')) && (await visible(page, 'ส่งอีเมลยืนยันอีกครั้ง')));
    await page.fill('#email', ' Mint@Example.com ');
    await page.fill('#password', 'secret123');
    await button(page, 'เข้าสู่ระบบ').click();
    const toastSeen = await visible(page, 'ยินดีต้อนรับกลับ', 8000);
    const home2 = await visible(page, 'ยอดคงเหลือ', 8000);
    await shot(page, '07b-after-signin');
    check('Sign-in works (email with spaces/capitals)', home2);
    check('Welcome-back toast', toastSeen);
    await ctx.close();
  }

  // 4. Sign up again with a registered email
  {
    const { ctx, page } = await freshPage('existing');
    await page.goto(APP);
    await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000);
    await introGone(page);
    await page.getByText('สมัครสมาชิก', { exact: true }).click();
    await page.fill('#name', 'ซ้ำ');
    await page.fill('#email', 'mint@example.com');
    await page.fill('#password', 'another123');
    await button(page, 'สร้างบัญชี').click();
    check('Registered email: told to sign in or reset, not "สมัครสำเร็จ"', (await visible(page, 'อีเมลนี้มีบัญชีอยู่แล้ว')) && !(await page.getByText('สมัครบัญชีสำเร็จ').count()));
    await shot(page, '08-existing-email');
    await ctx.close();
  }

  // 5. Confirmation OFF: account ready at once
  {
    state.confirmEmail = false;
    const { ctx, page } = await freshPage('instant');
    await page.goto(APP);
    await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000);
    await introGone(page);
    await page.getByText('สมัครสมาชิก', { exact: true }).click();
    await page.fill('#name', 'บีม');
    await page.fill('#email', 'beam@example.com');
    await page.fill('#password', 'secret123');
    await button(page, 'สร้างบัญชี').click();
    const popup = await visible(page, 'สมัครบัญชีสำเร็จ');
    const setupBehind = await page.locator('#ob-name').waitFor({ state: 'attached', timeout: 8000 }).then(() => true, () => false);
    check('Confirmation off: popup at once, then money setup behind it', popup && setupBehind);
    await ctx.close();
    state.confirmEmail = true;
  }

  // 6. Email links
  {
    const u = makeUser('link@example.com', 'secret123', 'ลิงก์', true);
    const s = session(u);
    const { ctx, page } = await freshPage('link');
    await page.goto(`${APP}#access_token=${s.access_token}&expires_in=3600&refresh_token=${s.refresh_token}&token_type=bearer&type=signup`);
    check('Confirm link signs in and shows the popup', await visible(page, 'ยืนยันอีเมลเรียบร้อย', 9000));
    check('Tokens are removed from the address bar', !page.url().includes('access_token'), page.url());
    await shot(page, '09-link-confirmed');
    await ctx.close();

    const b = await freshPage('expired');
    await b.page.goto(`${APP}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`);
    check('Used/expired link: explained in a dialog', await visible(b.page, 'ลิงก์ใช้ไม่ได้', 9000));
    await shot(b.page, '10-link-expired');
    await button(b.page, 'ตกลง').click();
    check('...then the sign-in form', await visible(b.page, 'ลืมรหัสผ่าน?'));
    await b.ctx.close();
  }

  // 7. Forgot password with the code, set a new one, sign in with it
  {
    const { ctx, page } = await freshPage('forgot');
    await page.goto(APP);
    await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000);
    await introGone(page);
    await page.getByText('ลืมรหัสผ่าน?').click();
    await page.fill('#email', 'mint@example.com');
    await button(page, 'ส่งลิงก์ตั้งรหัสผ่านใหม่').click();
    check('Reset: code screen', await visible(page, 'ตั้งรหัสผ่านใหม่'));
    const introBefore = await page.getByLabel('กำลังเปิด MindPay').count();
    await page.fill('#otp', '123456');
    const timeline = [];
    let introAgain = false;
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(200);
      const intro = await page.getByLabel('กำลังเปิด MindPay').count();
      if (intro) introAgain = true;
      timeline.push(`${i * 200}ms intro=${intro} dialog=${await page.getByText('บันทึกรหัสผ่านใหม่').count()} home=${await page.getByText('ยอดคงเหลือ').count()}`);
      if (i === 2) await shot(page, '11a-after-code');
    }
    check('Opening animation does not replay after signing in', !introAgain);
    check('Reset code -> new password dialog', await visible(page, 'บันทึกรหัสผ่านใหม่'));
    check('Reset code signs in: the home screen loads behind the dialog', await visible(page, 'ยอดคงเหลือ', 8000));
    await shot(page, '11-new-password');
    await page.fill('#new-password', 'secret123');
    await button(page, 'บันทึกรหัสผ่านใหม่').click();
    check('Same password is refused with a message', await visible(page, 'ต้องไม่ซ้ำกับรหัสเดิม'));
    await page.fill('#new-password', 'newsecret456');
    await button(page, 'บันทึกรหัสผ่านใหม่').click();
    check('New password saved', await visible(page, 'ตั้งรหัสผ่านใหม่แล้ว'));
    check('Password really changed', state.users.get('mint@example.com').password === 'newsecret456');
    await ctx.close();

    const r = await freshPage('recovery-link');
    const u = state.users.get('link@example.com');
    const s = session(u);
    await r.page.goto(`${APP}#access_token=${s.access_token}&refresh_token=${s.refresh_token}&type=recovery`);
    check('Reset link -> new password dialog', await visible(r.page, 'บันทึกรหัสผ่านใหม่', 9000));
    await r.ctx.close();
  }

  // 8. Sign out returns to the welcome screen
  {
    const { ctx, page } = await freshPage('signout');
    await page.goto(APP);
    await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000);
    await introGone(page);
    await page.fill('#email', 'mint@example.com');
    await page.fill('#password', 'newsecret456');
    await button(page, 'เข้าสู่ระบบ').click();
    await visible(page, 'ยอดคงเหลือ', 8000);
    await page.goto(`${APP}settings`);
    const onSettings = await visible(page, 'ออกจากระบบ', 8000);
    await introGone(page);
    await shot(page, '12-settings');
    check('Settings shows the signed-in email', await visible(page, 'mint@example.com'));
    check('Settings: no coach tone picker; น้องกล้า has a sound switch', (await page.getByText('โทนของโค้ช').count()) === 0 && (await visible(page, 'เสียงน้องกล้า')));
    await button(page, 'เปลี่ยนรหัสผ่าน').click();
    check('Settings: change password opens the new-password dialog', await visible(page, 'บันทึกรหัสผ่านใหม่'));
    await button(page, 'ไว้ทีหลัง').click();
    await page.waitForTimeout(300);
    // Colour themes: Red Velvet paints the buttons burgundy, and the choice is kept after reopening.
    await page.getByRole('button', { name: 'ธีม เรดเวลเวท' }).click();
    const saveBg = await page.getByRole('button', { name: 'บันทึก', exact: true }).first().evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.getByRole('button', { name: 'ธีม เรดเวลเวท' }).scrollIntoViewIfNeeded();
    await shot(page, '32-theme-red-velvet');
    await page.reload();
    await introGone(page);
    const kept = await page.getByRole('button', { name: 'ธีม เรดเวลเวท' }).getAttribute('aria-selected');
    const velvet = phone.colorScheme === 'dark' ? 'rgb(208, 86, 108)' : 'rgb(142, 36, 54)';
    check('Colour theme: Red Velvet colours the app and is remembered', saveBg === velvet && kept === 'true', `${saveBg} selected=${kept}`);
    await page.getByRole('button', { name: 'ธีม ป่าทอง' }).click();
    await button(page, 'กลับ').click();
    check('Back from settings opened directly goes home', await visible(page, 'สวัสดี', 8000));
    await page.goto(`${APP}settings`);
    await visible(page, 'ออกจากระบบ', 8000);
    await button(page, 'ออกจากระบบ').click();
    await page.waitForTimeout(600);
    await shot(page, '13-signout-confirm');
    await page.getByRole('dialog').getByRole('button', { name: 'ออกจากระบบ' }).click({ timeout: 8000 }).catch((e) => console.log('confirm click failed', e.message.slice(0, 300)));
    check('Sign out returns to the welcome screen', await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000));
    await page.reload();
    check('...and stays signed out after reload', await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000));
    await ctx.close();
  }

  // 9. Web scan: pick photos once, everything else is automatic; results by period and by day
  {
    state.confirmEmail = false;
    const bkkDay = (daysAgo) => new Date(Date.now() + 7 * 3600e3 - daysAgo * 86400e3).toISOString().slice(0, 10);
    state.slipReadings = [
      { isSlip: true, direction: 'expense', amount: '120.00', dateText: 'x', dateIso: bkkDay(0), time: '00:30', counterparty: 'ร้านป้าแดง', bank: 'KBank', reference: 'E2E001', confidence: { amount: 0.97, date: 0.95, counterparty: 0.93 } },
      { isSlip: true, direction: 'income', amount: '500.00', dateText: 'x', dateIso: bkkDay(1), time: '18:05', counterparty: 'แม่', bank: 'SCB', reference: 'E2E002', confidence: { amount: 0.99, date: 0.96, counterparty: 0.9 } },
      { isSlip: false, direction: 'unknown', amount: null, dateText: null, dateIso: null, time: null, counterparty: null, bank: null, reference: null, confidence: { amount: 0, date: 0, counterparty: 0 } },
    ];
    const { ctx, page } = await freshPage('scan');
    await page.clock.install(); // real time, but the AI-busy wait below can be skipped
    await page.goto(APP);
    await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000);
    await introGone(page);
    await page.getByText('สมัครสมาชิก', { exact: true }).click();
    await page.fill('#name', 'สแกน');
    await page.fill('#email', 'scan@example.com');
    await page.fill('#password', 'secret123');
    await button(page, 'สร้างบัญชี').click();
    await visible(page, 'สมัครบัญชีสำเร็จ');
    await button(page, 'ไปตั้งค่าเงิน').click();
    await page.fill('#ob-balance', '1000');
    await button(page, 'เริ่มใช้ MindPay').click();
    await visible(page, 'ยอดคงเหลือ', 8000);
    await page.goto(`${APP}scan`);
    await introGone(page);
    check('Web scan: one button to choose photos, no range to pick first', (await visible(page, 'เลือกรูปสลิป แล้ว')) && !(await page.getByText('ย้อนหลังกี่วัน').count()));
    await shot(page, '14-scan-start');
    const chooser = page.waitForEvent('filechooser');
    await button(page, 'เลือกรูปสลิป').click();
    state.slipBusy = 1;
    await (await chooser).setFiles(['photo-1.jpg', 'photo-2.jpg', 'photo-3.jpg'].map((f) => join(FIXTURES, f)));
    check('AI busy (free-tier limit): the scan says it will wait instead of failing', await visible(page, 'AI มีคิวเยอะ รออีก', 10000));
    await shot(page, '14b-scan-ai-busy');
    const secondsShown = async () => Number((await page.getByText(/AI มีคิวเยอะ รออีก \d+/).first().textContent().catch(() => '')).match(/\d+/)?.[0] ?? NaN);
    const s1 = await secondsShown();
    await page.clock.fastForward(5_000);
    await page.waitForTimeout(300);
    const s2 = await secondsShown();
    check('...with a live countdown', s1 <= 20 && s2 <= s1 - 4, `${s1} → ${s2}`);
    await page.clock.fastForward(17_000);
    check('Reading starts by itself and finishes', await visible(page, 'อ่านเสร็จแล้ว ได้ 2 รายการ', 20000));
    await page.waitForTimeout(600);
    await shot(page, '15-scan-done');
    check('Clear slips count in the balance at once', await visible(page, 'รวมในยอดเงินแล้ว 2 รายการ'));
    check('Today = 00:00–23:59 of today, with money in/out', (await visible(page, '· 00:00–23:59')) && (await visible(page, 'ออก ฿120')));
    check('7 days include yesterday\'s income', await visible(page, 'เข้า ฿500'));
    check('Slips are grouped by their date (today / yesterday)', (await visible(page, 'สลิปที่อ่านรอบนี้ แยกตามวันที่')) && (await visible(page, 'เมื่อวาน')));
    const bkkDayOf = (iso) => new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(0, 10);
    check(
      'Saved under the date printed on each slip (Bangkok time)',
      state.txRows.some((r) => r.title === 'แม่' && bkkDayOf(r.occurred_at) === bkkDay(1)) &&
        state.txRows.some((r) => r.title === 'ร้านป้าแดง' && bkkDayOf(r.occurred_at) === bkkDay(0)),
    );
    await button(page, 'เสร็จ').click();
    check('"เสร็จ" returns home even when the scan page was opened directly', await visible(page, 'สวัสดี', 8000));
    await pickPeriod(page, 'วันนี้');
    check('Home: the chosen period shows its exact hours', await visible(page, '00:00–23:59'));
    check('Home: today shows the money out from the slip', await visible(page, 'เงินออก'));
    await shot(page, '16-home-today');
    await ctx.close();
    state.confirmEmail = true;
  }

  // 10. A new day: at 00:00 Bangkok time "วันนี้" starts over by itself
  {
    const { ctx, page } = await freshPage('midnight');
    await page.clock.install({ time: new Date('2026-09-28T16:59:40Z') }); // 23:59:40 on 28 Sep in Bangkok
    await page.goto(APP);
    await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000);
    await introGone(page);
    await page.getByText('ลองใช้ด้วยข้อมูลตัวอย่าง').click();
    const before = await visible(page, 'วันจันทร์ที่ 28 กันยายน 2569', 8000);
    await page.clock.fastForward(30_000); // past midnight
    await page.waitForTimeout(500);
    const after = await visible(page, 'วันอังคารที่ 29 กันยายน 2569', 5000);
    check('At midnight the date on the home screen moves to the new day by itself', before && after);
    check('The companion greets the new day with yesterday\'s spending', await visible(page, 'วันใหม่แล้ว!'));
    const picked = await pickPeriod(page, 'วันนี้');
    check('"วันนี้" now means the new day, 00:00–23:59', picked && (await visible(page, '29 ก.ย. 2569 · 00:00–23:59', 8000)), picked ? '' : 'tab not selected');
    await shot(page, '17-new-day');
    await ctx.close();
  }

  // 11. Motion: respects "Reduce motion", and nothing keeps animating when the screen is idle
  {
    const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', ...phone });
    const page = await reduced.newPage();
    await page.route(`${SUPA}/**`, supabase);
    await page.goto(APP);
    const shown = await page.getByLabel('กำลังเปิด MindPay').waitFor({ state: 'attached', timeout: 8000 }).then(() => true, () => false);
    const t0 = Date.now();
    await page.getByLabel('กำลังเปิด MindPay').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    const introMs = Date.now() - t0;
    check('Reduce motion: the opening screen still shows, then leaves quickly', shown && introMs < 1500, `${introMs} ms on screen`);
    await page.getByText('ลองใช้ด้วยข้อมูลตัวอย่าง').click();
    await visible(page, 'ยอดคงเหลือ', 8000);
    const balanceNow = await page.getByText(/฿[\d,]+/).first().textContent();
    await page.waitForTimeout(150);
    check('Reduce motion: the balance appears at once (no count-up)', balanceNow === (await page.getByText(/฿[\d,]+/).first().textContent()));
    await reduced.close();

    const { ctx, page: p2 } = await freshPage('idle');
    await p2.goto(APP);
    await p2.getByLabel('กำลังเปิด MindPay').waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
    const t1 = Date.now();
    await introGone(p2);
    const fullMs = Date.now() - t1;
    check('Normal motion: the opening animation lasts about a second, not longer', fullMs > 700 && fullMs < 4000, `${fullMs} ms on screen`);
    await p2.getByText('ลองใช้ด้วยข้อมูลตัวอย่าง').click();
    await visible(p2, 'ยอดคงเหลือ', 8000);
    await p2.waitForTimeout(9000); // the companion bobs a few times, then rests
    const frames = await p2.evaluate(
      () =>
        new Promise((resolve) => {
          let n = 0;
          const orig = window.requestAnimationFrame.bind(window);
          window.requestAnimationFrame = (cb) => orig((t) => { n += 1; cb(t); });
          setTimeout(() => { window.requestAnimationFrame = orig; resolve(n); }, 2000);
        }),
    );
    check('Idle home screen: no animation keeps running (battery)', frames < 5, `${frames} frames in 2 s`);
    await ctx.close();
  }

  // 12. Money: add, edit, delete and undo; the balance follows every change
  {
    const { ctx, page } = await freshPage('money');
    await page.goto(APP);
    await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000);
    await introGone(page);
    await page.getByText('ลองใช้ด้วยข้อมูลตัวอย่าง').click();
    await visible(page, 'ยอดคงเหลือ', 8000);
    const balance = async () => {
      await page.waitForTimeout(900); // let the count-up finish
      const label = await page.locator('[aria-label^="ยอดคงเหลือ"]').first().getAttribute('aria-label');
      return Math.round(Number(label.match(/฿([\d,]+\.\d{2})/)[1].replace(/,/g, '')) * 100);
    };
    const start = await balance();
    await button(page, 'จดรายการ').click();
    await visible(page, 'จ่ายให้ / ซื้ออะไร');
    await button(page, 'บันทึกรายการ').click();
    check('Add: an empty amount is not saved', await visible(page, 'จ่ายให้ / ซื้ออะไร'));
    await page.fill('#tx-amount', '123');
    await page.fill('#tx-title', 'ทดสอบกาแฟ');
    await button(page, 'บันทึกรายการ').click();
    check('Add: saved with a confirmation', await visible(page, 'บันทึกรายการแล้ว'));
    await visible(page, 'ยอดคงเหลือ', 8000);
    check('Add: the balance goes down by ฿123', (await balance()) === start - 12_300);
    await page.goto(`${APP}transactions`);
    await introGone(page);
    await page.getByText('ทดสอบกาแฟ').first().click();
    await page.fill('#tx-amount', '150');
    await button(page, 'บันทึกการแก้ไข').click();
    check('Edit: saved', await visible(page, 'บันทึกการแก้ไขแล้ว'));
    await page.goto(APP);
    await introGone(page);
    check('Edit: the balance follows (฿150 instead of ฿123)', (await balance()) === start - 15_000);
    await page.goto(`${APP}transactions`);
    await introGone(page);
    await page.getByText('ทดสอบกาแฟ').first().click();
    await button(page, 'ลบรายการ').first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'ลบรายการ' }).click();
    check('Delete: toast with undo', await visible(page, 'เลิกทำ'));
    await button(page, 'เลิกทำ').click();
    await page.waitForTimeout(500);
    check('Undo: the item is back', await visible(page, 'ทดสอบกาแฟ'));
    // Money in without a slip: one tile on home opens the form as income.
    await page.goto(APP);
    await introGone(page);
    await visible(page, 'ยอดคงเหลือ', 8000);
    const beforeIncome = await balance();
    // Exactly the tile (the "มีอะไรใหม่" card also mentions it).
    await page.getByRole('button', { name: 'เพิ่มเงินเข้า', exact: true }).first().click();
    const incomeForm = (await visible(page, 'ได้รับจาก')) && (await page.getByRole('tab', { name: 'รายรับ', exact: true }).first().getAttribute('aria-selected')) === 'true';
    await page.getByRole('button', { name: '+฿1,000', exact: true }).first().click();
    await page.fill('#tx-title', 'ค่าสอนพิเศษ');
    await shot(page, '31-add-income');
    await button(page, 'บันทึกรายการ').click();
    check('Add money in: the form opens as income with quick amounts, and saves', incomeForm && (await visible(page, 'เพิ่มเงินเข้าแล้ว')));
    await visible(page, 'ยอดคงเหลือ', 8000);
    check('Add money in: the balance goes up by ฿1,000', (await balance()) === beforeIncome + 100_000);
    await ctx.close();
  }

  // 13. Coach: an answer from the AI, and a clear message when the key is missing
  {
    state.confirmEmail = false;
    const { ctx, page } = await freshPage('coach');
    // A stand-in for the browser's speech (the test browser has no Thai voice): records what is said.
    await ctx.addInitScript(() => {
      window.__spoken = [];
      const voices = [
        { name: 'Google US English', lang: 'en-US', default: true, localService: false, voiceURI: 'en' },
        { name: 'Microsoft Premwadee Online (Natural) - Thai (Thailand)', lang: 'th-TH', default: false, localService: false, voiceURI: 'th1' },
        { name: 'Microsoft Niwat Online (Natural) - Thai (Thailand)', lang: 'th-TH', default: false, localService: false, voiceURI: 'th2' },
      ];
      class FakeUtterance {
        constructor(text) {
          this.text = text;
          this.lang = '';
          this.rate = 1;
          this.pitch = 1;
          this.voice = null;
          this.onend = null;
          this.onerror = null;
        }
      }
      const synth = {
        speaking: false,
        getVoices: () => voices,
        addEventListener() {},
        speak(u) {
          window.__spoken.push({ text: u.text, lang: u.lang, rate: u.rate, pitch: u.pitch, voice: u.voice?.name ?? '' });
          setTimeout(() => u.onend?.(), 250);
        },
        cancel() {},
      };
      Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true, writable: true });
    });
    await page.goto(APP);
    await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000);
    await introGone(page);
    await page.getByText('สมัครสมาชิก', { exact: true }).click();
    await page.fill('#name', 'โค้ช');
    await page.fill('#email', 'coach@example.com');
    await page.fill('#password', 'secret123');
    await button(page, 'สร้างบัญชี').click();
    await visible(page, 'สมัครบัญชีสำเร็จ');
    await button(page, 'ไปตั้งค่าเงิน').click();
    await page.fill('#ob-balance', '2000');
    await button(page, 'เริ่มใช้ MindPay').click();
    await visible(page, 'ยอดคงเหลือ', 8000);
    await page.goto(`${APP}coach`);
    await introGone(page);
    check('Coach: the companion greets before the first question', await visible(page, 'ถามเรื่องเงินได้ทุกเรื่อง'));
    const greeted = await page.waitForFunction(() => window.__spoken.length > 0, null, { timeout: 6000 }).then(() => true, () => false);
    const firstSaid = greeted ? (await page.evaluate(() => window.__spoken))[0] : null;
    check(
      'Coach voice: น้องกล้า speaks Thai with a calm Thai voice, a little slower and lower than normal',
      !!firstSaid && firstSaid.lang === 'th-TH' && firstSaid.voice.includes('Niwat') && firstSaid.rate < 1 && firstSaid.pitch < 1 && firstSaid.text.includes('สวัสดี'),
      JSON.stringify(firstSaid),
    );
    check('Coach voice: no "no Thai voice" note on a device that has one', (await page.getByText('เครื่องนี้ยังไม่มีเสียงอ่านภาษาไทย').count()) === 0);
    await page.getByText('สรุปสัปดาห์นี้ให้หน่อย').first().click();
    check('Coach: the AI answer appears', await visible(page, 'สัปดาห์นี้ใช้ไป ฿0'));
    const readAloud = await page.waitForFunction(() => window.__spoken.some((u) => u.text.includes('ใช้ไป 0 บาท')), null, { timeout: 8000 }).then(() => true, () => false);
    check('Coach voice: the answer is read aloud, with "฿0" said as "0 บาท"', readAloud);
    state.coach = { status: 503, body: { error: { code: 'not_configured', message: 'x' } } };
    await page.fill('#coach-input', 'หมวดไหนควรลดก่อน');
    await button(page, 'ส่งคำถาม').click();
    check('Coach: a missing key says exactly what to set', await visible(page, 'GEMINI_API_KEY'));
    state.coach = { status: 503, body: { error: { code: 'busy', message: 'x' } } };
    await page.fill('#coach-input', 'อีกข้อ');
    await button(page, 'ส่งคำถาม').click();
    check('Coach: a busy AI asks to try again shortly', await visible(page, 'รอสักครู่'));
    await shot(page, '18-coach');
    await ctx.close();
    state.confirmEmail = true;
  }

  // 14. Runway: "can I buy this?" shows the days before/after and hands the question to the coach
  {
    const { ctx, page } = await freshPage('runway');
    await page.goto(APP);
    await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000);
    await introGone(page);
    await page.getByText('ลองใช้ด้วยข้อมูลตัวอย่าง').click();
    await visible(page, 'ยอดคงเหลือ', 8000);
    await page.goto(`${APP}runway`);
    await introGone(page);
    // What-if slider: drag the gold thumb to spend 30% less a day.
    const slider = page.getByRole('slider', { name: 'ใช้น้อยลงวันละกี่เปอร์เซ็นต์' }).first();
    await slider.scrollIntoViewIfNeeded();
    // A raw mouse drag does not wait like click() does: make sure the opening animation has fully gone.
    const introWait = Date.now();
    await page.getByLabel('กำลังเปิด MindPay').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    const introMs = Date.now() - introWait;
    // Wait until the page stops moving (cards slide in), so the drag starts on the thumb.
    let box = await slider.boundingBox();
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(250);
      const again = await slider.boundingBox();
      const still = box && again && Math.abs(again.y - box.y) < 0.5 && Math.abs(again.x - box.x) < 0.5;
      box = again;
      if (still) break;
    }
    const under = box
      ? await page.evaluate(({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          return el ? `${el.tagName} role=${el.getAttribute('role')} label=${el.getAttribute('aria-label')}` : 'nothing';
        }, { x: box.x + 15, y: box.y + box.height / 2 })
      : 'no box';
    if (box) {
      // hover() waits until the slider itself receives the pointer (nothing on top of it).
      await slider.hover({ position: { x: 15, y: box.height / 2 } }).catch(() => {});
      await page.mouse.down();
      await page.mouse.move(box.x + 15 + (box.width - 30) * 0.3, box.y + box.height / 2, { steps: 8 });
      await page.mouse.move(box.x + 15 + (box.width - 30) * 0.6, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
    }
    const slid = (await slider.getAttribute('aria-valuenow').catch(() => null)) ?? '';
    await page.waitForTimeout(900);
    await shot(page, '28-runway-slider');
    check('Runway: dragging the slider to 30% less a day shows the extra days', slid === '30' && (await visible(page, 'เพิ่มขึ้น')), `value=${slid} box=${JSON.stringify(box)} under=${under} introWaitMs=${introMs}`);
    // The arrow keys move it too (keyboard users on the web).
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    const keyed = (await slider.getAttribute('aria-valuenow').catch(() => null)) ?? '';
    check('Runway: the slider also moves with the arrow keys', keyed === String(Number(slid || 0) + 5), `value=${keyed}`);
    await page.keyboard.press('Home');
    await page.fill('#runway-price', '2000');
    check('Runway: buying ฿2,000 shows the days before and after', (await visible(page, 'ถ้าซื้อ ฿2,000')) && (await visible(page, 'ตอนนี้')));
    await button(page, 'ถามโค้ชเรื่องนี้').click();
    const asked = await page.locator('#coach-input').inputValue().catch(() => '');
    check('Runway: "ask the coach" opens the coach with the question ready', asked.includes('฿2,000'), asked);
    await ctx.close();
  }

  // 15. Unclear slip: waits in "รอยืนยัน" and counts only after the user confirms it
  {
    state.confirmEmail = false;
    const bkkDay = (daysAgo) => new Date(Date.now() + 7 * 3600e3 - daysAgo * 86400e3).toISOString().slice(0, 10);
    state.slipReadings = [
      { isSlip: true, direction: 'expense', amount: '89.00', dateText: 'x', dateIso: bkkDay(0), time: '12:10', counterparty: 'ร้านชัด', bank: 'KBank', reference: 'E2E101', confidence: { amount: 0.98, date: 0.95, counterparty: 0.95 } },
      { isSlip: true, direction: 'expense', amount: '45.00', dateText: 'x', dateIso: bkkDay(0), time: '13:20', counterparty: 'ร้านเบลอ', bank: 'SCB', reference: 'E2E102', confidence: { amount: 0.5, date: 0.9, counterparty: 0.6 } },
    ];
    const { ctx, page } = await freshPage('review');
    await page.goto(APP);
    await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000);
    await introGone(page);
    await page.getByText('สมัครสมาชิก', { exact: true }).click();
    await page.fill('#name', 'ตรวจ');
    await page.fill('#email', 'review@example.com');
    await page.fill('#password', 'secret123');
    await button(page, 'สร้างบัญชี').click();
    await visible(page, 'สมัครบัญชีสำเร็จ');
    await button(page, 'ไปตั้งค่าเงิน').click();
    await page.fill('#ob-balance', '1000');
    await button(page, 'เริ่มใช้ MindPay').click();
    await visible(page, 'ยอดคงเหลือ', 8000);
    await page.goto(`${APP}scan`);
    await introGone(page);
    const chooser = page.waitForEvent('filechooser');
    await button(page, 'เลือกรูปสลิป').click();
    state.slipOffline = 2; // the connection drops: the retry after 3 s fails too
    await (await chooser).setFiles(['photo-1.jpg', 'photo-2.jpg'].map((f) => join(FIXTURES, f)));
    const offlineNotice = await visible(page, 'เชื่อมต่ออินเทอร์เน็ตไม่ได้', 15000);
    await shot(page, '19-scan-offline');
    check('Offline: the scan pauses and says why, instead of marking slips as unreadable', offlineNotice && (await button(page, 'อ่านต่อ').isVisible()));
    await button(page, 'อ่านต่อ').click();
    check('Unclear slip: only the clear one counts at once', (await visible(page, 'อ่านเสร็จแล้ว ได้ 2 รายการ', 20000)) && (await visible(page, 'รวมในยอดเงินแล้ว 1 รายการ')));
    await button(page, 'ตรวจ 1 รายการที่อ่านไม่ชัด').click();
    check('Unclear slip: listed under "ต้องตรวจก่อน"', await visible(page, 'ต้องตรวจก่อน (1)'));
    await page.getByText('ร้านเบลอ').first().click();
    await button(page, 'ยืนยันและรวมในยอดเงิน').click();
    check('Unclear slip: confirmed by the user', await visible(page, 'ยืนยันรายการแล้ว'));
    check('Nothing left to review', await visible(page, 'เคลียร์หมดแล้ว', 8000));
    const row = state.txRows.find((r) => r.title === 'ร้านเบลอ');
    check('Unclear slip: saved as confirmed only after the user confirmed', row?.status === 'confirmed');
    await ctx.close();
    state.confirmEmail = true;
  }

  // 16. The slip-verification QR printed small in the corner is found, and its reference is the duplicate key
  {
    state.confirmEmail = false;
    const bkkDay = (daysAgo) => new Date(Date.now() + 7 * 3600e3 - daysAgo * 86400e3).toISOString().slice(0, 10);
    state.slipReadings = [
      { isSlip: true, direction: 'expense', amount: '250.00', dateText: 'x', dateIso: bkkDay(0), time: '09:40', counterparty: 'ร้านคิวอาร์', bank: 'Kasikorn Bank', reference: 'AIREAD999', confidence: { amount: 0.97, date: 0.95, counterparty: 0.93 } },
    ];
    const { ctx, page } = await freshPage('qr');
    await page.goto(APP);
    await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000);
    await introGone(page);
    await page.getByText('สมัครสมาชิก', { exact: true }).click();
    await page.fill('#name', 'คิวอาร์');
    await page.fill('#email', 'qr@example.com');
    await page.fill('#password', 'secret123');
    await button(page, 'สร้างบัญชี').click();
    await visible(page, 'สมัครบัญชีสำเร็จ');
    await button(page, 'ไปตั้งค่าเงิน').click();
    await page.fill('#ob-balance', '1000');
    await button(page, 'เริ่มใช้ MindPay').click();
    await visible(page, 'ยอดคงเหลือ', 8000);
    await page.goto(`${APP}scan`);
    await introGone(page);
    const chooser = page.waitForEvent('filechooser');
    await button(page, 'เลือกรูปสลิป').click();
    await (await chooser).setFiles([join(FIXTURES, 'slip-qr.jpg')]);
    await visible(page, 'อ่านเสร็จแล้ว ได้ 1 รายการ', 20000);
    const saved = state.txRows.find((r) => r.title === 'ร้านคิวอาร์');
    check('Slip QR in the corner is found: its reference (not the AI\'s guess) is kept', saved?.slip_ref === '016271094231BTF05678', `slip_ref=${saved?.slip_ref}`);
    check('The bank comes from the QR code (004 = KBank), not from reading the logo', saved?.note === 'สลิปจาก KBank', String(saved?.note));
    await ctx.close();
    state.confirmEmail = true;
  }

  // 17. Android flow on a stand-in photo gallery: open the app and new slips are read by themselves
  {
    state.confirmEmail = false;
    const bkkDay = (daysAgo) => new Date(Date.now() + 7 * 3600e3 - daysAgo * 86400e3).toISOString().slice(0, 10);
    state.slipReadings = [
      { isSlip: true, direction: 'expense', amount: '350.00', dateText: 'x', dateIso: bkkDay(0), time: '11:20', counterparty: 'ร้านข้าวมันไก่', bank: 'SCB', reference: 'AUTO1', confidence: { amount: 0.97, date: 0.96, counterparty: 0.94 } },
      { isSlip: true, direction: 'income', amount: '1200.00', dateText: 'x', dateIso: bkkDay(1), time: '20:00', counterparty: 'พี่ชาย', bank: 'BBL', reference: 'AUTO2', confidence: { amount: 0.99, date: 0.97, counterparty: 0.95 } },
      { isSlip: true, direction: 'expense', amount: '120.00', dateText: 'x', dateIso: bkkDay(0), time: '08:30', counterparty: 'ร้านชานม', bank: 'TrueMoney', reference: 'TMN55501', confidence: { amount: 0.96, date: 0.95, counterparty: 0.92 } },
    ];
    const { ctx, page } = await freshPage('auto');
    await installTestGallery(page, [
      { name: 'slip-qr-2.jpg', minutesAgo: 10 },
      { name: 'photo-1.jpg', minutesAgo: 20, width: 600, height: 1000 },
      { name: 'slip-qr-3.jpg', minutesAgo: 30 },
      { name: 'photo-2.jpg', minutesAgo: 40, width: 600, height: 1000 },
      { name: 'wallet-qr.jpg', minutesAgo: 50 }, // e-wallet receipt: its own kind of QR
      { name: 'camera-qr.jpg', file: 'wallet-qr.jpg', minutesAgo: 60, width: 3000, height: 4000 }, // a camera photo with a QR: stays on the phone
    ]);
    await page.goto(APP);
    await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000);
    await introGone(page);
    await page.getByText('สมัครสมาชิก', { exact: true }).click();
    await page.fill('#name', 'ออโต้');
    await page.fill('#email', 'auto@example.com');
    await page.fill('#password', 'secret123');
    await button(page, 'สร้างบัญชี').click();
    await visible(page, 'สมัครบัญชีสำเร็จ');
    await button(page, 'ไปตั้งค่าเงิน').click();
    await page.fill('#ob-balance', '5000');
    const aiBefore = state.calls.filter((c) => c.startsWith('POST /functions/v1/parse-slip')).length;
    await button(page, 'เริ่มใช้ MindPay').click();
    await visible(page, 'ยอดคงเหลือ', 8000);
    // No photo is picked: the scan starts by itself once the user is in the app.
    const scanned = await visible(page, 'จดให้แล้ว 3 รายการ', 25000);
    await page.waitForTimeout(1200);
    await shot(page, '20-auto-scan-done');
    check('Android flow: new slips are read by themselves on opening the app, no photo picked', scanned);
    const aiCalls = state.calls.filter((c) => c.startsWith('POST /functions/v1/parse-slip')).length - aiBefore;
    check('Only slip-like pictures are sent to the AI: 2 bank slips + 1 e-wallet receipt of 6 photos', aiCalls === 3, `${aiCalls} sent`);
    const refs = state.txRows.filter((r) => ['ร้านข้าวมันไก่', 'พี่ชาย'].includes(r.title)).map((r) => r.slip_ref).sort();
    check('The QR references are kept', JSON.stringify(refs) === JSON.stringify(['016272184455CKQ11220', '016273009912DMV30011']), refs.join(','));
    check('The balance counts them at once', await visible(page, '฿5,730', 8000));
    await page.getByRole('button', { name: 'สแกนสลิป' }).last().click();
    const nothingNew = await visible(page, 'ทุกรูปเคยตรวจแล้ว (6 รูป)', 15000);
    check('The scan screen searches the gallery by itself and finds nothing new', nothingNew, nothingNew ? '' : (await page.locator('body').innerText()).split('\n').filter((l) => /รูป|สลิป/.test(l)).slice(0, 6).join(' | '));
    await ctx.close();
    state.confirmEmail = true;
  }

  // 18. The two AI reads of a slip disagree on the amount: it waits, and the user picks the right one
  {
    state.confirmEmail = false;
    const bkkDay = (daysAgo) => new Date(Date.now() + 7 * 3600e3 - daysAgo * 86400e3).toISOString().slice(0, 10);
    state.slipReadings = [
      {
        reading: { isSlip: true, direction: 'expense', amount: '1250.00', dateText: 'x', dateIso: bkkDay(0), time: '10:10', counterparty: 'ร้านสองค่า', bank: 'SCB', reference: 'E2E201', confidence: { amount: 0.5, date: 0.97, counterparty: 0.95 } },
        check: { verified: false, reads: 2, disagree: { amount: ['1250.00', '1280.00'] } },
      },
    ];
    const { ctx, page } = await freshPage('two-reads');
    await page.goto(APP);
    await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000);
    await introGone(page);
    await page.getByText('สมัครสมาชิก', { exact: true }).click();
    await page.fill('#name', 'สองค่า');
    await page.fill('#email', 'tworeads@example.com');
    await page.fill('#password', 'secret123');
    await button(page, 'สร้างบัญชี').click();
    await visible(page, 'สมัครบัญชีสำเร็จ');
    await button(page, 'ไปตั้งค่าเงิน').click();
    await page.fill('#ob-balance', '5000');
    await button(page, 'เริ่มใช้ MindPay').click();
    await visible(page, 'ยอดคงเหลือ', 8000);
    await page.goto(`${APP}scan`);
    await introGone(page);
    const chooser = page.waitForEvent('filechooser');
    await button(page, 'เลือกรูปสลิป').click();
    await (await chooser).setFiles([join(FIXTURES, 'photo-3.jpg')]);
    await visible(page, 'อ่านเสร็จแล้ว ได้ 1 รายการ', 20000);
    const draft = state.txRows.find((r) => r.title === 'ร้านสองค่า');
    check('Two reads disagree: the slip is not counted, it waits for the user', draft?.status === 'draft' && (draft?.review_flags ?? []).includes('amount'), `${draft?.status} ${draft?.review_flags}`);
    await button(page, 'ตรวจ 1 รายการที่อ่านไม่ชัด').click();
    await page.getByText('ร้านสองค่า').first().click();
    const both = (await visible(page, 'AI อ่านได้ 2 แบบ')) && (await visible(page, 'ดูที่สลิปแล้วเลือก'));
    await shot(page, '22-two-reads');
    check('The review shows both readings to choose from', both);
    await page.getByRole('button', { name: '฿1,280.00' }).first().click();
    await button(page, 'ยืนยันและรวมในยอดเงิน').click();
    await visible(page, 'ยืนยันรายการแล้ว');
    const row = state.txRows.find((r) => r.title === 'ร้านสองค่า');
    check('The amount the user picked is saved and counted', row?.status === 'confirmed' && row?.amount_satang === 128_000, `${row?.status} ${row?.amount_satang}`);

    // Savings goal (กระปุกออม): create one, drop money in, and the runway keeps it aside.
    await page.goto(`${APP}goals`);
    await introGone(page);
    await button(page, 'ตั้งกระปุกแรก').click();
    await page.fill('#goal-title', 'หูฟังใหม่');
    await page.fill('#goal-amount', '2500');
    await button(page, 'ตั้งกระปุก').click();
    check('Goal: created and listed with its jar', (await visible(page, 'หูฟังใหม่')) && (await visible(page, 'เก็บวันละ')));
    await button(page, 'หยอดกระปุก').click();
    await page.getByRole('button', { name: '฿500', exact: true }).first().click();
    await visible(page, 'หยอด ฿500 แล้ว');
    await page.waitForTimeout(1200);
    await shot(page, '29-goal-jar');
    const goalRow = state.goalRows.find((r) => r.title === 'หูฟังใหม่');
    check('Goal: money put in is saved (20% of ฿2,500)', goalRow?.saved_satang === 50_000 && (await visible(page, '20%')), `saved=${goalRow?.saved_satang}`);
    await page.goto(`${APP}runway`);
    await introGone(page);
    check('Runway: money in the jar is kept out of what can be spent', await visible(page, 'หักเงินที่กันไว้ในกระปุกออม'));
    await ctx.close();
    state.confirmEmail = true;
  }

  // 19. Voice entry: say "ข้าวมันไก่ 50 บาท" (a stand-in for the browser's speech recognizer), or type it the same way
  {
    const { ctx, page } = await freshPage('voice');
    await ctx.addInitScript(() => {
      class FakeRecognition {
        constructor() {
          this.lang = '';
          this.onresult = null;
          this.onerror = null;
          this.onend = null;
        }
        start() {
          window.__speechLang = this.lang;
          const say = (text, isFinal) => {
            const result = [{ transcript: text }];
            result.isFinal = isFinal;
            this.onresult?.({ resultIndex: 0, results: [result] });
          };
          setTimeout(() => say('ข้าวมันไก่', false), 300);
          setTimeout(() => say('ข้าวมันไก่ 50 บาท', true), 900);
          setTimeout(() => this.onend?.(), 1000);
        }
        stop() {
          setTimeout(() => this.onend?.(), 0);
        }
      }
      for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
        Object.defineProperty(window, name, { value: FakeRecognition, configurable: true, writable: true });
      }
    });
    await page.goto(APP);
    await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000);
    await introGone(page);
    await page.getByText('ลองใช้ด้วยข้อมูลตัวอย่าง').click();
    await visible(page, 'ยอดคงเหลือ', 8000);
    const balance = async () => {
      await page.waitForTimeout(900);
      const label = await page.locator('[aria-label^="ยอดคงเหลือ"]').first().getAttribute('aria-label');
      return Math.round(Number(label.match(/฿([\d,]+\.\d{2})/)[1].replace(/,/g, '')) * 100);
    };
    const start = await balance();
    // Streak and badges: the sample data has already earned some.
    check('Home: the recording streak is shown', await button(page, 'จดต่อเนื่อง').isVisible());
    check('Home: earned badges are announced', await visible(page, 'ได้เหรียญใหม่'));
    // "มีอะไรใหม่": one card on home opens the list of new features, then goes away.
    await page.getByText('มีอะไรใหม่ในอัปเดตนี้').first().click();
    const news = (await visible(page, 'ตั้งเป้าของที่อยากได้')) && (await visible(page, 'อ่านสลิปแม่นขึ้น ทุกธนาคาร'));
    await page.waitForTimeout(900);
    await shot(page, '30-whats-new');
    check('What\'s new: the new features, each with a way to try it', news);
    await button(page, 'ปิด').click();
    check('What\'s new: the card is not shown again', await gone(page, 'มีอะไรใหม่ในอัปเดตนี้'));
    await button(page, 'ดูเหรียญ').click();
    const achievements = (await visible(page, 'เหรียญของฉัน')) && (await visible(page, 'สถิติสูงสุด'));
    await page.waitForTimeout(1500);
    await shot(page, '24-achievements');
    check('Achievements: streak of the last 14 days and the badge collection', achievements);
    await button(page, 'กลับ').click();
    check('Seen badges are not announced again', await gone(page, 'ได้เหรียญใหม่'));
    // The companion and the money tree answer when tapped.
    await button(page, 'แตะน้องกล้าเพื่อฟังเคล็ดลับ').click();
    check('Tapping the companion: it gives a tip', await visible(page, 'เก็บสลิปไว้ในเครื่องได้เลย'));
    await button(page, 'ต้นไม้เงิน แตะเพื่อดูความหมาย').click();
    const treeSays = await visible(page, 'ใบทองคือวันที่เงินพอใช้');
    await page.waitForTimeout(500);
    await shot(page, '23-tree-tapped');
    check('Tapping the money tree: the companion explains the gold leaves', treeSays);
    await button(page, 'จดด้วยเสียง').click();
    check('Voice: the mic on the home screen opens "พูดจดรายการ"', await visible(page, 'แตะไมค์แล้วพูด'));
    await button(page, 'แตะแล้วพูด').click();
    const heard = await visible(page, 'จะบันทึก 1 รายการ', 6000);
    await page.waitForTimeout(600);
    await shot(page, '21-voice-heard');
    // (The home screen stays underneath with its own amounts, so look inside the item itself.)
    const itemText = await button(page, 'รายจ่าย แตะเพื่อสลับ').textContent().catch(() => '');
    check('Voice: "ข้าวมันไก่ 50 บาท" said -> one item of ฿50 ready to save', heard && itemText.includes('−฿50.00'), itemText);
    check('Voice: the recognizer listens in Thai', (await page.evaluate(() => window.__speechLang)) === 'th-TH');
    await page.fill('#voice-text', 'ค่ารถ 25 กาแฟ 65 ได้เงินจากแม่ 500');
    check('Typed the same way: three items, the money from mom as income', (await visible(page, 'จะบันทึก 3 รายการ')) && (await visible(page, '+฿500.00')));
    await button(page, 'บันทึก 3 รายการ').click();
    check('Voice: saved with a confirmation', await visible(page, 'บันทึก 3 รายการแล้ว'));
    await visible(page, 'ยอดคงเหลือ', 8000);
    check('Voice: the balance follows (−฿25 −฿65 +฿500)', (await balance()) === start - 2_500 - 6_500 + 50_000);
    check('First voice entry earns the "พูดแล้วจด" badge', (await visible(page, 'ได้เหรียญใหม่')) && (await visible(page, 'พูดแล้วจด')));

    // Spending calendar on the transactions tab: each day shaded by spending; tap a day to see only it.
    await page.getByRole('tab', { name: 'รายการ', exact: true }).first().click().catch(() => page.goto(`${APP}transactions`));
    const calendarShown = (await visible(page, 'มีเงินเข้า')) && (await visible(page, 'เทียบกับวันที่ใช้ตามปกติ'));
    check('Transactions: the spending calendar of this month is shown', calendarShown);
    const spentDay = page.getByRole('button', { name: /ใช้ไป ฿/ }).first();
    const dayLabel = (await spentDay.getAttribute('aria-label')) ?? '';
    await spentDay.click();
    await page.waitForTimeout(600);
    await shot(page, '27-calendar-day');
    check('Tapping a day shows only that day (with its total)', (await visible(page, 'ดูทุกวัน')) && dayLabel.length > 0, dayLabel);
    await button(page, 'ดูทุกวัน').click();
    check('"ดูทุกวัน" shows every day again', await gone(page, 'ดูทุกวัน'));
    await page.goto(APP);
    await introGone(page);
    await visible(page, 'ยอดคงเหลือ', 8000);

    // Month recap: a story of full screens that moves on by itself; tap right for the next one.
    await button(page, 'ดูสรุปเดือน').click();
    check('Recap: opens on the month\'s title screen', await visible(page, 'แตะด้านขวาเพื่อไปต่อ'));
    // This month so far, or (on the 1st, when the recap is the month just ended) the whole month.
    check('Recap: moves on to the next screen by itself', await visible(page, /เดือนนี้ใช้ไปแล้ว|ทั้งเดือนใช้ไป/, 9000));
    await button(page, 'ถัดไป').click();
    const where = await visible(page, 'เงินไปที่ไหนมากที่สุด');
    await page.waitForTimeout(1600);
    await shot(page, '25-recap-where');
    check('Recap: where the money went, biggest first', where);
    for (let i = 0; i < 4; i++) await button(page, 'ถัดไป').click();
    const outro = await visible(page, 'ดูอีกครั้ง');
    await page.waitForTimeout(1200);
    await shot(page, '26-recap-end');
    check('Recap: ends with the money tree and the badges', outro && (await visible(page, 'เหรียญที่ได้แล้ว')));
    await button(page, 'เสร็จ').click();
    check('Recap: "เสร็จ" returns home', await visible(page, 'ยอดคงเหลือ', 8000));

    // น้องกล้า's skins: announced on home, money missions on the achievements screen, the collection.
    check('Home: new skins for น้องกล้า are announced', await visible(page, 'น้องกล้าได้ชุดใหม่'));
    await page.goto(`${APP}achievements`);
    await introGone(page);
    check(
      'Achievements: money missions, each unlocking a skin (open the app 30 days in a row -> ชุดไทย)',
      (await visible(page, 'ภารกิจการเงิน')) && (await visible(page, 'มาหากล้าทุกวัน')) && (await visible(page, 'เปิดแอปติดต่อกัน 30 วัน')),
    );
    await button(page, 'ภารกิจ มาหากล้าทุกวัน').click();
    const thaiLocked = (await visible(page, 'ชุดของฉัน')) && (await visible(page, 'ปลดล็อก: เปิดแอปติดต่อกัน 30 วัน'));
    await page.waitForTimeout(900);
    await shot(page, '33-skins-thai-locked');
    check('Mission -> its skin in the collection: ชุดไทย, locked, with how to unlock it', thaiLocked);
    await button(page, 'สกิน สงกรานต์ 2569').click();
    check('Skins: a limited skin whose time has passed says it can no longer be collected', await visible(page, 'สกินลิมิเต็ด · หมดเวลาแล้ว หาไม่ได้อีก'));
    await button(page, 'สกิน บัณฑิตการเงิน').click();
    await button(page, 'ใส่ชุดนี้').click();
    check('Skins: wearing an unlocked skin', await visible(page, 'น้องกล้าใส่ชุดบัณฑิตการเงินแล้ว'));
    await page.waitForTimeout(1200);
    await shot(page, '34-skins-wearing');
    check('Skins: the skin being worn is marked', await visible(page, 'น้องกล้าใส่ชุดนี้อยู่'));

    // The coach is now น้องกล้า, big, wearing the chosen skin; the three coach tones are gone.
    await page.goto(`${APP}coach`);
    await introGone(page);
    check('Coach: the big น้องกล้า wears the chosen skin', (await visible(page, 'โค้ชส่วนตัว')) && (await shown(button(page, 'น้องกล้าในชุดบัณฑิตการเงิน'))));
    check('Coach: the three coach tones are gone', (await page.getByText('โค้ชตรงประเด็น').count()) === 0);
    await button(page, 'น้องกล้าในชุดบัณฑิตการเงิน').click();
    const talks = (await visible(page, 'เก็บสลิปไว้ในเครื่องได้เลย')) && (await shown(button(page, 'ให้น้องกล้าหยุดพูด')));
    await page.waitForTimeout(700);
    await shot(page, '35-coach-kla-talking');
    check('Coach: tapping น้องกล้า -> it talks (subtitle, and a stop button while talking)', talks);
    await button(page, 'ให้น้องกล้าหยุดพูด').click();
    check('Coach: stop -> quiet, with "ฟังอีกครั้ง"', await visible(page, 'ฟังอีกครั้ง'));
    await button(page, 'ปิดเสียงน้องกล้า').click();
    check('Coach: the sound can be turned off', await shown(button(page, 'เปิดเสียงน้องกล้า')));
    await button(page, 'เปิดเสียงน้องกล้า').click();
    // Change the skin right on the stage, from the skins the user owns.
    await button(page, 'เปลี่ยนชุดน้องกล้า').click();
    await button(page, 'ใส่ชุดต้นกล้า').click();
    const changed = (await shown(button(page, 'น้องกล้าในชุดต้นกล้า'))) && (await visible(page, 'ใส่ชุดต้นกล้าแล้ว'));
    await page.waitForTimeout(600);
    await shot(page, '36-coach-skin-picker');
    check('Coach: the skin can be changed on the stage (owned skins only), and น้องกล้า says so', changed && (await page.getByRole('button', { name: 'ใส่ชุดชุดไทย' }).count()) === 0);
    await page.getByText('สรุปสัปดาห์นี้ให้หน่อย').first().click();
    check('Coach (demo): explains that the AI needs a real account', await visible(page, 'โหมดทดลองยังถาม AI ไม่ได้'));
    await ctx.close();
  }

  // 20. ฮาโลวีน: an invitation on home, the Halloween theme, catching ghosts for candies, Halloween skins
  {
    const { ctx, page } = await freshPage('halloween');
    await page.clock.install({ time: new Date('2026-09-30T05:00:00Z') }); // noon on 30 Sep in Bangkok, during the event
    await page.goto(APP);
    await visible(page, 'ลองใช้ด้วยข้อมูลตัวอย่าง', 8000);
    await introGone(page);
    await page.getByText('ลองใช้ด้วยข้อมูลตัวอย่าง').click();
    await visible(page, 'ยอดคงเหลือ', 8000);
    check('Halloween: other themes get an invitation on home', await visible(page, 'ฮาโลวีนมาแล้ว!'));
    await button(page, 'เปิดธีมฮาโลวีน').click();
    const card = await visible(page, 'จับผีรับลูกอม');
    check('Halloween: one tap switches to the Halloween theme, with ghosts to catch', card && (await shown(button(page, 'จับผีตัวที่ 1'))));
    const candies = async () => {
      const label = (await page.getByLabel(/^ลูกอม \d+ เม็ด$/).first().getAttribute('aria-label').catch(() => '')) ?? '';
      return Number(label.match(/\d+/)?.[0] ?? NaN);
    };
    const before = await candies();
    await page.waitForTimeout(800);
    await shot(page, '37-halloween-home');
    await button(page, 'จับผีตัวที่ 1').click();
    const booed = await visible(page, 'ได้ลูกอม 1 เม็ด');
    await page.waitForTimeout(700);
    const after = await candies();
    check('Halloween: catching a ghost says boo and gives a candy', booed && after === before + 1, `${before} -> ${after}`);
    check('Halloween: that ghost is gone for today (two left)', (await visible(page, 'วันนี้มีผีน้อย 2 ตัว')) && (await page.getByRole('button', { name: 'จับผีตัวที่ 1' }).count()) === 0);
    await button(page, 'ดูสกินฮาโลวีน').click();
    check('Halloween skins: their own section with the candies', (await visible(page, 'ฮาโลวีน 2569')) && (await visible(page, 'จับผีบนหน้าหลัก')));
    check('Halloween skins: the pumpkin ghost is free during the event', await shown(button(page, 'สกิน ผีหัวฟักทอง สกินลิมิเต็ด มีแล้ว')));
    await button(page, 'สกิน แฟรงเกนสไตน์').click();
    const franken = await visible(page, 'สะสมลูกอม 40 เม็ดเพื่อปลดล็อก');
    await page.waitForTimeout(900);
    await shot(page, '38-halloween-frankenstein');
    check('Halloween skins: Frankenstein needs 40 candies (limited)', franken);
    await button(page, 'สกิน ผีหัวฟักทอง').click();
    await button(page, 'ใส่ชุดนี้').click();
    check('Halloween skins: wearing the pumpkin ghost', await visible(page, 'น้องกล้าใส่ชุดผีหัวฟักทองแล้ว'));
    await page.goto(`${APP}coach`);
    await introGone(page);
    check('Halloween coach: a spooky-cute greeting, in the pumpkin ghost skin', (await visible(page, 'บู้! ตกใจไหม')) && (await shown(button(page, 'น้องกล้าในชุดผีหัวฟักทอง'))));
    await page.waitForTimeout(900);
    await shot(page, '39-halloween-coach');
    await ctx.close();
  }
} catch (e) {
  check('Test run crashed', false, e.stack?.slice(0, 500));
}

await browser.close();
closeServer();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (${ENGINE})`);
if (IN_CI) console.log(`::notice title=${ENGINE} browser test::${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
