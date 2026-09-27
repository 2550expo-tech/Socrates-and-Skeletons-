/**
 * Sign-in rules that do not depend on the UI or on Supabase itself, so they
 * are unit-tested (see __tests__/auth.test.ts):
 * - reading the result of an email link (confirm sign-up, reset password)
 * - turning Supabase auth errors into clear Thai messages
 */

export interface AuthLinkResult {
  kind: 'session' | 'code' | 'error';
  accessToken?: string;
  refreshToken?: string;
  /** signup | recovery | magiclink | email_change | invite */
  type?: string;
  code?: string;
  errorCode?: string;
  errorDescription?: string;
}

/**
 * Supabase sends the user back from an email link with the result in the URL
 * fragment (#access_token=...&type=signup) or query (?error_code=otp_expired).
 * Returns null when the URL carries no sign-in result.
 */
export function parseAuthLink(url: string | null | undefined): AuthLinkResult | null {
  if (!url) return null;
  const params = new Map<string, string>();
  const read = (part: string) => {
    for (const pair of part.split('&')) {
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      const key = pair.slice(0, eq);
      let value = pair.slice(eq + 1).replace(/\+/g, ' ');
      try {
        value = decodeURIComponent(value);
      } catch {
        // keep the raw value
      }
      if (!params.has(key)) params.set(key, value);
    }
  };
  const hash = url.indexOf('#');
  if (hash >= 0) read(url.slice(hash + 1));
  const query = url.indexOf('?');
  if (query >= 0) read(url.slice(query + 1, hash > query ? hash : undefined));

  const errorCode = params.get('error_code') ?? params.get('error');
  if (errorCode) {
    return { kind: 'error', errorCode, errorDescription: params.get('error_description') };
  }
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    return { kind: 'session', accessToken, refreshToken, type: params.get('type') };
  }
  const code = params.get('code');
  if (code && /^[\w-]{8,}$/.test(code)) return { kind: 'code', code, type: params.get('type') };
  return null;
}

/** Message for a link that did not work (expired, already used, wrong address). */
export function authLinkErrorMessage(result: AuthLinkResult): string {
  const code = result.errorCode ?? '';
  const text = (result.errorDescription ?? '').toLowerCase();
  if (code === 'otp_expired' || text.includes('expired') || text.includes('invalid')) {
    return 'ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว (ลิงก์ในอีเมลกดได้ครั้งเดียว) ถ้าเคยกดยืนยันแล้ว เข้าสู่ระบบได้เลย ถ้ายังไม่ได้ ขอลิงก์ใหม่จากหน้าเข้าสู่ระบบ';
  }
  return 'เปิดลิงก์จากอีเมลไม่สำเร็จ ลองเข้าสู่ระบบ หรือขอลิงก์ใหม่อีกครั้ง';
}

export interface AuthErrorLike {
  name?: string;
  code?: string;
  status?: number;
  message?: string;
}

/** Thai message for any error from supabase.auth.* */
export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  if (!error) return 'ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง';
  const code = error.code ?? '';
  const msg = (error.message ?? '').toLowerCase();
  switch (code) {
    case 'invalid_credentials':
      return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง ถ้าจำรหัสไม่ได้ กด "ลืมรหัสผ่าน"';
    case 'email_not_confirmed':
      return 'ยังไม่ได้ยืนยันอีเมล เปิดอีเมลที่เราส่งไปแล้วกดลิงก์ยืนยันก่อน';
    case 'user_already_exists':
    case 'email_exists':
      return 'อีเมลนี้มีบัญชีอยู่แล้ว เข้าสู่ระบบ หรือกด "ลืมรหัสผ่าน"';
    case 'weak_password':
      return 'รหัสผ่านเดาง่ายเกินไป ลองผสมตัวอักษรกับตัวเลขให้ยาวขึ้น';
    case 'same_password':
      return 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม';
    case 'over_email_send_rate_limit':
      return 'ส่งอีเมลบ่อยเกินไป ระบบอีเมลแบบฟรีส่งได้ชั่วโมงละ 2 ฉบับ รอสักพักแล้วลองใหม่';
    case 'over_request_rate_limit':
      return 'ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่';
    case 'email_address_invalid':
      return 'ใช้อีเมลนี้ไม่ได้ ลองอีเมลอื่น';
    case 'email_address_not_authorized':
      return 'ระบบยังส่งอีเมลยืนยันไปที่อีเมลนี้ไม่ได้ (อีเมลฟรีของ Supabase ส่งได้เฉพาะอีเมลของทีมผู้พัฒนา) แจ้งผู้ดูแลให้ปิด Confirm email หรือตั้งค่า SMTP';
    case 'signup_disabled':
    case 'email_provider_disabled':
      return 'ตอนนี้ปิดรับสมัครสมาชิกอยู่';
    case 'user_banned':
      return 'บัญชีนี้ถูกระงับการใช้งาน';
    case 'session_not_found':
    case 'session_expired':
    case 'refresh_token_not_found':
    case 'refresh_token_already_used':
      return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง';
    case 'otp_expired':
      return authLinkErrorMessage({ kind: 'error', errorCode: code });
  }
  if (error.name === 'AuthRetryableFetchError' || msg.includes('failed to fetch') || msg.includes('network')) {
    return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่';
  }
  if (error.status === 429) return 'ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่';
  if (msg.includes('invalid login credentials')) return authErrorMessage({ code: 'invalid_credentials' });
  if (msg.includes('email not confirmed')) return authErrorMessage({ code: 'email_not_confirmed' });
  return error.message ? `ทำรายการไม่สำเร็จ (${error.message})` : 'ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง';
}

/** Message for a wrong or expired code typed from the email. */
export function otpErrorMessage(error: AuthErrorLike | null | undefined): string {
  const code = error?.code ?? '';
  const msg = (error?.message ?? '').toLowerCase();
  if (code === 'otp_expired' || msg.includes('expired') || msg.includes('invalid')) {
    return 'รหัสไม่ถูกต้องหรือหมดอายุ ตรวจตัวเลขอีกครั้ง หรือกดส่งรหัสใหม่';
  }
  return authErrorMessage(error);
}

/** The code in Supabase emails is 6 digits by default (the project can set 6 to 10). */
export function cleanOtp(input: string): string {
  return input.replace(/\D/g, '').slice(0, 10);
}

export function isOtpComplete(code: string): boolean {
  return /^\d{6,10}$/.test(code);
}

/**
 * Supabase does not reveal whether an email is already registered: signing up
 * again "succeeds" but returns a user with no identities and sends no email.
 */
export function isExistingAccountSignUp(user: { identities?: unknown[] | null } | null | undefined): boolean {
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD_LENGTH = 8;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
