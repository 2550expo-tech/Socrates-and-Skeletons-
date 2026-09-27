/**
 * FR-2 Overview Dashboard: balance, income, expense and totals by category.
 * Only CONFIRMED transactions count. Drafts never change a number the user sees.
 */
import { getCategory } from './categories';
import { addDays, bkkDayKey, isDayInRange, rangeDays } from './dates';
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

/** Group transactions by Bangkok day, newest day first, newest item first within a day. */
export function groupByDay(txs: Transaction[]): { day: string; items: Transaction[]; netSatang: number }[] {
  const map = new Map<string, Transaction[]>();
  for (const t of [...txs].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))) {
    const day = bkkDayKey(t.occurredAt);
    const list = map.get(day) ?? [];
    list.push(t);
    map.set(day, list);
  }
  return [...map.entries()].map(([day, items]) => ({
    day,
    items,
    netSatang: items
      .filter((t) => t.status === 'confirmed')
      .reduce((s, t) => s + (t.kind === 'income' ? t.amountSatang : -t.amountSatang), 0),
  }));
}

/** This calendar month's confirmed expense (for the budget meter). */
export function monthExpense(txs: Transaction[], now: Date = new Date()): number {
  const month = bkkDayKey(now).slice(0, 7);
  return confirmedOnly(txs)
    .filter((t) => t.kind === 'expense' && bkkDayKey(t.occurredAt).startsWith(month))
    .reduce((s, t) => s + t.amountSatang, 0);
}
