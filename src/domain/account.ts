/**
 * Deleting an account (PDPA: the right to have one's data erased).
 * What is said to the person, and how a failure is told, in plain Thai.
 * The server side is supabase/functions/delete-account; unit tests: __tests__/account.test.ts (TC-107).
 */

/** Sent with the request; the same word as DELETE_CONFIRM in supabase/functions/_shared/helpers.ts. */
export const DELETE_CONFIRM = 'DELETE_MY_ACCOUNT';

/** Deleted on the server, for good (every table that holds the account's data). */
export const DELETED_FROM_ACCOUNT: readonly string[] = [
  'รายการรายรับรายจ่ายทั้งหมด รวมรายการที่จดจากสลิป',
  'กระปุกออมทั้งหมด',
  'ยอดเงินตั้งต้น เงินสำรอง และงบรายเดือน',
  'ประวัติการใช้ AI และคำตอบเรื่องความยินยอม',
  'บัญชีเข้าสู่ระบบ (อีเมลนี้ใช้สมัครใหม่ได้ภายหลัง)',
];

/** Also removed from this phone. */
export const DELETED_FROM_PHONE: readonly string[] = ['รูปสลิปที่เก็บไว้ในเครื่องนี้', 'สกิน เหรียญ และลูกอมของบัญชีนี้', 'ตัวเลขบนวิดเจ็ตหน้าจอโฮม'];

/** MyPay and MindPay share accounts: deleting here empties MindPay too. */
export const SHARED_ACCOUNT_NOTE = 'บัญชีนี้ใช้ร่วมกับแอป MindPay ข้อมูลที่เห็นใน MindPay จะหายไปด้วย';

export type DeleteAccountCode = 'wrong_password' | 'reauth' | 'unauthorized' | 'network' | 'not_signed_in' | 'failed';

export const DELETE_ACCOUNT_MESSAGES: Record<DeleteAccountCode, string> = {
  wrong_password: 'รหัสผ่านไม่ถูกต้อง บัญชียังไม่ถูกลบ ลองใหม่อีกครั้ง',
  reauth: 'ต้องใส่รหัสผ่านอีกครั้งก่อนลบบัญชี',
  unauthorized: 'เซสชันหมดอายุ ออกจากระบบแล้วเข้าใหม่ก่อนลบบัญชี',
  network: 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ บัญชียังไม่ถูกลบ ลองใหม่อีกครั้ง',
  not_signed_in: 'ลบบัญชีได้เมื่อเข้าสู่ระบบด้วยบัญชีจริง',
  failed: 'ลบบัญชีไม่สำเร็จ บัญชียังอยู่ครบ ลองใหม่อีกครั้ง',
};

export class DeleteAccountError extends Error {
  constructor(public code: DeleteAccountCode) {
    super(DELETE_ACCOUNT_MESSAGES[code]);
    this.name = 'DeleteAccountError';
  }
}

/** The server's error code (or no answer at all) as what the person is told. */
export function deleteAccountCode(serverCode: unknown, status: number | null): DeleteAccountCode {
  if (serverCode === 'reauth') return 'reauth';
  if (serverCode === 'unauthorized' || status === 401) return 'unauthorized';
  if (status === null || status === 0) return 'network';
  return 'failed';
}
