/**
 * TC-43..TC-48: sign-in rules (email links, codes and error messages).
 */
import { describe, expect, it } from 'vitest';
import {
  authErrorMessage,
  cleanOtp,
  isOtpComplete,
  otpErrorMessage,
  authLinkErrorMessage,
  EMAIL_PATTERN,
  isExistingAccountSignUp,
  normalizeEmail,
  parseAuthLink,
} from '../auth';

const BASE = 'https://2550expo-tech.github.io/Socrates-and-Skeletons-/';

describe('Email links', () => {
  it('TC-43 reads the session from a confirm or reset link (web and app)', () => {
    expect(parseAuthLink(`${BASE}#access_token=aaa.bbb.ccc&expires_in=3600&refresh_token=rrr&token_type=bearer&type=signup`)).toEqual({
      kind: 'session',
      accessToken: 'aaa.bbb.ccc',
      refreshToken: 'rrr',
      type: 'signup',
    });
    expect(parseAuthLink('mindpay://#access_token=x.y.z&refresh_token=r2&type=recovery')?.type).toBe('recovery');
    expect(parseAuthLink(`${BASE}?code=0f3a1c9e-77b2-4a55-9d1f-2c1e0b9a7f10`)).toEqual({
      kind: 'code',
      code: '0f3a1c9e-77b2-4a55-9d1f-2c1e0b9a7f10',
      type: undefined,
    });
  });

  it('TC-44 reads a failed link (expired or used twice) from the fragment or the query', () => {
    const fromHash = parseAuthLink(`${BASE}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`);
    expect(fromHash).toEqual({ kind: 'error', errorCode: 'otp_expired', errorDescription: 'Email link is invalid or has expired' });
    expect(authLinkErrorMessage(fromHash!)).toContain('หมดอายุหรือถูกใช้ไปแล้ว');
    expect(parseAuthLink(`${BASE}?error=server_error&error_description=x`)?.kind).toBe('error');
  });

  it('TC-45 ignores ordinary addresses', () => {
    expect(parseAuthLink(null)).toBeNull();
    expect(parseAuthLink(BASE)).toBeNull();
    expect(parseAuthLink(`${BASE}transactions?range=7d`)).toBeNull();
    expect(parseAuthLink(`${BASE}#access_token=only`)).toBeNull();
    expect(parseAuthLink('mindpay://scan')).toBeNull();
    expect(parseAuthLink(`${BASE}?code=1`)).toBeNull();
  });
});

describe('Sign-in messages', () => {
  it('TC-46 explains each Supabase error in Thai', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' })).toContain('ลืมรหัสผ่าน');
    expect(authErrorMessage({ code: 'email_not_confirmed' })).toContain('ยังไม่ได้ยืนยันอีเมล');
    expect(authErrorMessage({ code: 'over_email_send_rate_limit', status: 429 })).toContain('ชั่วโมงละ 2 ฉบับ');
    expect(authErrorMessage({ code: 'weak_password' })).toContain('เดาง่าย');
    expect(authErrorMessage({ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 })).toContain('อินเทอร์เน็ต');
    expect(authErrorMessage({ message: 'Invalid login credentials' })).toContain('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    expect(authErrorMessage({ message: 'Something new' })).toBe('ทำรายการไม่สำเร็จ (Something new)');
    expect(authErrorMessage(null)).toContain('ลองใหม่');
    expect(authErrorMessage({ code: 'email_address_not_authorized' })).toContain('Confirm email');
  });

  it('TC-48 accepts the 6-digit code from the email however it is pasted', () => {
    expect(cleanOtp(' 123 456 ')).toBe('123456');
    expect(cleanOtp('รหัส: 654321')).toBe('654321');
    expect(isOtpComplete('123456')).toBe(true);
    expect(isOtpComplete('12345')).toBe(false);
    expect(isOtpComplete('12345678')).toBe(true);
    expect(otpErrorMessage({ code: 'otp_expired', message: 'Token has expired or is invalid' })).toContain('รหัสไม่ถูกต้องหรือหมดอายุ');
    expect(otpErrorMessage({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' })).toContain('อินเทอร์เน็ต');
  });

  it('TC-47 recognises signing up again with a registered email, and cleans the email', () => {
    expect(isExistingAccountSignUp({ identities: [] })).toBe(true);
    expect(isExistingAccountSignUp({ identities: [{ provider: 'email' }] })).toBe(false);
    expect(isExistingAccountSignUp(null)).toBe(false);
    expect(normalizeEmail('  Mint@Example.COM ')).toBe('mint@example.com');
    expect(EMAIL_PATTERN.test('mint@example.com')).toBe(true);
    expect(EMAIL_PATTERN.test('mint@example')).toBe(false);
    expect(EMAIL_PATTERN.test('mint @example.com')).toBe(false);
  });
});
