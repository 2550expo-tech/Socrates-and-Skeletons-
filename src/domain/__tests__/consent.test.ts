/** TC-102 consent before slip photos go to the AI (PDPA). */
import { describe, expect, it } from 'vitest';
import { answerConsent, consentState, maySendSlips, SLIP_AI_CONSENT_POINTS, SLIP_AI_CONSENT_VERSION } from '../consent';

describe('TC-102 consent before slip photos go to the AI', () => {
  it('nobody has said yes until they answer', () => {
    expect(consentState(null)).toBe('ask');
    expect(consentState(undefined)).toBe('ask');
    expect(maySendSlips(null)).toBe(false);
    // A damaged stored value is not a yes.
    expect(maySendSlips({ at: 1, version: SLIP_AI_CONSENT_VERSION } as never)).toBe(false);
  });

  it('a yes allows sending, a no does not', () => {
    expect(maySendSlips(answerConsent(true, 1000))).toBe(true);
    expect(consentState(answerConsent(false, 1000))).toBe('declined');
    expect(maySendSlips(answerConsent(false, 1000))).toBe(false);
  });

  it('remembers when and to which wording the person answered', () => {
    expect(answerConsent(true, 1234)).toEqual({ granted: true, at: 1234, version: SLIP_AI_CONSENT_VERSION });
  });

  it('a yes to older wording is asked again; a no stays a no (no nagging)', () => {
    const oldYes = { granted: true, at: 1, version: SLIP_AI_CONSENT_VERSION - 1 };
    expect(consentState(oldYes)).toBe('ask');
    expect(maySendSlips(oldYes)).toBe(false);
    expect(consentState({ granted: false, at: 1, version: SLIP_AI_CONSENT_VERSION - 1 })).toBe('declined');
  });

  it('tells the person what is sent, to whom, what is kept, about other people, and how to say no', () => {
    const text = SLIP_AI_CONSENT_POINTS.join(' ');
    expect(text).toMatch(/QR/);
    // Every AI the server may be set up with is named (supabase/functions/_shared/common.ts).
    expect(text).toMatch(/Gemini/);
    expect(text).toMatch(/Claude/);
    // Photos the person picks skip the QR check, and the consent says so.
    expect(text).toMatch(/เลือกเอง/);
    expect(text).toMatch(/คนที่โอน/);
    expect(text).toMatch(/เก็บเฉพาะ/);
    expect(text).toMatch(/ไม่ยินยอม/);
    expect(text).toMatch(/ตั้งค่า/);
  });
});

describe('TC-106 the consent answer is kept with the account and follows it to another phone', async () => {
  const { consentFromRow, consentToRow, reconcileConsent } = await import('../consent');
  const yes = (at: number) => answerConsent(true, at);
  const no = (at: number) => answerConsent(false, at);

  it('a new phone takes the account’s answer (nothing to send)', () => {
    expect(reconcileConsent(null, yes(100))).toEqual({ use: yes(100), send: false });
    expect(reconcileConsent(undefined, null)).toEqual({ use: null, send: false });
  });

  it('an answer given on this phone (or offline) and not on the server yet is sent', () => {
    expect(reconcileConsent(yes(100), null)).toEqual({ use: yes(100), send: true });
    expect(reconcileConsent(no(300), yes(100))).toEqual({ use: no(300), send: true });
  });

  it('a later answer from another phone wins: withdrawing there stops sending here', () => {
    expect(reconcileConsent(yes(100), no(300))).toEqual({ use: no(300), send: false });
    expect(maySendSlips(reconcileConsent(yes(100), no(300)).use)).toBe(false);
  });

  it('the same answer on both sides: nothing to do', () => {
    expect(reconcileConsent(yes(100), yes(100))).toEqual({ use: yes(100), send: false });
  });

  it('rows carry the app, the purpose, the wording version and the time; bad rows are ignored', () => {
    const row = consentToRow(yes(Date.UTC(2026, 9, 25, 3, 0, 0)));
    expect(row).toEqual({ app: 'mypay', purpose: 'slip_ai', granted: true, version: SLIP_AI_CONSENT_VERSION, answered_at: '2026-10-25T03:00:00.000Z' });
    expect(consentFromRow(row)).toEqual(yes(Date.UTC(2026, 9, 25, 3, 0, 0)));
    expect(consentFromRow({ granted: true, version: 1, answered_at: 'not a date' })).toBeNull();
    expect(consentFromRow({ granted: 'yes' as never, version: 1, answered_at: row.answered_at })).toBeNull();
  });
});
