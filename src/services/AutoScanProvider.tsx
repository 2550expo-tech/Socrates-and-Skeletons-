/**
 * FR-4 automatic scan: when the app opens (and each time it comes back to the
 * foreground, at most every 5 minutes), look for NEW slips in the gallery,
 * read them, and update the balance right away.
 *
 * - Only photos with a Thai slip QR code are read (cost + privacy).
 * - Slips read with ≥ 80% confidence on every field count immediately when
 *   auto-confirm is on; unsure ones wait in "สลิปรอยืนยัน".
 * - Never shows the permission prompt by itself: if access is missing, the home
 *   screen offers a button instead.
 * - Nothing is skipped for good by accident: when the phone is offline or the AI
 *   is unavailable the run stops without moving its window forward, and a photo
 *   that could not be read is tried again next run (MAX_AUTO_ATTEMPTS in all).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { autoScanSince, MAX_AUTO_ATTEMPTS, MAX_IMAGES_PER_RUN, nextAutoScanMark, shouldAutoScan } from '../domain/autoScan';
import { rangeDays } from '../domain/dates';
import { buildDuplicateIndex } from '../domain/slip';
import type { Transaction } from '../domain/types';
import { useApp } from '../data/AppProvider';
import { DEFAULT_SCAN_PREFS, loadScanPrefs, saveScanPrefs, type ScanPrefs } from '../data/prefs';
import { processSlipImage } from './processSlip';
import {
  findGalleryImages,
  galleryAvailable,
  galleryUri,
  getGalleryAccess,
  loadScanFailures,
  loadScannedIds,
  rememberScanned,
  saveScanFailures,
  requestGalleryAccess,
  SlipReaderError,
} from './slips';

/** Wait before trying a photo again after a network error. */
const NETWORK_RETRY_MS = 3000;
/** The automatic scan starts this long after the app is ready (the opening animation takes about 1.8 s). */
const START_DELAY_MS = 1800;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type AutoScanPhase = 'idle' | 'needs_permission' | 'scanning' | 'done' | 'error';

export interface AutoScanState {
  phase: AutoScanPhase;
  total: number;
  processed: number;
  /** Transactions counted in the balance by this run. */
  confirmed: Transaction[];
  /** Slips saved as drafts (need a check) by this run. */
  drafts: number;
  message: string | null;
  /** While the AI is rate-limited: when the reader tries again (ms). */
  waitUntil: number | null;
}

interface AutoScanContextValue {
  state: AutoScanState;
  prefs: ScanPrefs;
  available: boolean;
  setPrefs(patch: Partial<Omit<ScanPrefs, 'lastAutoScanAt'>>): Promise<void>;
  grantAndRun(): Promise<void>;
  runNow(): Promise<void>;
  /** Move this run's auto-counted slips back to "รอยืนยัน". */
  undoLast(): Promise<void>;
  dismiss(): void;
}

const IDLE: AutoScanState = { phase: 'idle', total: 0, processed: 0, confirmed: [], drafts: 0, message: null, waitUntil: null };
const AutoScanContext = createContext<AutoScanContextValue | null>(null);

export function useAutoScan() {
  const ctx = useContext(AutoScanContext);
  if (!ctx) throw new Error('useAutoScan must be used inside AutoScanProvider');
  return ctx;
}

