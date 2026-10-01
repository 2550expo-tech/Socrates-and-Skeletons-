/**
 * TC-38..TC-42, TC-54, TC-55, TC-62, TC-63: server-side AI helpers (Claude or Gemini).
 */
import { describe, expect, it } from 'vitest';
import {
  geminiModels,
  geminiStep,
  geminiText,
  isInvalidKey,
  isZeroQuota,
  mergeReadings,
  MAX_TEXT,
  normalizeReading,
  similarName,
  UNCHECKED_MAX,
  verifierModels,
  parseJsonText,
  pickProvider,
  plainText,
  readKey,
  retryDelayMs,
  GEMINI_KEY_NAMES,
} from '../helpers';

describe('AI provider', () => {
  it('TC-38 uses Claude when its key is set, otherwise Gemini; AI_PROVIDER forces one', () => {
    expect(pickProvider({ hasClaude: true, hasGemini: true })).toBe('claude');
    expect(pickProvider({ hasClaude: false, hasGemini: true })).toBe('gemini');
    expect(pickProvider({ hasClaude: false, hasGemini: false })).toBeNull();
    expect(pickProvider({ forced: 'Gemini', hasClaude: true, hasGemini: true })).toBe('gemini');
    expect(pickProvider({ forced: 'gemini', hasClaude: true, hasGemini: false })).toBeNull();
    expect(geminiModels('my-model')[0]).toBe('my-model');
    expect(new Set(geminiModels('gemini-3.5-flash-lite')).size).toBe(geminiModels('gemini-3.5-flash-lite').length);
  });

  it('TC-39 tells a refused key and a no-quota model apart from "slow down"', () => {
    expect(isInvalidKey(400, '{"reason":"API_KEY_INVALID"}')).toBe(true);
    expect(isInvalidKey(401, '')).toBe(true);
    expect(isInvalidKey(400, 'Unknown name "responseJsonSchema"')).toBe(false);
    expect(isZeroQuota('Quota exceeded for metric: x, limit: 0, model: y')).toBe(true);
    expect(isZeroQuota('Quota exceeded for metric: x, limit: 15, model: y')).toBe(false);
    expect(retryDelayMs('{"retryDelay": "7s"}')).toBe(7000);
    expect(retryDelayMs('{"retryDelay":"0.5s"}')).toBe(500);
    expect(retryDelayMs('slow down')).toBeNull();
  });

  it('TC-55 a busy model hands over to the next model (each has its own free quota)', () => {
    expect(geminiStep(429, '{"retryDelay":"20s"} limit: 15', true)).toBe('busy');
    expect(geminiStep(503, 'overloaded', false)).toBe('busy');
    expect(geminiStep(500, 'internal', false)).toBe('busy');
    expect(geminiStep(429, 'limit: 0, model: x', true)).toBe('next_model');
    expect(geminiStep(404, 'not found', true)).toBe('next_model');
    expect(geminiStep(400, 'Unknown name "responseJsonSchema"', true)).toBe('plain_schema');
    expect(geminiStep(400, 'bad request', false)).toBe('fail');
    expect(geminiStep(400, '{"reason":"API_KEY_INVALID"}', true)).toBe('invalid_key');
    expect(geminiStep(403, '', false)).toBe('invalid_key');
  });

  it('TC-40 reads the reply text: skips thinking parts, fenced JSON, markdown', () => {
    const data = { candidates: [{ content: { parts: [{ text: 'hmm', thought: true }, { text: '{"a":' }, { text: '1}' }] } }] };
    expect(geminiText(data)).toBe('{"a":1}');
    expect(geminiText({})).toBe('');
    expect(parseJsonText('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonText('Here it is: {"a":2} done')).toEqual({ a: 2 });
    expect(() => parseJsonText('no json')).toThrow();
    expect(plainText('## หัวข้อ\n**สรุป** ใช้ไป ฿1,200')).toBe('หัวข้อ\nสรุป ใช้ไป ฿1,200');
    // Read aloud by น้องกล้า: no list bullets or numbers in front of lines.
    expect(plainText('- กินข้าวบ้าน\n• ลดกาแฟ\n2) เก็บ ฿100')).toBe('กินข้าวบ้าน\nลดกาแฟ\nเก็บ ฿100');
  });
});

describe('Reading the AI key', () => {
  it('TC-54 tolerates copy-paste mistakes and Google\'s other standard name', () => {
    const env = (vars: Record<string, string>) => (n: string) => vars[n];
    expect(readKey(env({ GEMINI_API_KEY: '  abc123\n' }), GEMINI_KEY_NAMES)).toBe('abc123');
    expect(readKey(env({ GEMINI_API_KEY: '"abc123"' }), GEMINI_KEY_NAMES)).toBe('abc123');
    expect(readKey(env({ GOOGLE_API_KEY: 'xyz' }), GEMINI_KEY_NAMES)).toBe('xyz');
    expect(readKey(env({ 'GEMINI API KEY': 'spaced' }), GEMINI_KEY_NAMES)).toBe('spaced');
    expect(readKey(env({ GEMINI_API_KEY: 'right', 'GEMINI API KEY': 'spaced' }), GEMINI_KEY_NAMES)).toBe('right');
    expect(readKey(env({ GEMINI_API_KEY: '   ' }), GEMINI_KEY_NAMES)).toBeNull();
    expect(readKey(env({}), GEMINI_KEY_NAMES)).toBeNull();
  });
});

describe('Slip reading from any model', () => {
  it('TC-41 cleans values: amount text, Buddhist year, time, reference', () => {
    const r = normalizeReading({
      isSlip: true,
      direction: 'expense',
      amount: '1,250.00 บาท',
      dateText: '27 ก.ย. 69',
      dateIso: '2569-09-27',
      time: '9.05',
      counterparty: ' ร้านป้าแดง ',
      bank: 'KBank',
      reference: '0152-ABC',
      confidence: { amount: 0.95, date: '0.9', counterparty: 1.4 },
    });
    expect(r).toEqual({
      isSlip: true,
      direction: 'expense',
      amount: '1250.00',
      dateText: '27 ก.ย. 69',
      dateIso: '2026-09-27',
      time: '09:05',
      counterparty: 'ร้านป้าแดง',
      bank: 'KBank',
      reference: '0152ABC',
      fromName: null,
      toName: null,
      confidence: { amount: 0.95, date: 0.9, counterparty: 1 },
    });
    expect(normalizeReading({ isSlip: true, amount: 89.5 }).amount).toBe('89.50');
  });

  it('TC-42 a missing or unreadable value never keeps a high confidence; non-slips are empty', () => {
    const r = normalizeReading({
      isSlip: true,
      direction: 'sideways',
      amount: 'สองร้อย',
      dateText: null,
      dateIso: 'null',
      counterparty: '',
      confidence: { amount: 0.99, date: 0.99, counterparty: 0.99 },
    });
    expect(r.direction).toBe('unknown');
    expect(r.amount).toBeNull();
    expect(r.confidence).toEqual({ amount: 0, date: 0, counterparty: 0 });

    const notSlip = normalizeReading({ isSlip: 'yes', amount: '100', confidence: { amount: 1 } });
    expect(notSlip.isSlip).toBe(false);
    expect(notSlip.amount).toBeNull();
    expect(notSlip.confidence.amount).toBe(0);
    expect(normalizeReading(null).isSlip).toBe(false);
  });
});

describe('Slip read twice (accuracy)', () => {
  const slip = (over: Record<string, unknown> = {}) =>
    normalizeReading({
      isSlip: true,
      direction: 'expense',
      amount: '1250.00',
      amountPrinted: '1,250.00',
      fee: '0.00',
      dateText: '27 ก.ย. 69',
      dateIso: '2026-09-27',
      time: '14:05',
      fromName: 'นาย สมชาย ใจดี',
      toName: 'ร้านข้าวมันไก่ป้าแดง',
      counterparty: 'ร้านข้าวมันไก่ป้าแดง',
      bank: 'KBank',
      reference: '016271094231BTF05678',
      confidence: { amount: 0.97, date: 0.96, counterparty: 0.95 },
      ...over,
    });

  it('TC-62 the amount must match itself: as digits, as printed, and not the fee', () => {
    expect(slip().confidence.amount).toBe(0.97);
    expect(slip({ amountPrinted: '+1,250.00 บาท' }).confidence.amount).toBe(0.97);
    // "1,520.00" printed but "1250.00" written: one of them is misread.
    expect(slip({ amountPrinted: '1,520.00' }).confidence.amount).toBe(0);
    expect(slip({ amountPrinted: null }).confidence.amount).toBe(0);
    // The fee was taken as the amount.
    expect(slip({ amount: '15.00', amountPrinted: '15.00', fee: '15.00' }).confidence.amount).toBe(0);
    // Readers that do not send amountPrinted are not penalised.
    expect(slip({ amountPrinted: undefined }).confidence.amount).toBe(0.97);
    expect(slip().fromName).toBe('นาย สมชาย ใจดี');
    expect(slip().toName).toBe('ร้านข้าวมันไก่ป้าแดง');
    // The second read uses other models first.
    expect(verifierModels(null)[0]).not.toBe(geminiModels(null)[0]);
    expect(verifierModels('my-model')[0]).toBe('my-model');
  });

  it('TC-87 two reads: a value only one read found is kept (unsure), and same-model reads are never sure', () => {
    // The first read missed the amount and date; the second (larger) model had them.
    const merged = mergeReadings(slip({ amount: null, amountPrinted: null, dateText: null, dateIso: null }), slip());
    expect(merged.reading.amount).toBe('1250.00');
    expect(merged.reading.dateIso).toBe(slip().dateIso);
    expect(merged.reading.confidence.amount).toBeLessThan(0.8);
    expect(merged.check.verified).toBe(false);
    const payee = mergeReadings(slip({ counterparty: null }), slip());
    expect(payee.reading.counterparty).toBe('ร้านข้าวมันไก่ป้าแดง');
    // Agreeing amounts, but one read doubted its own: stay unsure.
    const doubted = mergeReadings(slip({ amountPrinted: '1,520.00' }), slip());
    expect(doubted.reading.confidence.amount).toBeLessThan(0.5);
    // Same model twice: their mistakes would agree, so nothing is counted without a look.
    const same = mergeReadings(slip(), slip(), { sameModel: true });
    expect(same.reading.confidence.amount).toBeLessThanOrEqual(UNCHECKED_MAX);
    expect(same.check.verified).toBe(false);
  });

  it('TC-88 model output is capped to what the database takes', () => {
    const long = 'ร้าน'.repeat(80);
    expect((slip({ counterparty: long, toName: long }).counterparty ?? '').length).toBeLessThanOrEqual(MAX_TEXT);
    expect(slip({ amount: '99999999999999999999.00', amountPrinted: '99999999999999999999.00' }).amount).toBeNull();
    expect(slip({ amount: '1000000000.00', amountPrinted: '1,000,000,000.00' }).amount).toBe('1000000000.00');
  });

  it('TC-63 two reads: agreement is kept, any disagreement on a key field waits for the user', () => {
    const agreed = mergeReadings(slip(), slip({ confidence: { amount: 0.99, date: 0.9, counterparty: 0.9 }, dateText: '27ก.ย.2569' }));
    expect(agreed.check).toEqual({ verified: true, reads: 2, disagree: {} });
    expect(agreed.reading.confidence).toEqual({ amount: 0.99, date: 0.96, counterparty: 0.95 });

    const amount = mergeReadings(slip(), slip({ amount: '1280.00', amountPrinted: '1,280.00' }));
    expect(amount.check.verified).toBe(false);
    expect(amount.check.disagree.amount).toEqual(['1250.00', '1280.00']);
    expect(amount.reading.confidence.amount).toBeLessThan(0.8);
    expect(amount.reading.confidence.date).toBe(0.96);

    const date = mergeReadings(slip(), slip({ dateText: '21 ก.ย. 69', dateIso: '2026-09-21' }));
    expect(date.check.disagree.date).toEqual(['27 ก.ย. 69', '21 ก.ย. 69']);
    expect(date.reading.confidence.date).toBeLessThan(0.8);

    const direction = mergeReadings(slip(), slip({ direction: 'income' }));
    expect(direction.reading.direction).toBe('unknown');
    expect(mergeReadings(slip({ direction: 'unknown' }), slip()).reading.direction).toBe('expense');

    // A masked name and the full name are the same person; a different shop is not.
    const masked = mergeReadings(slip({ counterparty: 'ร้านข้าวมันไก่ป้า***' }), slip());
    expect(masked.check.verified).toBe(true);
    expect(masked.reading.counterparty).toBe('ร้านข้าวมันไก่ป้าแดง');
    expect(similarName('นาย สมชาย ใ***', 'สมชาย ใจดี')).toBe(true);
    expect(similarName('MR. SOMCHAI JAIDEE', 'Somchai Jaidee')).toBe(true);
    expect(similarName('ร้านกาแฟดอยช้าง', 'ร้านข้าวมันไก่ป้าแดง')).toBe(false);
    const other = mergeReadings(slip(), slip({ counterparty: 'ร้านกาแฟดอยช้าง' }));
    expect(other.check.disagree.counterparty).toBeTruthy();

    // Only one read could be made: nothing counts without a look.
    const single = mergeReadings(slip(), null);
    expect(single.check).toEqual({ verified: false, reads: 1, disagree: {} });
    expect(Math.max(...Object.values(single.reading.confidence))).toBeLessThanOrEqual(UNCHECKED_MAX);
    // One model sees a slip, the other does not.
    const notSure = mergeReadings(slip(), normalizeReading({ isSlip: false }));
    expect(notSure.reading.isSlip).toBe(true);
    expect(notSure.check.verified).toBe(false);
    expect(notSure.reading.confidence.amount).toBeLessThan(0.8);
    expect(mergeReadings(normalizeReading({ isSlip: false }), normalizeReading({ isSlip: false })).reading.isSlip).toBe(false);
  });
});
