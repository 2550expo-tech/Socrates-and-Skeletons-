/**
 * TC-33: demo data must always look like a healthy student budget, on any date
 * the app is opened (the old prototype's fixed sample data went stale, and an
 * earlier version of this one could show a negative balance).
 */
import { describe, expect, it } from 'vitest';
import { DEMO_OPENING_BALANCE_SATANG, buildSampleTransactions } from '../sample';
import { averageDailyExpense, computeRunway } from '../runway';
import { computeBalance } from '../summary';

const DATES = ['2026-09-27', '2026-10-01', '2026-10-02', '2026-10-14', '2026-10-30', '2026-11-20', '2027-01-31', '2027-06-15'];

describe('demo data', () => {
  it.each(DATES)('TC-33 is healthy when opened on %s', (day) => {
    const now = new Date(`${day}T07:00:00Z`);
    const txs = buildSampleTransactions(now);
    const balance = computeBalance(DEMO_OPENING_BALANCE_SATANG, txs);
    const avg = averageDailyExpense(txs, now).averageSatang;
    const r = computeRunway({ balanceSatang: balance, floorSatang: 50_000, averageSatang: avg, now });
    if (process.env.SHOW_DEMO) console.log(day, balance / 100, avg / 100, r.days, r.status);
    expect(balance).toBeGreaterThan(200_000); // more than ฿2,000
    expect(avg).toBeGreaterThan(0); // Money Runway always has something to show
    expect(r.days).not.toBeNull();
    expect(r.days!).toBeGreaterThanOrEqual(10);
  });
});
