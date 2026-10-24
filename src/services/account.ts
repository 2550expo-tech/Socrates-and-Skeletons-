/**
 * Delete the signed-in account (Settings → ลบบัญชี).
 *
 * 1. The password is checked again (a fresh sign-in): the server only deletes an account
 *    whose owner signed in within the last 10 minutes.
 * 2. The Edge Function "delete-account" deletes the account; everything in it goes with it
 *    (every table references the account with "on delete cascade").
 * 3. What this phone kept for the account is removed too.
 * Nothing is deleted when step 1 or 2 fails.
 */
import { FunctionsHttpError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { forgetScanPrefsFor } from '../data/prefs';
import { supabase } from '../data/supabase';
import { DELETE_CONFIRM, DeleteAccountError, deleteAccountCode } from '../domain/account';
import { forgetWardrobe } from './kla';
import { forgetNames } from './myNames';
import { clearWidget } from './quickWidget';
import { deleteAllSlipCopies } from './slipCopies';
import { forgetScanned } from './slips';
import { forgetBadges } from './useAchievements';

export async function deleteMyAccount(userId: string, password: string): Promise<void> {
  if (!supabase) throw new DeleteAccountError('not_signed_in');
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user.email;
  if (!email || data.session?.user.id !== userId) throw new DeleteAccountError('unauthorized');

  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    throw new DeleteAccountError(isAuthRetryableFetchError(signIn.error) ? 'network' : 'wrong_password');
  }
  // The password was right but belongs to another account somehow: never delete that one.
  if (signIn.data.user?.id !== userId) throw new DeleteAccountError('unauthorized');

  const { error } = await supabase.functions.invoke('delete-account', { body: { confirm: DELETE_CONFIRM } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response;
      const body = await res.json().catch(() => null);
      throw new DeleteAccountError(deleteAccountCode(body?.error?.code, res.status));
    }
    throw new DeleteAccountError('network');
  }

  await forgetAccountOnThisDevice(userId);
}

/** What this phone kept for the account (the phone's own settings, such as the theme, stay). */
export async function forgetAccountOnThisDevice(userId: string): Promise<void> {
  await Promise.all([
    deleteAllSlipCopies(userId).catch(() => {}),
    forgetScanned(userId),
    forgetNames(userId),
    forgetWardrobe(userId),
    forgetBadges(userId),
    forgetScanPrefsFor(userId).catch(() => {}),
    clearWidget().catch(() => {}),
  ]);
}
