/**
 * FR-4 scanner controller. Runs the pure state machine from
 * src/domain/scanQueue.ts and does the phone work for one image at a time.
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
  requestGalleryAccess,
  SlipReaderError,
  type GalleryAccess,
} from './slips';

type Finished = Extract<ScanAction, { type: 'itemFinished' }>;

export function useSlipScanner(initialRange: RangeKey = '7d') {
  const { repo, userId, txs, upsertLocal } = useApp();
  const [state, setState] = useState<ScanState>(() => initialScanState(initialRange));
  const stateRef = useRef(state);
  const [access, setAccess] = useState<GalleryAccess | null>(null);
  const [finding, setFinding] = useState(false);
  const [skippedKnown, setSkippedKnown] = useState(0);
  const [requireQr, setRequireQr] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const txsRef = useRef(txs);
  useEffect(() => {
    txsRef.current = txs;
  }, [txs]);
  const indexRef = useRef<DuplicateIndex>(buildDuplicateIndex([]));
  const pickedRef = useRef(new Map<string, { width: number | null }>());
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

  /** Queue gallery photos in the chosen range, skipping ones checked before. */
  const loadFromGallery = useCallback(async () => {
    setNotice(null);
    const a = await requestGalleryAccess();
    setAccess(a);
    if (a === 'denied' || a === 'blocked') return;
    setFinding(true);
    try {
      const since = rangeStartMs(stateRef.current.range);
      const [images, scanned] = await Promise.all([findGalleryImages(since), userId ? loadScannedIds(userId) : new Set<string>()]);
      scannedRef.current = scanned;
      const fresh = images.filter((i) => !scanned.has(i.assetId));
      setSkippedKnown(images.length - fresh.length);
      pickedRef.current.clear();
      apply({ type: 'load', items: fresh.map((i) => ({ assetId: i.assetId, createdAt: i.createdAt })) });
    } catch {
      setNotice('เปิดแกลเลอรีไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setFinding(false);
    }
  }, [apply, userId]);

  /** Queue photos the user picks by hand (always read, QR or not). */
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
    pickedRef.current = new Map(res.assets.map((a) => [a.uri, { width: a.width ?? null }]));
    setSkippedKnown(0);
    const now = Date.now();
    apply({ type: 'load', items: res.assets.map((a, i) => ({ assetId: a.uri, createdAt: now - i })) });
  }, [apply]);

  async function processOne(item: ScanItem): Promise<Omit<Finished, 'type' | 'runId' | 'assetId'>> {
    const picked = pickedRef.current.get(item.assetId);
    const prefs = await loadScanPrefs();
    const r = await processSlipImage({
      uri: picked ? item.assetId : await galleryUri(item.assetId),
      width: picked?.width,
      requireQr: requireQr && !picked,
      range: rangeDays(stateRef.current.range),
      index: indexRef.current,
      repo: repo!,
      autoConfirm: prefs.autoConfirm,
      fallbackTimeMs: item.createdAt,
    });
    if (r.tx) upsertLocal(r.tx);
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
    indexRef.current = buildDuplicateIndex(txsRef.current);
    try {
      while (stateRef.current.phase === 'running') {
        const item = nextQueued(stateRef.current);
        if (!item) break;
        const runId = stateRef.current.runId;
        apply({ type: 'itemStarted', runId, assetId: item.assetId });
        try {
          const result = await processOne(item);
          apply({ type: 'itemFinished', runId, assetId: item.assetId, ...result });
          if (!pickedRef.current.has(item.assetId) && userId) scannedRef.current.add(item.assetId);
        } catch (e) {
          if (e instanceof SlipReaderError && e.code !== 'reader_error' && e.code !== 'network') {
            // Problems that affect every image: stop and tell the user. This image is retried on resume.
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
    skippedKnown,
    requireQr,
    setRequireQr,
    notice,
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
      apply({ type: 'reset' });
    },
  };
}
