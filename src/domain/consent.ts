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
 * Unit tests: __tests__/consent.test.ts (TC-102; TC-92 in the old app on `main`).
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
 * code:
 * - the QR check on the phone applies when the app searches the gallery by itself
 *   (AutoScanProvider, useSlipScanner `requireQr`); photos the person picks are all sent;
 *   a screen-sized picture with any QR (e-wallet slips) is sent too (processSlip.ts);
 * - parse-slip reads each slip twice with the AI the server is set up with: Anthropic Claude
 *   or Google Gemini (supabase/functions/_shared/common.ts `aiProvider`, AI_PROVIDER);
 * - what repo.insert keeps (processSlip.ts): amount, date/time, name, bank (in the note),
 *   reference number and a fingerprint (hash) of the picture for duplicates.
 * Change the wording only together with SLIP_AI_CONSENT_VERSION.
 */
export const SLIP_AI_CONSENT_POINTS: readonly string[] = [
  'ตอนแอปหาสลิปในแกลเลอรีเอง มือถือเลือกเฉพาะรูปที่มี QR (สลิปธนาคาร หรือภาพหน้าจอ e-wallet) รูปอื่นไม่ออกจากเครื่อง ส่วนรูปที่คุณเลือกเองจะถูกส่งไปอ่านทุกรูป',
  'รูปสลิปถูกส่งผ่านเซิร์ฟเวอร์ MindPay ไปให้ AI อ่าน (Google Gemini หรือ Anthropic Claude ตามที่ระบบตั้งไว้) และไม่ถูกเก็บไว้บนเซิร์ฟเวอร์ MindPay',
  'ในสลิปมีชื่อและเลขบัญชีบางส่วนของคุณ และของคนที่โอนกับคุณ',
  'ถ้าระบบใช้ Gemini แบบฟรี Google อาจเก็บข้อมูลที่ส่งไปเพื่อปรับปรุง AI',
  'MindPay เก็บเฉพาะยอดเงิน วันที่ ชื่อผู้รับหรือร้าน ธนาคาร เลขอ้างอิง และรหัสตรวจรูปซ้ำ (ไม่ใช่ตัวรูป) เป็นรายการในบัญชีของคุณ',
  'ไม่ยินยอมก็ได้ ยังจดเองและพูดจดได้ตามปกติ และเปลี่ยนใจได้ทุกเมื่อในตั้งค่า',
];
