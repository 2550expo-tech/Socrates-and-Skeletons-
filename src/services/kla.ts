/**
 * น้องกล้า's wardrobe for the signed-in account (or the demo), kept on this
 * phone: the skins owned, the one being worn, the skins already celebrated,
 * the days the app was opened (for "เปิดแอปติดต่อกัน 30 วัน"), and the
 * Halloween ghosts caught each day (candies, src/domain/halloween.ts).
 *
 * One shared store, so choosing a skin in the collection changes น้องกล้า on
 * every screen at once. `useKlaSync` (mounted once inside the app) records
 * today's visit and hands out skins for finished missions and limited events.
 * Rules: src/domain/skins.ts and src/domain/missions.ts.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useApp, useAppMaybe } from '../data/AppProvider';
import { Storage } from '../data/storage';
import { catchGhost as addGhost, countCandies, ghostsLeft, type GhostCatches } from '../domain/halloween';
import { computeMissions, recordOpen } from '../domain/missions';
import { DEFAULT_SKIN, isSkinId, limitedOpenToday, wearable, type SkinId } from '../domain/skins';
import { useAchievements } from './useAchievements';

interface Wardrobe {
  owned: SkinId[];
  /** Skins the user has already been told about. */
  seen: SkinId[];
  equipped: SkinId;
  /** Bangkok days the app was opened. */
  opens: string[];
  /** Halloween ghosts caught per Bangkok day. */
  ghosts: GhostCatches;
}

const EMPTY: Wardrobe = { owned: [DEFAULT_SKIN], seen: [DEFAULT_SKIN], equipped: DEFAULT_SKIN, opens: [], ghosts: {} };
const key = (who: string) => `mindpay.kla.${who}`;

type Snap = { who: string; data: Wardrobe } | null;
let current: Snap = null;
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

function clean(raw: unknown): Wardrobe {
  if (!raw || typeof raw !== 'object') return EMPTY;
  const r = raw as Partial<Record<keyof Wardrobe, unknown>>;
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter(isSkinId) : []);
  const owned = [...new Set<SkinId>([DEFAULT_SKIN, ...ids(r.owned)])];
  return {
    owned,
    seen: [...new Set<SkinId>([DEFAULT_SKIN, ...ids(r.seen)])],
    equipped: isSkinId(r.equipped) ? r.equipped : DEFAULT_SKIN,
    opens: Array.isArray(r.opens) ? r.opens.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [],
    ghosts:
      r.ghosts && typeof r.ghosts === 'object'
        ? Object.fromEntries(
            Object.entries(r.ghosts as Record<string, unknown>).filter(
              (e): e is [string, number] => /^\d{4}-\d{2}-\d{2}$/.test(e[0]) && typeof e[1] === 'number' && e[1] > 0,
            ),
          )
        : {},
  };
}

async function load(who: string) {
  if (current?.who === who || loading.has(who)) return;
  loading.add(who);
  let data = EMPTY;
  try {
    const raw = await Storage.getItem(key(who));
    if (raw) data = clean(JSON.parse(raw));
  } catch {
    // Start fresh.
  }
  loading.delete(who);
  current = { who, data };
  emit();
}

function save(who: string, change: (w: Wardrobe) => Wardrobe) {
  if (current?.who !== who) return;
  const next = change(current.data);
  if (next === current.data) return;
  current = { who, data: next };
  emit();
  Storage.setItem(key(who), JSON.stringify(next)).catch(() => {});
}

const whoOf = (repo: { mode: string } | null | undefined, userId: string | null | undefined) => (repo?.mode === 'demo' ? 'demo' : (userId ?? null));

/** The skin น้องกล้า wears right now (the starter look before sign-in). */
export function useEquippedSkin(): SkinId {
  const app = useAppMaybe();
  const who = app ? whoOf(app.repo, app.userId) : null;
  const snap = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    if (who) load(who);
  }, [who]);
  if (!snap || !who || snap.who !== who) return DEFAULT_SKIN;
  return wearable(snap.data.equipped, new Set(snap.data.owned));
}

/** Everything the achievements screen and the skin collection need. */
export function useKla() {
  const { txs, goals, today, userId, repo, profile } = useApp();
  const { streak, badges } = useAchievements();
  const who = whoOf(repo, userId);
  const snap = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    if (who) load(who);
  }, [who]);
  const data = snap && who && snap.who === who ? snap.data : null;
  const opens = data?.opens;
  const earnedBadges = badges.filter((b) => b.earned).length;
  const missions = useMemo(
    () =>
      computeMissions({
        txs,
        openDays: opens ?? [today],
        recordBest: streak.best,
        badgesEarned: earnedBadges,
        goals,
        monthlyBudgetSatang: profile?.monthlyBudgetSatang ?? null,
        today,
      }),
    [txs, opens, today, streak.best, earnedBadges, goals, profile?.monthlyBudgetSatang],
  );
  const owned = useMemo(() => new Set<SkinId>(data?.owned ?? [DEFAULT_SKIN]), [data?.owned]);
  const fresh = useMemo(() => (data ? data.owned.filter((id) => !data.seen.includes(id)) : []), [data]);
  const equipped = wearable(data?.equipped, owned);

  const equip = useCallback(
    (id: SkinId) => {
      if (!who) return;
      save(who, (w) => (w.owned.includes(id) || id === DEFAULT_SKIN ? { ...w, equipped: id, seen: [...new Set([...w.seen, id])] } : w));
    },
    [who],
  );
  const markSeen = useCallback(
    (ids: SkinId[]) => {
      if (!who || !ids.length) return;
      save(who, (w) => (ids.every((id) => w.seen.includes(id)) ? w : { ...w, seen: [...new Set([...w.seen, ...ids])] }));
    },
    [who],
  );

  // Halloween: candies from caught ghosts and from days with a record.
  const ghosts = data?.ghosts;
  const candies = useMemo(() => countCandies({ txs, caught: ghosts ?? {} }), [txs, ghosts]);
  const catchGhost = useCallback(() => {
    if (!who) return;
    save(who, (w) => (ghostsLeft(w.ghosts, today) > 0 ? { ...w, ghosts: addGhost(w.ghosts, today) } : w));
  }, [who, today]);

  return {
    ready: !!data,
    missions,
    owned,
    equipped,
    fresh,
    equip,
    markSeen,
    candies,
    ghostsLeft: data ? ghostsLeft(data.ghosts, today) : 0,
    catchGhost,
  };
}

/**
 * Mounted once inside the app: records today's visit and gives the skins the
 * user has earned (finished missions, limited events open today, Halloween
 * skins with enough candies).
 */
export function useKlaSync() {
  const { today, userId, repo } = useApp();
  const who = whoOf(repo, userId);
  const { missions, ready, candies } = useKla();
  const doneSkins = missions
    .filter((m) => m.done)
    .map((m) => m.skin)
    .join(',');
  useEffect(() => {
    if (!who || !ready) return;
    const give = new Set<SkinId>([...limitedOpenToday(today, candies.total), ...(doneSkins ? (doneSkins.split(',') as SkinId[]) : [])]);
    save(who, (w) => {
      const opens = w.opens.includes(today) ? w.opens : recordOpen(w.opens, today);
      const owned = [...new Set([...w.owned, ...give])];
      if (opens === w.opens && owned.length === w.owned.length) return w;
      return { ...w, opens, owned };
    });
  }, [who, ready, today, doneSkins, candies.total]);
}
