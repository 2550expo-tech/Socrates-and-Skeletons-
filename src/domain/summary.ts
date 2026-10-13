/**
 * FR-2 Overview Dashboard: balance, income, expense and totals by category.
 * Only CONFIRMED transactions count. Drafts never change a number the user sees.
 */
import { getCategory } from './categories';
import { addDays, bkkDayKey, daysBetween, daysInMonth, isDayInRange, rangeDays, THAI_MONTHS_SHORT } from './dates';
import type { RangeKey, Transaction, TxKind } from './types';

export const confirmedOnly = (txs: Transaction[]) => txs.filter((t) => t.status === 'confirmed');

/** Balance now = money at start + all confirmed income − all confirmed expense. */
export function computeBalance(openingBalanceSatang: number, txs: Transaction[]): number {
  return confirmedOnly(txs).reduce(
    (sum, t) => sum + (t.kind === 'income' ? t.amountSatang : -t.amountSatang),
    openingBalanceSatang,
  );
}

export interface CategoryTotal {
  key: string;
  label: string;
  glyph: string;
  kind: TxKind;
  totalSatang: number;
  /** Share of this kind's total, 0..1 */
  share: number;
  count: number;
}

export interface RangeSummary {
  from: string;
  to: string;
  incomeSatang: number;
  expenseSatang: number;
  netSatang: number;
  count: number;
  byCategory: { income: CategoryTotal[]; expense: CategoryTotal[] };
}

function totalsByCategory(txs: Transaction[], kind: TxKind): CategoryTotal[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const t of txs) {
    if (t.kind !== kind) continue;
    const cur = map.get(t.categoryKey) ?? { total: 0, count: 0 };
    cur.total += t.amountSatang;
    cur.count += 1;
    map.set(t.categoryKey, cur);
  }
  const grand = [...map.values()].reduce((s, v) => s + v.total, 0);
  return [...map.entries()]
    .map(([key, v]) => {
      const c = getCategory(key);
      return {
        key,
        label: c.label,
        glyph: c.glyph,
        kind,
        totalSatang: v.total,
        count: v.count,
        share: grand > 0 ? v.total / grand : 0,
      };
    })
    .sort((a, b) => b.totalSatang - a.totalSatang);
}

export function summarizeRange(txs: Transaction[], range: RangeKey, now: Date = new Date()): RangeSummary {
  const days = rangeDays(range, now);
  const inRange = confirmedOnly(txs).filter((t) => isDayInRange(bkkDayKey(t.occurredAt), days));
  const income = inRange.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amountSatang, 0);
  const expense = inRange.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amountSatang, 0);
  return {
    ...days,
    incomeSatang: income,
    expenseSatang: expense,
    netSatang: income - expense,
    count: inRange.length,
    byCategory: {
      income: totalsByCategory(inRange, 'income'),
      expense: totalsByCategory(inRange, 'expense'),
    },
  };
}

export interface DayTotal {
  day: string;
  incomeSatang: number;
  expenseSatang: number;
}

/** One entry per Bangkok day, oldest first, including days with no activity. */
export function dailyTotals(txs: Transaction[], days: number, now: Date = new Date()): DayTotal[] {
  const today = bkkDayKey(now);
  const out: DayTotal[] = [];
  const index = new Map<string, DayTotal>();
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    const row = { day, incomeSatang: 0, expenseSatang: 0 };
    out.push(row);
    index.set(day, row);
  }
  for (const t of confirmedOnly(txs)) {
    const row = index.get(bkkDayKey(t.occurredAt));
    if (!row) continue;
    if (t.kind === 'income') row.incomeSatang += t.amountSatang;
    else row.expenseSatang += t.amountSatang;
  }
  return out;
}

/** One bar of the spending trend on สถิติ: a day, or a calendar month (cut to the range). */
export interface TrendBucket {
  key: string;
  /** First and last Bangkok day counted in this bar. */
  from: string;
  to: string;
  /** Label under the bar; '' when there is no room for one (every 7th day of 30 is labelled). */
  label: string;
  expenseSatang: number;
  /** Today, or this month. */
  current: boolean;
}

export interface SpendingTrend {
  unit: 'day' | 'month';
  buckets: TrendBucket[];
  /** Monthly view: the range starts mid-month, so the first bar counts from this day. */
  partialFrom: string | null;
}

const WEEKDAY_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

/**
 * The trend that matches the chosen range on สถิติ, so the chart and the totals
 * above it always count the same days:
 *   วันนี้, 7 วัน -> the last 7 days (today alone is not a trend)
 *   30 วัน        -> 30 daily bars (today and every 7th day back are labelled)
 *   6 เดือน, 1 ปี -> one bar per calendar month, the first one cut at the range's start
 */
