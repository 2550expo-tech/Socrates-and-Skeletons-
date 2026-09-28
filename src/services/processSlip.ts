/**
 * FR-4: process ONE image into a transaction. Shared by the manual scan screen
 * and the automatic scan that runs when the app opens.
 *
 *   QR check (phone, free) -> shrink + hash -> slip reader -> rules -> save
 */
import { bkkToIso } from '../domain/dates';
import {
  addToIndex,
  classifyCandidate,
  initialStatus,
  normalizeReading,
  type DuplicateIndex,
} from '../domain/slip';
import type { ItemStatus } from '../domain/scanQueue';
import type { Transaction } from '../domain/types';
import { DuplicateSlipError, type Repo } from '../data/repo';
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
  repo: Repo;
  autoConfirm: boolean;
  /** Used as the transaction time when the slip date could not be read. */
  fallbackTimeMs: number;
  /** Called when the AI is busy and the reader waits before trying again. */
  onWait?: (seconds: number) => void;
}): Promise<ProcessResult> {
  const { qr, scannerWorks } = await detectSlipQr(opts.uri, { width: opts.width, height: opts.height });
  if (!qr && opts.requireQr) {
    // Without a working scanner every photo would look like "not a slip": say so instead.
    if (!scannerWorks) throw new SlipReaderError('qr_unavailable', READER_MESSAGES.qr_unavailable);
    return { status: 'not_slip', message: 'ไม่พบ QR ของสลิป' };
  }

  const prepared = await prepareImage(opts.uri, opts.width);
  if (opts.index.hashes.has(prepared.hash)) return { status: 'duplicate', message: 'รูปนี้เคยบันทึกแล้ว' };

  const reading = await readSlip(prepared.base64, opts.onWait);
  if (!reading.isSlip) return { status: 'not_slip', message: 'ไม่ใช่สลิปโอนเงิน' };

  const c = normalizeReading(reading, { qr, imageHash: prepared.hash });
  const outcome = classifyCandidate(c, { range: opts.range, index: opts.index });
  const label = c.counterparty ?? 'รายการจากสลิป';
  if (outcome === 'duplicate') return { status: 'duplicate', amountSatang: c.amountSatang, label, message: 'มีรายการนี้แล้ว' };
  if (outcome === 'out_of_range') return { status: 'out_of_range', amountSatang: c.amountSatang, label, message: 'วันที่บนสลิปเก่ากว่า 1 ปี จึงไม่บันทึกอัตโนมัติ' };
  if (c.amountSatang === null) return { status: 'failed', label, message: 'อ่านยอดเงินไม่ได้ ลองจดรายการนี้เอง' };

  const status = initialStatus(outcome, opts.autoConfirm);
  try {
    const tx = await opts.repo.insert({
      kind: c.kind,
      amountSatang: c.amountSatang,
      categoryKey: c.categoryKey,
      title: label,
      note: c.bank ? `สลิปจาก ${c.bank}` : null,
      occurredAt: c.dayKey ? bkkToIso(c.dayKey, c.time) : new Date(opts.fallbackTimeMs).toISOString(),
      source: 'slip',
      status,
      slipRef: c.ref,
      slipImageHash: c.imageHash,
      ocrConfidence: Math.round(c.confidence * 100) / 100,
      reviewFlags: c.flags,
    });
    addToIndex(opts.index, tx);
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
    throw e;
  }
}