export function AutoScanProvider({ children }: { children: ReactNode }) {
  const { status, repo, userId, txs, upsertLocal, updateTx, profile } = useApp();
  // Only once the user is in the app (not during sign-up or money setup).
  const inApp = status === 'ready' && !!profile?.onboarded;
  const [state, setState] = useState<AutoScanState>(IDLE);
  const [prefs, setPrefsState] = useState<ScanPrefs>(DEFAULT_SCAN_PREFS);
  const running = useRef(false);
  const txsRef = useRef(txs);
  useEffect(() => {
    txsRef.current = txs;
  }, [txs]);

  const available = galleryAvailable && repo?.mode === 'cloud';

  const run = useCallback(
    async (p: ScanPrefs) => {
      if (!repo || !userId || running.current) return;
      running.current = true;
      const startedAt = Date.now();
      setState({ ...IDLE, phase: 'scanning' });
      const confirmed: Transaction[] = [];
      let drafts = 0;
      let processed = 0;
      let stoppedBy: string | null = null;
      try {
        const [images, scanned, failures] = await Promise.all([
          findGalleryImages(autoScanSince(p.lastAutoScanAt, startedAt), 500),
          loadScannedIds(userId),
          loadScanFailures(userId),
        ]);
        // Photos that failed MAX_AUTO_ATTEMPTS times are left for the scan screen.
        const fresh = images.filter((i) => !scanned.has(i.assetId) && (failures[i.assetId] ?? 0) < MAX_AUTO_ATTEMPTS);
        const batch = fresh.slice(0, MAX_IMAGES_PER_RUN);
        setState((s) => ({ ...s, total: batch.length }));
        const index = buildDuplicateIndex(txsRef.current);
        const range = rangeDays('1y');
        /** Oldest photo to try again next run (it must stay inside the next run's window). */
        let retryFrom: number | null = null;

        for (const img of batch) {
          for (let attempt = 0; ; attempt++) {
            try {
              const r = await processSlipImage({
                uri: await galleryUri(img.assetId),
                width: img.width,
                height: img.height,
                requireQr: true,
                range,
                index,
                repo,
                autoConfirm: p.autoConfirm,
                fallbackTimeMs: img.createdAt,
                onWait: (seconds) => setState((s) => ({ ...s, waitUntil: Date.now() + seconds * 1000 })),
              });
              if (r.tx) {
                upsertLocal(r.tx);
                if (r.confirmed) confirmed.push(r.tx);
                else drafts += 1;
              }
              scanned.add(img.assetId);
              delete failures[img.assetId];
            } catch (e) {
              const code = e instanceof SlipReaderError ? e.code : null;
              if (code === 'network' && attempt === 0) {
                await sleep(NETWORK_RETRY_MS); // a short drop in the connection: try this photo once more
                continue;
              }
              if (code === 'network') {
                // Offline: stop without moving the window, so nothing found this time is skipped.
                stoppedBy = 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ สลิปที่เหลือจะอ่านต่อตอนเปิดแอปครั้งหน้า';
              } else if (code && code !== 'reader_error' && code !== 'too_large') {
                stoppedBy = (e as Error).message; // affects every photo (not configured, AI busy, quota, signed out)
              } else {
                // This photo could not be read: try it again next run, up to MAX_AUTO_ATTEMPTS times.
                failures[img.assetId] = (failures[img.assetId] ?? 0) + 1;
                if (failures[img.assetId] < MAX_AUTO_ATTEMPTS) retryFrom = Math.min(retryFrom ?? img.createdAt, img.createdAt);
              }
            }
            break;
          }
          if (stoppedBy) break;
          processed += 1;
          setState((s) => ({ ...s, processed, confirmed: [...confirmed], drafts, waitUntil: null }));
        }

        await rememberScanned(userId, scanned);
        await saveScanFailures(userId, failures);
        // Move the window forward only when everything in it was handled.
        if (!stoppedBy && fresh.length <= MAX_IMAGES_PER_RUN) {
          setPrefsState(await saveScanPrefs({ lastAutoScanAt: nextAutoScanMark(startedAt, retryFrom) }));
        }
        // Keep what was recorded before stopping, so the banner can still say so.
        if (stoppedBy) setState({ ...IDLE, phase: 'error', message: stoppedBy, total: batch.length, processed, confirmed, drafts });
        else if (confirmed.length + drafts > 0) setState({ ...IDLE, phase: 'done', total: batch.length, processed, confirmed, drafts });
        else setState(IDLE); // nothing new: stay quiet
      } catch {
        setState({ ...IDLE, phase: 'error', message: 'ตรวจแกลเลอรีอัตโนมัติไม่สำเร็จ ลองใหม่ได้ที่ปุ่มสแกนสลิป' });
      } finally {
        running.current = false;
      }
    },
    [repo, userId, upsertLocal],
  );

  const maybeRun = useCallback(async () => {
    if (!available || running.current) return;
    let p = await loadScanPrefs();
    setPrefsState(p);
    if (!shouldAutoScan({ enabled: p.autoScan, lastAutoScanAt: p.lastAutoScanAt, nowMs: Date.now(), alreadyRunning: running.current })) return;
    let access = await getGalleryAccess().catch(() => 'denied' as const);
    if (access === 'denied' && !p.askedGalleryOnce) {
      // First time the app opens: ask for the photos right away (the phone shows its own
      // permission dialog once), so scanning needs no tap at all from then on.
      p = await saveScanPrefs({ askedGalleryOnce: true });
      setPrefsState(p);
      access = await requestGalleryAccess().catch(() => 'denied' as const);
    }
    if (access === 'denied' || access === 'blocked') {
      setState({ ...IDLE, phase: 'needs_permission' });
      return;
    }
    await run(p);
  }, [available, run]);

  // On open (once the user is in the app) and whenever the app returns to the foreground.
  useEffect(() => {
    if (!inApp || !available) return;
    // Start once the opening animation has finished and the first screen is on show,
    // so opening the app stays instant (and the one-time photo prompt comes after it).
    const first = setTimeout(() => {
      maybeRun();
    }, START_DELAY_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') maybeRun();
    });
    return () => {
      clearTimeout(first);
      sub.remove();
    };
  }, [inApp, available, maybeRun]);

  const value = useMemo<AutoScanContextValue>(
    () => ({
      state,
      prefs,
      available,
      async setPrefs(patch) {
        setPrefsState(await saveScanPrefs(patch));
      },
      async grantAndRun() {
        const a = await requestGalleryAccess();
        if (a === 'denied' || a === 'blocked') {
          setState({ ...IDLE, phase: 'needs_permission', message: 'ยังไม่ได้รับสิทธิ์เข้าถึงรูปภาพ เปิดได้ในการตั้งค่าของมือถือ' });
          return;
        }
        await run(await loadScanPrefs());
      },
      async runNow() {
        await run(await loadScanPrefs());
      },
      async undoLast() {
        const ids = state.confirmed.map((t) => t.id);
        for (const id of ids) await updateTx(id, { status: 'draft' });
        setState(IDLE);
      },
      dismiss() {
        setState(IDLE);
      },
    }),
    [state, prefs, available, run, updateTx],
  );

  return <AutoScanContext.Provider value={value}>{children}</AutoScanContext.Provider>;
}
