/**
 * Shared motion helpers. Every animation in MindPay respects the phone's
 * "Reduce motion" accessibility setting.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/** Transform and opacity animations run on the UI thread on phones; the web has no native driver. */
export const useNative = Platform.OS !== 'web';

// Read once and shared, so screens opened later know the setting from their first frame.
let reduceMotion = false;
let tracking = false;
const listeners = new Set<() => void>();
function track() {
  if (tracking) return;
  tracking = true;
  const set = (r: boolean) => {
    reduceMotion = r;
    listeners.forEach((l) => l());
  };
  AccessibilityInfo.isReduceMotionEnabled().then(set).catch(() => {});
  AccessibilityInfo.addEventListener?.('reduceMotionChanged', set);
}
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  track();
  return () => {
    listeners.delete(onChange);
  };
}

export function useReduceMotion(): boolean {
  return useSyncExternalStore(subscribe, () => reduceMotion, () => false);
}

/** A number that counts up to `target` (and eases to new values), e.g. the balance on the home screen. */
export function useCountUp(target: number, enabled: boolean, durationMs = 700, from = 0): number {
  const [shown, setShown] = useState(enabled ? from : target);
  const current = useRef(enabled ? from : target);
  useEffect(() => {
    if (!enabled) return;
    const start = current.current;
    if (start === target) return;
    const began = Date.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - began) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(start + (target - start) * eased);
      current.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled, durationMs]);
  return enabled ? shown : target;
}
