/**
 * TC-69: the month recap story ("สรุปเดือน").
 */
import { describe, expect, it } from 'vitest';
import { VOICE_NOTE } from '../achievements';
import { bkkToIso, daysInMonth, formatThaiMonth, previousMonth } from '../dates';
import { monthRecap, recapMonths } from '../recap';
import type { Transaction } from '../types';

let n = 0;
function tx(day: string, amount: number, over: Partial<Transaction> = {}): Transaction {
  const at = bkkToIso(day, '12:00');
  return {
    id: `r${++n}`,
    kind: 'expense',
    amountSatang: amount * 100,
    categoryKey: 'food',
    title: 'ข้าวมันไก่',
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

describe('Month recap', () => {
  it('TC-69 sums the month, finds where the money went, the biggest day, habits, and compares fairly with last month', () => {
    expect(formatThaiMonth('2026-09')).toBe('กันยายน 2569');
    expect(previousMonth('2026-01')).toBe('2025-12');
    expect(daysInMonth('2028-02')).toBe(29);

    const txs = [
      tx('2026-09-01', 50),
      tx('2026-09-01', 60, { title: 'ข้าวมันไก่ ' }),
      tx('2026-09-03', 400, { categoryKey: 'transport', title: 'BTS', source: 'slip' }),
      tx('2026-09-10', 1200, { categoryKey: 'shopping', title: 'Shopee', note: VOICE_NOTE }),
      tx('2026-09-12', 5000, { kind: 'income', categoryKey: 'allowance', title: 'แม่' }),
      tx('2026-09-12', 999, { status: 'draft' }), // not confirmed: not counted
      tx('2026-09-30', 80), // after today: not counted yet
      // August, first 15 days: 1,000; later: not compared
      tx('2026-08-05', 1000, { title: 'ค่าหอ' }),
      tx('2026-08-20', 3000, { title: 'รองเท้า' }),
    ];
    const r = monthRecap(txs, '2026-09', '2026-09-15');
    expect(r.label).toBe('กันยายน 2569');
    expect(r.partial).toBe(true);
    expect(r.days).toBe(15);
    expect(r.expenseSatang).toBe(171_000);
    expect(r.incomeSatang).toBe(500_000);
    expect(r.count).toBe(5);
    expect(r.top.map((t) => t.key)).toEqual(['shopping', 'transport', 'food']);
    expect(r.top[0].share).toBeCloseTo(1200 / 1710, 5);
    expect(r.biggestDay).toEqual({ day: '2026-09-10', amountSatang: 120_000 });
    expect(r.noSpendDays).toBe(12); // 15 days, spending on the 1st, 3rd and 10th
    expect(r.avgPerDaySatang).toBe(11_400);
    expect(r.favorite).toEqual({ title: 'ข้าวมันไก่', times: 2 });
    expect(r.from).toEqual({ slips: 1, voice: 1, typed: 3 });
    // Same 15 days of August: ฿1,000 -> +71%.
    expect(r.changePct).toBe(71);
    expect(r.prevLabel).toBe('สิงหาคม 2569');

    const aug = monthRecap(txs, '2026-08', '2026-09-15');
    expect(aug.partial).toBe(false);
    expect(aug.days).toBe(31);
    expect(aug.expenseSatang).toBe(400_000);
    expect(aug.changePct).toBeNull(); // nothing in July to compare with
    expect(aug.favorite).toBeNull(); // paid only once each

    expect(recapMonths(txs)).toEqual(['2026-09', '2026-08']);
    const empty = monthRecap([], '2026-09', '2026-09-15');
    expect(empty.top).toEqual([]);
    expect(empty.biggestDay).toBeNull();
    expect(empty.noSpendDays).toBe(15);
  });
});
