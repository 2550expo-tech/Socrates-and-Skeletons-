/**
 * Month recap ("สรุปเดือน"), shown as a story of a few full screens: how much
 * went out and came in, where it went, the biggest day, habits (slips, voice,
 * streak) and how it compares with the month before. Pure; unit tests in
 * __tests__/recap.test.ts (TC-69).
 */
import { VOICE_NOTE } from './achievements';
import { getCategory } from './categories';
import { bkkDayKey, daysInMonth, formatThaiMonth, previousMonth } from './dates';
import type { Transaction } from './types';

export interface MonthRecap {
  /** "YYYY-MM" */
  month: string;
  /** "กันยายน 2569" */
  label: string;
  /** The month is still going (the recap counts up to today). */
  partial: boolean;
  /** Days counted: the whole month, or up to today. */
  days: number;
  expenseSatang: number;
  incomeSatang: number;
  /** Confirmed transactions in the month. */
  count: number;
  /** Up to three categories where the money went, biggest first. */
  top: { key: string; label: string; glyph: string; amountSatang: number; share: number }[];
  biggestDay: { day: string; amountSatang: number } | null;
  /** Days (of those counted) with no spending at all. */
  noSpendDays: number;
  avgPerDaySatang: number;
  /** The payee paid most often. */
  favorite: { title: string; times: number } | null;
  /** How the month was recorded. */
  from: { slips: number; voice: number; typed: number };
  /** Spending vs the same days of the month before, in percent (null when there is nothing to compare). */
  changePct: number | null;
  prevLabel: string;
}

/** Months that have confirmed transactions, newest first ("YYYY-MM"). */
export function recapMonths(txs: Transaction[]): string[] {
  const set = new Set(txs.filter((t) => t.status === 'confirmed').map((t) => bkkDayKey(t.occurredAt).slice(0, 7)));
  return [...set].sort().reverse();
}

export function monthRecap(txs: Transaction[], month: string, today: string): MonthRecap {
  const partial = today.slice(0, 7) === month;
  const days = partial ? Number(today.slice(8, 10)) : daysInMonth(month);
  const inMonth = txs.filter((t) => t.status === 'confirmed' && bkkDayKey(t.occurredAt).slice(0, 7) === month && bkkDayKey(t.occurredAt) <= today);
  const expenses = inMonth.filter((t) => t.kind === 'expense');
  const expenseSatang = expenses.reduce((s, t) => s + t.amountSatang, 0);
  const incomeSatang = inMonth.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amountSatang, 0);

  const byCat = new Map<string, number>();
  const byDay = new Map<string, number>();
  const byPayee = new Map<string, { title: string; times: number }>();
  for (const t of expenses) {
    byCat.set(t.categoryKey, (byCat.get(t.categoryKey) ?? 0) + t.amountSatang);
    const day = bkkDayKey(t.occurredAt);
    byDay.set(day, (byDay.get(day) ?? 0) + t.amountSatang);
    const k = t.title.trim().toLowerCase();
    if (k) byPayee.set(k, { title: t.title.trim(), times: (byPayee.get(k)?.times ?? 0) + 1 });
  }
  const top = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, amountSatang]) => {
      const c = getCategory(key);
      return { key, label: c.label, glyph: c.glyph, amountSatang, share: expenseSatang ? amountSatang / expenseSatang : 0 };
    });
  const biggest = [...byDay.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const favorite = [...byPayee.values()].sort((a, b) => b.times - a.times)[0];

  // Fair comparison: the same number of days at the start of the month before.
  const prev = previousMonth(month);
  const prevDays = Math.min(days, daysInMonth(prev));
  const prevSpent = txs
    .filter((t) => t.status === 'confirmed' && t.kind === 'expense')
    .filter((t) => {
      const d = bkkDayKey(t.occurredAt);
      return d.slice(0, 7) === prev && Number(d.slice(8, 10)) <= prevDays;
    })
    .reduce((s, t) => s + t.amountSatang, 0);

  return {
    month,
    label: formatThaiMonth(month),
    partial,
    days,
    expenseSatang,
    incomeSatang,
    count: inMonth.length,
    top,
    biggestDay: biggest ? { day: biggest[0], amountSatang: biggest[1] } : null,
    noSpendDays: Math.max(0, days - byDay.size),
    avgPerDaySatang: days ? Math.round(expenseSatang / days) : 0,
    favorite: favorite && favorite.times >= 2 ? favorite : null,
    from: {
      slips: inMonth.filter((t) => t.source === 'slip').length,
      voice: inMonth.filter((t) => t.source !== 'slip' && t.note === VOICE_NOTE).length,
      typed: inMonth.filter((t) => t.source !== 'slip' && t.note !== VOICE_NOTE).length,
    },
    changePct: prevSpent > 0 ? Math.round(((expenseSatang - prevSpent) / prevSpent) * 100) : null,
    prevLabel: formatThaiMonth(prev),
  };
}

