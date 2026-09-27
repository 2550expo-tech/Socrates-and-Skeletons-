/**
 * App-wide state: who is signed in, their profile and their transactions,
 * plus the actions screens call. Numbers shown on screen are always derived
 * from this state with the pure functions in src/domain, never stored twice.
 */
import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { averageDailyExpense, computeRunway } from '../domain/runway';
import { computeBalance } from '../domain/summary';
import type { Profile, Transaction, TransactionInput } from '../domain/types';
import { createCloudRepo, createDemoRepo, resetDemoData, type Repo } from './repo';
import { supabase } from './supabase';

const MODE_KEY = 'mindpay.mode';

type AuthStatus = 'loading' | 'signedOut' | 'ready';

interface AppContextValue {
  status: AuthStatus;
  repo: Repo | null;
  userId: string | null;
  profile: Profile | null;
  txs: Transaction[];
  loadError: string | null;
  refreshing: boolean;
  refresh(): Promise<void>;
  startDemo(): Promise<void>;
  signOut(): Promise<void>;
  saveProfile(patch: Partial<Omit<Profile, 'id'>>): Promise<void>;
  addTx(input: TransactionInput): Promise<Transaction>;
  updateTx(id: string, patch: Partial<TransactionInput>): Promise<Transaction>;
  removeTx(id: string): Promise<Transaction | undefined>;
  confirmTxs(ids: string[]): Promise<void>;
  /** Used by the slip scanner, which inserts through the repo itself. */
  upsertLocal(tx: Transaction): void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [repo, setRepo] = useState<Repo | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const repoRef = useRef<Repo | null>(null);

  const loadAll = useCallback(async (r: Repo) => {
    setLoadError(null);
    try {
      const [p, list] = await Promise.all([r.getProfile(), r.listTransactions()]);
      setProfile(p);
      setTxs(list);
      setStatus('ready');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
      setStatus('ready');
    }
  }, []);

  const activateRepo = useCallback(
    async (r: Repo, id: string) => {
      repoRef.current = r;
      setRepo(r);
      setUserId(id);
      await loadAll(r);
    },
    [loadAll],
  );

  const clear = useCallback(() => {
    repoRef.current = null;
    setRepo(null);
    setUserId(null);
    setProfile(null);
    setTxs([]);
    setStatus('signedOut');
  }, []);

  // Decide the starting mode once, then follow Supabase auth changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mode = await Storage.getItem(MODE_KEY).catch(() => null);
      if (mode === 'demo') {
        if (!cancelled) await activateRepo(createDemoRepo(), 'demo');
        return;
      }
      if (!supabase) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) await activateRepo(createCloudRepo(data.session.user.id), data.session.user.id);
      else setStatus('signedOut');
    })();

    const sub = supabase?.auth.onAuthStateChange((event, session) => {
      // Supabase warns against calling other supabase methods inside this callback
      // (it can deadlock the auth lock), so the actual work is deferred.
      setTimeout(() => {
        if (event === 'SIGNED_IN' && session && repoRef.current?.mode !== 'cloud') {
          Storage.setItem(MODE_KEY, 'cloud').catch(() => {});
          activateRepo(createCloudRepo(session.user.id), session.user.id);
        }
        if (event === 'SIGNED_OUT' && repoRef.current?.mode === 'cloud') clear();
      }, 0);
    });
    return () => {
      cancelled = true;
      sub?.data.subscription.unsubscribe();
    };
  }, [activateRepo, clear]);

  const need = () => {
    if (!repoRef.current) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
    return repoRef.current;
  };

  const value = useMemo<AppContextValue>(
    () => ({
      status,
      repo,
      userId,
      profile,
      txs,
      loadError,
      refreshing,
      async refresh() {
        if (!repoRef.current) return;
        setRefreshing(true);
        await loadAll(repoRef.current);
        setRefreshing(false);
      },
      async startDemo() {
        await Storage.setItem(MODE_KEY, 'demo').catch(() => {});
        await activateRepo(createDemoRepo(), 'demo');
      },
      async signOut() {
        const r = repoRef.current;
        await Storage.setItem(MODE_KEY, '').catch(() => {});
        if (r?.mode === 'cloud') await supabase?.auth.signOut();
        if (r?.mode === 'demo') await resetDemoData();
        clear();
      },
      async saveProfile(patch) {
        const p = await need().updateProfile(patch);
        setProfile(p);
      },
      async addTx(input) {
        const tx = await need().insert(input);
        setTxs((list) => [tx, ...list]);
        return tx;
      },
      async updateTx(id, patch) {
        const tx = await need().update(id, patch);
        setTxs((list) => list.map((t) => (t.id === id ? tx : t)));
        return tx;
      },
      async removeTx(id) {
        const removed = txs.find((t) => t.id === id);
        await need().remove(id);
        setTxs((list) => list.filter((t) => t.id !== id));
        return removed;
      },
      async confirmTxs(ids) {
        await need().confirmMany(ids);
        const set = new Set(ids);
        setTxs((list) => list.map((t) => (set.has(t.id) ? { ...t, status: 'confirmed', reviewFlags: [] } : t)));
      },
      upsertLocal(tx) {
        setTxs((list) => [tx, ...list.filter((t) => t.id !== tx.id)]);
      },
    }),
    [status, repo, userId, profile, txs, loadError, refreshing, loadAll, activateRepo, clear],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** Derived money numbers used across screens (FR-2 balance, FR-6 runway). */
export function useMoney() {
  const { profile, txs } = useApp();
  return useMemo(() => {
    const opening = profile?.openingBalanceSatang ?? 0;
    const floor = profile?.runwayFloorSatang ?? 50_000;
    const balance = computeBalance(opening, txs);
    const average = averageDailyExpense(txs);
    const runway = computeRunway({ balanceSatang: balance, floorSatang: floor, averageSatang: average.averageSatang });
    const drafts = txs.filter((t) => t.status === 'draft');
    return { balance, average, runway, drafts };
  }, [profile, txs]);
}
