/**
 * TC-107 deleting an account: the app and the server use the same confirmation word,
 * the person is told what goes (including MindPay's view of the shared account), and
 * every failure is said in plain Thai, saying the account is still there.
 */
import { describe, expect, it } from 'vitest';
import { DELETE_CONFIRM as SERVER_CONFIRM, isDeleteConfirmed } from '../../../supabase/functions/_shared/helpers';
import { DELETE_ACCOUNT_MESSAGES, DELETE_CONFIRM, deleteAccountCode, DeleteAccountError, DELETED_FROM_ACCOUNT, SHARED_ACCOUNT_NOTE } from '../account';

describe('TC-107 deleting an account', () => {
  it('the app sends the word the server checks for', () => {
    expect(DELETE_CONFIRM).toBe(SERVER_CONFIRM);
    expect(isDeleteConfirmed({ confirm: DELETE_CONFIRM })).toBe(true);
  });

  it('says what is deleted, and that MindPay shares the account', () => {
    const all = DELETED_FROM_ACCOUNT.join(' ');
    expect(all).toMatch(/รายการ/);
    expect(all).toMatch(/กระปุก/);
    expect(all).toMatch(/ความยินยอม/);
    expect(SHARED_ACCOUNT_NOTE).toMatch(/MindPay/);
  });

  it('server answers become plain Thai messages', () => {
    expect(deleteAccountCode('reauth', 403)).toBe('reauth');
    expect(deleteAccountCode(undefined, 401)).toBe('unauthorized');
    expect(deleteAccountCode('unauthorized', 401)).toBe('unauthorized');
    expect(deleteAccountCode(undefined, null)).toBe('network');
    expect(deleteAccountCode('delete_failed', 502)).toBe('failed');
    expect(new DeleteAccountError('wrong_password').message).toBe(DELETE_ACCOUNT_MESSAGES.wrong_password);
  });

  it('no message is in English or hides that nothing was deleted', () => {
    for (const [code, m] of Object.entries(DELETE_ACCOUNT_MESSAGES)) {
      expect(m, code).not.toMatch(/[A-Za-z]/);
    }
    for (const code of ['wrong_password', 'network', 'failed'] as const) {
      expect(DELETE_ACCOUNT_MESSAGES[code]).toMatch(/ยังไม่ถูกลบ|ยังอยู่ครบ/);
    }
  });
});
