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
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium, webkit } from 'playwright';

// E2E_BROWSER=webkit runs the same checks on Safari's engine, set up like an iPhone.
const ENGINE = process.env.E2E_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const IN_CI = !!process.env.GITHUB_ACTIONS;
const DIST = process.argv[2] ?? 'dist';
const SHOTS = process.argv[3] ?? 'e2e-shots';
const FIXTURES = new URL('./fixtures/', import.meta.url).pathname;
await mkdir(SHOTS, { recursive: true });
const BASE_PATH = '/Socrates-and-Skeletons-';
const PORT = 4173;
const APP = `http://localhost:${PORT}${BASE_PATH}/`;
const SUPA = 'https://dufvcdwswcaqsfbxjwat.supabase.co';

// ---------------------------------------------------------------- static server
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, APP).pathname);
  if (!path.startsWith(BASE_PATH)) { res.writeHead(404); return res.end(); }
  path = path.slice(BASE_PATH.length) || '/';
  let file = join(DIST, path);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'content-type': 'text/html' });
    res.end(await readFile(join(DIST, '404.html')));
  }
});
await new Promise((r) => server.listen(PORT, r));

// ---------------------------------------------------------------- fake Supabase
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(user) {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now })}.sig`;
}
const state = {
  confirmEmail: true,
  users: new Map(), // email -> { id, email, password, confirmed, name }
  profiles: new Map(), // id -> profile row
  redirects: [],
  calls: [],
  txRows: [], // transactions saved through the REST API
  slipReadings: [], // queue of answers from the slip reader (parse-slip)
  coach: { status: 200, body: { text: 'สัปดาห์นี้ใช้ไป ฿0 ยังไม่มีรายจ่ายเลยนะ' } }, // answer of the coach function
};
let seq = 0;
function makeUser(email, password, name, confirmed) {
  const id = `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  const u = { id, email, password, confirmed, name };
  state.users.set(email, u);
  state.profiles.set(id, { id, display_name: name, opening_balance_satang: 0, runway_floor_satang: 50000, monthly_budget_satang: null, onboarded: false, coach_tone: 'friend', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  return u;
}
const userJson = (u, identities = true) => ({
  id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email,
  email_confirmed_at: u.confirmed ? new Date().toISOString() : null,
  user_metadata: { display_name: u.name }, app_metadata: { provider: 'email' },
  identities: identities ? [{ id: u.id, provider: 'email', identity_data: { email: u.email } }] : [],
  created_at: new Date().toISOString(),
});
const session = (u) => ({ access_token: jwt(u), refresh_token: `r-${u.id}`, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: userJson(u) });
const byToken = (auth) => {
  const token = (auth ?? '').replace(/^Bearer /, '');
  try {
    const sub = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
    return [...state.users.values()].find((u) => u.id === sub);
  } catch { return undefined; }
};
const err = (status, code, msg) => ({ status, body: { code: status, error_code: code, msg } });

async function supabase(route) {
  const req = route.request();
  const url = new URL(req.url());
  const p = url.pathname;
  const body = req.postDataJSON?.() ?? null;
  state.calls.push(`${req.method()} ${p}${url.search}`);
  const reply = ({ status = 200, body: b = {} }) =>
    route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(b) });
  if (req.method() === 'OPTIONS') return reply({ status: 200 });

  if (p === '/auth/v1/signup') {
    state.redirects.push(url.searchParams.get('redirect_to'));
    const existing = state.users.get(body.email);
    if (existing?.confirmed) return reply({ body: userJson(existing, false) });
    const u = existing ?? makeUser(body.email, body.password, body.data?.display_name, !state.confirmEmail);
    if (!state.confirmEmail) return reply({ body: session(u) });
    return reply({ body: { ...userJson(u), confirmation_sent_at: new Date().toISOString() } });
  }
  if (p === '/auth/v1/token') {
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const u = state.users.get(body.email);
      if (!u || u.password !== body.password) return reply(err(400, 'invalid_credentials', 'Invalid login credentials'));
      if (!u.confirmed) return reply(err(400, 'email_not_confirmed', 'Email not confirmed'));
      return reply({ body: session(u) });
    }
    if (grant === 'refresh_token') {
      const u = [...state.users.values()].find((x) => `r-${x.id}` === body.refresh_token);
      return u ? reply({ body: session(u) }) : reply(err(400, 'refresh_token_not_found', 'Invalid Refresh Token'));
    }
  }
  if (p === '/auth/v1/verify') {
    const u = state.users.get(body.email);
    if (!u || body.token !== '123456') return reply(err(403, 'otp_expired', 'Token has expired or is invalid'));
    u.confirmed = true;
    return reply({ body: session(u) });
  }
  if (p === '/auth/v1/resend' || p === '/auth/v1/recover') {
    state.redirects.push(url.searchParams.get('redirect_to') ?? body?.options?.email_redirect_to ?? null);
    return reply({ body: {} });
  }
  if (p === '/auth/v1/user') {
    const u = byToken(req.headers().authorization);
    if (!u) return reply(err(401, 'bad_jwt', 'invalid JWT'));
    if (req.method() === 'PUT' && body?.password) {
      if (body.password === u.password) return reply(err(422, 'same_password', 'New password should be different'));
      u.password = body.password;
    }
    return reply({ body: userJson(u) });
  }
  if (p === '/auth/v1/logout') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });

  if (p === '/rest/v1/profiles') {
    const u = byToken(req.headers().authorization);
    const row = u && state.profiles.get(u.id);
    if (!row) return reply({ status: 406, body: { code: 'PGRST116', message: 'no rows' } });
    if (req.method() === 'PATCH') Object.assign(row, body, { updated_at: new Date().toISOString() });
    return reply({ body: row });
  }
  if (p === '/rest/v1/transactions') {
    const u = byToken(req.headers().authorization);
    if (!u) return reply({ status: 401, body: {} });
    if (req.method() === 'POST') {
      const row = { ...body, id: `tx-${state.txRows.length + 1}`, user_id: u.id, created_at: new Date().toISOString() };
      state.txRows.push(row);
      return reply({ status: 201, body: row });
    }
    if (req.method() === 'PATCH') {
      const ids = (url.searchParams.get('id') ?? '').replace(/^(eq\.|in\.\()/, '').replace(/\)$/, '').split(',');
      const changed = state.txRows.filter((r) => r.user_id === u.id && ids.includes(r.id));
      changed.forEach((r) => Object.assign(r, body));
      return reply({ body: changed.length === 1 ? changed[0] : changed });
    }
    return reply({ body: state.txRows.filter((r) => r.user_id === u.id) });
  }
  if (p === '/functions/v1/coach') return reply(state.coach);
  if (p === '/functions/v1/parse-slip') {
    const reading = state.slipReadings.shift();
    return reading ? reply({ body: { reading } }) : reply(err(502, 'reader_error', 'x'));
  }
  if (p.startsWith('/functions/v1/')) return reply(err(503, 'not_configured', 'x'));
  return reply({ status: 404, body: {} });
}

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
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: join(SHOTS, `${name}.png`) });
const visible = (page, text, timeout = 6000) => page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout }).then(() => true, () => false);
const gone = (page, text, timeout = 6000) => page.getByText(text, { exact: false }).first().waitFor({ state: 'hidden', timeout }).then(() => true, () => false);
const introGone = (page) => page.getByLabel('กำลังเปิด MindPay').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
const button = (page, name) => page.getByRole('button', { name, exact: false }).first();

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
    await shot(page, '12-settings');
    check('Settings shows the signed-in email', await visible(page, 'mint@example.com'));
    await button(page, 'เปลี่ยนรหัสผ่าน').click();
    check('Settings: change password opens the new-password dialog', await visible(page, 'บันทึกรหัสผ่านใหม่'));
    await button(page, 'ไว้ทีหลัง').click();
    await page.waitForTimeout(300);
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
    await (await chooser).setFiles(['photo-1.jpg', 'photo-2.jpg', 'photo-3.jpg'].map((f) => join(FIXTURES, f)));
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
    await page.getByText('วันนี้', { exact: true }).first().click();
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
    await page.getByText('วันนี้', { exact: true }).first().click();
    check('"วันนี้" now means the new day, 00:00–23:59', await visible(page, '29 ก.ย. 2569 · 00:00–23:59'));
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
    await ctx.close();
  }

  // 13. Coach: an answer from the AI, and a clear message when the key is missing
  {
    state.confirmEmail = false;
    const { ctx, page } = await freshPage('coach');
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
    await page.getByText('สรุปสัปดาห์นี้ให้หน่อย').first().click();
    check('Coach: the AI answer appears', await visible(page, 'สัปดาห์นี้ใช้ไป ฿0'));
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
    await (await chooser).setFiles(['photo-1.jpg', 'photo-2.jpg'].map((f) => join(FIXTURES, f)));
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
} catch (e) {
  check('Test run crashed', false, e.stack?.slice(0, 500));
}

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (${ENGINE})`);
if (IN_CI) console.log(`::notice title=${ENGINE} browser test::${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
