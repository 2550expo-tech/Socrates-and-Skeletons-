/**
 * FR-6 Money Runway: "how many more days will my money last?"
 *
 * Definitions (these are the testable meanings asked for in the SRS feedback):
 *
 * - LOW LINE (runway floor): an amount the user sets, default ฿500.
 *   "Low balance" means balance <= floor. It is a line to stay above,
 *   not zero, so the user still has a buffer for emergencies.
 * - AVERAGE DAILY SPEND: confirmed expenses in the last 7 Bangkok days
 *   (today and the 6 days before), divided by the number of those days the
 *   user has been tracking (at most 7). A user who started 3 days ago is
 *   divided by 3, not 7, so their average is not understated.
 * - RUNWAY DAYS: floor((balance − floor) / average daily spend).
 * - DEPLETION DATE: today + runway days = the first day the balance is
 *   expected to reach the low line.
 * - ZERO AVERAGE: if there was no spending in the window we cannot divide,
 *   so the status is "no_spending" and no date is shown.
 */
import { addDays, bkkDayKey, daysBetween } from './dates';
import { confirmedOnly } from './summary';
import type { Transaction } from './types';

export const DEFAULT_FLOOR_SATANG = 50_000; // ฿500
export const RUNWAY_WINDOW_DAYS = 7;
/** Above this we just say "more than a year"; the estimate means little that far out. */
export const RUNWAY_CAP_DAYS = 365;

export type RunwayStatus = 'healthy' | 'watch' | 'critical' | 'below_floor' | 'no_spending';

export interface AverageSpend {
  totalSatang: number;
  daysCounted: number;
  averageSatang: number;
}

export function averageDailyExpense(txs: Transaction[], now: Date = new Date()): AverageSpend {
  const today = bkkDayKey(now);
  const windowStart = addDays(today, -(RUNWAY_WINDOW_DAYS - 1));
  const confirmed = confirmedOnly(txs);
  if (confirmed.length === 0) return { totalSatang: 0, daysCounted: RUNWAY_WINDOW_DAYS, averageSatang: 0 };

  const firstDay = confirmed.map((t) => bkkDayKey(t.occurredAt)).sort()[0];
  const trackedDays = Math.max(1, daysBetween(firstDay, today) + 1);
  const daysCounted = Math.min(RUNWAY_WINDOW_DAYS, trackedDays);

  const total = confirmed
    .filter((t) => t.kind === 'expense')
    .filter((t) => {
      const d = bkkDayKey(t.occurredAt);
      return d >= windowStart && d <= today;
    })
    .reduce((s, t) => s + t.amountSatang, 0);

  return { totalSatang: total, daysCounted, averageSatang: Math.round(total / daysCounted) };
}

export interface Runway {
  status: RunwayStatus;
  /** null when it cannot be computed (no spending) */
  days: number | null;
  /** Bangkok day the balance is expected to reach the floor; null if unknown */
  depletionDay: string | null;
  /** true when days was capped at RUNWAY_CAP_DAYS */
  capped: boolean;
  balanceSatang: number;
  floorSatang: number;
  averageSatang: number;
  /** Money above the floor that can still be spent */
  spendableSatang: number;
}

export function computeRunway(params: {
  balanceSatang: number;
  floorSatang: number;
  averageSatang: number;
  now?: Date;
}): Runway {
  const { balanceSatang, floorSatang, averageSatang } = params;
  const today = bkkDayKey(params.now ?? new Date());
  const spendable = balanceSatang - floorSatang;
  const base = { balanceSatang, floorSatang, averageSatang, spendableSatang: Math.max(0, spendable) };

  if (spendable <= 0) {
    return { ...base, status: 'below_floor', days: 0, depletionDay: today, capped: false };
  }
  if (averageSatang <= 0) {
    return { ...base, status: 'no_spending', days: null, depletionDay: null, capped: false };
  }
  const raw = Math.floor(spendable / averageSatang);
  const capped = raw > RUNWAY_CAP_DAYS;
  const days = capped ? RUNWAY_CAP_DAYS : raw;
  const status: RunwayStatus = days < 7 ? 'critical' : days < 14 ? 'watch' : 'healthy';
  return { ...base, status, days, depletionDay: addDays(today, days), capped };
}

/**
 * Safe-to-spend: how much per day the user can spend and still stay above
 * the floor until (and including) `targetDay`. Rounded down to whole baht.
 */
export function safeDailySpend(params: {
  balanceSatang: number;
  floorSatang: number;
  targetDay: string;
  now?: Date;
}): number {
  const today = bkkDayKey(params.now ?? new Date());
  const days = Math.max(1, daysBetween(today, params.targetDay) + 1);
  const spendable = params.balanceSatang - params.floorSatang;
  if (spendable <= 0) return 0;
  return Math.floor(spendable / days / 100) * 100;
}

/** Last day of the current Bangkok month, e.g. "2026-09-30". */
export function endOfMonthDay(now: Date = new Date()): string {
  const [y, m] = bkkDayKey(now).split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * "Before you spend" check: what happens to the runway if the user spends
 * `amountSatang` now, keeping the same daily habit afterwards.
 */
export function runwayAfterPurchase(current: Runway, amountSatang: number, now: Date = new Date()): Runway {
  return computeRunway({
    balanceSatang: current.balanceSatang - amountSatang,
    floorSatang: current.floorSatang,
    averageSatang: current.averageSatang,
    now,
  });
}

/** What-if: the runway if the daily average were `reducePercent` lower (0..100). */
export function runwayWithReduction(current: Runway, reducePercent: number, now: Date = new Date()): Runway {
  const factor = Math.min(100, Math.max(0, reducePercent)) / 100;
  return computeRunway({
    balanceSatang: current.balanceSatang,
    floorSatang: current.floorSatang,
    averageSatang: Math.round(current.averageSatang * (1 - factor)),
    now,
  });
}
