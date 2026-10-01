/**
 * FR-4 scanner controller. Runs the pure state machine from
 * src/domain/scanQueue.ts and does the phone work for one image at a time.
 *
 * Every slip is kept under the date printed on it (up to one year back); the
 * user then looks at it by period (วันนี้ / 7 วัน / ...) instead of choosing a
 * range before scanning. The range here only decides how far back in the
 * gallery to look.
 *
 * The state lives in a ref as well as React state so the processing loop
 * always sees the latest phase (pause takes effect before the next image).
 */
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { rangeDays, rangeStartMs } from '../domain/dates';
import { buildDuplicateIndex, type DuplicateIndex } from '../domain/slip';
import { initialScanState, nextQueued, scanReducer, type ScanAction, type ScanItem, type ScanState } from '../domain/scanQueue';
import type { RangeKey } from '../domain/types';
import { useApp } from '../data/AppProvider';
import { loadScanPrefs } from '../data/prefs';
import { processSlipImage } from './processSlip';
import {
  findGalleryImages,
  galleryUri,
  loadScannedIds,
  rememberScanned,
  scanLock,
  requestGalleryAccess,
  SlipReaderError,
  type GalleryAccess,
} from './slips';

type Finished = Extract<ScanAction, { type: 'itemFinished' }>;

/** Slips older than this (by the date printed on them) are not recorded automatically. */
const SLIP_WINDOW: RangeKey = '1y';
/** Wait before trying an image again after a network error. */
const NETWORK_RETRY_MS = 3000;

