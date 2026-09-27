/**
 * Core data types for MindPay.
 *
 * Money is always stored as an integer number of satang (1 baht = 100 satang)
 * so that adding many amounts never produces floating-point errors
 * (0.1 + 0.2 !== 0.3 in JavaScript).
 */

export type TxKind = 'income' | 'expense';

/** draft = not counted in any total until the user confirms it (Charter: slip results stay drafts). */
export type TxStatus = 'draft' | 'confirmed';

export type TxSource = 'manual' | 'slip';

export interface Transaction {
  id: string;
  kind: TxKind;
  amountSatang: number;
  categoryKey: string;
  title: string;
  note: string | null;
  /** ISO 8601 instant, e.g. "2026-09-27T01:15:00.000Z" */
  occurredAt: string;
  source: TxSource;
  status: TxStatus;
  /** Transaction reference read from the slip (QR or text). Used for duplicate detection. */
  slipRef: string | null;
  /** SHA-256 of the processed slip image. Second line of duplicate detection. */
  slipImageHash: string | null;
  /** Lowest field confidence (0..1) reported by the slip reader, null for manual entries. */
  ocrConfidence: number | null;
  /** Fields the slip reader was unsure about, shown to the user during review. */
  reviewFlags: string[];
  createdAt: string;
}

/** Everything the user can type or change in the form. */
export type TransactionInput = Omit<Transaction, 'id' | 'createdAt'>;

export type CoachTone = 'friend' | 'coach' | 'senior';

export interface Profile {
  id: string;
  displayName: string;
  /** Money the user had when they started using MindPay. Balance = opening + income − expense. */
  openingBalanceSatang: number;
  /** FR-6: the "low" line. Runway counts the days until balance would reach this amount. */
  runwayFloorSatang: number;
  monthlyBudgetSatang: number | null;
  coachTone: CoachTone;
  onboarded: boolean;
}

export type RangeKey = 'today' | '7d' | '1m' | '6m' | '1y';
