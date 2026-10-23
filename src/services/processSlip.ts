/**
 * FR-4: process ONE image into a transaction. Shared by the manual scan screen
 * and the automatic scan that runs when the app opens.
 *
 *   consent? -> QR check (phone, free) -> shrink + hash -> slip reader -> rules -> save
 *   -> a copy of the picture kept on this phone only (slipCopies.ts)
 */
import { bkkToIso } from '../domain/dates';
import {
  addToIndex,
  classifyCandidate,
  initialStatus,
  isScreenSized,
  normalizeReading,
  slipNote,
  type DuplicateIndex,
} from '../domain/slip';
import { EMPTY_NAME_STATS } from '../domain/slipNames';
import type { ItemStatus } from '../domain/scanQueue';
import type { Transaction } from '../domain/types';
import { maySendSlips } from '../domain/consent';
import { loadScanPrefs } from '../data/prefs';
import { DuplicateSlipError, type Repo } from '../data/repo';
import { learnPayer, loadNames } from './myNames';
import { saveSlipCopy } from './slipCopies';
import { detectSlipQr, prepareImage, READER_MESSAGES, readSlip, SlipReaderError } from './slips';

export interface ProcessResult {
  status: Exclude<ItemStatus, 'queued' | 'working'>;
  tx?: Transaction;
  amountSatang?: number | null;
  label?: string | null;
  message?: string;
  confirmed?: boolean;
}

export async function processSlipImage(opts: {
  uri: string;
  width?: number | null;
  height?: number | null;
  /** Skip images without a Thai slip QR code (saves cost; photos never leave the phone). */
  requireQr: boolean;
  range: { from: string; to: string };
  index: DuplicateIndex;
  /** Checked right before saving: false when the account changed meanwhile (nothing is saved then). */
  stillValid?: () => boolean;
  repo: Repo;
  autoConfirm: boolean;
  /** Used as the transaction time when the slip date could not be read. */
  fallbackTimeMs: number;
  /** Called when the AI is busy and the reader waits before trying again. */
  onWait?: (seconds: number) => void;
  /** The signed-in account: its own name on slips is learned to tell income from expense. */
  userId?: string | null;
}): Promise<ProcessResult> {
  // PDPA: no photo leaves the phone for the AI without this account's consent (domain/consent.ts).
  // Checked here, the one path both the scan screen and the automatic scan go through.
  const { aiConsent } = await loadScanPrefs(opts.userId);
  if (!opts.userId || !maySendSlips(aiConsent)) throw new SlipReaderError('no_consent', READER_MESSAGES.no_consent);

  const size = { width: opts.width, height: opts.height };
  const { qr, scannerWorks, otherQr } = await detectSlipQr(opts.uri, size);
  // E-wallet slips (TrueMoney, ShopeePay...) carry their own kind of QR: a screen-sized
  // picture with any QR code is read too, and the reader says whether it is a slip.
  if (!qr && opts.requireQr && !(otherQr && isScreenSized(size))) {
    // Without a working scanner every photo would look like "not a slip": say so instead.
    if (!scannerWorks) throw new SlipReaderError('qr_unavailable', READER_MESSAGES.qr_unavailable);
    return { status: 'not_slip', message: 'ไม่พบ QR ของสลิป' };
  }

  const prepared = await prepareImage(opts.uri, opts.width);
  if (opts.index.hashes.has(prepared.hash)) return { status: 'duplicate', message: 'รูปนี้เคยบันทึกแล้ว' };

  const { reading, check } = await readSlip(prepared.base64, opts.onWait);
  if (!reading.isSlip) return { status: 'not_slip', message: 'ไม่ใช่สลิปโอนเงิน' };

  const names = opts.userId ? await loadNames(opts.userId) : EMPTY_NAME_STATS;
  const c = normalizeReading(reading, { qr, imageHash: prepared.hash, names });
  // Most saved slips are the user's own payments: their payer line teaches the user's name.
  if (opts.userId && reading.direction === 'expense' && reading.fromName) await learnPayer(opts.userId, reading.fromName);
  const outcome = classifyCandidate(c, { range: opts.range, index: opts.index });
  const label = c.ownTransfer ? 'โอนระหว่างบัญชีตัวเอง' : (c.counterparty ?? 'รายการจากสลิป');
  if (outcome === 'duplicate') return { status: 'duplicate', amountSatang: c.amountSatang, label, message: 'มีรายการนี้แล้ว' };
  if (outcome === 'out_of_range') return { status: 'out_of_range', amountSatang: c.amountSatang, label, message: 'วันที่บนสลิปเก่ากว่า 1 ปี จึงไม่บันทึกอัตโนมัติ' };
  if (c.amountSatang === null) return { status: 'failed', label, message: 'อ่านยอดเงินไม่ได้ ลองจดรายการนี้เอง' };

  const status = initialStatus(outcome, opts.autoConfirm);
  if (opts.stillValid && !opts.stillValid()) throw new SlipReaderError('cancelled', 'หยุดอ่านสลิปแล้ว');
  try {
    const tx = await opts.repo.insert({
      kind: c.kind,
      amountSatang: c.amountSatang,
      categoryKey: c.categoryKey,
      title: label,
      note: slipNote(c, check),
      occurredAt: c.dayKey ? bkkToIso(c.dayKey, c.time) : new Date(opts.fallbackTimeMs).toISOString(),
      source: 'slip',
      status,
      slipRef: c.ref,
      slipImageHash: c.imageHash,
      ocrConfidence: Math.round(c.confidence * 100) / 100,
      reviewFlags: c.flags,
    });
    addToIndex(opts.index, tx);
    // A copy of the picture stays on this phone only, to look at with the item later (never on the MindPay server).
    if (opts.userId) await saveSlipCopy(opts.userId, prepared.hash, prepared.base64).catch(() => {});
    return {
      status: outcome,
      tx,
      amountSatang: c.amountSatang,
      label,
      confirmed: status === 'confirmed',
      message: status === 'confirmed' ? 'รวมในยอดเงินแล้ว' : undefined,
    };
  } catch (e) {
    if (e instanceof DuplicateSlipError) return { status: 'duplicate', amountSatang: c.amountSatang, label, message: 'มีรายการนี้แล้ว' };
    // Saving failed after the slip was read: not this photo's fault. As a reader error the whole
    // run pauses with the right message (and the photo is tried again later) instead of every
    // following photo using up another AI read and failing to save too.
    throw saveError(e);
  }
}

/** A failed save, as the error the scanners already handle for the whole run. */
function saveError(e: unknown): SlipReaderError {
  const err = (e ?? {}) as { status?: unknown; code?: unknown; message?: unknown; name?: unknown };
  const text = [err.name, err.message, err.code].filter((x) => typeof x === 'string').join(' ').toLowerCase();
  if (err.status === 401 || err.code === 'PGRST301' || /\bjwt\b|unauthori[sz]ed|row-level security/.test(text)) {
    return new SlipReaderError('unauthorized', READER_MESSAGES.unauthorized);
  }
  return new SlipReaderError('network', READER_MESSAGES.network);
}
