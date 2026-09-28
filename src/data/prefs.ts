/**
 * Per-device preferences for slip scanning. Kept on the phone (not in the
 * database) because they describe how THIS phone's gallery is handled.
 */
import { Storage } from './storage';

export interface ScanPrefs {
  /** Check the gallery for new slips every time the app opens. */
  autoScan: boolean;
  /** Slips read with ≥ 80% confidence on every field count in the balance right away. */
  autoConfirm: boolean;
  /** When the last automatic scan started (ms). 0 = never. */
  lastAutoScanAt: number;
  /** The phone's photo permission was asked for once by itself (the first time the app opened). */
  askedGalleryOnce: boolean;
}

const KEY = 'mindpay.scanPrefs.v1';
export const DEFAULT_SCAN_PREFS: ScanPrefs = { autoScan: true, autoConfirm: true, lastAutoScanAt: 0, askedGalleryOnce: false };

export async function loadScanPrefs(): Promise<ScanPrefs> {
  try {
    const raw = await Storage.getItem(KEY);
    return raw ? { ...DEFAULT_SCAN_PREFS, ...(JSON.parse(raw) as Partial<ScanPrefs>) } : DEFAULT_SCAN_PREFS;
  } catch {
    return DEFAULT_SCAN_PREFS;
  }
}

export async function saveScanPrefs(patch: Partial<ScanPrefs>): Promise<ScanPrefs> {
  const next = { ...(await loadScanPrefs()), ...patch };
  await Storage.setItem(KEY, JSON.stringify(next));
  return next;
}
