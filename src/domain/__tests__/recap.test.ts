/**
 * TC-69: the month recap story ("สรุปเดือน").
 */
import { describe, expect, it } from 'vitest';
import { VOICE_NOTE } from '../achievements';
import { bkkToIso, daysInMonth, formatThaiMonth, previousMonth } from '../dates';
import { monthRecap, recapMonths, spendCalendar } from '../recap';
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

describe('Spending calendar', () => {
  it('TC-70 lays the month out Sunday to Saturday and shades each day against the usual spending day', () => {
    const txs = [
      tx('2026-09-01', 100), // Tuesday
      tx('2026-09-02', 40),
      tx('2026-09-03', 400),
      tx('2026-09-04', 60),
      tx('2026-09-04', 0.5, { kind: 'income' }),
      tx('2026-09-05', 999, { status: 'draft' }),
      tx('2026-10-01', 500),
    ];
    const cal = spendCalendar(txs, '2026-09', '2026-09-15');
    expect(cal.label).toBe('กันยายน 2569');
    // September 2026 starts on a Tuesday: Sunday and Monday are empty.
    expect(cal.weeks[0].slice(0, 2)).toEqual([null, null]);
    expect(cal.weeks.every((w) => w.length === 7)).toBe(true);
    expect(cal.weeks.flat().filter(Boolean)).toHaveLength(30);
    // Usual day = (100 + 40 + 400 + 60) / 4 = ฿150.
    expect(cal.usualSatang).toBe(15_000);
    const byDay = Object.fromEntries(cal.weeks.flat().filter((c) => c).map((c) => [c!.day, c!]));
    expect(byDay['2026-09-01'].level).toBe(2); // 0.67x
    expect(byDay['2026-09-02'].level).toBe(1); // 0.27x
    expect(byDay['2026-09-03'].level).toBe(4); // 2.7x
    expect(byDay['2026-09-04']).toMatchObject({ level: 1, count: 2, incomeSatang: 50 });
    expect(byDay['2026-09-05'].level).toBe(0); // a draft does not count
    expect(byDay['2026-09-15'].isToday).toBe(true);
    expect(byDay['2026-09-16'].future).toBe(true);
    expect(spendCalendar([], '2026-02', '2026-09-15').weeks.flat().filter(Boolean)).toHaveLength(28);
  });
});
