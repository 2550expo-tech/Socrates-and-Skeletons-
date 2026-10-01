/**
 * FR-4 Automatic Gallery Slip Detection — the rules, separated from the phone APIs
 * so every rule can be unit-tested.
 *
 * Pipeline for one image:
 *   1. read the QR code on the slip (on the phone, free)          -> parseSlipQr
 *   2. send the image to the slip reader (server + AI vision: Claude or Gemini)  -> SlipReading
 *   3. clean the reading and flag unsure fields                    -> normalizeReading
 *   4. decide what to do with it                                   -> classifyCandidate
 *
 * CONFIDENCE RULE (Charter: 80%): a field whose confidence is below 0.8, or that
 * is missing, is flagged. A slip with no flags is "ready" (one tap to confirm);
 * any flag makes it "needs_review". Nothing from a slip is ever counted in a
 * total until the user confirms it.
 */
import { suggestCategory } from './categories';
import { addDays, bkkDayKey, isDayInRange, parseSlipDate, parseSlipTime } from './dates';
import { formatBaht, parseBahtToSatang } from './money';
import { decideDirection, EMPTY_NAME_STATS, type NameStats } from './slipNames';
import type { Transaction, TxKind, TxStatus } from './types';

export const CONFIDENCE_THRESHOLD = 0.8;

/** What the slip reader (supabase/functions/parse-slip) returns for one image. */
export interface SlipReading {
  isSlip: boolean;
  direction: 'expense' | 'income' | 'unknown';
  amount: string | number | null;
  /** Date exactly as printed, e.g. "27 ก.ย. 69" */
  dateText: string | null;
  /** The reader's own conversion to YYYY-MM-DD (Gregorian), may be null */
  dateIso: string | null;
  time: string | null;
  counterparty: string | null;
  bank: string | null;
  reference: string | null;
  /** Payer and receiver as printed (newer readers only). */
  fromName?: string | null;
  toName?: string | null;
  confidence: { amount: number; date: number; counterparty: number };
}

/** How the reader double-checked the slip (parse-slip reads every slip twice with two models). */
export interface SlipCheck {
  verified: boolean;
  reads: number;
  disagree: Partial<Record<'amount' | 'date' | 'direction' | 'counterparty', [string | null, string | null]>>;
}

export type ReviewFlag = 'amount' | 'date' | 'counterparty' | 'direction';

export const FLAG_LABEL: Record<ReviewFlag, string> = {
  amount: 'ยอดเงิน',
  date: 'วันที่',
  counterparty: 'ผู้รับ/ผู้โอน',
  direction: 'เงินเข้าหรือออก',
};

export interface SlipCandidate {
  kind: TxKind;
  amountSatang: number | null;
  dayKey: string | null;
  time: string | null;
  counterparty: string | null;
  bank: string | null;
  ref: string | null;
  imageHash: string | null;
  categoryKey: string;
  /** Lowest of the three field confidences */
  confidence: number;
  flags: ReviewFlag[];
  /** Payer and receiver are both the user (money moved between the user's own accounts). */
  ownTransfer: boolean;
}

// ---------------------------------------------------------------------------
// QR on Thai bank slips
// ---------------------------------------------------------------------------

/** Parse EMVCo-style TLV: 2-digit tag, 2-digit length, value. */
export function parseTlv(data: string): Map<string, string> | null {
  const out = new Map<string, string>();
  let i = 0;
  while (i < data.length) {
    if (i + 4 > data.length) return null;
    const tag = data.slice(i, i + 2);
    const len = Number(data.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(tag) || !Number.isInteger(len)) return null;
    const value = data.slice(i + 4, i + 4 + len);
    if (value.length !== len) return null;
    out.set(tag, value);
    i += 4 + len;
  }
  return out;
}

/** CRC-16/CCITT-FALSE, used by Thai QR payloads (tag 91). */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface SlipQr {
  sendingBank: string;
  transRef: string;
  crcValid: boolean;
}

/**
 * Thai bank slips carry a "slip verification" QR. It holds the sending bank
 * code and a transaction reference that is unique per transfer, which makes it
 * the most reliable duplicate key we have. Payment QRs (PromptPay) are rejected.
 */
