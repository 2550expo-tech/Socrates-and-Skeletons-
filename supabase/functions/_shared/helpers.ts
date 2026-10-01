// Pure helpers for the Edge Functions. No Deno APIs here, so the same file is
// unit-tested with vitest (see __tests__/helpers.test.ts).

export type AiProvider = 'claude' | 'gemini';

/**
 * Secret names accepted for each service. The first is the documented one;
 * the rest are Google's other standard name and common typing slips seen in
 * the Supabase dashboard (a secret saved as "GEMINI API KEY", 28 ก.ย. 2569).
 */
export const GEMINI_KEY_NAMES = [
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'GEMINI API KEY',
  'GEMINI-API-KEY',
  'GEMINI_KEY',
];
export const CLAUDE_KEY_NAMES = ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY', 'ANTHROPIC API KEY'];

/**
 * The first secret that is set, with spaces, line breaks or quotes from
 * copy-paste removed. Returns null when none is set.
 */
export function readKey(get: (name: string) => string | undefined | null, names: string[]): string | null {
  for (const name of names) {
    const raw = get(name);
    const clean = raw?.trim().replace(/^["']|["']$/g, '').trim();
    if (clean) return clean;
  }
  return null;
}

/**
 * Which AI service answers: Claude when its key is set, otherwise Gemini.
 * AI_PROVIDER=claude|gemini forces one. Returns null when no usable key is set.
 */
export function pickProvider(env: { forced?: string | null; hasClaude: boolean; hasGemini: boolean }): AiProvider | null {
  const forced = env.forced?.trim().toLowerCase();
  if (forced === 'claude') return env.hasClaude ? 'claude' : null;
  if (forced === 'gemini') return env.hasGemini ? 'gemini' : null;
  if (env.hasClaude) return 'claude';
  if (env.hasGemini) return 'gemini';
  return null;
}

/** Gemini models to try in order. A model the key cannot use (404, or no free quota) falls through to the next. */
export function geminiModels(preferred?: string | null): string[] {
  const list = [preferred?.trim(), 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-flash-latest'];
  return [...new Set(list.filter((m): m is string => !!m))];
}

/**
 * Models for the second, independent read of a slip. A different (larger) model
 * than the first read makes the two readings independent, so a misread digit
 * shows up as a disagreement. Each model has its own free quota, so running both
 * at once does not halve how many slips can be read.
 */
export function verifierModels(preferred?: string | null): string[] {
  const list = [preferred?.trim(), 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];
  return [...new Set(list.filter((m): m is string => !!m))];
}

/** The key itself was refused (wrong, deleted, or not allowed for this API). */
export function isInvalidKey(status: number, body: string): boolean {
  if (status === 401 || status === 403) return true;
  return status === 400 && /API_KEY_INVALID|API key not valid|invalid x-api-key/i.test(body);
}

/** A 429 that means "this model has no quota on this key at all" rather than "slow down". */
export function isZeroQuota(body: string): boolean {
  return /limit:\s*0\b/.test(body);
}

/**
 * What to do after a failed Gemini call:
 * - invalid_key: stop, the key is wrong (tell the app "not configured")
 * - plain_schema: retry the same model with the schema described in the prompt
 * - next_model: this model is not available to this key; try the next one
 * - busy: rate limit or overload on this model. Each model has its own free
 *   quota, so try the next model first and wait only when all are busy.
 * - fail: anything else
 */
export type GeminiStep = 'invalid_key' | 'plain_schema' | 'next_model' | 'busy' | 'fail';

export function geminiStep(status: number, body: string, usingJsonSchema: boolean): GeminiStep {
  if (isInvalidKey(status, body)) return 'invalid_key';
  if (status === 404) return 'next_model';
  if (status === 429 && isZeroQuota(body)) return 'next_model';
  if (status === 400 && usingJsonSchema) return 'plain_schema';
  if (status === 429 || status === 500 || status === 503) return 'busy';
  return 'fail';
}

/** Gemini 429 bodies carry RetryInfo such as "retryDelay": "7s". Returns milliseconds, or null. */
export function retryDelayMs(body: string): number | null {
  const m = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return m ? Math.ceil(Number(m[1]) * 1000) : null;
}

/** Text of the first Gemini candidate, without "thought" parts. */
export function geminiText(data: unknown): string {
  const parts = (data as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] })
    ?.candidates?.[0]?.content?.parts;
  return (parts ?? [])
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');
}

/** Parse a JSON reply; tolerates ```json fences or a sentence around the object. */
export function parseJsonText(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('AI reply was not JSON');
  }
}

