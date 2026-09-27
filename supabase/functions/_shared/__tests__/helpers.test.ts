/**
 * TC-38..TC-42: server-side AI helpers (Claude or Gemini).
 */
import { describe, expect, it } from 'vitest';
import {
  geminiModels,
  geminiText,
  isInvalidKey,
  isZeroQuota,
  normalizeReading,
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

  it('TC-40 reads the reply text: skips thinking parts, fenced JSON, markdown', () => {
    const data = { candidates: [{ content: { parts: [{ text: 'hmm', thought: true }, { text: '{"a":' }, { text: '1}' }] } }] };
    expect(geminiText(data)).toBe('{"a":1}');
    expect(geminiText({})).toBe('');
    expect(parseJsonText('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonText('Here it is: {"a":2} done')).toEqual({ a: 2 });
    expect(() => parseJsonText('no json')).toThrow();
    expect(plainText('## หัวข้อ\n**สรุป** ใช้ไป ฿1,200')).toBe('หัวข้อ\nสรุป ใช้ไป ฿1,200');
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