export function parseSlipQr(data: string | null | undefined): SlipQr | null {
  if (!data) return null;
  const top = parseTlv(data.trim());
  if (!top) return null;
  const info = top.get('00');
  if (!info) return null;
  const sub = parseTlv(info);
  if (!sub || sub.get('00') !== '000001') return null;
  const bank = sub.get('01');
  const ref = sub.get('02');
  if (!bank || !ref) return null;
  const crc = top.get('91');
  const crcValid = !!crc && crc.toUpperCase() === crc16(data.slice(0, data.lastIndexOf('9104') + 4));
  return { sendingBank: bank, transRef: ref, crcValid };
}

/**
 * Bank codes in the slip QR (the Bank of Thailand's 3-digit codes). The QR is
 * made by the sending bank, so its code names the bank more reliably than
 * reading the logo on the picture.
 */
export const BANK_BY_CODE: Record<string, string> = {
  '002': 'Bangkok Bank',
  '004': 'KBank',
  '006': 'Krungthai',
  '011': 'ttb',
  '014': 'SCB',
  '017': 'Citibank',
  '020': 'Standard Chartered',
  '022': 'CIMB Thai',
  '024': 'UOB',
  '025': 'Krungsri',
  '030': 'GSB (ออมสิน)',
  '031': 'HSBC',
  '033': 'GHB (ธอส.)',
  '034': 'BAAC (ธ.ก.ส.)',
  '066': 'Islamic Bank',
  '067': 'TISCO',
  '069': 'KKP',
  '070': 'ICBC Thai',
  '071': 'Thai Credit',
  '073': 'LH Bank',
  '098': 'SME D Bank',
};

export function bankFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return BANK_BY_CODE[code.padStart(3, '0').slice(-3)] ?? null;
}

/** The first code in a picture that is a Thai slip-verification QR. */
export function firstSlipQr(codes: (string | null | undefined)[]): SlipQr | null {
  for (const code of codes) {
    const qr = parseSlipQr(code);
    if (qr) return qr;
  }
  return null;
}

export interface PictureSize {
  width?: number | null;
  height?: number | null;
}

/**
 * Pictures about the size of a phone screen: slips saved by bank apps and
 * screenshots, not camera photos (those are 1,500+ pixels wide). Only these get
 * the closer look below, which keeps scanning a big gallery quick.
 */
export function isScreenSized(size: PictureSize | null | undefined): boolean {
  const w = size?.width ?? 0;
  const h = size?.height ?? 0;
  if (!w || !h) return true; // size unknown: look closer anyway
  return w <= 1600 && h >= w;
}

/**
 * Where banks print the verification QR on a slip, as fractions of the picture.
 * Phone QR scanners (Android's in particular) read best when the code fills a
 * large part of the image, and the slip QR is small, so when the whole picture
 * shows no slip QR the scan looks again at these parts, one by one.
 */
export const SLIP_QR_REGIONS: readonly { x: number; y: number; width: number; height: number }[] = [
  { x: 0, y: 0.45, width: 1, height: 0.55 }, // lower half (most banks)
  { x: 0.45, y: 0.55, width: 0.55, height: 0.45 }, // lower right corner (K PLUS, SCB EASY, Krungthai NEXT...)
];

/** A region in whole pixels, always inside the picture. */
export function regionInPixels(region: { x: number; y: number; width: number; height: number }, size: { width: number; height: number }) {
  const originX = Math.max(0, Math.floor(region.x * size.width));
  const originY = Math.max(0, Math.floor(region.y * size.height));
  return {
    originX,
    originY,
    width: Math.max(1, Math.min(size.width - originX, Math.round(region.width * size.width))),
    height: Math.max(1, Math.min(size.height - originY, Math.round(region.height * size.height))),
  };
}

// ---------------------------------------------------------------------------
// Reading -> candidate
// ---------------------------------------------------------------------------

export function normalizeRef(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const r = ref.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return r.length >= 6 ? r : null;
}

