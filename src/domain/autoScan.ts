/**
 * FR-4 automatic scan when the app opens: which photos to look at.
 * Pure rules, unit-tested in __tests__/autoScan.test.ts.
 */
import { DAY_MS } from './dates';

/** First run looks back 30 days (like MeowJot), later runs start from the last run. */
export const FIRST_RUN_DAYS = 30;
/** Never look back more than 30 days automatically (older slips: use the scan screen). */
export const MAX_LOOKBACK_DAYS = 30;
/** Photos saved just before the last run are checked again, in case the gallery was still syncing. */
export const OVERLAP_MS = 60 * 60 * 1000;
/** Opening the app repeatedly within this time does not start another scan. */
export const MIN_INTERVAL_MS = 5 * 60 * 1000;
/** At most this many photos per run (only QR slips are sent to be read); the rest are picked up next time. */
export const MAX_IMAGES_PER_RUN = 150;

/** A photo the automatic scan could not read is tried this many times in all, then left for the scan screen. */
export const MAX_AUTO_ATTEMPTS = 2;

/**
 * The time to save as "last automatic scan": normally when this run started,
 * but early enough that the oldest photo to try again stays inside the next
 * run's window (see autoScanSince).
 */
export function nextAutoScanMark(startedAt: number, retryFromCreatedAt: number | null): number {
  if (retryFromCreatedAt === null) return startedAt;
  return Math.min(startedAt, retryFromCreatedAt + OVERLAP_MS - 1);
}

export function autoScanSince(lastAutoScanAt: number, nowMs: number): number {
  const floor = nowMs - MAX_LOOKBACK_DAYS * DAY_MS;
  if (!lastAutoScanAt) return nowMs - FIRST_RUN_DAYS * DAY_MS;
  return Math.max(floor, lastAutoScanAt - OVERLAP_MS);
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
