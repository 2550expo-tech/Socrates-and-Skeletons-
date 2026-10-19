/**
 * Consent before slip photos go to the AI (PDPA; Ch8 "minimise, consent for sensitive data").
 *
 * A slip shows money, names and part of an account number: the user's own, and those of
 * the person on the other side of the transfer. So no photo is sent to the slip reader
 * until the signed-in person has said yes, after being told what is sent, to whom, and
 * what is kept. They can say no (the rest of the app works as usual) and change their
 * mind at any time in Settings.
 *
 * The record is per account. When what is sent or who receives it changes, raise
 * SLIP_AI_CONSENT_VERSION: everyone who said yes is asked again; a "no" stays a "no".
 * Unit tests: __tests__/consent.test.ts (TC-92).
 */
export const SLIP_AI_CONSENT_VERSION = 1;

export interface ConsentRecord {
  granted: boolean;
  /** When the person answered (ms). */
  at: number;
  /** Which wording they answered (SLIP_AI_CONSENT_VERSION at the time). */
  version: number;
}

export type ConsentState = 'ask' | 'granted' | 'declined';

export function consentState(record: ConsentRecord | null | undefined, version = SLIP_AI_CONSENT_VERSION): ConsentState {
  if (!record || typeof record.granted !== 'boolean') return 'ask';
  if (!record.granted) return 'declined';
  return record.version === version ? 'granted' : 'ask';
}

/** True only for a yes to the current wording: the single check before any photo is sent. */
export const maySendSlips = (record: ConsentRecord | null | undefined) => consentState(record) === 'granted';

export function answerConsent(granted: boolean, nowMs: number): ConsentRecord {
  return { granted, at: nowMs, version: SLIP_AI_CONSENT_VERSION };
}

/**
 * What the person is told before they answer (also shown in Settings). Keep it true to the
 * code: QR check on the phone (services/slips.ts), parse-slip Edge Function, Gemini, what
 * repo.insert keeps. Change the wording only together with SLIP_AI_CONSENT_VERSION.
 */
export const SLIP_AI_CONSENT_POINTS: readonly string[] = [
  'มือถือหาเฉพาะรูปที่มี QR ของสลิปก่อน รูปอื่นไม่ออกจากเครื่อง',
  'รูปสลิปถูกส่งผ่านเซิร์ฟเวอร์ MindPay ไปให้ AI ของ Google (Gemini) อ่าน และไม่ถูกเก็บไว้บนเซิร์ฟเวอร์ MindPay',
  'ในสลิปมีชื่อและเลขบัญชีบางส่วนของคุณ และของคนที่โอนกับคุณ',
  'ช่วงทดลองใช้ Gemini แบบฟรี ซึ่ง Google อาจเก็บข้อมูลที่ส่งไปเพื่อปรับปรุง AI',
  'MindPay เก็บเฉพาะยอดเงิน วันที่ ชื่อผู้รับหรือร้าน และเลขอ้างอิง เป็นรายการในบัญชีของคุณ',
  'ไม่ยินยอมก็ได้ ยังจดเองและพูดจดได้ตามปกติ และเปลี่ยนใจได้ทุกเมื่อในตั้งค่า',
];
