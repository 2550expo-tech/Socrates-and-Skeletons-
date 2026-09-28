/**
 * The user's own name(s) as printed on slips, learned on this phone per
 * account (see domain/slipNames.ts). Only fingerprints are stored.
 */
import { Storage } from '../data/storage';
import { addPayer, EMPTY_NAME_STATS, type NameStats } from '../domain/slipNames';

const key = (userId: string) => `mindpay.slipNames.${userId}`;
const cache = new Map<string, NameStats>();

export async function loadNames(userId: string): Promise<NameStats> {
  const hit = cache.get(userId);
  if (hit) return hit;
  let stats = EMPTY_NAME_STATS;
  try {
    const raw = await Storage.getItem(key(userId));
    const parsed = raw ? (JSON.parse(raw) as Partial<NameStats>) : null;
    if (parsed && typeof parsed.total === 'number' && parsed.counts && typeof parsed.counts === 'object') {
      stats = { counts: parsed.counts, total: parsed.total };
    }
  } catch {
    // Start learning again.
  }
  cache.set(userId, stats);
  return stats;
}

/** Count the payer of a slip that looks like the user's own payment. */
export async function learnPayer(userId: string, payer: string | null | undefined) {
  const next = addPayer(await loadNames(userId), payer);
  cache.set(userId, next);
  try {
    await Storage.setItem(key(userId), JSON.stringify(next));
  } catch {
    // Not critical: the name is learned again from the next slips.
  }
}

export async function forgetNames(userId: string) {
  cache.delete(userId);
  await Storage.removeItem(key(userId)).catch(() => {});
}
