/**
 * FR-4 scanner state machine (pure, testable).
 *
 * The old prototype had a bug: changing the time range while a scan was running
 * could keep using the old range or skip images. This reducer prevents that by
 * design:
 *   - the range can only change when no scan is running (idle / done);
 *   - every queue gets a new `runId`; results that arrive for an older run are ignored;
 *   - results are matched by asset id, never by array position.
 *
 * Images are processed newest first, so progress naturally passes the
 * 1 day -> 7 days -> 1 month -> 6 months -> 1 year milestones in that order.
 */
import { RANGE_ORDER, rangeStartMs } from './dates';
import type { RangeKey } from './types';

export type ScanPhase = 'idle' | 'running' | 'paused' | 'done';

export type ItemStatus =
  | 'queued'
  | 'working'
  | 'ready'
  | 'needs_review'
  | 'duplicate'
  | 'out_of_range'
  | 'not_slip'
  | 'failed';

export interface ScanItem {
  assetId: string;
  /** Creation time of the photo (ms). */
  createdAt: number;
  status: ItemStatus;
  /** Id of the draft transaction created from this slip, if any. */
  txId?: string;
  amountSatang?: number | null;
  label?: string | null;
  message?: string;
  /** true when the slip was counted in the balance straight away (auto-confirm). */
  confirmed?: boolean;
}

export interface ScanState {
  phase: ScanPhase;
  range: RangeKey;
  runId: number;
  items: ScanItem[];
}

export type ScanAction =
  | { type: 'setRange'; range: RangeKey }
  | { type: 'load'; items: { assetId: string; createdAt: number }[] }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'itemStarted'; runId: number; assetId: string }
  | {
      type: 'itemFinished';
      runId: number;
      assetId: string;
      status: Exclude<ItemStatus, 'queued' | 'working'>;
      txId?: string;
      amountSatang?: number | null;
      label?: string | null;
      message?: string;
      confirmed?: boolean;
    }
  | { type: 'reset' };

export const initialScanState = (range: RangeKey = '7d'): ScanState => ({
  phase: 'idle',
  range,
  runId: 0,
  items: [],
});

const canConfigure = (s: ScanState) => s.phase === 'idle' || s.phase === 'done';

export function scanReducer(state: ScanState, action: ScanAction): ScanState {
  switch (action.type) {
    case 'setRange':
      // Locked while a scan is running or paused.
      if (!canConfigure(state) || state.range === action.range) return state;
      return { ...state, phase: 'idle', range: action.range, items: [], runId: state.runId + 1 };

    case 'load': {
      if (!canConfigure(state)) return state;
      const seen = new Set<string>();
      const items = action.items
        .filter((i) => (seen.has(i.assetId) ? false : (seen.add(i.assetId), true)))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((i) => ({ ...i, status: 'queued' as const }));
      return { ...state, phase: 'idle', items, runId: state.runId + 1 };
    }

    case 'start':
      if (state.phase !== 'idle' || nextQueued(state) === null) return state;
      return { ...state, phase: 'running' };

    case 'pause':
      return state.phase === 'running' ? { ...state, phase: 'paused' } : state;

    case 'resume':
      if (state.phase !== 'paused') return state;
      return nextQueued(state) === null ? { ...state, phase: 'done' } : { ...state, phase: 'running' };

    case 'itemStarted':
      if (action.runId !== state.runId) return state;
      return {
        ...state,
        items: state.items.map((i) =>
          i.assetId === action.assetId && i.status === 'queued' ? { ...i, status: 'working' } : i,
        ),
      };

    case 'itemFinished': {
      if (action.runId !== state.runId) return state; // stale result from an older run
      let found = false;
      const items = state.items.map((i) => {
        if (i.assetId !== action.assetId || (i.status !== 'working' && i.status !== 'queued')) return i;
        found = true;
        return {
          ...i,
          status: action.status,
          txId: action.txId,
          amountSatang: action.amountSatang,
          label: action.label,
          message: action.message,
          confirmed: action.confirmed,
        };
      });
      if (!found) return state;
      const next = { ...state, items };
      const remaining = items.some((i) => i.status === 'queued' || i.status === 'working');
      if (!remaining) next.phase = 'done';
      return next;
    }

    case 'reset':
      return { ...initialScanState(state.range), runId: state.runId + 1 };
  }
}

/** The next image to process, or null. Items left 'working' by a pause are retried. */
export function nextQueued(state: ScanState): ScanItem | null {
  return state.items.find((i) => i.status === 'queued' || i.status === 'working') ?? null;
}

export type ScanCounts = Record<ItemStatus, number> & { total: number; finished: number };

export function scanCounts(state: ScanState): ScanCounts {
  const c = {
    queued: 0, working: 0, ready: 0, needs_review: 0, duplicate: 0,
    out_of_range: 0, not_slip: 0, failed: 0, total: state.items.length, finished: 0,
  };
  for (const i of state.items) c[i.status] += 1;
  c.finished = c.total - c.queued - c.working;
  return c;
}

/**
 * Which range milestones (1 วัน, 7 วัน, ...) up to the chosen range are fully checked.
 * A milestone is complete when every photo newer than its start has been processed.
 */
export function milestones(state: ScanState, now: Date = new Date()) {
  const chosen = RANGE_ORDER.indexOf(state.range);
  return RANGE_ORDER.slice(0, chosen + 1).map((range) => {
    const start = rangeStartMs(range, now);
    const inside = state.items.filter((i) => i.createdAt >= start);
    const done = inside.every((i) => i.status !== 'queued' && i.status !== 'working');
    return { range, total: inside.length, complete: state.items.length > 0 && done };
  });
}