/**
 * Coach replies are shown as plain text and read aloud: drop markdown bold,
 * headings and list bullets if a model adds them.
 */
export function plainText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
    .trim();
}

export interface SlipReadingOut {
  isSlip: boolean;
  direction: 'expense' | 'income' | 'unknown';
  amount: string | null;
  dateText: string | null;
  dateIso: string | null;
  time: string | null;
  counterparty: string | null;
  bank: string | null;
  reference: string | null;
  /** Payer and receiver as printed (the app works out which one is the user). */
  fromName: string | null;
  toName: string | null;
  confidence: { amount: number; date: number; counterparty: number };
}

/** Longest text kept from a reading: names become the transaction title (the database allows 120). */
export const MAX_TEXT = 100;
/** Largest amount a slip can carry, in baht (the app takes up to ฿1,000,000,000). */
export const MAX_AMOUNT_BAHT = 1_000_000_000;

function text(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s && s.toLowerCase() !== 'null' ? s.slice(0, MAX_TEXT).trim() : null;
}

function amountText(v: unknown): string | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 && v <= MAX_AMOUNT_BAHT ? v.toFixed(2) : null;
  const s = text(v);
  if (!s) return null;
  const cleaned = s.replace(/฿|บาท|THB|,|\s/gi, '').replace(/^[+\-−]/, '');
  return /^\d+(\.\d{1,2})?$/.test(cleaned) && Number(cleaned) > 0 && Number(cleaned) <= MAX_AMOUNT_BAHT ? cleaned : null;
}

function isoDate(v: unknown): string | null {
  const s = text(v);
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  let year = Number(m[1]);
  if (year > 2400) year -= 543; // Buddhist Era year left unconverted
  return `${year}-${m[2]}-${m[3]}`;
}