/**
 * Which month to offer on the home screen: last month during the first week
 * of a new month (if it had anything), otherwise this month once it has a few
 * records. Null when there is not enough to tell a story yet.
 */
export function recapToOffer(txs: Transaction[], today: string): string | null {
  const months = recapMonths(txs);
  const current = today.slice(0, 7);
  const prev = previousMonth(current);
  if (Number(today.slice(8, 10)) <= 7 && months.includes(prev)) return prev;
  const thisMonth = txs.filter((t) => t.status === 'confirmed' && bkkDayKey(t.occurredAt).slice(0, 7) === current).length;
  return thisMonth >= 3 ? current : null;
}

// ---------------------------------------------------------------------------
// Spending calendar (a month as a heatmap)
// ---------------------------------------------------------------------------

export interface CalendarDay {
  day: string;
  expenseSatang: number;
  incomeSatang: number;
  count: number;
  /** 0 = no spending; 1..4 = compared with the month's usual spending day (under half, under 1x, under 2x, 2x or more). */
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  /** After today: nothing to show yet. */
  future: boolean;
}

export interface SpendCalendar {
  month: string;
  label: string;
  /** Weeks from Sunday to Saturday; null = a day of another month. */
  weeks: (CalendarDay | null)[][];
  /** The usual spending day this month (average of days with spending). */
  usualSatang: number;
}

export function spendCalendar(txs: Transaction[], month: string, today: string): SpendCalendar {
  const total = daysInMonth(month);
  const per = new Map<string, { e: number; i: number; n: number }>();
  for (const t of txs) {
    if (t.status !== 'confirmed') continue;
    const d = bkkDayKey(t.occurredAt);
    if (d.slice(0, 7) !== month) continue;
    const cur = per.get(d) ?? { e: 0, i: 0, n: 0 };
    if (t.kind === 'expense') cur.e += t.amountSatang;
    else cur.i += t.amountSatang;
    cur.n += 1;
    per.set(d, cur);
  }
  const spending = [...per.values()].filter((v) => v.e > 0);
  const usual = spending.length ? spending.reduce((s, v) => s + v.e, 0) / spending.length : 0;
  const level = (e: number): CalendarDay['level'] => {
    if (e <= 0 || usual <= 0) return 0;
    const r = e / usual;
    return r < 0.5 ? 1 : r < 1 ? 2 : r < 2 ? 3 : 4;
  };
  const [y, m] = month.split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const cells: (CalendarDay | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let d = 1; d <= total; d++) {
    const day = `${month}-${String(d).padStart(2, '0')}`;
    const v = per.get(day) ?? { e: 0, i: 0, n: 0 };
    cells.push({ day, expenseSatang: v.e, incomeSatang: v.i, count: v.n, level: level(v.e), isToday: day === today, future: day > today });
  }
  while (cells.length % 7) cells.push(null);
  const weeks: (CalendarDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { month, label: formatThaiMonth(month), weeks, usualSatang: Math.round(usual) };
}
