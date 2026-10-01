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

/** Stored form: the switches belong to this phone, the scan window to each account on it. */
type Stored = Omit<ScanPrefs, 'lastAutoScanAt'> & { lastAutoScanBy?: Record<string, number> };

async function loadStored(): Promise<Stored> {
  try {
    const raw = await Storage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Stored>) : {};
    const { autoScan, autoConfirm, askedGalleryOnce } = { ...DEFAULT_SCAN_PREFS, ...parsed };
    return { autoScan, autoConfirm, askedGalleryOnce, lastAutoScanBy: parsed.lastAutoScanBy ?? {} };
  } catch {
    return { ...DEFAULT_SCAN_PREFS, lastAutoScanBy: {} };
  }
}

/** This phone's scan settings, with the scan window of `userId` (another account starts with its own). */
export async function loadScanPrefs(userId?: string | null): Promise<ScanPrefs> {
  const s = await loadStored();
  return { autoScan: s.autoScan, autoConfirm: s.autoConfirm, askedGalleryOnce: s.askedGalleryOnce, lastAutoScanAt: (userId && s.lastAutoScanBy?.[userId]) || 0 };
}

export async function saveScanPrefs(patch: Partial<ScanPrefs>, userId?: string | null): Promise<ScanPrefs> {
  const s = await loadStored();
  const { lastAutoScanAt, ...rest } = patch;
  const next: Stored = { ...s, ...rest };
  if (lastAutoScanAt !== undefined && userId) next.lastAutoScanBy = { ...s.lastAutoScanBy, [userId]: lastAutoScanAt };
  await Storage.setItem(KEY, JSON.stringify(next));
  return loadScanPrefs(userId);
}
