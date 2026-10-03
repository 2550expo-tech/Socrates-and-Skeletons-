/**
 * App-wide state: who is signed in, their profile and their transactions,
 * plus the actions screens call. Numbers shown on screen are always derived
 * from this state with the pure functions in src/domain, never stored twice.
 */
import { Storage } from './storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { authErrorMessage, authLinkErrorMessage, parseAuthLink } from '../domain/auth';
import { bkkDayKey, msUntilNextBkkMidnight } from '../domain/dates';
import { applyDeposit, reservedSatang, type GoalInput, type SavingsGoal } from '../domain/goals';
import { averageDailyExpense, computeRunway } from '../domain/runway';
import { computeBalance } from '../domain/summary';
import type { Profile, Transaction, TransactionInput } from '../domain/types';
import { createCloudRepo, createDemoRepo, resetDemoData, type Repo } from './repo';
import { clearLinkFromAddressBar, onIncomingLink, openingLink } from './authLinks';
import { supabase } from './supabase';

const MODE_KEY = 'mindpay.mode';
const LAST_DAY_KEY = 'mindpay.lastOpenDay';
/** Fingerprints of email links already used (never the link itself: it holds sign-in tokens). */
const USED_LINKS_KEY = 'mindpay.usedAuthLinks';

/** A short fingerprint of a link (FNV-1a), enough to recognise it again. */
function linkFingerprint(url: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

async function usedLinks(): Promise<string[]> {
  try {
    return JSON.parse((await Storage.getItem(USED_LINKS_KEY)) ?? '[]') as string[];
  } catch {
    return [];
  }
}

type AuthStatus = 'loading' | 'signedOut' | 'ready';

/** One-time message shown over any screen after an account event. */
export type AuthNotice =
  | { kind: 'signed_up'; name?: string | null }
  | { kind: 'email_confirmed'; name?: string | null }
  | { kind: 'recovery' }
  | { kind: 'link_error'; message: string };

interface AppContextValue {
  status: AuthStatus;
  repo: Repo | null;
  userId: string | null;
  profile: Profile | null;
  txs: Transaction[];
  /** Net of confirmed money older than the loaded transactions (it still counts in the balance). */
  carrySatang: number;
  /** Savings goals ("กระปุกออม"). */
  goals: SavingsGoal[];
  addGoal(input: GoalInput): Promise<SavingsGoal>;
  updateGoal(id: string, patch: Partial<GoalInput>): Promise<SavingsGoal>;
  /** Put money into a goal (or take it out with a negative amount). */
  depositToGoal(id: string, deltaSatang: number): Promise<SavingsGoal>;
  removeGoal(id: string): Promise<void>;
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
  authNotice: AuthNotice | null;
  showAuthNotice(notice: AuthNotice): void;
  dismissAuthNotice(): void;
  /** Today's Bangkok day ("2026-09-28"). Changes at 00:00, so everything about "วันนี้" starts over. */
  today: string;
  /** True for the first session of a new day (greets the user and sums up yesterday). */
  newDay: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

/** Same as useApp, but null outside the provider (for small shared pieces such as the companion). */
export function useAppMaybe() {
  return useContext(AppContext);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [repo, setRepo] = useState<Repo | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [carrySatang, setCarry] = useState(0);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [authNotice, setAuthNotice] = useState<AuthNotice | null>(null);
  const [today, setToday] = useState(() => bkkDayKey(Date.now()));
  const [newDay, setNewDay] = useState(false);
  const todayRef = useRef(today);
  const repoRef = useRef<Repo | null>(null);
  /** The account whose data is loaded (or being loaded): prevents loading the same account twice. */
  const activeUserRef = useRef<string | null>(null);
  const handledLinks = useRef(new Set<string>());
  /** Each load gets a number; an older load that finishes late is ignored (it may be another account's). */
  const loadGen = useRef(0);
  /** Changes made on this phone while a load is running (null = deleted), put back over what it returns. */
  const localChanges = useRef(new Map<string, Transaction | null>());

  const noteLocal = (id: string, tx: Transaction | null) => {
    localChanges.current.set(id, tx);
  };

  const loadAll = useCallback(async (r: Repo) => {
    const gen = ++loadGen.current;
    localChanges.current = new Map();
    setLoadError(null);
    try {
      // Goals never block the app: if they cannot be loaded, the rest still works.
      const [p, list, g] = await Promise.all([r.getProfile(), r.listTransactions(), r.listGoals().catch(() => [] as SavingsGoal[])]);
      if (gen !== loadGen.current || repoRef.current !== r) return;
      // A slip saved by the automatic scan during the load is not lost when the list arrives.
      const changes = localChanges.current;
      const fresh = list.txs.filter((t) => !changes.has(t.id));
      const kept = [...changes.values()].filter((t): t is Transaction => t !== null);
      setProfile(p);
      setTxs([...kept, ...fresh]);
      setCarry(list.carrySatang);
      setGoals(g);
      setStatus('ready');
    } catch (e) {
      if (gen !== loadGen.current || repoRef.current !== r) return;
      setLoadError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
      setStatus('ready');
    }
  }, []);

  const activateRepo = useCallback(
    async (r: Repo, id: string) => {
      if (activeUserRef.current !== id) {
        // Another account (or leaving the demo): never show or use the previous one's data meanwhile.
        setProfile(null);
        setTxs([]);
        setCarry(0);
        setGoals([]);
      }
      activeUserRef.current = id;
      repoRef.current = r;
      setRepo(r);
      setUserId(id);
      await loadAll(r);
    },
    [loadAll],
  );

  const clear = useCallback(() => {
    loadGen.current += 1;
    activeUserRef.current = null;
    repoRef.current = null;
    setRepo(null);
    setUserId(null);
    setProfile(null);
    setTxs([]);
    setCarry(0);
    setGoals([]);
    setStatus('signedOut');
  }, []);

  // A new day starts at 00:00 Bangkok time: while the app is open (timer) or
  // when it comes back to the screen the next morning (AppState / tab focus).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const now = bkkDayKey(Date.now());
      if (now !== todayRef.current) {
        todayRef.current = now;
        setToday(now);
        setNewDay(true);
        Storage.setItem(LAST_DAY_KEY, now).catch(() => {});
      }
      clearTimeout(timer);
      timer = setTimeout(check, msUntilNextBkkMidnight() + 1000);
    };
    check();
    // First open on a different day from the last one.
    Storage.getItem(LAST_DAY_KEY)
      .then((last) => {
        if (last && last !== todayRef.current) setNewDay(true);
        return Storage.setItem(LAST_DAY_KEY, todayRef.current);
      })
      .catch(() => {});
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  /**
   * A link from a Supabase email (confirm sign-up / reset password). Returns true
   * when it signed the user in; the SIGNED_IN event then loads their data.
   */
  const handleAuthLink = useCallback(async (url: string | null) => {
    const result = parseAuthLink(url);
    if (!url || !result || !supabase || handledLinks.current.has(url)) return false;
    handledLinks.current.add(url);
    // Never leave sign-in tokens in the address bar (web), whatever happens next.
    clearLinkFromAddressBar();
    // Android keeps handing back the link that opened the app, even after an update reloads it:
    // a link that worked (or that the server refused) is never used again. One that failed only
    // because the phone was offline can be tapped again.
    const fp = linkFingerprint(url);
    const used = await usedLinks();
    if (used.includes(fp)) return false;
    const remember = () => {
      Storage.setItem(USED_LINKS_KEY, JSON.stringify([...used, fp].slice(-20))).catch(() => {});
    };
    const tryLater = () => handledLinks.current.delete(url);
    if (result.kind === 'error') {
      remember();
      setAuthNotice({ kind: 'link_error', message: authLinkErrorMessage(result) });
      return false;
    }
    try {
      const { data, error } =
        result.kind === 'session'
          ? await supabase.auth.setSession({ access_token: result.accessToken!, refresh_token: result.refreshToken! })
          : await supabase.auth.exchangeCodeForSession(result.code!);
      if (error || !data.session) {
        // An answer from the server (expired, already used): final. No answer (offline): may work later.
        if (error && typeof error.status === 'number' && error.status > 0) remember();
        else tryLater();
        setAuthNotice({ kind: 'link_error', message: authErrorMessage(error) });
        return false;
      }
      remember();
      // Sign in right away (the auth event may only say TOKEN_REFRESHED when a session already existed).
      const uid = data.session.user.id;
      if (activeUserRef.current !== uid) {
        Storage.setItem(MODE_KEY, 'cloud').catch(() => {});
        activateRepo(createCloudRepo(uid), uid);
      }
      const name = (data.session.user.user_metadata?.display_name as string | undefined) ?? null;
      if (result.type === 'recovery') setAuthNotice({ kind: 'recovery' });
      else if (result.type === 'signup' || result.type === 'email' || result.type === 'invite') {
        setAuthNotice({ kind: 'email_confirmed', name });
      }
      return true;
    } catch (e) {
      tryLater();
      setAuthNotice({ kind: 'link_error', message: authErrorMessage(e as Error) });
      return false;
    }
  }, [activateRepo]);

  // Decide the starting mode once, then follow Supabase auth changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // An email link that opened the app wins over the saved mode.
      if (await handleAuthLink(await openingLink())) return;
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
      const id = data.session?.user.id;
      if (id) {
        if (activeUserRef.current !== id) await activateRepo(createCloudRepo(id), id);
      } else if (!activeUserRef.current) setStatus('signedOut');
    })();

    const sub = supabase?.auth.onAuthStateChange((event, session) => {
      // Supabase warns against calling other supabase methods inside this callback
      // (it can deadlock the auth lock), so the actual work is deferred.
      setTimeout(() => {
        // A password-reset code signs in with the PASSWORD_RECOVERY event instead of SIGNED_IN.
        // Opened offline with an expired token, the session only comes back later as TOKEN_REFRESHED:
        // that signs in too, but only while nothing is open (never over the demo or another account).
        const signedIn =
          event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || (event === 'TOKEN_REFRESHED' && !activeUserRef.current);
        if (signedIn && session && activeUserRef.current !== session.user.id) {
          Storage.setItem(MODE_KEY, 'cloud').catch(() => {});
          activateRepo(createCloudRepo(session.user.id), session.user.id);
        }
        if (event === 'SIGNED_OUT' && repoRef.current?.mode === 'cloud') clear();
      }, 0);
    });
    const stopLinks = onIncomingLink((url) => {
      handleAuthLink(url);
    });
    return () => {
      cancelled = true;
      sub?.data.subscription.unsubscribe();
      stopLinks();
    };
  }, [activateRepo, clear, handleAuthLink]);

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
      carrySatang,
      goals,
      async addGoal(input) {
        const r = need();
        const g = await r.insertGoal(input);
        if (repoRef.current === r) setGoals((list) => [...list, g]);
        return g;
      },
      async updateGoal(id, patch) {
        const r = need();
        const g = await r.updateGoal(id, patch);
        if (repoRef.current === r) setGoals((list) => list.map((x) => (x.id === id ? g : x)));
        return g;
      },
      async depositToGoal(id, deltaSatang) {
        const current = goals.find((x) => x.id === id);
        if (!current) throw new Error('ไม่พบเป้าหมาย');
        const r = need();
        const g = await r.updateGoal(id, applyDeposit(current, deltaSatang));
        if (repoRef.current === r) setGoals((list) => list.map((x) => (x.id === id ? g : x)));
        return g;
      },
      async removeGoal(id) {
        const r = need();
        await r.removeGoal(id);
        if (repoRef.current === r) setGoals((list) => list.filter((x) => x.id !== id));
      },
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
      // After each save the result is shown only if the same account is still open
      // (an account switch during the save must not mix the two).
      async saveProfile(patch) {
        const r = need();
        const p = await r.updateProfile(patch);
        if (repoRef.current === r) setProfile(p);
      },
      async addTx(input) {
        const r = need();
        const tx = await r.insert(input);
        if (repoRef.current !== r) return tx;
        noteLocal(tx.id, tx);
        setTxs((list) => [tx, ...list]);
        return tx;
      },
      async updateTx(id, patch) {
        const r = need();
        const tx = await r.update(id, patch);
        if (repoRef.current !== r) return tx;
        noteLocal(id, tx);
        setTxs((list) => list.map((t) => (t.id === id ? tx : t)));
        return tx;
      },
      async removeTx(id) {
        const removed = txs.find((t) => t.id === id);
        const r = need();
        await r.remove(id);
        if (repoRef.current !== r) return removed;
        noteLocal(id, null);
        setTxs((list) => list.filter((t) => t.id !== id));
        return removed;
      },
      async confirmTxs(ids) {
        const r = need();
        await r.confirmMany(ids);
        if (repoRef.current !== r) return;
        const set = new Set(ids);
        setTxs((list) =>
          list.map((t) => {
            if (!set.has(t.id)) return t;
            const next = { ...t, status: 'confirmed' as const, reviewFlags: [] };
            noteLocal(t.id, next);
            return next;
          }),
        );
      },
      upsertLocal(tx) {
        noteLocal(tx.id, tx);
        setTxs((list) => [tx, ...list.filter((t) => t.id !== tx.id)]);
      },
      authNotice,
      showAuthNotice: setAuthNotice,
      dismissAuthNotice() {
        setAuthNotice(null);
      },
      today,
      newDay,
    }),
    [status, repo, userId, profile, txs, carrySatang, goals, loadError, refreshing, authNotice, today, newDay, loadAll, activateRepo, clear],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** Derived money numbers used across screens (FR-2 balance, FR-6 runway). */
export function useMoney() {
  const { profile, txs, carrySatang, goals, today } = useApp();
  return useMemo(() => {
    const opening = profile?.openingBalanceSatang ?? 0;
    const floor = profile?.runwayFloorSatang ?? 50_000;
    // Money from before the loaded window (over ~13 months ago) still counts.
    const balance = computeBalance(opening + carrySatang, txs);
    const average = averageDailyExpense(txs);
    // Money in savings goals is set aside: it does not count as money to spend.
    const reserved = reservedSatang(goals);
    const runway = computeRunway({ balanceSatang: balance, floorSatang: floor + reserved, averageSatang: average.averageSatang });
    const drafts = txs.filter((t) => t.status === 'draft');
    return { balance, average, runway, drafts, reserved, floor };
    // `today` makes the runway and averages start over at midnight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, txs, carrySatang, goals, today]);
}
