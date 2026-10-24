// MyPay: delete the signed-in account and everything in it (PDPA: the right to have
// one's data erased). The account comes from the caller's session token, never from
// the request, so only one's own account can be deleted. Two more checks:
// - the body must carry the confirmation word (DELETE_CONFIRM), and
// - the person must have signed in within the last 10 minutes: the app asks for the
//   password again right before, so a phone left signed in, or an old token, is not enough.
// MyPay and MindPay share accounts: this deletes the data both apps show.
import { corsHeaders, deleteUser, fail, json, requireUser } from '../_shared/common.ts';
import { isDeleteConfirmed, jwtPayload, signedInWithin } from '../_shared/helpers.ts';

const RECENT_SIGN_IN_SEC = 10 * 60;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('method_not_allowed', 'Use POST', 405);

  const userId = await requireUser(req);
  if (!userId) return fail('unauthorized', 'Sign in again', 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('bad_request', 'Body must be JSON', 400);
  }
  if (!isDeleteConfirmed(body)) return fail('not_confirmed', 'The confirmation is missing', 400);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!signedInWithin(jwtPayload(token), Math.floor(Date.now() / 1000), RECENT_SIGN_IN_SEC)) {
    return fail('reauth', 'Enter the password again first', 403);
  }

  try {
    await deleteUser(userId);
    // No personal data in the log: only that a deletion happened.
    console.log(JSON.stringify({ account: 'deleted' }));
    return json({ deleted: true });
  } catch (e) {
    console.error('delete-account failed', e instanceof Error ? e.message : String(e));
    return fail('delete_failed', 'The account could not be deleted, try again', 502);
  }
});
