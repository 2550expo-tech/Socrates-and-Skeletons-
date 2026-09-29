/**
 * Whether this phone has seen the "มีอะไรใหม่" page of the current update.
 * One shared store so the home card disappears as soon as the page opens.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { Storage } from '../data/storage';

/** Change this when a new "มีอะไรใหม่" page is written. */
export const WHATS_NEW_VERSION = '2026-09-30-halloween';
const KEY = 'mindpay.whatsNewSeen';

let seen: boolean | null = null; // null = not loaded yet
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => seen;

async function load() {
  if (seen !== null) return;
  try {
    seen = (await Storage.getItem(KEY)) === WHATS_NEW_VERSION;
  } catch {
    seen = false;
  }
  emit();
}

export function markWhatsNewSeen() {
  seen = true;
  emit();
  Storage.setItem(KEY, WHATS_NEW_VERSION).catch(() => {});
}

/** True when the card should be offered (loaded, and this update's page not seen yet). */
export function useWhatsNewPending(): boolean {
  const value = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    load();
  }, []);
  return value === false;
}