const clamp01 = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function normalizeReading(
  reading: SlipReading,
  extra: { qr?: SlipQr | null; imageHash?: string | null; now?: Date; names?: NameStats } = {},
): SlipCandidate {
  const now = extra.now ?? new Date();
  const today = bkkDayKey(now);
  const flags: ReviewFlag[] = [];
  const conf = {
    amount: clamp01(reading.confidence?.amount),
    date: clamp01(reading.confidence?.date),
    counterparty: clamp01(reading.confidence?.counterparty),
  };

  const amountSatang = parseBahtToSatang(reading.amount);
  if (amountSatang === null || conf.amount < CONFIDENCE_THRESHOLD) flags.push('amount');

  // Trust our own parser of the printed text first; fall back to the reader's ISO date.
  const fromText = parseSlipDate(reading.dateText, now);
  const fromIso = parseSlipDate(reading.dateIso, now);
  const dayKey = fromText ?? fromIso;
  const disagree = !!fromText && !!fromIso && fromText !== fromIso;
  const inFuture = !!dayKey && dayKey > addDays(today, 1);
  if (!dayKey || conf.date < CONFIDENCE_THRESHOLD || disagree || inFuture) flags.push('date');

  // Income or expense: from the names on the slip once the user's own name is known.
  const dir = decideDirection(reading, extra.names ?? EMPTY_NAME_STATS);
  const kind: TxKind = dir.kind;
  const counterparty = dir.counterparty?.trim() || null;
  if (!counterparty || conf.counterparty < CONFIDENCE_THRESHOLD) flags.push('counterparty');
  if (dir.unsure) flags.push('direction');

  return {
    kind,
    amountSatang,
    dayKey: inFuture ? null : dayKey,
    time: parseSlipTime(reading.time),
    counterparty,
    // The QR's bank code first: it comes from the bank itself.
    bank: bankFromCode(extra.qr?.sendingBank) ?? (reading.bank?.trim() || null),
    ref: normalizeRef(extra.qr?.transRef) ?? normalizeRef(reading.reference),
    imageHash: extra.imageHash ?? null,
    categoryKey: suggestCategory(counterparty, kind),
    confidence: Math.min(conf.amount, conf.date, conf.counterparty),
    flags,
    ownTransfer: dir.ownTransfer,
  };
}

const bahtText = (v: string | null) => {
  const satang = parseBahtToSatang(v);
  return satang === null ? (v ?? 'อ่านไม่ได้') : formatBaht(satang);
};

/**
 * The note saved with a slip: which bank made it, and how it was checked.
 * When the two AI reads disagree, both values are written down so the user can
 * pick the right one (the review screen offers the amounts as buttons).
 */
export function slipNote(c: Pick<SlipCandidate, 'bank' | 'ownTransfer'>, check?: SlipCheck | null): string | null {
  const lines: string[] = [];
  if (c.bank) lines.push(`สลิปจาก ${c.bank}`);
  const d = check?.disagree ?? {};
  const parts: string[] = [];
  if (d.amount) parts.push(`ยอดเงิน ${bahtText(d.amount[0])} หรือ ${bahtText(d.amount[1])}`);
  if (d.date) parts.push(`วันที่ ${d.date[0] ?? 'อ่านไม่ได้'} หรือ ${d.date[1] ?? 'อ่านไม่ได้'}`);
  if (d.direction) parts.push('เงินเข้าหรือออก');
  if (d.counterparty) parts.push(`ชื่อ ${d.counterparty[0] ?? 'อ่านไม่ได้'} หรือ ${d.counterparty[1] ?? 'อ่านไม่ได้'}`);
  if (parts.length) lines.push(`${ALT_PREFIX} ${parts.join(' · ')}`);
  else if (check && check.reads < 2) lines.push('อ่านได้รอบเดียว ช่วยตรวจกับสลิปอีกครั้ง');
  else if (check && !check.verified) lines.push('AI 2 ตัวเห็นไม่ตรงกันว่าเป็นสลิปหรือไม่ ช่วยตรวจกับรูปอีกครั้ง');
  if (c.ownTransfer) lines.push('ดูเหมือนโอนระหว่างบัญชีของคุณเอง ถ้าใช่ ลบรายการนี้ได้ (ไม่ใช่รายรับหรือรายจ่าย)');
  return lines.length ? lines.join('\n') : null;
}

/** Start of the note line that lists the two readings. */
export const ALT_PREFIX = 'AI อ่านได้ 2 แบบ:';