export function spendingTrend(txs: Transaction[], range: RangeKey, now: Date = new Date()): SpendingTrend {
  const today = bkkDayKey(now);
  if (range === 'today' || range === '7d' || range === '1m') {
    const n = range === '1m' ? 30 : 7;
    const days = dailyTotals(txs, n, now);
    return {
      unit: 'day',
      partialFrom: null,
      buckets: days.map((d, i) => {
        const back = n - 1 - i;
        const dow = new Date(`${d.day}T00:00:00Z`).getUTCDay();
        const label = back === 0 ? 'วันนี้' : n === 7 ? WEEKDAY_SHORT[dow] : back % 7 === 0 ? String(Number(d.day.slice(8, 10))) : '';
        return { key: d.day, from: d.day, to: d.day, label, expenseSatang: d.expenseSatang, current: back === 0 };
      }),
    };
  }
  const { from, to } = rangeDays(range, now);
  const months: string[] = [];
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); ) {
    months.push(m);
    const [y, mm] = m.split('-').map(Number);
    m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, '0')}`;
  }
  const buckets: TrendBucket[] = months.map((m) => {
    const start = `${m}-01` < from ? from : `${m}-01`;
    const endOfMonth = `${m}-${String(daysInMonth(m)).padStart(2, '0')}`;
    const end = endOfMonth > to ? to : endOfMonth;
    return { key: m, from: start, to: end, label: THAI_MONTHS_SHORT[Number(m.slice(5, 7)) - 1], expenseSatang: 0, current: m === today.slice(0, 7) };
  });
  // The same month name twice (a year back from mid-October): the older one gets its year (ต.ค. 68).
  const first = buckets[0];
  if (buckets.length > 1 && first.label === buckets[buckets.length - 1].label) first.label = `${first.label}${(Number(first.key.slice(0, 4)) + 543) % 100}`;
  const byMonth = new Map(buckets.map((b) => [b.key, b]));
  for (const t of confirmedOnly(txs)) {
    if (t.kind !== 'expense') continue;
    const day = bkkDayKey(t.occurredAt);
    if (day < from || day > to) continue;
    const b = byMonth.get(day.slice(0, 7));
    if (b) b.expenseSatang += t.amountSatang;
  }
  return { unit: 'month', buckets, partialFrom: from.endsWith('-01') ? null : from };
}

/** Group transactions by Bangkok day, newest day first, newest item first within a day. */
export function groupByDay(txs: Transaction[]): { day: string; items: Transaction[]; netSatang: number; spentSatang: number; inSatang: number }[] {
  const map = new Map<string, Transaction[]>();
  for (const t of [...txs].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))) {
    const day = bkkDayKey(t.occurredAt);
    const list = map.get(day) ?? [];
    list.push(t);
    map.set(day, list);
  }
  return [...map.entries()].map(([day, items]) => {
    const confirmed = items.filter((t) => t.status === 'confirmed');
    const spentSatang = confirmed.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amountSatang, 0);
    const inSatang = confirmed.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amountSatang, 0);
    return { day, items, netSatang: inSatang - spentSatang, spentSatang, inSatang };
  });
}

/** This calendar month's confirmed expense (for the budget meter). */
export function monthExpense(txs: Transaction[], now: Date = new Date()): number {
  const month = bkkDayKey(now).slice(0, 7);
  return confirmedOnly(txs)
    .filter((t) => t.kind === 'expense' && bkkDayKey(t.occurredAt).startsWith(month))
    .reduce((s, t) => s + t.amountSatang, 0);
}

/**
 * Average spending per day in a range (the stats screen): the range's confirmed
 * expense divided by its days, counting only from the first confirmed record,
 * so a new user's average is not watered down by days before they started.
 * Whole satang.
 */
export function rangeDailyAverage(txs: Transaction[], range: RangeKey, now: Date = new Date()): number {
  const days = rangeDays(range, now);
  const confirmed = confirmedOnly(txs);
  if (confirmed.length === 0) return 0;
  const first = confirmed.map((t) => bkkDayKey(t.occurredAt)).sort()[0];
  const start = first > days.from ? first : days.from;
  const counted = Math.max(1, daysBetween(start, days.to) + 1);
  const expense = confirmed
    .filter((t) => t.kind === 'expense' && isDayInRange(bkkDayKey(t.occurredAt), days))
    .reduce((s, t) => s + t.amountSatang, 0);
  return Math.round(expense / counted);
}
