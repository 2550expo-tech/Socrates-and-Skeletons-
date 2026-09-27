/**
 * TC-49..TC-51: the companion ("น้องกล้า") on the home screen.
 */
import { describe, expect, it } from 'vitest';
import { buddyLine, isNewFromSlip, spentToday } from '../buddy';
import { bkkToIso } from '../dates';
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
