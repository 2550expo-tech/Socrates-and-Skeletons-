/**
 * Streak and badges for the signed-in account (or the demo). Badges already
 * shown to the user are remembered on this phone, so each one is celebrated
 * once and stays earned. Rules: src/domain/achievements.ts.
 *
 * The remembered list is one shared store, so marking badges as seen on one
 * screen (achievements) updates every other screen (the home card) at once.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useApp, useMoney } from '../data/AppProvider';
import { Storage } from '../data/storage';
import { computeBadges, computeStreak, newlyEarned } from '../domain/achievements';

const key = (who: string) => `mindpay.badges.${who}`;

type Seen = { who: string; ids: ReadonlySet<string> } | null;
let current: Seen = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => current;
const loading = new Set<string>();

async function load(who: string) {
  if (current?.who === who || loading.has(who)) return;
  loading.add(who);
  let ids: string[] = [];
  try {
    const raw = await Storage.getItem(key(who));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(parsed)) ids = parsed.map(String);
  } catch {
    // Start with nothing seen.
  }
  loading.delete(who);
  current = { who, ids: new Set(ids) };
  emit();
}

function remember(who: string, ids: string[]) {
  const next = new Set(current?.who === who ? current.ids : []);
  ids.forEach((id) => next.add(id));
  current = { who, ids: next };
  emit();
  Storage.setItem(key(who), JSON.stringify([...next])).catch(() => {});
}

export function useAchievements() {
  const { txs, goals, today, userId, repo } = useApp();
  const { runway } = useMoney();
  const who = repo?.mode === 'demo' ? 'demo' : userId;
  const seen = useSyncExternalStore(subscribe, snapshot, snapshot);

  useEffect(() => {
    if (who) load(who);
  }, [who]);

  const known = seen && seen.who === who ? seen.ids : null;
  const streak = useMemo(() => computeStreak(txs, today), [txs, today]);
  const badges = useMemo(
    () => computeBadges({ txs, streak, runwayStatus: runway.status, earnedBefore: known ?? undefined, today, goals }),
    [txs, streak, runway.status, known, today, goals],
  );
  // Only once the remembered list is loaded, or every badge would look new.
  const fresh = useMemo(() => (known ? newlyEarned(badges, known) : []), [badges, known]);

  const markSeen = useCallback(
    (ids: string[]) => {
      if (who && ids.length) remember(who, ids);
    },
    [who],
  );

  return { streak, badges, fresh, markSeen };
}
