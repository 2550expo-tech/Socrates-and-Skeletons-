/**
 * TC-35..TC-37: automatic scan on app open, and the auto-confirm rule.
 */
import { describe, expect, it } from 'vitest';
import { autoScanSince, MIN_INTERVAL_MS, shouldAutoScan } from '../autoScan';
import { DAY_MS } from '../dates';
import { initialStatus } from '../slip';

const NOW = Date.parse('2026-09-27T11:00:00Z');

describe('FR-4 automatic scan', () => {
  it('TC-35 looks back 30 days the first time, then from the last run (with 1 hour overlap), at most 30 days', () => {
    expect(autoScanSince(0, NOW)).toBe(NOW - 30 * DAY_MS);
    const last = NOW - 2 * DAY_MS;
    expect(autoScanSince(last, NOW)).toBe(last - 60 * 60 * 1000);
    expect(autoScanSince(NOW - 90 * DAY_MS, NOW)).toBe(NOW - 30 * DAY_MS);
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
});