/** The amounts offered in a note written by slipNote, in satang (for the review screen's buttons). */
export function amountChoices(note: string | null | undefined): number[] {
  const line = note?.split('\n').find((l) => l.startsWith(ALT_PREFIX));
  const m = line?.match(/ยอดเงิน (.+?) หรือ (.+?)(?: ·|$)/);
  if (!m) return [];
  const out = [m[1], m[2]].map((v) => parseBahtToSatang(v.replace(/[^\d.,]/g, ''))).filter((v): v is number => v !== null);
  return [...new Set(out)];
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

export type SlipOutcome = 'ready' | 'needs_review' | 'duplicate' | 'out_of_range' | 'not_slip';

export interface DuplicateIndex {
  refs: Set<string>;
  hashes: Set<string>;
  /** Amount + day + minute -> the payees seen with it ('' = none read). */
  composite: Map<string, Set<string>>;
}

/** Titles the app gives a slip when no payee was read: they say nothing about who was paid. */
const NO_PAYEE_TITLES = new Set(['รายการจากสลิป', 'โอนระหว่างบัญชีตัวเอง']);

const payeeKey = (who: string | null | undefined) => {
  const w = (who ?? '').toLowerCase().replace(/\s+/g, '');
  return NO_PAYEE_TITLES.has(w) ? '' : w;
};

/** Amount + day + minute, the part of the duplicate check that must always match. */
export function compositeKey(p: { amountSatang: number | null; dayKey: string | null; time: string | null }): string | null {
  if (!p.amountSatang || !p.dayKey || !p.time) return null;
  return `${p.amountSatang}|${p.dayKey}|${p.time}`;
}

export function buildDuplicateIndex(existing: Transaction[]): DuplicateIndex {
  const idx: DuplicateIndex = { refs: new Set(), hashes: new Set(), composite: new Map() };
  for (const t of existing) addToIndex(idx, t);
  return idx;
}

export function addToIndex(
  idx: DuplicateIndex,
  t: Pick<Transaction, 'slipRef' | 'slipImageHash' | 'amountSatang' | 'occurredAt' | 'title' | 'source'>,
) {
  if (t.slipRef) idx.refs.add(t.slipRef);
  if (t.slipImageHash) idx.hashes.add(t.slipImageHash);
  if (t.source === 'slip') {
    const key = compositeKey({
      amountSatang: t.amountSatang,
      dayKey: bkkDayKey(t.occurredAt),
      time: new Date(new Date(t.occurredAt).getTime() + 7 * 3600e3).toISOString().slice(11, 16),
    });
    if (!key) return;
    const who = idx.composite.get(key) ?? new Set<string>();
    who.add(payeeKey(t.title));
    idx.composite.set(key, who);
  }
}

/**
 * The same slip seen again: same reference, same image, or (for slips without a reference) the
 * same amount, day and minute with the same payee. A payee missing on either side still matches,
 * since the saved title may be the app's own "รายการจากสลิป".
 */
export function isDuplicate(c: SlipCandidate, idx: DuplicateIndex): boolean {
  if (c.ref && idx.refs.has(c.ref)) return true;
  if (c.imageHash && idx.hashes.has(c.imageHash)) return true;
  if (!c.ref) {
    const key = compositeKey(c);
    const seen = key ? idx.composite.get(key) : undefined;
    if (seen) {
      const who = c.ownTransfer ? '' : payeeKey(c.counterparty);
      if (!who || seen.has('') || seen.has(who)) return true;
    }
  }
  return false;
}

export function classifyCandidate(
  c: SlipCandidate,
  opts: { range: { from: string; to: string }; index: DuplicateIndex },
): Exclude<SlipOutcome, 'not_slip'> {
  if (isDuplicate(c, opts.index)) return 'duplicate';
  if (c.dayKey && !isDayInRange(c.dayKey, opts.range)) return 'out_of_range';
  return c.flags.length === 0 ? 'ready' : 'needs_review';
}

/**
 * How a newly read slip is saved.
 * Team decision (27 ก.ย. 2569): when "auto-confirm" is on, a slip whose every key
 * field was read with at least 80% confidence counts in the balance right away
 * (the user can undo). Anything unsure stays a draft until the user checks it.
 */
export function initialStatus(outcome: 'ready' | 'needs_review', autoConfirm: boolean): TxStatus {
  return outcome === 'ready' && autoConfirm ? 'confirmed' : 'draft';
}
