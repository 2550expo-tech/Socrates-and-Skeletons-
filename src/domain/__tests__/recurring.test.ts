/**
 * TC-72: monthly regulars ("รายการประจำ"): rent, bills, allowance.
 */
import { describe, expect, it } from 'vitest';
import { bkkToIso } from '../dates';
import { dueLabel, findRecurring, upcomingRecurring } from '../recurring';
import type { Transaction } from '../types';

let n = 0;
function tx(day: string, title: string, amount: number, over: Partial<Transaction> = {}): Transaction {
  const at = bkkToIso(day, '10:00');
  return {
    id: `c${++n}`,
    kind: 'expense',
    amountSatang: amount * 100,
    categoryKey: 'bills',
    title,
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

describe('Monthly regulars', () => {
  it('TC-72 finds rent, bills and allowance that come around the same day each month, and when they are due next', () => {
    const txs = [
      tx('2026-07-05', 'ค่าหอพัก', 3500),
      tx('2026-08-04', 'ค่าหอพัก', 3500),
      tx('2026-09-05', 'ค่าหอพัก ', 3500),
      tx('2026-08-01', 'ค่าขนมจากที่บ้าน', 10000, { kind: 'income', categoryKey: 'allowance' }),
      tx('2026-09-01', 'ค่าขนมจากที่บ้าน', 10000, { kind: 'income', categoryKey: 'allowance' }),
      tx('2026-08-20', 'ค่าเน็ต AIS', 599),
      tx('2026-09-21', 'ค่าเน็ต AIS', 620),
      // Not monthly: a daily lunch, a one-off, a price that changes a lot, a day that moves around.
      ...['2026-09-01', '2026-09-02', '2026-09-03', '2026-08-01', '2026-08-02'].map((d) => tx(d, 'ข้าวกลางวัน', 60, { categoryKey: 'food' })),
      tx('2026-09-10', 'Shopee', 590, { categoryKey: 'shopping' }),
      tx('2026-08-10', 'เติมน้ำมัน', 300, { categoryKey: 'transport' }),
      tx('2026-09-10', 'เติมน้ำมัน', 900, { categoryKey: 'transport' }),
      tx('2026-08-03', 'ตัดผม', 150, { categoryKey: 'other_expense' }),
      tx('2026-09-18', 'ตัดผม', 150, { categoryKey: 'other_expense' }),
      // A draft does not count.
      tx('2026-08-12', 'ค่าโทรศัพท์', 300, { status: 'draft' }),
      tx('2026-09-12', 'ค่าโทรศัพท์', 300, { status: 'draft' }),
    ];
    const found = findRecurring(txs, '2026-09-29');
    expect(found.map((r) => r.title)).toEqual(['ค่าขนมจากที่บ้าน', 'ค่าหอพัก', 'ค่าเน็ต AIS']);
    const [allowance, rent, net] = found;
    expect(allowance).toMatchObject({ kind: 'income', amountSatang: 1_000_000, dayOfMonth: 1, nextDay: '2026-10-01', daysLeft: 2 });
    expect(rent).toMatchObject({ kind: 'expense', amountSatang: 350_000, dayOfMonth: 5, months: 3, nextDay: '2026-10-05', daysLeft: 6 });
    expect(net).toMatchObject({ amountSatang: 60_950, nextDay: '2026-10-21' });

    // Due within a week (or a few days late).
    expect(upcomingRecurring(found).map((r) => r.title)).toEqual(['ค่าขนมจากที่บ้าน', 'ค่าหอพัก']);
    // Two days late this month: still shown as due.
    const late = findRecurring(txs, '2026-10-07').find((r) => r.title.startsWith('ค่าหอ'));
    expect(late).toMatchObject({ nextDay: '2026-10-05', daysLeft: -2 });
    // Paid early for next month: the one after that is next.
    const early = findRecurring([...txs, tx('2026-09-30', 'ค่าขนมจากที่บ้าน', 10000, { kind: 'income', categoryKey: 'allowance' })], '2026-09-30');
    expect(early.find((r) => r.kind === 'income')?.nextDay).toBe('2026-11-01');
    // A regular that stopped (nothing for over 45 days) is dropped.
    expect(findRecurring(txs, '2026-12-31')).toEqual([]);

    expect(dueLabel(0)).toBe('วันนี้');
    expect(dueLabel(1)).toBe('พรุ่งนี้');
    expect(dueLabel(4)).toBe('อีก 4 วัน');
    expect(dueLabel(-2)).toBe('เลยมา 2 วัน');
  });
});
