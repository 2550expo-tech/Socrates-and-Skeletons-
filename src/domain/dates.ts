/**
 * Date helpers fixed to Thailand time (Asia/Bangkok, UTC+7, no daylight saving).
 *
 * Everything the user sees ("today", "this week", the date printed on a slip)
 * is a Bangkok calendar day, so all grouping and range logic goes through
 * `bkkDayKey`. Because Thailand has no DST, a fixed +7h offset is exact.
 */
import type { RangeKey } from './types';

export const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Instant -> "YYYY-MM-DD" in Bangkok. */
export function bkkDayKey(at: Date | string | number): string {
  const ms = new Date(at).getTime() + BKK_OFFSET_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" (Bangkok day) -> the UTC instant of 00:00 that day in Bangkok. */
/** Milliseconds until the next 00:00 in Bangkok (when "วันนี้" starts over). */
export function msUntilNextBkkMidnight(nowMs: number = Date.now()): number {
  const next = bkkDayStart(addDays(bkkDayKey(nowMs), 1)).getTime();
  return Math.max(0, next - nowMs);
}

export function bkkDayStart(dayKey: string): Date {
  return new Date(Date.parse(`${dayKey}T00:00:00.000Z`) - BKK_OFFSET_MS);
}

/** Add whole days to a "YYYY-MM-DD" key. */
export function addDays(dayKey: string, days: number): string {
  return new Date(Date.parse(`${dayKey}T00:00:00.000Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Whole days from a to b (both "YYYY-MM-DD"). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** Combine a Bangkok day and "HH:MM" into an ISO instant. */
export function bkkToIso(dayKey: string, time: string | null = '12:00'): string {
  const t = time && /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, '0') : '12:00';
  return new Date(Date.parse(`${dayKey}T${t}:00.000Z`) - BKK_OFFSET_MS).toISOString();
}

/** "HH:MM" of an instant in Bangkok. */
export function bkkTime(at: Date | string): string {
  return new Date(new Date(at).getTime() + BKK_OFFSET_MS).toISOString().slice(11, 16);
}

/**
 * Number of calendar days (including today) covered by each range.
 * The same definition is used by the dashboard (FR-2) and the slip scanner (FR-4),
 * so "1 เดือน" always means the same 30 days everywhere in the app.
 */
export const RANGE_DAYS: Record<RangeKey, number> = {
  today: 1,
  '7d': 7,
  '1m': 30,
  '6m': 180,
  '1y': 365,
};

export const RANGE_LABEL: Record<RangeKey, string> = {
  today: 'วันนี้',
  '7d': '7 วัน',
  '1m': '1 เดือน',
  '6m': '6 เดือน',
  '1y': '1 ปี',
};

export const RANGE_ORDER: RangeKey[] = ['today', '7d', '1m', '6m', '1y'];

/** First and last Bangkok day of a range ending today. */
export function rangeDays(range: RangeKey, now: Date = new Date()): { from: string; to: string } {
  const to = bkkDayKey(now);
  return { from: addDays(to, -(RANGE_DAYS[range] - 1)), to };
}

/** UTC instant where a range starts (for querying the photo library by creation time). */
export function rangeStartMs(range: RangeKey, now: Date = new Date()): number {
  return bkkDayStart(rangeDays(range, now).from).getTime();
}

export function isDayInRange(dayKey: string, range: { from: string; to: string }): boolean {
  return dayKey >= range.from && dayKey <= range.to;
}

// ---------------------------------------------------------------------------
// Thai display
// ---------------------------------------------------------------------------

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];
const THAI_MONTHS_LONG = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const THAI_WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

/** "2026-09-27" -> "27 ก.ย. 2569" (Buddhist Era year, as Thai users read it). */
export function formatThaiDay(dayKey: string, opts: { year?: boolean } = {}): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const base = `${d} ${THAI_MONTHS_SHORT[m - 1]}`;
  return opts.year === false ? base : `${base} ${y + 543}`;
}

/**
 * Exact span of a period, so users see which hours count:
 *   today -> "28 ก.ย. 2569 · 00:00–23:59"
 *   7d    -> "22 – 28 ก.ย. 2569 · 7 วันเต็ม (00:00 วันแรก ถึง 23:59 วันนี้)"
 */
export function formatRangeSpan(range: RangeKey, now: Date = new Date()): string {
  const { from, to } = rangeDays(range, now);
  if (range === 'today') return `${formatThaiDay(to)} · 00:00–23:59`;
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const sameMonth = sameYear && from.slice(5, 7) === to.slice(5, 7);
  const start = sameMonth ? String(Number(from.slice(8, 10))) : formatThaiDay(from, { year: !sameYear });
  return `${start} – ${formatThaiDay(to)} · ${RANGE_DAYS[range]} วันเต็ม`;
}

/** "2026-09" -> "กันยายน 2569" */
export function formatThaiMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${THAI_MONTHS_LONG[m - 1]} ${y + 543}`;
}

/** "2026-09" -> "2026-08" (and "2026-01" -> "2025-12"). */
export function previousMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** Number of days in a month ("2026-02" -> 28). */
export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "2026-09-27" -> "วันอาทิตย์ที่ 27 กันยายน 2569" */
export function formatThaiDayLong(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `วัน${THAI_WEEKDAYS[weekday]}ที่ ${d} ${THAI_MONTHS_LONG[m - 1]} ${y + 543}`;
}

/** Friendly label for a day relative to today: "วันนี้", "เมื่อวาน", or "25 ก.ย." */
export function relativeDayLabel(dayKey: string, now: Date = new Date()): string {
  const today = bkkDayKey(now);
  if (dayKey === today) return 'วันนี้';
  if (dayKey === addDays(today, -1)) return 'เมื่อวาน';
  return formatThaiDay(dayKey, { year: dayKey.slice(0, 4) !== today.slice(0, 4) });
}

// ---------------------------------------------------------------------------
// Parsing dates printed on bank slips
// ---------------------------------------------------------------------------

/**
 * Month tokens with dots and spaces removed. OCR engines often drop or move the
 * dots in "ก.ย." (this is exactly what broke September slips in the old
 * prototype), so we compare letters only.
 */
const MONTH_TOKENS: [string, number][] = [
  ...THAI_MONTHS_SHORT.map((m, i) => [m.replace(/\./g, ''), i + 1] as [string, number]),
  ...THAI_MONTHS_LONG.map((m, i) => [m, i + 1] as [string, number]),
  ...['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].map(
    (m, i) => [m, i + 1] as [string, number],
  ),
];

function monthFromToken(token: string): number | null {
  const t = token.toLowerCase().replace(/[.\s]/g, '');
  if (!t) return null;
  // Longest match first so "มีค" is not read as "มค".
  const sorted = [...MONTH_TOKENS].sort((a, b) => b[0].length - a[0].length);
  for (const [name, month] of sorted) {
    if (t === name || (name.length >= 3 && t.startsWith(name))) return month;
  }
  return null;
}

/**
 * Turn a year as printed on a slip into a Gregorian year.
 * Thai slips usually print Buddhist Era years, often shortened: "69" = 2569 = 2026.
 */
export function normalizeYear(raw: number, now: Date = new Date()): number | null {
  const currentCe = Number(bkkDayKey(now).slice(0, 4));
  let year: number;
  if (raw >= 2400) year = raw - 543; // full BE: 2569
  else if (raw >= 1900) year = raw; // full CE: 2026
  else if (raw >= 0 && raw < 100) {
    const asBe = 2500 + raw - 543; // "69" -> 2026
    const asCe = 2000 + raw; // "26" -> 2026
    // Prefer the reading that is not in the future and closest to today.
    const candidates = [asBe, asCe].filter((y) => y <= currentCe + 1);
    if (candidates.length === 0) return null;
    year = candidates.reduce((best, y) =>
      Math.abs(y - currentCe) < Math.abs(best - currentCe) ? y : best,
    );
  } else return null;
  return year;
}

function validDay(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null; // e.g. 31 ก.พ.
  return date.toISOString().slice(0, 10);
}

/**
 * Parse a date as printed on a Thai bank slip. Returns "YYYY-MM-DD" or null.
 * Handles: "27 ก.ย. 69", "27 ก.ย. 2569", "27 กันยายน 2569", "27/09/2569",
 * "27-09-69", "2026-09-27", "27 Sep 2026", and OCR noise like "27ก.ย.69" or "27 กย 69".
 */
export function parseSlipDate(text: string | null | undefined, now: Date = new Date()): string | null {
  if (!text) return null;
  const s = text.trim().replace(/\s+/g, ' ');

  // ISO: 2026-09-27
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const y = normalizeYear(Number(m[1]), now);
    const day = y ? validDay(y, Number(m[2]), Number(m[3])) : null;
    if (day) return day;
  }

  // Day + month name + year: 27 ก.ย. 69 / 27ก.ย.2569 / 27 Sep 2026. Tried before the numeric form,
  // because a time printed with dots ("14.30.25", "12.10.25") looks like a numeric date.
  m = s.match(/(\d{1,2})\s*([ก-๙a-zA-Z][ก-๙a-zA-Z.\s]{0,12}?)\s*(\d{2,4})(?!\d)/);
  if (m) {
    const month = monthFromToken(m[2]);
    const y = normalizeYear(Number(m[3]), now);
    const day = month && y ? validDay(y, month, Number(m[1])) : null;
    if (day) return day;
  }

  // Numeric: 27/09/2569, 27-09-69, 27.09.69
  for (const n of s.matchAll(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})(?!\d)/g)) {
    const y = normalizeYear(Number(n[3]), now);
    const day = y ? validDay(y, Number(n[2]), Number(n[1])) : null;
    if (day) return day;
  }
  return null;
}

/** Extract "HH:MM" from slip text like "08:15 น." */
export function parseSlipTime(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}
