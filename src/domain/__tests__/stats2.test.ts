/**
 * MindPay ใหม่, รายการ and สถิติ redesign: TC-96 each day's header splits money
 * out and money in; TC-97 the spending trend follows the chosen range.
 */
import { describe, expect, it } from 'vitest';
import { groupByDay, spendingTrend, summarizeRange } from '../summary';
import type { Transaction } from '../types';

// 13 Oct 2026, 10:00 in Bangkok.
const NOW = new Date('2026-10-13T03:00:00Z');

function tx(day: string, baht: number, kind: 'expense' | 'income' = 'expense', status: 'confirmed' | 'draft' = 'confirmed'): Transaction {
  return {
    id: `${day}-${baht}-${kind}-${status}-${Math.random()}`,
    kind,
    status,
    amountSatang: baht * 100,
    occurredAt: `${day}T05:00:00.000Z`,
    categoryKey: kind === 'income' ? 'allowance' : 'food',
    title: 'x',
    note: null,
    source: 'manual',
    reviewFlags: [],
    createdAt: `${day}T05:00:00.000Z`,
  } as unknown as Transaction;
}

describe('TC-96 รายการ: a day header says what went out and what came in', () => {
  it('adds up money out and money in separately (drafts not counted)', () => {
    const [day] = groupByDay([tx('2026-10-12', 90), tx('2026-10-12', 171), tx('2026-10-12', 500, 'income'), tx('2026-10-12', 999, 'expense', 'draft')]);
    expect(day.spentSatang).toBe(26_100);
    expect(day.inSatang).toBe(50_000);
    expect(day.netSatang).toBe(50_000 - 26_100);
  });
});

describe('TC-97 สถิติ: the trend matches the chosen range', () => {
  const txs = [
    tx('2026-10-13', 34),
    tx('2026-10-12', 261),
    tx('2026-10-06', 100),
    tx('2026-09-14', 50),
    tx('2026-09-13', 7), // one day before the 30-day range
    tx('2026-04-20', 80),
    tx('2026-04-10', 999), // before the 180-day range (it starts 17 Apr)
    tx('2025-10-20', 40),
    tx('2026-10-10', 300, 'income'),
  ];

  it('today and 7 days: the last 7 days, labelled by weekday, today last', () => {
    for (const range of ['today', '7d'] as const) {
      const t = spendingTrend(txs, range, NOW);
      expect(t.unit).toBe('day');
      expect(t.buckets).toHaveLength(7);
      expect(t.buckets.at(-1)).toMatchObject({ key: '2026-10-13', label: 'วันนี้', current: true, expenseSatang: 3_400 });
      expect(t.buckets[0]).toMatchObject({ key: '2026-10-07', label: 'พ' });
    }
  });

  it('30 days: 30 daily bars that add up to the range total; every 7th day labelled', () => {
    const t = spendingTrend(txs, '1m', NOW);
    expect(t.buckets).toHaveLength(30);
    expect(t.buckets[0].key).toBe('2026-09-14');
    const sum = t.buckets.reduce((s, b) => s + b.expenseSatang, 0);
    expect(sum).toBe(summarizeRange(txs, '1m', NOW).expenseSatang);
    expect(sum).toBe(3_400 + 26_100 + 10_000 + 5_000);
    expect(t.buckets.filter((b) => b.label).map((b) => b.label)).toEqual(['15', '22', '29', '6', 'วันนี้']);
  });

  it('6 months: one bar per calendar month, the first cut at the range start; bars add up to the total', () => {
    const t = spendingTrend(txs, '6m', NOW);
    expect(t.unit).toBe('month');
    expect(t.partialFrom).toBe('2026-04-17');
    expect(t.buckets.map((b) => b.label)).toEqual(['เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.']);
    expect(t.buckets[0]).toMatchObject({ from: '2026-04-17', to: '2026-04-30', expenseSatang: 8_000 });
    expect(t.buckets.at(-1)).toMatchObject({ to: '2026-10-13', current: true });
    expect(t.buckets.reduce((s, b) => s + b.expenseSatang, 0)).toBe(summarizeRange(txs, '6m', NOW).expenseSatang);
  });

  it('1 year: the month that appears twice gets its year on the older bar', () => {
    const t = spendingTrend(txs, '1y', NOW);
    expect(t.buckets[0]).toMatchObject({ key: '2025-10', label: 'ต.ค.68', from: '2025-10-14', expenseSatang: 4_000 });
    expect(t.buckets.at(-1)).toMatchObject({ key: '2026-10', label: 'ต.ค.' });
    expect(t.buckets).toHaveLength(13);
    expect(t.buckets.reduce((s, b) => s + b.expenseSatang, 0)).toBe(summarizeRange(txs, '1y', NOW).expenseSatang);
  });
});
