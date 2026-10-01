/**
 * Regression tests for the bugs found in the repository audit of 1 Oct 2569.
 * TC-79 money input · TC-80 พูดจด · TC-81 monthly regulars across the month end ·
 * TC-82 categories from payee names · TC-83 duplicate slips without a reference ·
 * TC-84 learning the user's name · TC-85 slip dates next to dotted times · TC-86 goal lines.
 */
import { describe, expect, it } from 'vitest';
import { suggestCategory } from '../categories';
import { bkkToIso, parseSlipDate } from '../dates';
import { goalLine, type SavingsGoal } from '../goals';
import { formatBaht, MAX_SATANG, parseBahtToSatang } from '../money';
import { findRecurring, upcomingRecurring } from '../recurring';
import { addToIndex, buildDuplicateIndex, isDuplicate, type SlipCandidate } from '../slip';
import { addPayer, EMPTY_NAME_STATS, isMine } from '../slipNames';
import type { Transaction } from '../types';
import { parseSpokenEntry, thaiNumberWords } from '../voice';

let n = 0;
function tx(day: string, title: string, amount: number, over: Partial<Transaction> = {}): Transaction {
  const at = bkkToIso(day, '10:00');
  return {
    id: `a${++n}`,
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

describe('TC-79 money typed by the user', () => {
  it('reads a decimal comma, Thai digits and grouped thousands, and refuses the rest', () => {
    expect(parseBahtToSatang('85,50')).toBe(8550);
    expect(parseBahtToSatang('12,5')).toBe(1250);
    expect(parseBahtToSatang('1,234.50')).toBe(123450);
    expect(parseBahtToSatang('1,234,567')).toBe(123456700);
    expect(parseBahtToSatang('๘๕')).toBe(8500);
    expect(parseBahtToSatang('12.')).toBe(1200);
    expect(parseBahtToSatang('1,23,4')).toBeNull();
    expect(parseBahtToSatang('12.345')).toBeNull();
  });

  it('caps huge amounts and never turns a tiny one into zero', () => {
    expect(parseBahtToSatang('99999999999999999')).toBeNull();
    expect(parseBahtToSatang(String(MAX_SATANG / 100))).toBe(MAX_SATANG);
    expect(parseBahtToSatang(String(MAX_SATANG / 100 + 1))).toBeNull();
    expect(parseBahtToSatang(0.004)).toBeNull();
  });

  it('takes zero only when asked (an opening balance may be ฿0.00)', () => {
    expect(parseBahtToSatang('0.00')).toBeNull();
    expect(parseBahtToSatang('0.00', { allowZero: true })).toBe(0);
    expect(parseBahtToSatang('0', { allowZero: true })).toBe(0);
  });

  it('rounds to the nearest baht when showing whole baht', () => {
    expect(formatBaht(9999, { decimals: false })).toBe('฿100');
    expect(formatBaht(9949, { decimals: false })).toBe('฿99');
  });
});

describe('TC-80 พูดจด', () => {
  const items = (t: string) => parseSpokenEntry(t).items.map((i) => [i.title, i.amountSatang / 100, i.kind, i.dayOffset]);

  it('keeps 711 inside an amount; 7-11 is the shop', () => {
    expect(items('ค่าไฟ 711 บาท')).toEqual([['ค่าไฟ', 711, 'expense', 0]]);
    expect(items('ค่าเสื้อ 1711')).toEqual([['ค่าเสื้อ', 1711, 'expense', 0]]);
    expect(items('ค่าหอ 2,711 บาท')).toEqual([['ค่าหอ', 2711, 'expense', 0]]);
    expect(parseSpokenEntry('ขนม 7-11 45 บาท').items[0]).toMatchObject({ amountSatang: 4500, categoryKey: 'convenience' });
  });

  it('reads a digit followed by number words as one amount', () => {
    expect(items('รองเท้า 2 พันห้า')).toEqual([['รองเท้า', 2500, 'expense', 0]]);
    expect(items('ค่าเทอม 3 พัน 2 ร้อย')).toEqual([['ค่าเทอม', 3200, 'expense', 0]]);
    expect(items('เสื้อ 5 ร้อยห้าสิบ')).toEqual([['เสื้อ', 550, 'expense', 0]]);
    expect(items('ค่ารถ 1.5 พัน')).toEqual([['ค่ารถ', 1500, 'expense', 0]]);
    // Two numbers where the second is bigger stay two items.
    expect(items('ข้าวห้าสิบ สองร้อย').map((i) => i[1])).toEqual([50, 200]);
  });

  it('reads a trailing one as one', () => {
    expect(thaiNumberWords('ร้อยหนึ่ง')).toBe(101);
    expect(thaiNumberWords('ร้อยเอ็ด')).toBe(101);
    expect(thaiNumberWords('ยี่สิบนึง')).toBe(21);
    expect(thaiNumberWords('ร้อยนึง')).toBe(100);
    expect(thaiNumberWords('พันนึง')).toBe(1000);
    expect(thaiNumberWords('ร้อยห้า')).toBe(150);
  });

  it('pairs amounts said first with the words after them', () => {
    expect(items('50 บาท ค่าข้าว 30 บาท ค่าน้ำ')).toEqual([
      ['ค่าข้าว', 50, 'expense', 0],
      ['ค่าน้ำ', 30, 'expense', 0],
    ]);
  });

  it('paying words win over income words', () => {
    expect(items('จ่ายค่าจ้างช่างแอร์ 800')[0][2]).toBe('expense');
    expect(items('คืนเงินเพื่อน 200')[0][2]).toBe('expense');
    expect(items('ได้เงินคืน 50')).toEqual([['เงินคืน', 50, 'income', 0]]);
    expect(items('ได้เงินจากแม่ 500')).toEqual([['เงินจากแม่', 500, 'income', 0]]);
  });

  it('keeps words that only look like polite endings or connectors', () => {
    expect(items('ข้าวเจ้า 50')[0][0]).toBe('ข้าวเจ้า');
    expect(items('กับข้าว 60')[0][0]).toBe('กับข้าว');
    expect(items('ข้าว 50 บาทครับ')[0][0]).toBe('ข้าว');
  });

  it('gives each item the day said before it', () => {
    expect(items('เมื่อวานค่ารถ 40 วันนี้ข้าว 50')).toEqual([
      ['ค่ารถ', 40, 'expense', -1],
      ['ข้าว', 50, 'expense', 0],
    ]);
    expect(items('ข้าว 50 น้ำ 15 เมื่อวาน').map((i) => i[3])).toEqual([-1, -1]);
  });
});

describe('TC-81 monthly regulars around the month end', () => {
  it('finds rent paid around the 1st even when some payments fell on the 31st', () => {
    const txs = ['2026-06-02', '2026-07-01', '2026-07-31', '2026-08-31'].map((d) => tx(d, 'ค่าหอ', 3500));
    const [rent] = findRecurring(txs, '2026-09-20');
    expect(rent).toMatchObject({ dayOfMonth: 1, nextDay: '2026-10-01' });
  });

  it('shows rent due on the 30th as two days late on the 2nd of the next month', () => {
    const txs = ['2026-06-30', '2026-07-30', '2026-08-30'].map((d) => tx(d, 'ค่าหอ', 3500));
    const [rent] = findRecurring(txs, '2026-10-02');
    expect(rent).toMatchObject({ nextDay: '2026-09-30', daysLeft: -2 });
    expect(upcomingRecurring([rent])).toHaveLength(1);
  });
});

describe('TC-82 categories from payee names', () => {
  it('does not read people’s names as shops', () => {
    for (const name of ['นาย วินัย ใจดี', 'น.ส. อรวิน', 'MR. PAISAN', 'MS AISHA', 'MR. LAURENT']) {
      expect(suggestCategory(name, 'expense')).toBe('transfer_out');
    }
  });

  it('prefers the first keyword, then the more specific one', () => {
    expect(suggestCategory('ร้านยาเภสัชกร', 'expense')).toBe('health');
    expect(suggestCategory('MINI BIG C', 'expense')).toBe('convenience');
    expect(suggestCategory('KFC Central', 'expense')).toBe('food');
    expect(suggestCategory('AIS', 'expense')).toBe('bills');
    expect(suggestCategory('ร้านข้าว นายสมชาย', 'expense')).toBe('food');
  });
});

describe('TC-83 duplicate slips without a reference', () => {
  const at = bkkToIso('2026-09-27', '08:15');
  const saved = (title: string) => ({ ...tx('2026-09-27', title, 85), occurredAt: at, source: 'slip' as const });
  const candidate = (counterparty: string | null, over: Partial<SlipCandidate> = {}): SlipCandidate => ({
    kind: 'expense',
    amountSatang: 8500,
    dayKey: '2026-09-27',
    time: '08:15',
    counterparty,
    bank: null,
    ref: null,
    imageHash: 'other-image',
    categoryKey: 'food',
    confidence: 0.9,
    flags: [],
    ownTransfer: false,
    ...over,
  });

  it('matches when the payee was not read on either side', () => {
    expect(isDuplicate(candidate(null), buildDuplicateIndex([saved('รายการจากสลิป')]))).toBe(true);
    expect(isDuplicate(candidate('ร้านกาแฟ'), buildDuplicateIndex([saved('รายการจากสลิป')]))).toBe(true);
    expect(isDuplicate(candidate(null), buildDuplicateIndex([saved('ร้านกาแฟ')]))).toBe(true);
    expect(isDuplicate(candidate('x', { ownTransfer: true }), buildDuplicateIndex([saved('โอนระหว่างบัญชีตัวเอง')]))).toBe(true);
  });

  it('keeps two different payees at the same minute apart', () => {
    const idx = buildDuplicateIndex([saved('ร้านกาแฟ')]);
    expect(isDuplicate(candidate('ร้านกาแฟ'), idx)).toBe(true);
    expect(isDuplicate(candidate('ร้านข้าว'), idx)).toBe(false);
    addToIndex(idx, saved('ร้านข้าว'));
    expect(isDuplicate(candidate('ร้านข้าว'), idx)).toBe(true);
  });
});

describe('TC-84 learning the user’s own name', () => {
  it('still learns a new name when the table is full', () => {
    let stats = EMPTY_NAME_STATS;
    for (let i = 0; i < 30; i++) stats = addPayer(stats, `ผู้ใช้${String.fromCharCode(0x0e01 + i)}คน ก`);
    for (let i = 0; i < 12; i++) stats = addPayer(stats, 'นาย สมชาย ใจดี');
    expect(isMine(stats, 'สมชาย ใ***')).toBe(true);
    expect(Object.keys(stats.counts)).toHaveLength(30);
  });
});

describe('TC-85 slip dates next to times printed with dots', () => {
  const now = new Date('2026-09-30T05:00:00Z');
  it('finds the date whatever comes first', () => {
    expect(parseSlipDate('27 ก.ย. 69 เวลา 14.30.25', now)).toBe('2026-09-27');
    expect(parseSlipDate('ref 12.34.56 27 ก.ย. 69', now)).toBe('2026-09-27');
    // A time that is also a valid date must not win over the real date.
    expect(parseSlipDate('27 ก.ย. 69 เวลา 12.10.25', now)).toBe('2026-09-27');
    expect(parseSlipDate('27.09.69', now)).toBe('2026-09-27');
    expect(parseSlipDate('31/02/2569', now)).toBeNull();
  });
});

describe('TC-86 goal lines never say ฿0 while short', () => {
  it('rounds what is left up to whole baht', () => {
    const g: SavingsGoal = {
      id: 'g',
      title: 'หูฟัง',
      emoji: '🎧',
      targetSatang: 100_000,
      savedSatang: 99_960,
      dueDay: null,
      doneAt: null,
      createdAt: '2026-09-01T00:00:00Z',
    };
    expect(goalLine(g, '2026-09-30')).toBe('อีก ฿1 ก็ครบ');
  });
});
