/**
 * The monthly budget on the home screen (MindPay ใหม่): how much of it is left
 * for the month, how much is left for TODAY, and how far through the month we
 * are (the pace tick on the bar).
 *
 * Today's allowance spreads what was left of the budget at the start of today
 * evenly over the days left in the month, today included, and never more than
 * the money above the reserve line (so a budget bigger than the balance cannot
 * invite overspending). Only confirmed items count. Without a budget there is
 * no allowance at all: the money card shows the runway instead.
 */
import { bkkDayKey, daysBetween } from './dates';
import { endOfMonthDay } from './runway';
import type { Transaction } from './types';

export type BudgetState = 'ok' | 'over_today' | 'over_month';

export interface BudgetToday {
  budgetSatang: number;
  /** Confirmed spending this calendar month (including items dated later this month). */
  spentMonthSatang: number;
  /** Budget minus this month's spending (negative = over budget). */
  leftMonthSatang: number;
  /** Days left in the month, today included (1 on the last day). */
  daysLeft: number;
  /** What can be spent per day from the start of today, whole baht. */
  allowanceSatang: number;
  spentTodaySatang: number;
  /** Allowance minus today's spending (negative = over today's allowance). */
  leftTodaySatang: number;
  /** Share of the month passed by the end of today (0–1), for the pace tick. */
  pace: number;
  state: BudgetState;
}

const wholeBaht = (satang: number) => Math.floor(satang / 100) * 100;

export function budgetToday(params: {
  txs: Transaction[];
  budgetSatang: number;
  /** Money above the reserve line right now (balance − reserve − savings jars). */
  spendableSatang?: number;
  now?: Date;
}): BudgetToday {
  const now = params.now ?? new Date();
  const today = bkkDayKey(now);
  const month = today.slice(0, 7);
  let spentMonth = 0;
  let spentToday = 0;
  for (const t of params.txs) {
    if (t.status !== 'confirmed' || t.kind !== 'expense') continue;
    const day = bkkDayKey(t.occurredAt);
    if (!day.startsWith(month)) continue;
    spentMonth += t.amountSatang;
    if (day === today) spentToday += t.amountSatang;
  }
  const end = endOfMonthDay(now);
  const daysLeft = Math.max(1, daysBetween(today, end) + 1);
  const daysInMonth = Number(end.slice(8, 10));
  const leftAtStart = params.budgetSatang - (spentMonth - spentToday);
  let allowance = leftAtStart > 0 ? wholeBaht(leftAtStart / daysLeft) : 0;
  if (params.spendableSatang !== undefined) {
    // Today's spending already left the balance: add it back to know what was spendable this morning.
    const spendableAtStart = params.spendableSatang + spentToday;
    allowance = Math.min(allowance, spendableAtStart > 0 ? wholeBaht(spendableAtStart / daysLeft) : 0);
  }
  const leftMonth = params.budgetSatang - spentMonth;
  const leftToday = allowance - spentToday;
  const state: BudgetState = leftMonth < 0 || leftAtStart <= 0 ? 'over_month' : leftToday < 0 ? 'over_today' : 'ok';
  return {
    budgetSatang: params.budgetSatang,
    spentMonthSatang: spentMonth,
    leftMonthSatang: leftMonth,
    daysLeft,
    allowanceSatang: allowance,
    spentTodaySatang: spentToday,
    leftTodaySatang: leftToday,
    pace: Number(today.slice(8, 10)) / daysInMonth,
    state,
  };
}
