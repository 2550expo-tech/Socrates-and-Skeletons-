/**
 * TC-64, TC-65: reading slips of every bank without mistakes.
 * TC-64: the slip QR names the bank; when the two AI reads disagree, both values
 *        are kept for the user to choose from.
 * TC-65: income or expense from the names on the slip once the user's own name
 *        is known (a slip a friend sent "I paid you" is income, not expense).
 */
import { describe, expect, it } from 'vitest';
import { ALT_PREFIX, amountChoices, bankFromCode, normalizeReading, slipNote, type SlipReading } from '../slip';
import { addPayer, decideDirection, EMPTY_NAME_STATS, isMine, nameKey, type NameStats } from '../slipNames';

const NOW = new Date('2026-09-28T05:00:00Z');

const reading = (over: Partial<SlipReading> = {}): SlipReading => ({
  isSlip: true,
  direction: 'expense',
  amount: '1250.00',
  dateText: '27 ก.ย. 69',
  dateIso: '2026-09-27',
  time: '14:05',
  counterparty: 'ร้านข้าวมันไก่ป้าแดง',
  bank: 'Kasikorn',
  reference: '016271094231BTF05678',
  fromName: 'นาย สมชาย ใจดี',
  toName: 'ร้านข้าวมันไก่ป้าแดง',
  confidence: { amount: 0.97, date: 0.96, counterparty: 0.95 },
  ...over,
});

const learned = (payers: string[]): NameStats => payers.reduce(addPayer, EMPTY_NAME_STATS);

describe('Slips of every bank', () => {
  it('TC-64 the QR names the bank; two different readings are both offered to the user', () => {
    expect(bankFromCode('004')).toBe('KBank');
    expect(bankFromCode('14')).toBe('SCB');
    expect(bankFromCode('006')).toBe('Krungthai');
    expect(bankFromCode('025')).toBe('Krungsri');
    expect(bankFromCode('999')).toBeNull();
    const qr = { sendingBank: '014', transRef: '016272184455CKQ11220', crcValid: true };
    // The QR (made by the bank) wins over the logo the AI read.
    const c = normalizeReading(reading(), { qr, now: NOW });
    expect(c.bank).toBe('SCB');
    expect(c.ref).toBe('016272184455CKQ11220');
    expect(normalizeReading(reading(), { now: NOW }).bank).toBe('Kasikorn');

    expect(slipNote(c, { verified: true, reads: 2, disagree: {} })).toBe('สลิปจาก SCB');
    const note = slipNote(c, { verified: false, reads: 2, disagree: { amount: ['1250.00', '1280.00'], date: ['27 ก.ย. 69', '21 ก.ย. 69'] } });
    expect(note).toBe(`สลิปจาก SCB\n${ALT_PREFIX} ยอดเงิน ฿1,250.00 หรือ ฿1,280.00 · วันที่ 27 ก.ย. 69 หรือ 21 ก.ย. 69`);
    expect(amountChoices(note)).toEqual([125_000, 128_000]);
    expect(amountChoices('สลิปจาก SCB')).toEqual([]);
    expect(amountChoices(null)).toEqual([]);
    expect(slipNote({ bank: null, ownTransfer: false }, { verified: false, reads: 1, disagree: {} })).toBe('อ่านได้รอบเดียว ช่วยตรวจกับสลิปอีกครั้ง');
    expect(slipNote({ bank: null, ownTransfer: false }, null)).toBeNull();
  });

  it('TC-65 income or expense from whose name is on the slip', () => {
    // Title, masking and spacing do not matter; Thai and English spellings are learned apart.
    expect(nameKey('นาย สมชาย ใจดี')).toBe(nameKey('สมชาย ใ***'));
    expect(nameKey('น.ส. สมชาย ใจดี')).toBe(nameKey('สมชาย ใจดี'));
    expect(nameKey('MR. SOMCHAI JAIDEE')).toBe(nameKey('Somchai J.'));
    expect(nameKey('สมชาย ใจดี')).not.toBe(nameKey('สมหญิง ใจดี'));
    expect(nameKey('   ')).toBeNull();
    // Names are kept only as fingerprints.
    expect(JSON.stringify(learned(['นาย สมชาย ใจดี', 'นาย สมชาย ใจดี']))).not.toContain('สมชาย');

    // Not learned yet: the AI's reading decides.
    expect(decideDirection(reading(), EMPTY_NAME_STATS)).toMatchObject({ kind: 'expense', counterparty: 'ร้านข้าวมันไก่ป้าแดง', unsure: false });
    expect(decideDirection(reading({ direction: 'unknown' }), EMPTY_NAME_STATS).unsure).toBe(true);

    const me = learned(['นาย สมชาย ใจดี', 'นาย สมชาย ใ***', 'MR SOMCHAI JAIDEE', 'MR SOMCHAI J', 'นาย สมชาย ใจดี', 'ร้านป้าแดง']);
    expect(isMine(me, 'สมชาย ใจดี')).toBe(true);
    expect(isMine(me, 'SOMCHAI JAIDEE')).toBe(true);
    expect(isMine(me, 'ร้านป้าแดง')).toBe(false); // seen once only

    // A friend's slip "โอนเงินสำเร็จ" to the user looks like an expense to the AI: it is income.
    const friend = reading({ fromName: 'น.ส. มะลิ แสนดี', toName: 'นาย สมชาย ใ***', counterparty: 'นาย สมชาย ใ***' });
    const d = decideDirection(friend, me);
    expect(d).toMatchObject({ kind: 'income', counterparty: 'น.ส. มะลิ แสนดี', unsure: false, ownTransfer: false });
    const c = normalizeReading(friend, { names: me, now: NOW });
    expect(c.kind).toBe('income');
    expect(c.counterparty).toBe('น.ส. มะลิ แสนดี');
    expect(c.flags).toEqual([]);

    // The user's own payment stays an expense; a "received" reading of it is questioned.
    expect(decideDirection(reading(), me)).toMatchObject({ kind: 'expense', unsure: false });
    expect(decideDirection(reading({ direction: 'income' }), me)).toMatchObject({ kind: 'expense', unsure: true });

    // From one of the user's accounts to another: not income or expense, so ask.
    const own = normalizeReading(reading({ toName: 'MR. SOMCHAI JAIDEE' }), { names: me, now: NOW });
    expect(own.ownTransfer).toBe(true);
    expect(own.flags).toContain('direction');
    expect(slipNote(own, null)).toContain('โอนระหว่างบัญชีของคุณเอง');
  });
});
