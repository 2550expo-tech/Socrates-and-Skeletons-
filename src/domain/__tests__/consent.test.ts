/** TC-92 consent before slip photos go to the AI (PDPA). */
import { describe, expect, it } from 'vitest';
import { answerConsent, consentState, maySendSlips, SLIP_AI_CONSENT_POINTS, SLIP_AI_CONSENT_VERSION } from '../consent';

describe('TC-92 consent before slip photos go to the AI', () => {
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
