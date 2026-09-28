// Shared by the browser test (web-auth.mjs) and the demo video (demo-video.mjs):
// a static server for the exported web app, and an in-memory stand-in for
// Supabase so no real account, email or data is ever touched.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

export const BASE_PATH = '/Socrates-and-Skeletons-';
export const SUPA = 'https://dufvcdwswcaqsfbxjwat.supabase.co';
export const ZXING_WASM = new URL('../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm', import.meta.url).pathname;

const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

/** Serve the exported web app (dist) at http://localhost:<port>/Socrates-and-Skeletons-/ like GitHub Pages does. */
export async function serveDist(dist, port) {
  const app = `http://localhost:${port}${BASE_PATH}/`;
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, app).pathname);
    if (!path.startsWith(BASE_PATH)) { res.writeHead(404); return res.end(); }
    path = path.slice(BASE_PATH.length) || '/';
    let file = join(dist, path);
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404, { 'content-type': 'text/html' });
      res.end(await readFile(join(dist, '404.html')));
    }
  });
  await new Promise((r) => server.listen(port, r));
  return { app, close: () => server.close() };
}

/** A fresh in-memory Supabase: `state` to arrange or inspect data, `supabase` to pass to page.route(). */
export function createFakeSupabase() {
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
    slipBusy: 0, // this many next parse-slip calls answer "AI busy" (free-tier rate limit)
    slipOffline: 0, // this many next parse-slip calls fail as if the phone lost its connection
    coach: { status: 200, body: { text: 'สัปดาห์นี้ใช้ไป ฿0 ยังไม่มีรายจ่ายเลยนะ' } }, // answer of the coach function
    aiDelayMs: 0, // how long the AI functions take to answer (the demo video makes them feel real)
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
    if (p.startsWith('/functions/v1/') && state.aiDelayMs) await new Promise((r) => setTimeout(r, state.aiDelayMs));
    if (p === '/functions/v1/coach') return reply(state.coach);
    if (p === '/functions/v1/parse-slip') {
      if (state.slipOffline > 0) {
        state.slipOffline -= 1;
        return route.abort('internetdisconnected');
      }
      if (state.slipBusy > 0) {
        state.slipBusy -= 1;
        return reply({ status: 503, body: { error: { code: 'busy', message: 'x' } } });
      }
      const reading = state.slipReadings.shift();
      return reading ? reply({ body: { reading } }) : reply(err(502, 'reader_error', 'x'));
    }
    if (p.startsWith('/functions/v1/')) return reply(err(503, 'not_configured', 'x'));
    return reply({ status: 404, body: {} });
  }

  return { state, supabase, makeUser, session };
}

/** Serve the QR decoder the web app downloads from a CDN from node_modules instead (fast, works offline). */
export async function routeQrDecoder(page) {
  await page.route('**/zxing_reader.wasm', (route) => route.fulfill({ path: ZXING_WASM, contentType: 'application/wasm' }));
}

const FIXTURES = new URL('./fixtures/', import.meta.url).pathname;

/**
 * Stand in for a phone's photo library (see src/services/gallery.web.ts), so the
 * web app runs the same automatic scan as the Android app.
 * `photos`: [{ name: 'slip-qr.jpg', minutesAgo: 30, width: 1080, height: 1920 }, ...] from e2e/fixtures.
 */
export async function installTestGallery(page, photos) {
  await page.route('**/__test-gallery__/*', (route) => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop());
    return route.fulfill({ path: FIXTURES + name, contentType: 'image/jpeg' });
  });
  const images = photos.map((p, i) => ({
    id: `test-photo-${i + 1}`,
    name: p.name,
    minutesAgo: p.minutesAgo ?? (i + 1) * 20,
    width: p.width ?? 1080,
    height: p.height ?? 1920,
  }));
  await page.addInitScript((list) => {
    window.__MINDPAY_TEST_GALLERY__ = {
      images: list.map((p) => ({
        id: p.id,
        uri: `${location.origin}/__test-gallery__/${encodeURIComponent(p.name)}`,
        createdAt: Date.now() - p.minutesAgo * 60_000,
        width: p.width,
        height: p.height,
      })),
    };
  }, images);
}

