/**
 * Monthly regulars ("รายการประจำ"): money that goes out or comes in around the
 * same day every month (rent, phone bill, allowance, pay). Found from the
 * transactions themselves, so the app can say "ค่าหอพัก ฿3,500 อีก 2 วัน".
 * Pure; unit tests in __tests__/recurring.test.ts (TC-72).
 */
import { addDays, bkkDayKey, daysBetween, daysInMonth } from './dates';
import type { Transaction, TxKind } from './types';

export interface Recurring {
  key: string;
  title: string;
  kind: TxKind;
  categoryKey: string;
  /** The usual amount (median). */
  amountSatang: number;
  /** Usual day of the month. */
  dayOfMonth: number;
  /** Months it was seen in. */
  months: number;
  lastDay: string;
  /** When it is expected next ("YYYY-MM-DD"). */
  nextDay: string;
  /** Days from today to nextDay (0 = today, negative = a few days late). */
  daysLeft: number;
}

const LOOKBACK_DAYS = 120;
const DAY_TOLERANCE = 3;
const AMOUNT_TOLERANCE = 0.2;

const normalize = (title: string) => title.trim().toLowerCase().replace(/\s+/g, ' ');

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Distance between two days of the month, wrapping around the month end (31st and 1st are 1 apart). */
function domDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 31 - d);
}

/**
 * The usual day of the month for payments that may wrap around the month end (a median on a
 * circle): the day closest to all payments (2 Jun, 1 Jul, 31 Jul, 31 Aug -> the 1st; one early
 * payment on the 30th does not move the 1st), then the one whose farthest payment is nearest,
 * then the day of the latest payment (20th and 21st -> the 21st if that was last).
 */
function usualDay(doms: number[]): number {
  const latest = doms[doms.length - 1];
  let best = 1;
  let bestScore: [number, number, number] = [Infinity, Infinity, Infinity];
  for (let c = 1; c <= 31; c++) {
    const ds = doms.map((d) => domDistance(d, c));
    const score: [number, number, number] = [ds.reduce((a, b) => a + b, 0), Math.max(...ds), domDistance(latest, c)];
    const better = score[0] - bestScore[0] || score[1] - bestScore[1] || score[2] - bestScore[2];
    if (better < 0) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

/** The usual day in a given month ("2026-02" and day 31 -> the 28th). */
function dayInMonth(month: string, dom: number): string {
  return `${month}-${String(Math.min(dom, daysInMonth(month))).padStart(2, '0')}`;
}

const nextMonthKey = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};

const prevMonthKey = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

export function findRecurring(txs: Transaction[], today: string): Recurring[] {
  const from = addDays(today, -LOOKBACK_DAYS);
  const groups = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (t.status !== 'confirmed') continue;
    const day = bkkDayKey(t.occurredAt);
    if (day < from || day > today) continue;
    const key = `${t.kind}|${normalize(t.title)}`;
    if (!normalize(t.title)) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const out: Recurring[] = [];
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const days = sorted.map((t) => bkkDayKey(t.occurredAt));
    const months = new Set(days.map((d) => d.slice(0, 7)));
    // Monthly things: seen in at least two months, about once a month (not a daily coffee).
    if (months.size < 2 || sorted.length > months.size * 1.5) continue;
    const doms = days.map((d) => Number(d.slice(8, 10)));
    const dom = usualDay(doms);
    if (doms.some((d) => domDistance(d, dom) > DAY_TOLERANCE)) continue;
    const amount = median(sorted.map((t) => t.amountSatang));
    if (sorted.some((t) => Math.abs(t.amountSatang - amount) > amount * AMOUNT_TOLERANCE)) continue;
    const lastDay = days[days.length - 1];
    // Still going: seen within the last ~45 days.
    if (daysBetween(lastDay, today) > 45) continue;

    // Next time: the first usual day (from last month on, so rent due on the 30th that is two days
    // late on the 2nd still shows) that was not paid yet (no payment within a week of it) and is
    // not more than a few days gone.
    const month = today.slice(0, 7);
    const later = nextMonthKey(month);
    const candidates = [prevMonthKey(month), month, later, nextMonthKey(later)].map((m) => dayInMonth(m, dom));
    const next =
      candidates.find((c) => Math.abs(daysBetween(c, lastDay)) > 7 && daysBetween(c, today) <= DAY_TOLERANCE) ??
      candidates[candidates.length - 1];
    const last = sorted[sorted.length - 1];
    out.push({
      key,
      title: last.title.trim(),
      kind: last.kind,
      categoryKey: last.categoryKey,
      amountSatang: amount,
      dayOfMonth: dom,
      months: months.size,
      lastDay,
      nextDay: next,
      daysLeft: daysBetween(today, next),
    });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft || b.amountSatang - a.amountSatang);
}

/** Regulars due soon (from a few days late up to `withinDays` ahead). */
export function upcomingRecurring(list: Recurring[], withinDays = 7): Recurring[] {
  return list.filter((r) => r.daysLeft >= -DAY_TOLERANCE && r.daysLeft <= withinDays);
}

/** "วันนี้", "พรุ่งนี้", "อีก 3 วัน", "เลยมา 2 วัน". */
export function dueLabel(daysLeft: number): string {
  if (daysLeft === 0) return 'วันนี้';
  if (daysLeft === 1) return 'พรุ่งนี้';
  if (daysLeft > 1) return `อีก ${daysLeft} วัน`;
  return `เลยมา ${-daysLeft} วัน`;
}
