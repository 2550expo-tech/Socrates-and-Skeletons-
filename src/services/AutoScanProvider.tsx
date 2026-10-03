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
 *   Two unreadable photos in a row look like the reader being down: the run stops
 *   early (each still counts as one try). A photo that keeps stopping whole runs
 *   (busy or timed-out reader) is left for the scan screen after STALL_LIMIT runs,
 *   so one bad photo can never hold up the photos behind it.
 * - Each account has its own window, and a run stops (saving nothing more) when
 *   the account changes. It also waits while the scan screen is reading photos.
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
  scanLock,
  SlipReaderError,
} from './slips';

/** Wait before trying a photo again after a network error. */
const NETWORK_RETRY_MS = 3000;
/** The automatic scan starts this long after the app is ready (the opening animation takes about 1.8 s). */
const START_DELAY_MS = 1800;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const READER_DOWN = 'ระบบอ่านสลิปขัดข้องชั่วคราว สลิปที่เหลือจะอ่านต่อตอนเปิดแอปครั้งหน้า';
/** Runs one photo may stop (busy or timed-out reader) before the automatic scan leaves it for the scan screen. */
const STALL_LIMIT = 3;

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
  // The app's actions change on every data change; read them through refs so a new
  // transaction does not start the scan again.
  const upsertRef = useRef(upsertLocal);
  const updateTxRef = useRef(updateTx);
  useEffect(() => {
    txsRef.current = txs;
    upsertRef.current = upsertLocal;
    updateTxRef.current = updateTx;
  }, [txs, upsertLocal, updateTx]);
  /** Changes with the account: a run for another account stops and its results are not shown. */
  const runGen = useRef(0);
  // Another account: forget this card at once (adjusting state during render, no extra pass).
  const [stateUser, setStateUser] = useState(userId);
  if (stateUser !== userId) {
    setStateUser(userId);
    setState(IDLE);
  }
  useEffect(() => {
    runGen.current += 1;
    loadScanPrefs(userId)
      .then(setPrefsState)
      .catch(() => {});
  }, [userId]);

  const available = galleryAvailable && repo?.mode === 'cloud';

  const run = useCallback(
    async (p: ScanPrefs) => {
      if (!repo || !userId || running.current || scanLock.manual) return;
      running.current = true;
      const gen = runGen.current;
      const current = () => gen === runGen.current;
      const startedAt = Date.now();
      setState({ ...IDLE, phase: 'scanning' });
      const confirmed: Transaction[] = [];
      let drafts = 0;
      let processed = 0;
      let stoppedBy: string | null = null;
      /** Stopped quietly: the account changed or the scan screen took over. */
      let quiet = false;
      /** Unreadable photos in a row (reset by any photo read fine). */
      let unreadable: string[] = [];
      try {
        const [images, scanned, failures] = await Promise.all([
          findGalleryImages(autoScanSince(p.lastAutoScanAt, startedAt)),
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
          if (!current() || scanLock.manual) {
            quiet = true;
            break;
          }
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
                onWait: (seconds) => {
                  if (current()) setState((s) => ({ ...s, waitUntil: Date.now() + seconds * 1000 }));
                },
                userId,
                stillValid: current,
              });
              unreadable = [];
              delete failures[`stall:${img.assetId}`];
              // Saved for an account that is no longer open: do not show it in this one.
              if (r.tx && current()) {
                upsertRef.current(r.tx);
                if (r.confirmed) confirmed.push(r.tx);
                else drafts += 1;
              }
              scanned.add(img.assetId);
              delete failures[img.assetId];
            } catch (e) {
              const code = e instanceof SlipReaderError ? e.code : null;
              if (code === 'cancelled') {
                quiet = true;
                break;
              }
              if (code === 'network' && attempt === 0) {
                await sleep(NETWORK_RETRY_MS); // a short drop in the connection: try this photo once more
                continue;
              }
              if (code === 'network') {
                // Offline: stop without moving the window, so nothing found this time is skipped.
                stoppedBy = 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ สลิปที่เหลือจะอ่านต่อตอนเปิดแอปครั้งหน้า';
              } else if (code === 'busy' || code === 'server') {
                // The reader is busy or down. Usually that passes; but if this same photo stopped
                // STALL_LIMIT runs, it is probably the photo (it times out): leave it for the scan screen.
                const key = `stall:${img.assetId}`;
                failures[key] = (failures[key] ?? 0) + 1;
                if (failures[key] >= STALL_LIMIT) {
                  delete failures[key];
                  failures[img.assetId] = MAX_AUTO_ATTEMPTS;
                } else stoppedBy = (e as Error).message;
              } else if (code && code !== 'reader_error' && code !== 'too_large') {
                stoppedBy = (e as Error).message; // affects every photo (not configured, quota, signed out)
              } else {
                // This photo could not be read: try it again next run, up to MAX_AUTO_ATTEMPTS times.
                failures[img.assetId] = (failures[img.assetId] ?? 0) + 1;
                if (failures[img.assetId] < MAX_AUTO_ATTEMPTS) retryFrom = Math.min(retryFrom ?? img.createdAt, img.createdAt);
                if (code === 'reader_error') unreadable.push(img.assetId);
                // Two in a row: more likely the reader is down than the photos; stop and try later.
                if (unreadable.length >= 2) stoppedBy = READER_DOWN;
              }
            }
            break;
          }
          if (stoppedBy || quiet) break;
          processed += 1;
          setState((s) => ({ ...s, processed, confirmed: [...confirmed], drafts, waitUntil: null }));
        }

        await rememberScanned(userId, scanned);
        await saveScanFailures(userId, failures);
        // Move the window forward only when everything in it was handled.
        if (!stoppedBy && !quiet && fresh.length <= MAX_IMAGES_PER_RUN) {
          const next = await saveScanPrefs({ lastAutoScanAt: nextAutoScanMark(startedAt, retryFrom) }, userId).catch(() => null);
          if (next && current()) setPrefsState(next);
        }
        if (!current()) return;
        if (quiet) {
          setState(confirmed.length + drafts > 0 ? { ...IDLE, phase: 'done', total: batch.length, processed, confirmed, drafts } : IDLE);
          return;
        }
        // Keep what was recorded before stopping, so the banner can still say so.
        if (stoppedBy) setState({ ...IDLE, phase: 'error', message: stoppedBy, total: batch.length, processed, confirmed, drafts });
        else if (confirmed.length + drafts > 0) setState({ ...IDLE, phase: 'done', total: batch.length, processed, confirmed, drafts });
        else setState(IDLE); // nothing new: stay quiet
      } catch {
        if (current()) setState({ ...IDLE, phase: 'error', message: 'ตรวจแกลเลอรีอัตโนมัติไม่สำเร็จ ลองใหม่ได้ที่ปุ่มสแกนสลิป' });
      } finally {
        running.current = false;
      }
    },
    [repo, userId],
  );

  const maybeRun = useCallback(async () => {
    if (!available || running.current || scanLock.manual) return;
    let p = await loadScanPrefs(userId);
    setPrefsState(p);
    if (!shouldAutoScan({ enabled: p.autoScan, lastAutoScanAt: p.lastAutoScanAt, nowMs: Date.now(), alreadyRunning: running.current })) return;
    let access = await getGalleryAccess().catch(() => 'denied' as const);
    if (access === 'denied' && !p.askedGalleryOnce) {
      // First time the app opens: ask for the photos right away (the phone shows its own
      // permission dialog once), so scanning needs no tap at all from then on.
      p = await saveScanPrefs({ askedGalleryOnce: true }, userId);
      setPrefsState(p);
      access = await requestGalleryAccess().catch(() => 'denied' as const);
    }
    if (access === 'denied' || access === 'blocked') {
      setState({ ...IDLE, phase: 'needs_permission' });
      return;
    }
    await run(p);
  }, [available, run, userId]);

  // On open (once the user is in the app) and whenever the app returns to the foreground.
  useEffect(() => {
    if (!inApp || !available) return;
    // Start once the opening animation has finished and the first screen is on show,
    // so opening the app stays instant (and the one-time photo prompt comes after it).
    const first = setTimeout(() => {
      maybeRun().catch(() => {});
    }, START_DELAY_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') maybeRun().catch(() => {});
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
        setPrefsState(await saveScanPrefs(patch, userId));
      },
      async grantAndRun() {
        const a = await requestGalleryAccess().catch(() => 'denied' as const);
        if (a === 'denied' || a === 'blocked') {
          setState({ ...IDLE, phase: 'needs_permission', message: 'ยังไม่ได้รับสิทธิ์เข้าถึงรูปภาพ เปิดได้ในการตั้งค่าของมือถือ' });
          return;
        }
        await run(await loadScanPrefs(userId));
      },
      async runNow() {
        await run(await loadScanPrefs(userId));
      },
      async undoLast() {
        const ids = state.confirmed.map((t) => t.id);
        for (const id of ids) await updateTxRef.current(id, { status: 'draft' });
        setState(IDLE);
      },
      dismiss() {
        setState(IDLE);
      },
    }),
    [state, prefs, available, run, userId],
  );

  return <AutoScanContext.Provider value={value}>{children}</AutoScanContext.Provider>;
}
