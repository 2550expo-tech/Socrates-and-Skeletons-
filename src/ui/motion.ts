/**
 * Shared motion helpers. Every animation in MindPay respects the phone's
 * "Reduce motion" accessibility setting.
 */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => alive && setReduce(r))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (r: boolean) => setReduce(r));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

/** A number that counts up to `target` (and eases to new values), e.g. the balance on the home screen. */
export function useCountUp(target: number, enabled: boolean, durationMs = 700): number {
  const [shown, setShown] = useState(enabled ? 0 : target);
  const current = useRef(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) return;
    const from = current.current;
    if (from === target) return;
    const start = Date.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (target - from) * eased);
      current.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled, durationMs]);
  return enabled ? shown : target;
}