export function useSlipScanner(initialRange: RangeKey = '1m') {
  const { repo, userId, txs, upsertLocal } = useApp();
  const [state, setState] = useState<ScanState>(() => initialScanState(initialRange));
  const stateRef = useRef(state);
  const [access, setAccess] = useState<GalleryAccess | null>(null);
  const [finding, setFinding] = useState(false);
  /** A gallery search has finished at least once (to tell "nothing new" from "not searched yet"). */
  const [searched, setSearched] = useState(false);
  const [skippedKnown, setSkippedKnown] = useState(0);
  const [requireQr, setRequireQr] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  /** Set while the reader waits for the AI's rate limit (free tier): when it tries again (ms). */
  const [waiting, setWaiting] = useState<number | null>(null);
  /** Transactions recorded by this scan, to show them grouped by date. */
  const [runTxIds, setRunTxIds] = useState<string[]>([]);

  const txsRef = useRef(txs);
  useEffect(() => {
    txsRef.current = txs;
  }, [txs]);
  const indexRef = useRef<DuplicateIndex>(buildDuplicateIndex([]));
  const pickedRef = useRef(new Map<string, { width: number | null; height: number | null }>());
  /** Picture sizes of gallery photos in the queue (screen-sized ones get a closer QR check). */
  const sizesRef = useRef(new Map<string, { width: number | null; height: number | null }>());
  const scannedRef = useRef<Set<string>>(new Set());
  const loopRef = useRef(false);
  const mounted = useRef(true);

  const apply = useCallback((a: ScanAction) => {
    stateRef.current = scanReducer(stateRef.current, a);
    if (mounted.current) setState(stateRef.current);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Leaving the screen pauses the scan; drafts already saved stay saved.
      if (stateRef.current.phase === 'running') stateRef.current = scanReducer(stateRef.current, { type: 'pause' });
    };
  }, []);

  const setRange = (range: RangeKey) => apply({ type: 'setRange', range });

  /** Queue gallery photos taken in the last `range`, skipping ones checked before. Starts at once. */
  const loadFromGallery = useCallback(async (range?: RangeKey) => {
    setNotice(null);
    const a = await requestGalleryAccess();
    setAccess(a);
    if (a === 'denied' || a === 'blocked') return;
    if (range && range !== stateRef.current.range) apply({ type: 'setRange', range });
    setFinding(true);
    try {
      const since = rangeStartMs(stateRef.current.range);
      const [images, scanned] = await Promise.all([findGalleryImages(since), userId ? loadScannedIds(userId) : new Set<string>()]);
      scannedRef.current = scanned;
      const fresh = images.filter((i) => !scanned.has(i.assetId));
      setSkippedKnown(images.length - fresh.length);
      pickedRef.current.clear();
      sizesRef.current = new Map(fresh.map((i) => [i.assetId, { width: i.width, height: i.height }]));
      setRunTxIds([]);
      apply({ type: 'load', items: fresh.map((i) => ({ assetId: i.assetId, createdAt: i.createdAt })) });
      apply({ type: 'start' });
    } catch {
      setNotice('เปิดแกลเลอรีไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setFinding(false);
      setSearched(true);
    }
  }, [apply, userId]);

  /** Queue photos the user picks by hand (always read, QR or not). Starts at once. */
  const loadPicked = useCallback(async () => {
    setNotice(null);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 30,
      orderedSelection: true,
      quality: 1,
    });
    if (res.canceled || res.assets.length === 0) return;
    pickedRef.current = new Map(res.assets.map((a) => [a.uri, { width: a.width ?? null, height: a.height ?? null }]));
    setSkippedKnown(0);
    setRunTxIds([]);
    const now = Date.now();
    apply({ type: 'load', items: res.assets.map((a, i) => ({ assetId: a.uri, createdAt: now - i })) });
    apply({ type: 'start' });
  }, [apply]);

  async function processOne(item: ScanItem): Promise<Omit<Finished, 'type' | 'runId' | 'assetId'>> {
    const picked = pickedRef.current.get(item.assetId);
    const size = picked ?? sizesRef.current.get(item.assetId);
    const prefs = await loadScanPrefs(userId);
    const r = await processSlipImage({
      uri: picked ? item.assetId : await galleryUri(item.assetId),
      width: size?.width,
      height: size?.height,
      requireQr: requireQr && !picked,
      range: rangeDays(SLIP_WINDOW),
      index: indexRef.current,
      repo: repo!,
      autoConfirm: prefs.autoConfirm,
      fallbackTimeMs: item.createdAt,
      onWait: (seconds) => {
        if (mounted.current) setWaiting(Date.now() + seconds * 1000);
      },
      userId,
    });
    if (mounted.current) setWaiting(null);
    if (r.tx) {
      upsertLocal(r.tx);
      const id = r.tx.id;
      if (mounted.current) setRunTxIds((ids) => [...ids, id]);
    }
    return {
      status: r.status,
      txId: r.tx?.id,
      amountSatang: r.amountSatang,
      label: r.label,
      message: r.message,
      confirmed: r.confirmed,
    };
  }

  const runLoop = useCallback(async () => {
    if (loopRef.current) return;
    loopRef.current = true;
    scanLock.manual = true;
    indexRef.current = buildDuplicateIndex(txsRef.current);
    try {
      while (stateRef.current.phase === 'running') {
        const item = nextQueued(stateRef.current);
        if (!item) break;
        const runId = stateRef.current.runId;
        apply({ type: 'itemStarted', runId, assetId: item.assetId });
        try {
          let result: Awaited<ReturnType<typeof processOne>>;
          try {
            result = await processOne(item);
          } catch (e) {
            if (!(e instanceof SlipReaderError && e.code === 'network')) throw e;
            // A short drop in the connection: try this image once more before stopping.
            await new Promise((resolve) => setTimeout(resolve, NETWORK_RETRY_MS));
            result = await processOne(item);
          }
          apply({ type: 'itemFinished', runId, assetId: item.assetId, ...result });
          if (!pickedRef.current.has(item.assetId) && userId) scannedRef.current.add(item.assetId);
        } catch (e) {
          if (mounted.current) setWaiting(null);
          if (e instanceof SlipReaderError && e.code !== 'reader_error' && e.code !== 'too_large') {
            // Problems that affect every image (offline, not configured, AI busy, quota, signed out):
            // stop and tell the user. This image is retried on resume.
            setNotice(e.message);
            apply({ type: 'pause' });
            break;
          }
          const message = e instanceof SlipReaderError ? e.message : 'เกิดข้อผิดพลาดกับรูปนี้';
          apply({ type: 'itemFinished', runId, assetId: item.assetId, status: 'failed', message });
        }
      }
    } finally {
      loopRef.current = false;
      scanLock.manual = false;
      if (userId) rememberScanned(userId, scannedRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apply, userId, requireQr, repo]);

  useEffect(() => {
    if (state.phase === 'running') runLoop();
  }, [state.phase, runLoop]);

  return {
    state,
    access,
    finding,
    searched,
    skippedKnown,
    requireQr,
    setRequireQr,
    notice,
    waiting,
    runTxIds,
    setRange,
    loadFromGallery,
    loadPicked,
    start: () => apply({ type: 'start' }),
    pause: () => apply({ type: 'pause' }),
    resume: () => {
      setNotice(null);
      apply({ type: 'resume' });
    },
    reset: () => {
      setNotice(null);
      setSkippedKnown(0);
      setRunTxIds([]);
      apply({ type: 'reset' });
    },
  };
}
