/**
 * TC-71: savings goals ("กระปุกออม").
 */
import { describe, expect, it } from 'vitest';
import { applyDeposit, deadlineDay, goalLine, goalProgress, perDayToReach, reservedSatang, type SavingsGoal } from '../goals';

const TODAY = '2026-09-29';
const goal = (over: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id: 'g1',
  title: 'หูฟัง',
  emoji: '🎧',
  targetSatang: 250_000,
  savedSatang: 50_000,
  dueDay: '2026-10-08',
  doneAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

describe('Savings goals', () => {
  it('TC-71 progress, money set aside, per-day amount to reach it on time, and reaching it', () => {
    expect(goalProgress(goal())).toBe(0.2);
    expect(goalProgress(goal({ savedSatang: 300_000 }))).toBe(1);
    expect(reservedSatang([goal(), goal({ savedSatang: 12_345 })])).toBe(62_345);
    // ฿2,000 left over 10 days (today counts) = ฿200 a day.
    expect(perDayToReach(goal(), TODAY)).toBe(20_000);
    // Rounded up to whole baht.
    expect(perDayToReach(goal({ savedSatang: 50_001 }), TODAY)).toBe(20_000);
    expect(perDayToReach(goal({ savedSatang: 60_000, dueDay: '2026-10-01' }), TODAY)).toBe(63_400);
    expect(perDayToReach(goal({ dueDay: null }), TODAY)).toBeNull();
    expect(perDayToReach(goal({ savedSatang: 250_000 }), TODAY)).toBeNull();
    expect(goalLine(goal(), TODAY)).toBe('เก็บวันละ ฿200 ก็ทันวันที่ 8 ต.ค.');
    expect(goalLine(goal({ dueDay: null }), TODAY)).toBe('อีก ฿2,000 ก็ครบ');
    expect(goalLine(goal({ dueDay: '2026-09-01' }), TODAY)).toContain('เลยกำหนด');
    expect(goalLine(goal({ savedSatang: 250_000 }), TODAY)).toContain('ครบแล้ว');

    const now = new Date('2026-09-29T10:00:00Z');
    expect(applyDeposit(goal(), 10_000, now)).toEqual({ savedSatang: 60_000, doneAt: null });
    expect(applyDeposit(goal(), 200_000, now)).toEqual({ savedSatang: 250_000, doneAt: now.toISOString() });
    // Taking money out never goes below zero, and a goal no longer full is not "reached".
    expect(applyDeposit(goal(), -90_000, now)).toEqual({ savedSatang: 0, doneAt: null });
    expect(applyDeposit(goal({ savedSatang: 250_000, doneAt: 'x' }), -1_000, now).doneAt).toBeNull();
    expect(deadlineDay(TODAY, 30)).toBe('2026-10-29');
    expect(deadlineDay(TODAY, null)).toBeNull();
  });
});
