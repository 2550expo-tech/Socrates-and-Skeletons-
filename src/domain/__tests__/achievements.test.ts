/**
 * TC-67, TC-68: streak and badges (small rewards for keeping the diary going).
 */
import { describe, expect, it } from 'vitest';
import { activityDay, computeBadges, computeStreak, newlyEarned, VOICE_NOTE } from '../achievements';
import { addDays, bkkToIso } from '../dates';
import type { Transaction } from '../types';

const TODAY = '2026-09-29';
let n = 0;
function tx(day: string, over: Partial<Transaction> = {}): Transaction {
  const at = bkkToIso(day, '12:00');
  return {
    id: `t${++n}`,
    kind: 'expense',
    amountSatang: 5000,
    categoryKey: 'food',
    title: 'ข้าว',
    note: null,
    occurredAt: at,
    source: 'manual',
    status: 'confirmed',
    slipRef: null,
    slipImageHash: null,
    ocrConfidence: null,
    reviewFlags: [],
    createdAt: at,
    ...over,
  };
}
const days = (...ago: number[]) => ago.map((a) => tx(addDays(TODAY, -a)));

describe('Streak', () => {
  it('TC-67 counts days in a row with a record; today can still be added; a slip counts on the day it was scanned', () => {
    expect(computeStreak(days(0, 1, 2), TODAY)).toMatchObject({ days: 3, today: true, best: 3 });
    // Nothing yet today: still alive thanks to yesterday.
    expect(computeStreak(days(1, 2), TODAY)).toMatchObject({ days: 2, today: false });
    // A gap breaks it, but the best run is remembered.
    expect(computeStreak([...days(0), ...days(3, 4, 5, 6)], TODAY)).toMatchObject({ days: 1, best: 4 });
    expect(computeStreak(days(2, 3), TODAY).days).toBe(0);
    expect(computeStreak([], TODAY)).toMatchObject({ days: 0, today: false, best: 0 });
    // Two records the same day are one day.
    expect(computeStreak([...days(0), ...days(0)], TODAY).days).toBe(1);
    // An old slip scanned today counts today, not on its own date.
    const oldSlip = tx('2026-08-01', { source: 'slip', createdAt: bkkToIso(TODAY, '09:00') });
    expect(activityDay(oldSlip)).toBe(TODAY);
    expect(computeStreak([oldSlip], TODAY)).toMatchObject({ days: 1, today: true });
    const recent = computeStreak(days(0, 2), TODAY).recent;
    expect(recent).toHaveLength(14);
    expect(recent[13]).toEqual({ day: TODAY, active: true });
    expect(recent[12].active).toBe(false);
    expect(recent[11].active).toBe(true);
  });
});

describe('Badges', () => {
  const badgesFor = (txs: Transaction[], extra: Partial<Parameters<typeof computeBadges>[0]> = {}) =>
    Object.fromEntries(
      computeBadges({ txs, streak: computeStreak(txs, TODAY), runwayStatus: 'watch', today: TODAY, ...extra }).map((b) => [b.id, b]),
    );

  it('TC-68 badges follow the data, show progress, and stay earned', () => {
    const none = badgesFor([]);
    expect(Object.values(none).every((b) => !b.earned)).toBe(true);
    expect(none.streak_7.progress).toEqual({ value: 0, target: 7 });

    const week = days(0, 1, 2, 3, 4, 5, 6);
    const b = badgesFor(week);
    expect(b.first_step.earned).toBe(true);
    expect(b.streak_3.earned && b.streak_7.earned).toBe(true);
    expect(b.streak_30.earned).toBe(false);
    expect(b.streak_30.progress).toEqual({ value: 7, target: 30 });
    expect(b.first_slip.earned).toBe(false);

    const slips = Array.from({ length: 10 }, () => tx(TODAY, { source: 'slip' }));
    const s = badgesFor([...slips, tx(TODAY, { note: VOICE_NOTE })]);
    expect(s.first_slip.earned && s.slips_10.earned && s.voice.earned && s.all_clear.earned).toBe(true);
    expect(s.slips_100.progress).toEqual({ value: 10, target: 100 });
    // A slip still waiting for review: not "ตรวจครบ" yet.
    expect(badgesFor([...slips, tx(TODAY, { source: 'slip', status: 'draft' })]).all_clear.earned).toBe(false);

    // Spent less in the last 7 days than in the 7 before.
    const thrifty = [tx(addDays(TODAY, -1), { amountSatang: 10000 }), tx(addDays(TODAY, -9), { amountSatang: 30000 })];
    expect(badgesFor(thrifty).saver_week.earned).toBe(true);
    expect(badgesFor([tx(addDays(TODAY, -1), { amountSatang: 90000 }), tx(addDays(TODAY, -9), { amountSatang: 30000 })]).saver_week.earned).toBe(false);

    expect(badgesFor([], { runwayStatus: 'healthy' }).healthy_tree.earned).toBe(true);
    // Earned once, kept even when the money situation changes.
    expect(badgesFor([], { runwayStatus: 'critical', earnedBefore: new Set(['healthy_tree']) }).healthy_tree.earned).toBe(true);

    const all = computeBadges({ txs: week, streak: computeStreak(week, TODAY), runwayStatus: 'watch', today: TODAY });
    expect(newlyEarned(all, new Set(['first_step'])).map((x) => x.id)).toEqual(['streak_3', 'streak_7']);
  });
});
