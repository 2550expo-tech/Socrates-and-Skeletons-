/**
 * TC-98 (pre-ship check S3-3): a failed load is told in plain Thai, and an
 * expired session is recognised so the app can offer to sign in again.
 */
import { describe, expect, it } from 'vitest';
import { LOAD_ERROR_MESSAGES, loadErrorOf } from '../loadError';

describe('TC-98 load errors are shown in plain Thai', () => {
  it('no internet, a timeout or a dropped connection → network', () => {
    expect(loadErrorOf(new TypeError('Network request failed')).kind).toBe('network');
    expect(loadErrorOf(new TypeError('Failed to fetch')).kind).toBe('network');
    expect(loadErrorOf({ name: 'AbortError', message: 'The operation was aborted.' }).kind).toBe('network');
  });

  it('an expired or rejected session → expired (sign in again)', () => {
    expect(loadErrorOf({ code: 'PGRST301', message: 'JWT expired' }).kind).toBe('expired');
    expect(loadErrorOf({ status: 401, message: 'Unauthorized' }).kind).toBe('expired');
  });

  it('anything else → a general message; the raw text is never passed on', () => {
    const info = loadErrorOf({ code: '42P01', message: 'relation "public.transactions" does not exist' });
    expect(info.kind).toBe('other');
    expect(info.message).toBe(LOAD_ERROR_MESSAGES.other);
    expect(Object.values(LOAD_ERROR_MESSAGES).every((m) => !/[A-Za-z]/.test(m))).toBe(true);
    expect(loadErrorOf(undefined).kind).toBe('other');
  });
});
