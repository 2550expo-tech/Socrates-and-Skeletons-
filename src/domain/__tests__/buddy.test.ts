/**
 * TC-49..TC-51, TC-53, TC-58, TC-66: the companion ("น้องกล้า"), the start of a new
 * day, and what it says when tapped.
 */
import { describe, expect, it } from 'vitest';
import { BUDDY_TICKLE_AFTER, BUDDY_TIPS, buddyLine, buddyPoke, isNewFromSlip, spentOnDay, spentToday, treeLine } from '../buddy';
import { bkkToIso, msUntilNextBkkMidnight } from '../dates';
import type { Transaction } from '../types';

const NOW = new Date('2026-09-28T05:00:00Z'); // 12:00 in Bangkok
let seq = 0;
function tx(p: Partial<Transaction> & { day: string; amount: number }): Transaction {
  const { day, amount, ...rest } = p;
  return {
    id: `b${++seq}`,
    kind: 'expense',
    amountSatang: amount * 100,
    categoryKey: 'food',
    title: 'test',
    note: null,
    occurredAt: bkkToIso(day, '09:00'),
    source: 'manual',
    status: 'confirmed',
    slipRef: null,
    slipImageHash: null,
    ocrConfidence: null,
    reviewFlags: [],
    createdAt: NOW.toISOString(),
    ...rest,
  };
}

const base = { status: 'healthy' as const, days: 27, safeTodaySatang: 145_300, spentTodaySatang: 0, draftsToReview: 0, hasAnyTransaction: true };

describe('Companion', () => {
  it('TC-49 picks the mood from the money situation, most urgent first', () => {
    expect(buddyLine({ ...base, hasAnyTransaction: false }).mood).toBe('sleepy');
    expect(buddyLine({ ...base, draftsToReview: 2 })).toEqual({ mood: 'thinking', text: expect.stringContaining('2 ใบ') });
    expect(buddyLine({ ...base, status: 'below_floor', days: null }).mood).toBe('worried');
    expect(buddyLine({ ...base, status: 'critical', days: 4 }).text).toContain('4 วัน');
    expect(buddyLine({ ...base, status: 'watch', days: 10 }).text).toContain('฿1,453');
    expect(buddyLine({ ...base, status: 'no_spending', days: null }).mood).toBe('calm');
    expect(buddyLine(base)).toEqual({ mood: 'cheer', text: expect.stringContaining('27 วัน') });
    expect(buddyLine({ ...base, capped: true, days: 365 }).text).toContain('365+ วัน');
    expect(buddyLine({ ...base, spentTodaySatang: 9_000 }).text).toContain('฿90');
  });

  it('TC-50 never shames the user', () => {
    const statuses = ['healthy', 'watch', 'critical', 'below_floor', 'no_spending'] as const;
    for (const status of statuses) {
      const { text } = buddyLine({ ...base, status, days: status === 'below_floor' ? null : 5 });
      expect(text).not.toMatch(/เยอะเกินไป|ฟุ่มเฟือย|ผิด|แย่/);
    }
  });

  it('TC-51 counts only confirmed spending today, and marks slips recorded today as new', () => {
    const list = [
      tx({ day: '2026-09-28', amount: 50 }),
      tx({ day: '2026-09-28', amount: 30, status: 'draft' }),
      tx({ day: '2026-09-28', amount: 1000, kind: 'income' }),
      tx({ day: '2026-09-27', amount: 70 }),
    ];
    expect(spentToday(list, NOW)).toBe(5_000);
    expect(isNewFromSlip(tx({ day: '2026-09-25', amount: 20, source: 'slip' }), NOW)).toBe(true);
    expect(isNewFromSlip(tx({ day: '2026-09-28', amount: 20 }), NOW)).toBe(false);
    expect(isNewFromSlip(tx({ day: '2026-09-25', amount: 20, source: 'slip', createdAt: '2026-09-26T03:00:00Z' }), NOW)).toBe(false);
  });
});

describe('A new day', () => {
  it('TC-53 "วันนี้" starts over at 00:00 Bangkok time, and the companion greets the new day', () => {
    // 23:59:30 on 28 Sep in Bangkok -> 30 s to midnight
    expect(msUntilNextBkkMidnight(Date.parse('2026-09-28T16:59:30Z'))).toBe(30_000);
    // 00:00 exactly -> a full day
    expect(msUntilNextBkkMidnight(Date.parse('2026-09-28T17:00:00Z'))).toBe(24 * 3600 * 1000);
    expect(buddyLine({ ...base, newDay: { yesterdaySpentSatang: 25_000 } })).toEqual({
      mood: 'cheer',
      text: 'วันใหม่แล้ว! เมื่อวานใช้ไป ฿250 วันนี้ใช้ได้ราว ฿1,453',
    });
    expect(buddyLine({ ...base, newDay: { yesterdaySpentSatang: 0 } }).text).toContain('เมื่อวานไม่มีรายจ่ายเลย');
    // Urgent things still come first.
    expect(buddyLine({ ...base, draftsToReview: 1, newDay: { yesterdaySpentSatang: 0 } }).mood).toBe('thinking');
    expect(buddyLine({ ...base, status: 'critical', days: 3, newDay: { yesterdaySpentSatang: 0 } }).mood).toBe('worried');
    expect(spentOnDay([tx({ day: '2026-09-27', amount: 70 })], '2026-09-27')).toBe(7_000);
  });
});

describe('Tapping the companion', () => {
  it('TC-58 gives tips in turn (never the same twice in a row), comforts first when money is tight, giggles when tapped a lot', () => {
    for (let n = 1; n < 20; n++) {
      const a = buddyPoke(n, 'healthy');
      const b = buddyPoke(n + 1, 'healthy');
      expect(a.text.length).toBeGreaterThan(10);
      expect(a.text).not.toBe(b.text);
    }
    expect(buddyPoke(1, 'healthy').text).toBe(BUDDY_TIPS[0]);
    expect(buddyPoke(1, 'critical').text).toContain('ไม่เป็นไร');
    expect(buddyPoke(BUDDY_TICKLE_AFTER, 'healthy').text).toContain('จั๊กจี้');
    // Never scolds.
    for (const t of BUDDY_TIPS) expect(t).not.toMatch(/เกินไป!|ห้าม|แย่/);
  });
});

describe('Tapping the money tree', () => {
  it('TC-66 explains what the gold leaves mean, kindly, for every money situation', () => {
    expect(treeLine({ status: 'healthy', days: 27, capped: false }).text).toContain('27 วัน');
    expect(treeLine({ status: 'healthy', days: 400, capped: true }).text).toContain('เกิน 1 ปี');
    expect(treeLine({ status: 'watch', days: 12, capped: false }).text).toContain('12 วัน');
    expect(treeLine({ status: 'critical', days: 3, capped: false }).mood).toBe('worried');
    expect(treeLine({ status: 'below_floor', days: 0, capped: false }).text).toContain('เงินสำรอง');
    expect(treeLine({ status: 'no_spending', days: null, capped: false }).text).toContain('ยังไม่มีรายจ่าย');
    for (const status of ['healthy', 'watch', 'critical', 'below_floor', 'no_spending'] as const) {
      const t = treeLine({ status, days: 5, capped: false }).text;
      expect(t).toContain('ใบ');
      expect(t).not.toMatch(/เกินไป!|ห้าม|แย่/);
    }
  });
});
