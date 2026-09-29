/**
 * Unit tests for the rules behind FR-2, FR-4, FR-5 and FR-6.
 * Run with: npm test
 *
 * Test IDs (TC-xx) match docs/TRACEABILITY.md.
 */
import { describe, expect, it } from 'vitest';
import { suggestCategory } from '../categories';
import { bkkDayKey, bkkToIso, formatRangeSpan, parseSlipDate, parseSlipTime, rangeDays } from '../dates';
import { buildInsights, findCategoryIncrease } from '../insights';
import { formatBaht, parseBahtToSatang } from '../money';
import {
  averageDailyExpense,
  computeRunway,
  endOfMonthDay,
  runwayAfterPurchase,
  safeDailySpend,
} from '../runway';
import { initialScanState, milestones, nextQueued, scanCounts, scanReducer } from '../scanQueue';
import {
  buildDuplicateIndex,
  classifyCandidate,
  crc16,
  firstSlipQr,
  isScreenSized,
  normalizeReading,
  parseSlipQr,
  regionInPixels,
  SLIP_QR_REGIONS,
  type SlipReading,
} from '../slip';
import { computeBalance, dailyTotals, summarizeRange } from '../summary';
import type { Profile, Transaction } from '../types';

// Sunday 27 Sep 2026, 14:00 in Bangkok
const NOW = new Date('2026-09-27T07:00:00.000Z');

