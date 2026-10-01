/**
 * Who is "me" on a slip. A slip only shows a payer and a receiver; whether it
 * is the user's expense or income depends on which of the two is the user. A
 * slip a friend sent over LINE ("I paid you") looks exactly like the user's own
 * payment slip, so the AI alone would call it an expense.
 *
 * The phone learns the user's own name(s) from the payer line of the slips in
 * the gallery (most saved slips are the user's own payments; Thai, English and
 * masked spellings are learned separately). Only short fingerprints of the
 * names are kept, on this phone. Unit tests: __tests__/slipNames.test.ts.
 */
import type { TxKind } from './types';

export interface NameStats {
  /** Fingerprint of a payer name -> how many slips showed it as the payer. */
  counts: Record<string, number>;
  /** Slips whose payer was counted. */
  total: number;
}

export const EMPTY_NAME_STATS: NameStats = { counts: {}, total: 0 };

/** A name seen as payer at least this often, and on this share of slips, is the user. */
export const MINE_MIN_SLIPS = 2;
export const MINE_MIN_SHARE = 0.2;
const KEEP_NAMES = 30;

const TITLES = /^(?:นางสาว|นาง|นาย|น\.ส\.|ด\.ช\.|ด\.ญ\.|คุณ|mrs\.?|mr\.?|ms\.?|miss)\s*/i;

/** 32-bit FNV-1a, so names themselves are never stored. */
function fingerprint(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * First name plus the first letter of the last name, without title or masking:
 * "นาย สมชาย ใจดี", "สมชาย ใ***" and "น.ส. สมชาย ใจดี" give the same key;
 * "MR. SOMCHAI JAIDEE" and "SOMCHAI J" give another. Null when there is no name.
 */
export function nameKey(name: string | null | undefined): string | null {
  const words = (name ?? '')
    .trim()
    .replace(TITLES, '')
    .toLowerCase()
    .replace(/[*•·_]+|x{2,}/g, ' ')
    .replace(/\./g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return null;
  const first = words[0];
  if (first.length < 2) return null;
  return fingerprint(`${first}|${words[1]?.[0] ?? ''}`);
}

/** Count one slip's payer (only slips that look like the user's own payments are counted). */
export function addPayer(stats: NameStats, payer: string | null | undefined): NameStats {
  const key = nameKey(payer);
  if (!key) return stats;
  const counts = { ...stats.counts, [key]: (stats.counts[key] ?? 0) + 1 };
  // Keep the most frequent names, but never drop the one just counted: otherwise, once the table
  // is full, a new name (the user's own on a new phone) would be cut straight away every time.
  const others = Object.entries(counts)
    .filter(([k]) => k !== key)
    .sort((a, b) => b[1] - a[1])
    .slice(0, KEEP_NAMES - 1);
  return { counts: Object.fromEntries([[key, counts[key]], ...others]), total: stats.total + 1 };
}

export function isMine(stats: NameStats, name: string | null | undefined): boolean {
  const key = nameKey(name);
  if (!key) return false;
  const n = stats.counts[key] ?? 0;
  return n >= MINE_MIN_SLIPS && n / Math.max(stats.total, 1) >= MINE_MIN_SHARE;
}

export interface Direction {
  kind: TxKind;
  /** The other party: the receiver of an expense, the sender of income. */
  counterparty: string | null;
  /** Both sides are the user: money moved between the user's own accounts. */
  ownTransfer: boolean;
  /** The names contradict the AI's reading: the user should check income/expense. */
  unsure: boolean;
}

/**
 * Income or expense, from the names on the slip when the user's name is known,
 * otherwise from the AI's reading ("ได้รับเงิน" screens are income).
 */
export function decideDirection(
  reading: { direction: 'expense' | 'income' | 'unknown'; fromName?: string | null; toName?: string | null; counterparty: string | null },
  stats: NameStats,
): Direction {
  const fromMine = isMine(stats, reading.fromName);
  const toMine = isMine(stats, reading.toName);
  const aiKind: TxKind = reading.direction === 'income' ? 'income' : 'expense';
  if (fromMine && toMine) {
    return { kind: aiKind, counterparty: reading.toName ?? reading.counterparty, ownTransfer: true, unsure: true };
  }
  if (toMine) {
    // The user received this money, e.g. a slip a friend sent: income, from the payer.
    return { kind: 'income', counterparty: reading.fromName ?? reading.counterparty, ownTransfer: false, unsure: false };
  }
  if (fromMine) {
    // The user paid. A "money received" reading contradicts that, so ask.
    return {
      kind: 'expense',
      counterparty: reading.toName ?? reading.counterparty,
      ownTransfer: false,
      unsure: reading.direction === 'income',
    };
  }
  return { kind: aiKind, counterparty: reading.counterparty, ownTransfer: false, unsure: reading.direction === 'unknown' };
}
