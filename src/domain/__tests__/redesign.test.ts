/**
 * MindPay ใหม่ (redesign): TC-90 the home card's "does the money last to the
 * month end" check, TC-91 the stats screen's average per day.
 */
import { describe, expect, it } from 'vitest';
import { computeRunway, monthEndCheck } from '../runway';
import { rangeDailyAverage } from '../summary';
import type { Transaction } from '../types';

// 12 Oct 2026, 18:00 in Bangkok: 19 days after today to 31 Oct.
const NOW = new Date('2026-10-12T11:00:00Z');
const runwayOf = (days: number) => computeRunway({ balanceSatang: 50_000 + days * 10_000, floorSatang: 50_000, averageSatang: 10_000, now: NOW });

describe('TC-90 home card: runway compared with the end of the month', () => {
  it('counts the days to the month end like the runway (days after today)', () => {
    expect(monthEndCheck(runwayOf(19), NOW)).toMatchObject({ daysToMonthEnd: 19, kind: 'exact', days: 0 });
  });
  it('says how many days the money lasts past the month end ("เหลือเก็บ")', () => {
    const r = runwayOf(25); // runs out 6 Nov = 31 Oct + 6
    expect(r.depletionDay).toBe('2026-11-06');
    expect(monthEndCheck(r, NOW)).toMatchObject({ kind: 'surplus', days: 6, capped: false });
  });
  it('or how many days short it falls', () => {
    expect(monthEndCheck(runwayOf(15), NOW)).toMatchObject({ kind: 'short', days: 4 });
  });
  it('handles no spending, the reserve line, a capped runway and the last day of the month', () => {
    const none = computeRunway({ balanceSatang: 300_000, floorSatang: 50_000, averageSatang: 0, now: NOW });
    expect(monthEndCheck(none, NOW).kind).toBe('unknown');
    const below = computeRunway({ balanceSatang: 40_000, floorSatang: 50_000, averageSatang: 10_000, now: NOW });
    expect(monthEndCheck(below, NOW)).toMatchObject({ kind: 'below', days: 19 });
    const rich = computeRunway({ balanceSatang: 100_000_000, floorSatang: 50_000, averageSatang: 1_000, now: NOW });
    expect(monthEndCheck(rich, NOW)).toMatchObject({ kind: 'surplus', days: 365 - 19, capped: true });
    const lastDay = new Date('2026-10-31T05:00:00Z');
    expect(monthEndCheck(computeRunway({ balanceSatang: 80_000, floorSatang: 50_000, averageSatang: 10_000, now: lastDay }), lastDay)).toMatchObject({
      daysToMonthEnd: 0,
      kind: 'surplus',
      days: 3,
    });
  });
});

function tx(day: string, baht: number, kind: 'expense' | 'income' = 'expense', status: 'confirmed' | 'draft' = 'confirmed'): Transaction {
  return {
    id: `${day}-${baht}-${kind}-${status}`,
    kind,
    status,
    amountSatang: baht * 100,
    occurredAt: `${day}T05:00:00.000Z`,
    categoryKey: kind === 'expense' ? 'food' : 'allowance',
    title: 'x',
    note: null,
    source: 'manual',
    reviewFlags: [],
    createdAt: `${day}T05:00:00.000Z`,
  } as unknown as Transaction;
}

describe('TC-91 stats: average spending per day in a range', () => {
  it('divides the range expense by the days in the range', () => {
    const txs = [tx('2026-09-01', 1, 'income'), tx('2026-10-12', 300), tx('2026-10-08', 400), tx('2026-10-01', 9999)];
    // 7 days: 6–12 Oct, ฿700 → ฿100 a day (1 Oct is outside, the income is not spending).
    expect(rangeDailyAverage(txs, '7d', NOW)).toBe(10_000);
  });
  it('counts only from the first record for a new user, and ignores drafts', () => {
    const txs = [tx('2026-10-11', 120), tx('2026-10-12', 80), tx('2026-10-12', 500, 'expense', 'draft')];
    // Started on 11 Oct: 2 days, ฿200 → ฿100 a day (not ฿200 / 30).
    expect(rangeDailyAverage(txs, '1m', NOW)).toBe(10_000);
    expect(rangeDailyAverage([], '1m', NOW)).toBe(0);
  });
});
