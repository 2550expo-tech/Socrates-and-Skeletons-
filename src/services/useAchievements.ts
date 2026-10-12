/**
 * Streak and badges for the signed-in account (or the demo). Badges already
 * shown to the user are remembered on this phone, so each one is celebrated
 * once and stays earned. Rules: src/domain/achievements.ts.
 *
 * The remembered list is one shared store, so marking badges as seen on one
 * screen (achievements) updates every other screen (the home card) at once.
 *
 * The first time an account is opened on this phone (new phone, reinstall,
 * cleared browser, the demo) the badges it has already earned are remembered
 * quietly, so the home screen is not flooded with "new" badges the user did
 * not just earn. Only badges earned after that are announced.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useApp, useMoney } from '../data/AppProvider';
import { Storage } from '../data/storage';
import { computeBadges, computeStreak, newlyEarned } from '../domain/achievements';

const key = (who: string) => `mindpay.badges.${who}`;

type Seen = { who: string; ids: ReadonlySet<string>; seeding?: boolean } | null;
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
  let firstTime = false;
  try {
    const raw = await Storage.getItem(key(who));
    firstTime = raw === null;
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(parsed)) ids = parsed.map(String);
  } catch {
    // Start with nothing seen.
  }
  loading.delete(who);
  current = { who, ids: new Set(ids), seeding: firstTime };
  emit();
}

function remember(who: string, ids: string[]) {
  const next = new Set(current?.who === who ? current.ids : []);
  ids.forEach((id) => next.add(id));
  current = { who, ids: next, seeding: false };
  emit();
  Storage.setItem(key(who), JSON.stringify([...next])).catch(() => {});
}

export function useAchievements() {
  const { txs, goals, today, userId, repo, status } = useApp();
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
  const seeding = !!(seen && seen.who === who && seen.seeding);
  // Only once the remembered list is loaded (and seeded on a first visit), or every badge would look new.
  const fresh = useMemo(() => (known && !seeding ? newlyEarned(badges, known) : []), [badges, known, seeding]);
  // First visit on this phone: once the account's data is in, remember what it has already earned.
  const earnedIds = badges.filter((b) => b.earned).map((b) => b.id).join(',');
  useEffect(() => {
    if (seeding && who && status === 'ready') remember(who, earnedIds ? earnedIds.split(',') : []);
  }, [seeding, who, status, earnedIds]);

  const markSeen = useCallback(
    (ids: string[]) => {
      if (who && ids.length) remember(who, ids);
    },
    [who],
  );

  return { streak, badges, fresh, markSeen };
}