function clockTime(v: unknown): string | null {
  const m = text(v)?.match(/^(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

function score(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Make a slip reading safe for the app, whichever model produced it:
 * unknown values become null, and a null value never keeps a high confidence
 * (so an unreadable field always sends the slip to "รอยืนยัน").
 *
 * The amount is also checked against itself: the model writes it twice (as
 * digits, and exactly as printed with commas), and a slip whose two amounts do
 * not match, or whose amount equals the fee, gets no confidence in its amount.
 */
export function normalizeReading(raw: unknown): SlipReadingOut {
  const r = (raw ?? {}) as Record<string, unknown>;
  const conf = (r.confidence ?? {}) as Record<string, unknown>;
  const empty: SlipReadingOut = {
    isSlip: false,
    direction: 'unknown',
    amount: null,
    dateText: null,
    dateIso: null,
    time: null,
    counterparty: null,
    bank: null,
    reference: null,
    fromName: null,
    toName: null,
    confidence: { amount: 0, date: 0, counterparty: 0 },
  };
  if (r.isSlip !== true) return empty;

  const amount = amountText(r.amount);
  const printed = r.amountPrinted === undefined ? undefined : amountText(r.amountPrinted);
  const fee = amountText(r.fee);
  // Written twice and the two differ, or it is the fee: the amount is not trusted.
  const amountDoubtful =
    !!amount && ((printed !== undefined && (printed === null || Number(printed) !== Number(amount))) || (!!fee && Number(fee) === Number(amount)));
  const dateText = text(r.dateText);
  const dateIso = isoDate(r.dateIso);
  const counterparty = text(r.counterparty);
  const reference = text(r.reference)?.replace(/[^0-9A-Za-z]/g, '') || null;
  const direction = r.direction === 'expense' || r.direction === 'income' ? r.direction : 'unknown';
  return {
    isSlip: true,
    direction,
    amount,
    dateText,
    dateIso,
    time: clockTime(r.time),
    counterparty,
    bank: text(r.bank),
    reference,
    fromName: text(r.fromName),
    toName: text(r.toName),
    confidence: {
      amount: amount && !amountDoubtful ? score(conf.amount) : 0,
      date: dateIso || dateText ? score(conf.date) : 0,
      counterparty: counterparty ? score(conf.counterparty) : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Two independent reads of the same slip
// ---------------------------------------------------------------------------

/** Below the app's 0.8 rule, so the field is shown to the user to check. */
export const UNSURE = 0.5;
/** A single read that could not be double-checked is never counted without a look. */
export const UNCHECKED_MAX = 0.79;

export type CheckedField = 'amount' | 'date' | 'direction' | 'counterparty';

export interface SlipCheck {
  /** Both reads agreed on every key field (or were merged without a doubt). */
  verified: boolean;
  /** How many independent reads were made (1 when the second one could not be made). */
  reads: number;
  /** Fields the two reads disagree on, with both values, for the user to choose from. */
  disagree: Partial<Record<CheckedField, [string | null, string | null]>>;
}

const THAI_MONTHS: Record<string, string> = {
  'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04', 'พ.ค.': '05', 'มิ.ย.': '06',
  'ก.ค.': '07', 'ส.ค.': '08', 'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12',
};

/** "27 ก.ย. 69" and "27ก.ย.2569" and "27 ก.ย. 2569" are the same date. */
function dateTextKey(s: string | null): string | null {
  if (!s) return null;
  let t = s.replace(/\s+/g, '');
  for (const [m, n] of Object.entries(THAI_MONTHS)) t = t.split(m).join(`/${n}/`);
  const m = t.match(/(\d{1,2})\D+(\d{1,2})\D+(\d{2,4})/);
  if (!m) return t.toLowerCase();
  let year = Number(m[3]);
  if (year < 100) year += year >= 40 ? 2500 : 2000; // "69" = 2569
  if (year > 2400) year -= 543;
  return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function sameDate(a: SlipReadingOut, b: SlipReadingOut): boolean {
  if (a.dateIso && b.dateIso && a.dateIso === b.dateIso) return true;
  const ta = dateTextKey(a.dateText);
  const tb = dateTextKey(b.dateText);
  if (ta && tb) return ta === tb;
  return !a.dateIso && !b.dateIso && !a.dateText && !b.dateText;
}

const NAME_TITLES = /^(?:นางสาว|นาง|นาย|น\.ส\.|ด\.ช\.|ด\.ญ\.|คุณ|mrs\.?|mr\.?|ms\.?|miss)\s*/i;

/** A name as letters only: no title, spaces, dots, or masking ("x", "*"). */
export function nameLetters(s: string | null): string {
  if (!s) return '';
  return s
    .trim()
    .replace(NAME_TITLES, '')
    .toLowerCase()
    .replace(/[\s.\-*•·_]|x{2,}/g, '');
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

/**
 * The same name read twice: equal letters, one a masked start of the other
 * ("สมชาย ใ***" and "สมชาย ใจดี"), or at most one letter in five different.
 */
export function similarName(a: string | null, b: string | null): boolean {
  const x = nameLetters(a);
  const y = nameLetters(b);
  if (!x || !y) return !x && !y;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= 3 && long.startsWith(short)) return true;
  return editDistance(x, y) <= Math.floor(long.length / 5);
}

const higher = (x: number, y: number) => Math.max(x, y);

/**
 * Put two independent readings of one slip together. Where they agree the
 * value is kept (with the higher confidence); where they disagree on the
 * amount, date, direction or who was paid, the field is marked unsure so the
 * slip waits for the user, and both values are returned to choose from.
 * One reading only (the second could not be made), or both made by the same model
 * (their mistakes would agree): confidences are capped so nothing is counted
 * without a look.
 */
export function mergeReadings(
  a: SlipReadingOut | null,
  b: SlipReadingOut | null,
  opts: { sameModel?: boolean } = {},
): { reading: SlipReadingOut; check: SlipCheck } {
  const merged = mergeTwo(a, b);
  if (!opts.sameModel || merged.check.reads < 2) return merged;
  const c = merged.reading.confidence;
  return {
    reading: { ...merged.reading, confidence: { amount: Math.min(c.amount, UNCHECKED_MAX), date: Math.min(c.date, UNCHECKED_MAX), counterparty: Math.min(c.counterparty, UNCHECKED_MAX) } },
    check: { ...merged.check, verified: false },
  };
}

function mergeTwo(a: SlipReadingOut | null, b: SlipReadingOut | null): { reading: SlipReadingOut; check: SlipCheck } {
  const only = a ?? b;
  if (!only) throw new Error('No reading to merge');
  if (!a || !b) {
    const c = only.confidence;
    return {
      reading: { ...only, confidence: { amount: Math.min(c.amount, UNCHECKED_MAX), date: Math.min(c.date, UNCHECKED_MAX), counterparty: Math.min(c.counterparty, UNCHECKED_MAX) } },
      check: { verified: false, reads: 1, disagree: {} },
    };
  }
  if (!a.isSlip && !b.isSlip) return { reading: a, check: { verified: true, reads: 2, disagree: {} } };
  if (a.isSlip !== b.isSlip) {
    // One model sees a slip, the other does not: keep the slip, but nothing in it is sure.
    const slip = a.isSlip ? a : b;
    return {
      reading: { ...slip, confidence: { amount: Math.min(slip.confidence.amount, UNSURE), date: Math.min(slip.confidence.date, UNSURE), counterparty: Math.min(slip.confidence.counterparty, UNSURE) } },
      check: { verified: false, reads: 2, disagree: {} },
    };
  }

  const disagree: SlipCheck['disagree'] = {};
  const conf = { ...a.confidence };

  const amountAgrees = !!a.amount && !!b.amount && Number(a.amount) === Number(b.amount);
  // Agreeing reads keep the higher confidence, unless one of them doubted its own amount.
  const lowest = Math.min(a.confidence.amount, b.confidence.amount);
  if (amountAgrees) conf.amount = lowest < UNSURE ? lowest : higher(a.confidence.amount, b.confidence.amount);
  else {
    conf.amount = Math.min(a.confidence.amount, UNSURE);
    if (a.amount || b.amount) disagree.amount = [a.amount, b.amount];
  }

  if (sameDate(a, b)) conf.date = higher(a.confidence.date, b.confidence.date);
  else {
    conf.date = Math.min(a.confidence.date, UNSURE);
    disagree.date = [a.dateText ?? a.dateIso, b.dateText ?? b.dateIso];
  }

  let direction = a.direction;
  if (a.direction !== b.direction) {
    if (a.direction === 'unknown') direction = b.direction;
    else if (b.direction !== 'unknown') {
      direction = 'unknown';
      disagree.direction = [a.direction, b.direction];
    }
  }

  let counterparty = a.counterparty ?? b.counterparty;
  if (similarName(a.counterparty, b.counterparty)) {
    conf.counterparty = higher(a.confidence.counterparty, b.confidence.counterparty);
    // Prefer the fuller spelling when one of them is masked or cut short.
    const [la, lb] = [nameLetters(a.counterparty), nameLetters(b.counterparty)];
    if (lb.length > la.length && lb.startsWith(la)) counterparty = b.counterparty;
  } else {
    conf.counterparty = Math.min(a.confidence.counterparty, UNSURE);
    disagree.counterparty = [a.counterparty, b.counterparty];
  }

  // A value only one read found is kept (still unsure, so the user checks it) instead of lost.
  const dateFrom = a.dateIso || a.dateText ? a : b;
  const reading: SlipReadingOut = {
    ...a,
    amount: a.amount ?? b.amount,
    dateText: dateFrom.dateText,
    dateIso: dateFrom.dateIso,
    direction,
    counterparty,
    time: a.time ?? b.time,
    bank: a.bank ?? b.bank,
    reference: a.reference ?? b.reference,
    fromName: similarName(a.fromName, b.fromName) ? a.fromName ?? b.fromName : null,
    toName: similarName(a.toName, b.toName) ? a.toName ?? b.toName : null,
    confidence: conf,
  };
  return { reading, check: { verified: Object.keys(disagree).length === 0, reads: 2, disagree } };
}
