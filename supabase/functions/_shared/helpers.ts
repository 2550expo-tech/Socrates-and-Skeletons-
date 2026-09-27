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

/** Coach replies are shown as plain text: drop markdown bold and headings if a model adds them. */
export function plainText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
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
  confidence: { amount: number; date: number; counterparty: number };
}

function text(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s && s.toLowerCase() !== 'null' ? s : null;
}

function amountText(v: unknown): string | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v.toFixed(2) : null;
  const s = text(v);
  if (!s) return null;
  const cleaned = s.replace(/฿|บาท|THB|,|\s/gi, '');
  return /^\d+(\.\d{1,2})?$/.test(cleaned) && Number(cleaned) > 0 ? cleaned : null;
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
    confidence: { amount: 0, date: 0, counterparty: 0 },
  };
  if (r.isSlip !== true) return empty;

  const amount = amountText(r.amount);
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
    confidence: {
      amount: amount ? score(conf.amount) : 0,
      date: dateIso || dateText ? score(conf.date) : 0,
      counterparty: counterparty ? score(conf.counterparty) : 0,
    },
  };
}
