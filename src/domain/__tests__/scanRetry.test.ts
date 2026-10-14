/**
 * TC-99 (pre-ship check S4-3): after a scan, the photos that could not be read
 * can be tried again with one tap; the ones already read are left alone, and
 * results from the earlier run cannot land on the new one.
 */
import { describe, expect, it } from 'vitest';
import { initialScanState, nextQueued, scanReducer, type ScanState } from '../scanQueue';

function finishedScan(): ScanState {
  let s = scanReducer(initialScanState('7d'), {
    type: 'load',
    items: [
      { assetId: 'a', createdAt: 3 },
      { assetId: 'b', createdAt: 2 },
      { assetId: 'c', createdAt: 1 },
    ],
  });
  s = scanReducer(s, { type: 'start' });
  const run = s.runId;
  s = scanReducer(s, { type: 'itemFinished', runId: run, assetId: 'a', status: 'ready', txId: 't1', amountSatang: 5000 });
  s = scanReducer(s, { type: 'itemFinished', runId: run, assetId: 'b', status: 'failed', message: 'เชื่อมต่อไม่ได้' });
  s = scanReducer(s, { type: 'itemFinished', runId: run, assetId: 'c', status: 'failed', message: 'เชื่อมต่อไม่ได้' });
  return s;
}

describe('TC-99 retry the photos that could not be read', () => {
  it('only the failed photos go back in the queue, and the scan runs again', () => {
    const done = finishedScan();
    expect(done.phase).toBe('done');
    const s = scanReducer(done, { type: 'retryFailed' });
    expect(s.phase).toBe('running');
    expect(s.items.map((i) => i.status)).toEqual(['ready', 'queued', 'queued']);
    expect(s.items[0].txId).toBe('t1');
    expect(s.items[1].message).toBeUndefined();
    expect(nextQueued(s)?.assetId).toBe('b');
  });

  it('a late result from the earlier run is ignored', () => {
    const done = finishedScan();
    const s = scanReducer(done, { type: 'retryFailed' });
    expect(s.runId).toBe(done.runId + 1);
    const stale = scanReducer(s, { type: 'itemFinished', runId: done.runId, assetId: 'b', status: 'ready' });
    expect(stale).toBe(s);
  });

  it('does nothing while a scan is still running, or when nothing failed', () => {
    const running = scanReducer(scanReducer(initialScanState('7d'), { type: 'load', items: [{ assetId: 'x', createdAt: 1 }] }), { type: 'start' });
    expect(scanReducer(running, { type: 'retryFailed' })).toBe(running);
    const ok = scanReducer(running, { type: 'itemFinished', runId: running.runId, assetId: 'x', status: 'ready' });
    expect(ok.phase).toBe('done');
    expect(scanReducer(ok, { type: 'retryFailed' })).toBe(ok);
  });
});
