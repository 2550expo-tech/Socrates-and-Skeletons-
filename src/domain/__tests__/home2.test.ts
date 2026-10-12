/**
 * MindPay ใหม่, home redesign: TC-93 today's budget allowance, TC-94 the single
 * attention slot.
 */
import { describe, expect, it } from 'vitest';
import { pickAttention } from '../attention';
import { budgetToday } from '../budget';
import type { Transaction } from '../types';

// 13 Oct 2026, 10:00 in Bangkok: 19 days left in October, today included.
const NOW = new Date('2026-10-13T03:00:00Z');

function tx(day: string, baht: number, kind: 'expense' | 'income' = 'expense', status: 'confirmed' | 'draft' = 'confirmed'): Transaction {
  return {
    id: `${day}-${baht}-${kind}-${status}-${Math.random()}`,
    kind,
    status,
    amountSatang: baht * 100,
    occurredAt: `${day}T05:00:00.000Z`,
    categoryKey: 'food',
    title: 'x',
    note: null,
    source: 'manual',
    reviewFlags: [],
    createdAt: `${day}T05:00:00.000Z`,
  } as unknown as Transaction;
}

describe('TC-93 budget card: what is left for today', () => {
  it('spreads what was left this morning over the days left, today included', () => {
    const txs = [tx('2026-10-01', 5_700), tx('2026-10-12', 93), tx('2026-10-13', 120), tx('2026-09-30', 999)];
    const b = budgetToday({ txs, budgetSatang: 1_000_000, now: NOW });
    expect(b.daysLeft).toBe(19);
    // ฿10,000 − ฿5,793 before today = ฿4,207 → ฿221 a day (whole baht, rounded down).
    expect(b.allowanceSatang).toBe(22_100);
    expect(b.spentTodaySatang).toBe(12_000);
    expect(b.leftTodaySatang).toBe(10_100);
    expect(b.leftMonthSatang).toBe(1_000_000 - 591_300);
    expect(b.state).toBe('ok');
    expect(b.pace).toBeCloseTo(13 / 31);
  });
  it('never allows more than the money above the reserve line', () => {
    const b = budgetToday({ txs: [tx('2026-10-13', 50)], budgetSatang: 1_000_000, spendableSatang: 185_000, now: NOW });
    // This morning ฿1,850 + ฿50 = ฿1,900 above the reserve → ฿100 a day.
    expect(b.allowanceSatang).toBe(10_000);
    expect(b.leftTodaySatang).toBe(5_000);
  });
  it('says when today or the whole month is over budget', () => {
    // ฿10,000 / 19 days = ฿526 for today; ฿600 spent today is over it.
    expect(budgetToday({ txs: [tx('2026-10-13', 600)], budgetSatang: 1_000_000, now: NOW })).toMatchObject({ state: 'over_today', leftTodaySatang: -7_400 });
    const over = budgetToday({ txs: [tx('2026-10-02', 10_500)], budgetSatang: 1_000_000, now: NOW });
    expect(over.state).toBe('over_month');
    expect(over.allowanceSatang).toBe(0);
    expect(over.leftMonthSatang).toBe(-50_000);
  });
  it('ignores income and drafts, counts items dated later this month, and the last day is one day', () => {
    const txs = [tx('2026-10-13', 5_000, 'income'), tx('2026-10-13', 300, 'expense', 'draft'), tx('2026-10-20', 1_900)];
    const b = budgetToday({ txs, budgetSatang: 1_000_000, now: NOW });
    expect(b.spentTodaySatang).toBe(0);
    expect(b.allowanceSatang).toBe(42_600); // (10,000 − 1,900) / 19 = 426.3
    const last = budgetToday({ txs: [], budgetSatang: 300_000, now: new Date('2026-10-31T10:00:00Z') });
    expect(last.daysLeft).toBe(1);
    expect(last.allowanceSatang).toBe(300_000);
    expect(last.pace).toBe(1);
  });
});

describe('TC-94 home: one attention card at a time', () => {
  const today = '2026-10-13';
  it('money first, then new rewards, then one promotional card a day', () => {
    expect(pickAttention({ money: ['drafts', 'error'], rewards: true, promos: ['whatsnew'], turn: null, today }).item).toBe('error');
    expect(pickAttention({ money: [], rewards: true, promos: ['whatsnew'], turn: null, today }).item).toBe('rewards');
    const first = pickAttention({ money: [], rewards: false, promos: ['whatsnew', 'halloween'], turn: null, today });
    expect(first.item).toBe('halloween');
    expect(first.turn).toEqual({ day: today, item: 'halloween', closed: false });
  });
  it('closing today\'s card leaves the slot empty until tomorrow, then the next one comes', () => {
    const closed = { day: today, item: 'halloween' as const, closed: true };
    expect(pickAttention({ money: [], rewards: false, promos: ['halloween', 'whatsnew'], turn: closed, today }).item).toBeNull();
    const tomorrow = pickAttention({ money: [], rewards: false, promos: ['whatsnew'], turn: closed, today: '2026-10-14' });
    expect(tomorrow.item).toBe('whatsnew');
  });
  it('once today\'s card is dealt with, no other promotion that day; money still shows', () => {
    const turn = { day: today, item: 'whatsnew' as const, closed: false };
    expect(pickAttention({ money: [], rewards: false, promos: ['halloween'], turn, today }).item).toBeNull();
    expect(pickAttention({ money: ['autoscan'], rewards: false, promos: [], turn, today }).item).toBe('autoscan');
  });
  it('a promotion that turns up later in an empty day gets the turn', () => {
    const empty = { day: today, item: null, closed: false };
    expect(pickAttention({ money: [], rewards: false, promos: ['recap'], turn: empty, today }).item).toBe('recap');
  });
});
