/**
 * "AI มีคิวเยอะ รออีก 17 วินาที…" with a live countdown, shown while the slip
 * reader waits for the free AI tier's rate limit before trying again.
 */
import { useEffect, useState } from 'react';
import { waitMessage } from '../services/slips';
import { T } from './components';

// Rounded, so a countdown that starts at 20 never flashes 21 because of a millisecond of drift.
const secondsLeft = (until: number) => Math.max(0, Math.round((until - Date.now()) / 1000));

export function WaitNotice({ until, micro }: { until: number; micro?: boolean }) {
  const [left, setLeft] = useState(() => secondsLeft(until));
  useEffect(() => {
    const tick = () => setLeft(secondsLeft(until));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);
  return <T v={micro ? 'micro' : 'small'}>{left > 0 ? waitMessage(left) : 'กำลังลองอ่านอีกครั้ง…'}</T>;
}