let seq = 0;
function tx(p: Partial<Transaction> & { day: string; amount: number }): Transaction {
  const { day, amount, ...rest } = p;
  return {
    id: `t${++seq}`,
    kind: 'expense',
    amountSatang: amount * 100,
    categoryKey: 'food',
    title: 'test',
    note: null,
    occurredAt: bkkToIso(day, '12:00'),
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

const profile: Profile = {
  id: 'u1',
  displayName: 'ทดสอบ',
  openingBalanceSatang: 500_000,
  runwayFloorSatang: 50_000,
  monthlyBudgetSatang: 900_000,
  coachTone: 'coach',
  onboarded: true,
};

describe('money', () => {
  it('TC-01 parses amounts as printed on slips', () => {
    expect(parseBahtToSatang('1,234.50')).toBe(123450);
    expect(parseBahtToSatang('฿85')).toBe(8500);
    expect(parseBahtToSatang('85.00 บาท')).toBe(8500);
    expect(parseBahtToSatang('0.1')).toBe(10);
    expect(parseBahtToSatang('abc')).toBeNull();
    expect(parseBahtToSatang('-5')).toBeNull();
    expect(parseBahtToSatang('0')).toBeNull();
    expect(parseBahtToSatang('1.234')).toBeNull();
  });

  it('TC-02 avoids floating point drift', () => {
    const sum = [10, 20].map((b) => parseBahtToSatang(b / 100)!).reduce((a, b) => a + b, 0);
    expect(sum).toBe(30);
    expect(formatBaht(123450)).toBe('฿1,234.50');
    expect(formatBaht(-8500, { sign: true })).toBe('−฿85.00');
  });
});

describe('dates (Bangkok time, Thai slips)', () => {
  it('TC-03 groups by Bangkok day, not UTC day', () => {
    // 23:30 Bangkok on 26 Sep is 16:30 UTC on 26 Sep; 00:30 Bangkok on 27 Sep is still 26 Sep in UTC.
    expect(bkkDayKey('2026-09-26T17:30:00.000Z')).toBe('2026-09-27');
    expect(bkkDayKey('2026-09-26T16:30:00.000Z')).toBe('2026-09-26');
  });

  it('TC-04 reads September slips (regression: old prototype failed on "ก.ย.")', () => {
    expect(parseSlipDate('27 ก.ย. 69', NOW)).toBe('2026-09-27');
    expect(parseSlipDate('27 ก.ย. 2569 08:15 น.', NOW)).toBe('2026-09-27');
    expect(parseSlipDate('27ก.ย.69', NOW)).toBe('2026-09-27');
    expect(parseSlipDate('27 กย 69', NOW)).toBe('2026-09-27');
    expect(parseSlipDate('27 กันยายน 2569', NOW)).toBe('2026-09-27');
  });

  it('TC-05 reads other formats and months', () => {
    expect(parseSlipDate('3 ม.ค. 68', NOW)).toBe('2025-01-03');
    expect(parseSlipDate('15 มี.ค. 69', NOW)).toBe('2026-03-15');
    expect(parseSlipDate('15 มิ.ย. 2569', NOW)).toBe('2026-06-15');
    expect(parseSlipDate('27/09/2569', NOW)).toBe('2026-09-27');
    expect(parseSlipDate('27-09-26', NOW)).toBe('2026-09-27');
    expect(parseSlipDate('2026-09-27', NOW)).toBe('2026-09-27');
    expect(parseSlipDate('27 Sep 2026', NOW)).toBe('2026-09-27');
  });

  it('TC-06 rejects impossible dates', () => {
    expect(parseSlipDate('31 ก.พ. 69', NOW)).toBeNull();
    expect(parseSlipDate('hello', NOW)).toBeNull();
    expect(parseSlipDate(null, NOW)).toBeNull();
  });

  it('TC-07 reads times', () => {
    expect(parseSlipTime('08:15 น.')).toBe('08:15');
    expect(parseSlipTime('8.05')).toBe('08:05');
    expect(parseSlipTime('25:00')).toBeNull();
  });

  it('TC-08 ranges mean the same days everywhere', () => {
    expect(rangeDays('today', NOW)).toEqual({ from: '2026-09-27', to: '2026-09-27' });
    expect(rangeDays('7d', NOW)).toEqual({ from: '2026-09-21', to: '2026-09-27' });
    expect(rangeDays('1m', NOW).from).toBe('2026-08-29');
    expect(rangeDays('1y', NOW).from).toBe('2025-09-28');
  });
});

describe('FR-2 overview', () => {
  const txs = [
    tx({ day: '2026-09-27', amount: 100 }),
    tx({ day: '2026-09-25', amount: 50, categoryKey: 'transport' }),
    tx({ day: '2026-09-01', amount: 9000, kind: 'income', categoryKey: 'allowance' }),
    tx({ day: '2026-09-27', amount: 999, status: 'draft' }),
  ];

  it('TC-09 balance ignores drafts', () => {
    expect(computeBalance(500_000, txs)).toBe(500_000 + 900_000 - 15_000);
  });

  it('TC-10 summarizes a range with categories', () => {
    const s = summarizeRange(txs, '7d', NOW);
    expect(s.expenseSatang).toBe(15_000);
    expect(s.incomeSatang).toBe(0);
    expect(s.byCategory.expense[0]).toMatchObject({ key: 'food', totalSatang: 10_000 });
    expect(s.byCategory.expense[0].share).toBeCloseTo(2 / 3);
    const month = summarizeRange(txs, '1m', NOW);
    expect(month.incomeSatang).toBe(900_000);
  });

  it('TC-11 daily totals include empty days', () => {
    const d = dailyTotals(txs, 7, NOW);
    expect(d).toHaveLength(7);
    expect(d[6]).toMatchObject({ day: '2026-09-27', expenseSatang: 10_000 });
    expect(d[5].expenseSatang).toBe(0);
  });
});

describe('FR-6 money runway', () => {
  it('TC-12 averages the last 7 days including days with no spending', () => {
    const txs = [
      tx({ day: '2026-09-10', amount: 1 }), // tracking started long ago
      tx({ day: '2026-09-27', amount: 700 }),
      tx({ day: '2026-09-21', amount: 700 }),
      tx({ day: '2026-09-20', amount: 5000 }), // outside the window
    ];
    const avg = averageDailyExpense(txs, NOW);
    expect(avg.daysCounted).toBe(7);
    expect(avg.averageSatang).toBe(20_000);
  });

  it('TC-13 divides by tracked days for new users', () => {
    const avg = averageDailyExpense([tx({ day: '2026-09-25', amount: 300 })], NOW);
    expect(avg.daysCounted).toBe(3);
    expect(avg.averageSatang).toBe(10_000);
  });

  it('TC-14 computes days and depletion date', () => {
    const r = computeRunway({ balanceSatang: 350_000, floorSatang: 50_000, averageSatang: 20_000, now: NOW });
    expect(r.days).toBe(15);
    expect(r.depletionDay).toBe('2026-10-12');
    expect(r.status).toBe('healthy');
  });

  it('TC-15 handles zero average without dividing by zero', () => {
    const r = computeRunway({ balanceSatang: 350_000, floorSatang: 50_000, averageSatang: 0, now: NOW });
    expect(r.status).toBe('no_spending');
    expect(r.days).toBeNull();
    expect(r.depletionDay).toBeNull();
  });

  it('TC-16 flags balance at or below the low line', () => {
    const r = computeRunway({ balanceSatang: 50_000, floorSatang: 50_000, averageSatang: 10_000, now: NOW });
    expect(r.status).toBe('below_floor');
    expect(r.days).toBe(0);
  });

  it('TC-17 status thresholds', () => {
    const at = (days: number) =>
      computeRunway({ balanceSatang: 50_000 + days * 10_000, floorSatang: 50_000, averageSatang: 10_000, now: NOW }).status;
    expect(at(6)).toBe('critical');
    expect(at(7)).toBe('watch');
    expect(at(14)).toBe('healthy');
  });

  it('TC-18 before-you-spend check and safe daily spend', () => {
    const r = computeRunway({ balanceSatang: 350_000, floorSatang: 50_000, averageSatang: 20_000, now: NOW });
    expect(runwayAfterPurchase(r, 100_000, NOW).days).toBe(10);
    expect(endOfMonthDay(NOW)).toBe('2026-09-30');
    // ฿3,000 above the floor over 4 days (27-30 Sep) = ฿750/day
    expect(safeDailySpend({ balanceSatang: 350_000, floorSatang: 50_000, targetDay: '2026-09-30', now: NOW })).toBe(75_000);
  });
});

describe('FR-4 slip reading', () => {
  const good: SlipReading = {
    isSlip: true,
    direction: 'expense',
    amount: '85.00',
    dateText: '27 ก.ย. 69',
    dateIso: '2026-09-27',
    time: '08:15',
    counterparty: 'ร้านกาแฟดอยช้าง',
    bank: 'KBank',
    reference: '015270081500ABC123',
    confidence: { amount: 0.98, date: 0.95, counterparty: 0.9 },
  };

  it('TC-19 high-confidence slip is ready to confirm', () => {
    const c = normalizeReading(good, { now: NOW });
    expect(c.flags).toEqual([]);
    expect(c.amountSatang).toBe(8500);
    expect(c.dayKey).toBe('2026-09-27');
    expect(c.categoryKey).toBe('food');
    const outcome = classifyCandidate(c, { range: rangeDays('7d', NOW), index: buildDuplicateIndex([]) });
    expect(outcome).toBe('ready');
  });

  it('TC-20 fields under 80% confidence need review', () => {
    const c = normalizeReading({ ...good, confidence: { amount: 0.79, date: 0.95, counterparty: 0.9 } }, { now: NOW });
    expect(c.flags).toEqual(['amount']);
    expect(classifyCandidate(c, { range: rangeDays('7d', NOW), index: buildDuplicateIndex([]) })).toBe('needs_review');
  });

  it('TC-21 missing or future dates are flagged, never guessed', () => {
    expect(normalizeReading({ ...good, dateText: null, dateIso: null }, { now: NOW }).flags).toContain('date');
    const future = normalizeReading({ ...good, dateText: '30 ธ.ค. 69', dateIso: null }, { now: NOW });
    expect(future.flags).toContain('date');
    expect(future.dayKey).toBeNull();
  });

  it('TC-22 out-of-range slips are skipped', () => {
    const c = normalizeReading({ ...good, dateText: '15 มิ.ย. 69', dateIso: null }, { now: NOW });
    expect(classifyCandidate(c, { range: rangeDays('1m', NOW), index: buildDuplicateIndex([]) })).toBe('out_of_range');
    expect(classifyCandidate(c, { range: rangeDays('6m', NOW), index: buildDuplicateIndex([]) })).toBe('ready');
  });

  it('TC-23 duplicates by reference, image hash, or amount+time+payee', () => {
    const existing = [
      tx({ day: '2026-09-27', amount: 85, source: 'slip', slipRef: '015270081500ABC123', status: 'draft' }),
      tx({ day: '2026-09-26', amount: 40, source: 'slip', slipImageHash: 'hash-1' }),
    ];
    const idx = buildDuplicateIndex(existing);
    const range = rangeDays('7d', NOW);
    expect(classifyCandidate(normalizeReading(good, { now: NOW }), { range, index: idx })).toBe('duplicate');
    const sameImage = normalizeReading({ ...good, reference: null }, { imageHash: 'hash-1', now: NOW });
    expect(classifyCandidate(sameImage, { range, index: idx })).toBe('duplicate');

    const noRef = { ...good, reference: null };
    const saved = tx({ day: '2026-09-27', amount: 85, source: 'slip', title: 'ร้านกาแฟดอยช้าง' });
    saved.occurredAt = bkkToIso('2026-09-27', '08:15');
    const idx2 = buildDuplicateIndex([saved]);
    expect(classifyCandidate(normalizeReading(noRef, { now: NOW }), { range, index: idx2 })).toBe('duplicate');
    // Same shop, same amount, different minute: a second coffee, not a duplicate.
    expect(classifyCandidate(normalizeReading({ ...noRef, time: '15:40' }, { now: NOW }), { range, index: idx2 })).toBe('ready');
  });

  it('TC-24 reads the slip-verification QR and rejects payment QRs', () => {
    const inner = '0006000001' + '0103014' + '0220' + '2026092708150000ABCD';
    const body = `00${String(inner.length).padStart(2, '0')}${inner}5102TH9104`;
    const payload = body + crc16(body);
    const qr = parseSlipQr(payload);
    expect(qr).toEqual({ sendingBank: '014', transRef: '2026092708150000ABCD', crcValid: true });
    expect(normalizeReading(good, { qr, now: NOW }).ref).toBe('2026092708150000ABCD');
    // A PromptPay payment QR starts with 000201 and must not be treated as a slip.
    expect(parseSlipQr('00020101021129370016A000000677010111011300668123456785802TH53037646304ABCD')).toBeNull();
    expect(parseSlipQr('garbage')).toBeNull();
  });

  it('TC-25 suggests categories from the payee', () => {
    expect(suggestCategory('7-ELEVEN สาขา 1234', 'expense')).toBe('convenience');
    expect(suggestCategory('ร้านข้าว นายสมชาย', 'expense')).toBe('food');
    expect(suggestCategory('นาย สมชาย ใจดี', 'expense')).toBe('transfer_out');
    expect(suggestCategory('Shopee', 'expense')).toBe('shopping');
  });
});

describe('FR-4 scanner state machine', () => {
  const items = [
    { assetId: 'old', createdAt: Date.parse('2026-06-01T00:00:00Z') },
    { assetId: 'new', createdAt: Date.parse('2026-09-27T01:00:00Z') },
    { assetId: 'mid', createdAt: Date.parse('2026-09-24T01:00:00Z') },
  ];

  it('TC-26 processes newest first', () => {
    const s = scanReducer(scanReducer(initialScanState('1y'), { type: 'load', items }), { type: 'start' });
    expect(s.items.map((i) => i.assetId)).toEqual(['new', 'mid', 'old']);
    expect(nextQueued(s)?.assetId).toBe('new');
  });

  it('TC-27 range cannot change while scanning (regression: old prototype skipped images)', () => {
    let s = scanReducer(initialScanState('7d'), { type: 'load', items });
    s = scanReducer(s, { type: 'start' });
    const locked = scanReducer(s, { type: 'setRange', range: '1y' });
    expect(locked).toBe(s);
    s = scanReducer(s, { type: 'pause' });
    expect(scanReducer(s, { type: 'setRange', range: '1y' })).toBe(s);
  });

  it('TC-28 ignores results from an older run', () => {
    let s = scanReducer(initialScanState('7d'), { type: 'load', items });
    const oldRun = s.runId;
    s = scanReducer(s, { type: 'load', items: [items[1]] });
    const after = scanReducer(s, { type: 'itemFinished', runId: oldRun, assetId: 'new', status: 'ready' });
    expect(after).toBe(s);
  });

  it('TC-29 pause and resume continue where it stopped, then finish', () => {
    let s = scanReducer(initialScanState('1y'), { type: 'load', items });
    s = scanReducer(s, { type: 'start' });
    s = scanReducer(s, { type: 'itemStarted', runId: s.runId, assetId: 'new' });
    s = scanReducer(s, { type: 'itemFinished', runId: s.runId, assetId: 'new', status: 'ready' });
    s = scanReducer(s, { type: 'pause' });
    expect(s.phase).toBe('paused');
    s = scanReducer(s, { type: 'resume' });
    expect(nextQueued(s)?.assetId).toBe('mid');
    s = scanReducer(s, { type: 'itemFinished', runId: s.runId, assetId: 'mid', status: 'duplicate' });
    s = scanReducer(s, { type: 'itemFinished', runId: s.runId, assetId: 'old', status: 'not_slip' });
    expect(s.phase).toBe('done');
    expect(scanCounts(s)).toMatchObject({ ready: 1, duplicate: 1, not_slip: 1, finished: 3 });
  });

  it('TC-30 milestones fill in order 1 day -> 7 days -> ...', () => {
    let s = scanReducer(initialScanState('1y'), { type: 'load', items });
    s = scanReducer(s, { type: 'start' });
    s = scanReducer(s, { type: 'itemFinished', runId: s.runId, assetId: 'new', status: 'ready' });
    const m = milestones(s, NOW);
    expect(m.map((x) => x.complete)).toEqual([true, false, false, false, false]);
  });
});

describe('FR-5 coach insights', () => {
  it('TC-31 finds a category that rose this week', () => {
    const txs = [
      // usual: ฿300/week for 3 weeks
      tx({ day: '2026-09-08', amount: 300 }),
      tx({ day: '2026-09-14', amount: 300 }),
      tx({ day: '2026-09-18', amount: 300 }),
      // this week: ฿600
      tx({ day: '2026-09-25', amount: 600 }),
    ];
    const rise = findCategoryIncrease(txs, NOW);
    expect(rise).toMatchObject({ key: 'food', week: 60_000, usualWeek: 30_000, changePct: 100 });
  });

  it('TC-32 speaks as น้องกล้า in one calm voice, with the facts behind it, and never without data', () => {
    const runway = computeRunway({ balanceSatang: 100_000, floorSatang: 50_000, averageSatang: 10_000, now: NOW });
    const empty = buildInsights({ txs: [], profile, runway, now: NOW });
    expect(empty[0].kind).toBe('no_data');
    expect(empty[0].message).toContain('กล้า');
    const txs = [tx({ day: '2026-09-27', amount: 100 })];
    // The old tone setting no longer changes anything: there is one coach now.
    const a = buildInsights({ txs, profile: { ...profile, coachTone: 'friend' }, runway, now: NOW });
    const b = buildInsights({ txs, profile: { ...profile, coachTone: 'senior' }, runway, now: NOW });
    expect(a).toEqual(b);
    for (const i of a) {
      expect(i.fact.length).toBeGreaterThan(0);
      expect(i.message).not.toMatch(/เกินไป!|พี่|น้องตั้ง/);
    }
  });
});

describe('FR-5 budget wording', () => {
  it('TC-34 says "over budget" plainly when spending passed the budget, without shaming', () => {
    const txs = [tx({ day: '2026-09-10', amount: 9500 }), tx({ day: '2026-09-27', amount: 100 })];
    const runway = computeRunway({ balanceSatang: 900_000, floorSatang: 50_000, averageSatang: 10_000, now: NOW });
    const budget = buildInsights({ txs, profile, runway, now: NOW }).find((i) => i.kind === 'budget_pace')!;
    expect(budget.message).toContain('เกินงบ');
    expect(budget.message).toContain('฿600');
    expect(budget.message).not.toMatch(/นิดนึง|นิดหน่อย/);
  });
});

describe('Periods shown to the user', () => {
  it('TC-52 today is 00:00–23:59 of the Bangkok day, 7 days are 7 full days ending today', () => {
    const late = new Date('2026-09-28T16:30:00Z'); // 23:30 on 28 Sep in Bangkok
    expect(formatRangeSpan('today', late)).toBe('28 ก.ย. 2569 · 00:00–23:59');
    expect(formatRangeSpan('7d', late)).toBe('22 – 28 ก.ย. 2569 · 7 วันเต็ม');
    expect(formatRangeSpan('1m', late)).toBe('30 ส.ค. – 28 ก.ย. 2569 · 30 วันเต็ม');
    const early = new Date('2026-09-27T17:05:00Z'); // 00:05 on 28 Sep in Bangkok
    expect(formatRangeSpan('today', early)).toBe('28 ก.ย. 2569 · 00:00–23:59');
    const list = [
      tx({ day: '2026-09-28', amount: 100 }),
      tx({ day: '2026-09-28', amount: 500, kind: 'income' }),
      tx({ day: '2026-09-22', amount: 40 }),
      tx({ day: '2026-09-21', amount: 999 }),
    ];
    const today = summarizeRange(list, 'today', late);
    expect([today.incomeSatang, today.expenseSatang, today.netSatang]).toEqual([50_000, 10_000, 40_000]);
    const week = summarizeRange(list, '7d', late);
    expect(week.expenseSatang).toBe(14_000); // 21 Sep is outside the 7 days
  });
});

describe('Finding the slip QR on the phone', () => {
  const slipQr = (bank: string, ref: string) => {
    const inner = `000600000101${String(bank.length).padStart(2, '0')}${bank}02${String(ref.length).padStart(2, '0')}${ref}`;
    const body = `00${String(inner.length).padStart(2, '0')}${inner}5102TH9104`;
    return body + crc16(body);
  };

  it('TC-57 picks the slip QR among other codes, and looks closer only at screen-sized pictures', () => {
    const promptPay = '00020101021129370016A000000677010111011300668123456785802TH53037646304ABCD';
    expect(firstSlipQr([promptPay, slipQr('004', '015271094231ATF01234')])).toEqual({
      sendingBank: '004',
      transRef: '015271094231ATF01234',
      crcValid: true,
    });
    expect(firstSlipQr([promptPay, null, 'https://example.com'])).toBeNull();
    expect(firstSlipQr([])).toBeNull();

    // Saved slips and screenshots get the closer look; camera photos and landscape pictures do not.
    expect(isScreenSized({ width: 1080, height: 2400 })).toBe(true);
    expect(isScreenSized({ width: 1440, height: 3088 })).toBe(true);
    expect(isScreenSized({ width: 3000, height: 4000 })).toBe(false);
    expect(isScreenSized({ width: 1920, height: 1080 })).toBe(false);
    expect(isScreenSized(null)).toBe(true);

    // Every region stays inside the picture, and together they cover the lower half.
    for (const size of [{ width: 1080, height: 2400 }, { width: 721, height: 1283 }]) {
      for (const region of SLIP_QR_REGIONS) {
        const px = regionInPixels(region, size);
        expect(px.originX + px.width).toBeLessThanOrEqual(size.width);
        expect(px.originY + px.height).toBeLessThanOrEqual(size.height);
        expect(px.width).toBeGreaterThan(size.width * 0.5);
      }
      expect(regionInPixels(SLIP_QR_REGIONS[0], size).originY).toBeLessThanOrEqual(size.height / 2);
    }
  });
});
