/**
 * TC-35..TC-37, TC-56: automatic scan on app open, the auto-confirm rule, and
 * photos that could not be read.
 */
import { describe, expect, it } from 'vitest';
import { autoScanSince, MIN_INTERVAL_MS, nextAutoScanMark, shouldAutoScan } from '../autoScan';
import { initialStatus } from '../slip';

const NOW = Date.parse('2026-09-27T11:00:00Z');

describe('FR-4 automatic scan', () => {
  it('TC-35 reads only slips saved today (from 00:00 Bangkok time): on the install day and every day after', () => {
    // NOW is 18:00 on 27 Sep in Bangkok: the window starts at 00:00 that day.
    const startOf27 = Date.parse('2026-09-26T17:00:00Z');
    expect(autoScanSince(NOW)).toBe(startOf27);
    // Last minute of the day: still the same day.
    expect(autoScanSince(Date.parse('2026-09-27T16:59:59Z'))).toBe(startOf27);
    // Five minutes after midnight: only the new day (28 Sep), yesterday's slips are not read.
    const startOf28 = Date.parse('2026-09-27T17:00:00Z');
    expect(autoScanSince(startOf28 + 5 * 60_000)).toBe(startOf28);
    const lastNightSlip = startOf28 - 10 * 60_000; // saved 23:50 on 27 Sep
    expect(lastNightSlip < autoScanSince(startOf28 + 5 * 60_000)).toBe(true);
    // It does not depend on when the app scanned before (a week away still means today only).
    expect(autoScanSince(NOW + 7 * 24 * 3600_000)).toBe(startOf27 + 7 * 24 * 3600_000);
  });

  it('TC-36 does not rescan when the app is reopened within 5 minutes, or when switched off', () => {
    expect(shouldAutoScan({ enabled: true, lastAutoScanAt: NOW - 60_000, nowMs: NOW, alreadyRunning: false })).toBe(false);
    expect(shouldAutoScan({ enabled: true, lastAutoScanAt: NOW - MIN_INTERVAL_MS, nowMs: NOW, alreadyRunning: false })).toBe(true);
    expect(shouldAutoScan({ enabled: false, lastAutoScanAt: 0, nowMs: NOW, alreadyRunning: false })).toBe(false);
    expect(shouldAutoScan({ enabled: true, lastAutoScanAt: 0, nowMs: NOW, alreadyRunning: true })).toBe(false);
  });

  it('TC-37 only slips read with ≥80% confidence on every field count right away', () => {
    expect(initialStatus('ready', true)).toBe('confirmed');
    expect(initialStatus('needs_review', true)).toBe('draft');
    expect(initialStatus('ready', false)).toBe('draft');
  });

  it('TC-56 a photo that could not be read is tried again on the next opening the same day', () => {
    expect(nextAutoScanMark(NOW, null)).toBe(NOW);
    const photo = NOW - 3 * 3600_000; // 15:00 Bangkok, same day
    const mark = nextAutoScanMark(NOW, photo);
    // The next run (10 minutes later) still looks at that photo...
    expect(autoScanSince(NOW + 10 * 60_000)).toBeLessThanOrEqual(photo);
    // ...and the next opening of the app scans again instead of waiting 5 minutes from this run.
    expect(shouldAutoScan({ enabled: true, lastAutoScanAt: mark, nowMs: NOW + 1000, alreadyRunning: false })).toBe(true);
    // A photo taken after the run started never pushes the mark forward.
    expect(nextAutoScanMark(NOW, NOW + 5000)).toBe(NOW);
  });
});
