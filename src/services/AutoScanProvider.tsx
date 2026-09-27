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
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { autoScanSince, MAX_IMAGES_PER_RUN, shouldAutoScan } from '../domain/autoScan';
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
  loadScannedIds,
  rememberScanned,
  requestGalleryAccess,
  SlipReaderError,
} from './slips';

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

const IDLE: AutoScanState = { phase: 'idle', total: 0, processed: 0, confirmed: [], drafts: 0, message: null };
const AutoScanContext = createContext<AutoScanContextValue | null>(null);

export function useAutoScan() {
  const ctx = useContext(AutoScanContext);
  if (!ctx) throw new Error('useAutoScan must be used inside AutoScanProvider');
  return ctx;
}

export function AutoScanProvider({ children }: { children: ReactNode }) {
  const { status, repo, userId, txs, upsertLocal, updateTx } = useApp();
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
        const [images, scanned] = await Promise.all([
          findGalleryImages(autoScanSince(p.lastAutoScanAt, startedAt), 500),
          loadScannedIds(userId),
        ]);
        const fresh = images.filter((i) => !scanned.has(i.assetId));
        const batch = fresh.slice(0, MAX_IMAGES_PER_RUN);
        setState((s) => ({ ...s, total: batch.length }));
        const index = buildDuplicateIndex(txsRef.current);
        const range = rangeDays('1y');

        for (const img of batch) {
          try {
            const r = await processSlipImage({
              uri: await galleryUri(img.assetId),
              width: img.width,
              requireQr: true,
              range,
              index,
              repo,
              autoConfirm: p.autoConfirm,
              fallbackTimeMs: img.createdAt,
            });
            if (r.tx) {
              upsertLocal(r.tx);
              if (r.confirmed) confirmed.push(r.tx);
              else drafts += 1;
            }
            scanned.add(img.assetId);
          } catch (e) {
            if (e instanceof SlipReaderError && e.code !== 'reader_error' && e.code !== 'network') {
              stoppedBy = e.message; // affects every image (not configured, quota, signed out)
              break;
            }
            // One unreadable image: skip it this time, try again next run.
          }
          processed += 1;
          setState((s) => ({ ...s, processed, confirmed: [...confirmed], drafts }));
        }

        await rememberScanned(userId, scanned);
        // Advance the window only when everything in it was handled.
        if (!stoppedBy && fresh.length <= MAX_IMAGES_PER_RUN) {
          setPrefsState(await saveScanPrefs({ lastAutoScanAt: startedAt }));
        }
        if (stoppedBy) setState({ ...IDLE, phase: 'error', message: stoppedBy });
        else if (confirmed.length + drafts > 0) setState({ phase: 'done', total: batch.length, processed, confirmed, drafts, message: null });
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
    const p = await loadScanPrefs();
    setPrefsState(p);
    if (!shouldAutoScan({ enabled: p.autoScan, lastAutoScanAt: p.lastAutoScanAt, nowMs: Date.now(), alreadyRunning: running.current })) return;
    const access = await getGalleryAccess().catch(() => 'denied' as const);
    if (access === 'denied' || access === 'blocked') {
      setState({ ...IDLE, phase: 'needs_permission' });
      return;
    }
    await run(p);
  }, [available, run]);

  // On open (once the user is signed in) and whenever the app returns to the foreground.
  useEffect(() => {
    if (status !== 'ready' || !available) return;
    // Start after the first screen has rendered, so opening the app stays instant.
    const first = setTimeout(() => {
      maybeRun();
    }, 800);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') maybeRun();
    });
    return () => {
      clearTimeout(first);
      sub.remove();
    };
  }, [status, available, maybeRun]);

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
