/**
 * FR-4 automatic scan when the app opens: which photos to look at.
 * Pure rules, unit-tested in __tests__/autoScan.test.ts.
 *
 * The automatic scan reads only slips saved TODAY (Bangkok time). On the day
 * the app is installed it reads that day's slips, and every later run again
 * reads only the day it runs, so older slips are never pulled in by
 * themselves. The scan screen ("สแกนสลิป") still finds older slips on request.
 */
import { bkkDayKey, bkkDayStart } from './dates';

/** A run that must try a photo again saves a mark this much after that photo (see nextAutoScanMark). */
export const OVERLAP_MS = 60 * 60 * 1000;
/** Opening the app repeatedly within this time does not start another scan. */
export const MIN_INTERVAL_MS = 5 * 60 * 1000;
/** At most this many photos per run (only QR slips are sent to be read); the rest are picked up next time. */
export const MAX_IMAGES_PER_RUN = 150;

/** A photo the automatic scan could not read is tried this many times in all, then left for the scan screen. */
export const MAX_AUTO_ATTEMPTS = 2;

/**
 * The time to save as "last automatic scan": normally when this run started,
 * but earlier when a photo has to be tried again, so the next opening of the
 * app scans again right away instead of waiting MIN_INTERVAL_MS.
 */
export function nextAutoScanMark(startedAt: number, retryFromCreatedAt: number | null): number {
  if (retryFromCreatedAt === null) return startedAt;
  return Math.min(startedAt, retryFromCreatedAt + OVERLAP_MS - 1);
}

/** The automatic scan looks at photos saved from 00:00 today, Bangkok time. */
export function autoScanSince(nowMs: number): number {
  return bkkDayStart(bkkDayKey(nowMs)).getTime();
}

export function shouldAutoScan(params: {
  enabled: boolean;
  lastAutoScanAt: number;
  nowMs: number;
  alreadyRunning: boolean;
}): boolean {
  if (!params.enabled || params.alreadyRunning) return false;
  return params.nowMs - params.lastAutoScanAt >= MIN_INTERVAL_MS;
}
