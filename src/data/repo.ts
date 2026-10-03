/**
 * Data access. The screens never talk to Supabase or storage directly; they use
 * a Repo. Two implementations:
 *   - CloudRepo: Supabase (real accounts, data in PostgreSQL with RLS)
 *   - DemoRepo:  on-device only, starts with sample data (for trying the app
 *                without an account and as a fallback during a presentation)
 */
import { Storage } from './storage';
import { buildSampleTransactions, DEMO_OPENING_BALANCE_SATANG } from '../domain/sample';
import type { Profile, Transaction, TransactionInput } from '../domain/types';
import type { GoalInput, SavingsGoal } from '../domain/goals';
import { supabase } from './supabase';

export class DuplicateSlipError extends Error {
  constructor() {
    super('รายการนี้มีอยู่แล้ว');
    this.name = 'DuplicateSlipError';
  }
}

export interface Repo {
  mode: 'cloud' | 'demo';
  getProfile(): Promise<Profile>;
  updateProfile(patch: Partial<Omit<Profile, 'id'>>): Promise<Profile>;
  /**
   * Transactions of about the last 13 months, plus the net of confirmed money before them
   * (it still counts in the balance, but is not needed as a list).
   */
  listTransactions(): Promise<{ txs: Transaction[]; carrySatang: number }>;
  insert(input: TransactionInput): Promise<Transaction>;
  update(id: string, patch: Partial<TransactionInput>): Promise<Transaction>;
  remove(id: string): Promise<void>;
  confirmMany(ids: string[]): Promise<void>;
  listGoals(): Promise<SavingsGoal[]>;
  insertGoal(input: GoalInput): Promise<SavingsGoal>;
  updateGoal(id: string, patch: Partial<GoalInput>): Promise<SavingsGoal>;
  removeGoal(id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Row <-> model mapping (database uses snake_case)
// ---------------------------------------------------------------------------

type TxRow = {
  id: string;
  kind: 'income' | 'expense';
  amount_satang: number;
  category_key: string;
  title: string;
  note: string | null;
  occurred_at: string;
  source: 'manual' | 'slip';
  status: 'draft' | 'confirmed';
  slip_ref: string | null;
  slip_image_hash: string | null;
  ocr_confidence: number | null;
  review_flags: string[] | null;
  created_at: string;
};

const fromRow = (r: TxRow): Transaction => ({
  id: r.id,
  kind: r.kind,
  amountSatang: Number(r.amount_satang),
  categoryKey: r.category_key,
  title: r.title,
  note: r.note,
  occurredAt: r.occurred_at,
  source: r.source,
  status: r.status,
  slipRef: r.slip_ref,
  slipImageHash: r.slip_image_hash,
  ocrConfidence: r.ocr_confidence === null ? null : Number(r.ocr_confidence),
  reviewFlags: r.review_flags ?? [],
  createdAt: r.created_at,
});

function toRow(p: Partial<TransactionInput>) {
  const row: Record<string, unknown> = {};
  if (p.kind !== undefined) row.kind = p.kind;
  if (p.amountSatang !== undefined) row.amount_satang = p.amountSatang;
  if (p.categoryKey !== undefined) row.category_key = p.categoryKey;
  if (p.title !== undefined) row.title = p.title;
  if (p.note !== undefined) row.note = p.note;
  if (p.occurredAt !== undefined) row.occurred_at = p.occurredAt;
  if (p.source !== undefined) row.source = p.source;
  if (p.status !== undefined) row.status = p.status;
  if (p.slipRef !== undefined) row.slip_ref = p.slipRef;
  if (p.slipImageHash !== undefined) row.slip_image_hash = p.slipImageHash;
  if (p.ocrConfidence !== undefined) row.ocr_confidence = p.ocrConfidence;
  if (p.reviewFlags !== undefined) row.review_flags = p.reviewFlags;
  return row;
}

type ProfileRow = {
  id: string;
  display_name: string;
  opening_balance_satang: number;
  runway_floor_satang: number;
  monthly_budget_satang: number | null;
  coach_tone: Profile['coachTone'];
  onboarded: boolean;
};

const profileFromRow = (r: ProfileRow): Profile => ({
  id: r.id,
  displayName: r.display_name,
  openingBalanceSatang: Number(r.opening_balance_satang),
  runwayFloorSatang: Number(r.runway_floor_satang),
  monthlyBudgetSatang: r.monthly_budget_satang === null ? null : Number(r.monthly_budget_satang),
  coachTone: r.coach_tone,
  onboarded: r.onboarded,
});

function profileToRow(p: Partial<Omit<Profile, 'id'>>) {
  const row: Record<string, unknown> = {};
  if (p.displayName !== undefined) row.display_name = p.displayName;
  if (p.openingBalanceSatang !== undefined) row.opening_balance_satang = p.openingBalanceSatang;
  if (p.runwayFloorSatang !== undefined) row.runway_floor_satang = p.runwayFloorSatang;
  if (p.monthlyBudgetSatang !== undefined) row.monthly_budget_satang = p.monthlyBudgetSatang;
  if (p.coachTone !== undefined) row.coach_tone = p.coachTone;
  if (p.onboarded !== undefined) row.onboarded = p.onboarded;
  return row;
}

type GoalRow = {
  id: string;
  title: string;
  emoji: string;
  target_satang: number;
  saved_satang: number;
  due_day: string | null;
  done_at: string | null;
  created_at: string;
};

const goalFromRow = (r: GoalRow): SavingsGoal => ({
  id: r.id,
  title: r.title,
  emoji: r.emoji,
  targetSatang: Number(r.target_satang),
  savedSatang: Number(r.saved_satang),
  dueDay: r.due_day,
  doneAt: r.done_at,
  createdAt: r.created_at,
});

function goalToRow(p: Partial<GoalInput>) {
  const row: Record<string, unknown> = {};
  if (p.title !== undefined) row.title = p.title;
  if (p.emoji !== undefined) row.emoji = p.emoji;
  if (p.targetSatang !== undefined) row.target_satang = p.targetSatang;
  if (p.savedSatang !== undefined) row.saved_satang = p.savedSatang;
  if (p.dueDay !== undefined) row.due_day = p.dueDay;
  if (p.doneAt !== undefined) row.done_at = p.doneAt;
  return row;
}

/** Postgres unique violation = the same slip was saved before (see unique indexes in the migration). */
const isUniqueViolation = (e: { code?: string } | null) => e?.code === '23505';

// ---------------------------------------------------------------------------
// Cloud
// ---------------------------------------------------------------------------

export function createCloudRepo(userId: string): Repo {
  const db = supabase!;
  return {
    mode: 'cloud',
    async getProfile() {
      const { data, error } = await db.from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      return profileFromRow(data as ProfileRow);
    },
    async updateProfile(patch) {
      const { data, error } = await db.from('profiles').update(profileToRow(patch)).eq('id', userId).select().single();
      if (error) throw error;
      return profileFromRow(data as ProfileRow);
    },
    async listTransactions() {
      // Up to ~13 months: enough for the 1-year range. Paged to stay under the API row limit.
      const since = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString();
      const all: Transaction[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db
          .from('transactions')
          .select('*')
          .gte('occurred_at', since)
          .order('occurred_at', { ascending: false })
          // A unique tiebreaker, so rows with the same time are never skipped or read twice across pages.
          .order('id', { ascending: true })
          .range(from, from + 999);
        if (error) throw error;
        all.push(...(data as TxRow[]).map(fromRow));
        if (!data || data.length < 1000) break;
      }
      // Older confirmed money still counts in the balance: add it up (two columns only).
      let carrySatang = 0;
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db
          .from('transactions')
          .select('kind,amount_satang')
          .eq('status', 'confirmed')
          .lt('occurred_at', since)
          .order('occurred_at', { ascending: false })
          // A unique tiebreaker, so rows with the same time are never skipped or read twice across pages.
          .order('id', { ascending: true })
          .range(from, from + 999);
        if (error) throw error;
        for (const r of (data ?? []) as Pick<TxRow, 'kind' | 'amount_satang'>[]) {
          carrySatang += r.kind === 'income' ? Number(r.amount_satang) : -Number(r.amount_satang);
        }
        if (!data || data.length < 1000) break;
      }
      return { txs: all, carrySatang };
    },
    async insert(input) {
      const { data, error } = await db.from('transactions').insert(toRow(input)).select().single();
      if (isUniqueViolation(error)) throw new DuplicateSlipError();
      if (error) throw error;
      return fromRow(data as TxRow);
    },
    async update(id, patch) {
      const { data, error } = await db.from('transactions').update(toRow(patch)).eq('id', id).select().single();
      if (isUniqueViolation(error)) throw new DuplicateSlipError();
      if (error) throw error;
      return fromRow(data as TxRow);
    },
    async remove(id) {
      const { error } = await db.from('transactions').delete().eq('id', id);
      if (error) throw error;
    },
    async confirmMany(ids) {
      if (ids.length === 0) return;
      const { error } = await db.from('transactions').update({ status: 'confirmed', review_flags: [] }).in('id', ids);
      if (error) throw error;
    },
    async listGoals() {
      const { data, error } = await db.from('savings_goals').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return (data as GoalRow[]).map(goalFromRow);
    },
    async insertGoal(input) {
      const { data, error } = await db.from('savings_goals').insert(goalToRow(input)).select().single();
      if (error) throw error;
      return goalFromRow(data as GoalRow);
    },
    async updateGoal(id, patch) {
      const { data, error } = await db.from('savings_goals').update(goalToRow(patch)).eq('id', id).select().single();
      if (error) throw error;
      return goalFromRow(data as GoalRow);
    },
    async removeGoal(id) {
      const { error } = await db.from('savings_goals').delete().eq('id', id);
      if (error) throw error;
    },
  };
}

// ---------------------------------------------------------------------------
// Demo (on-device)
// ---------------------------------------------------------------------------

// v2: rebalanced sample data (v1 could show a negative balance). Old v1 data is simply ignored.
const DEMO_KEY = 'mindpay.demo.v2';

interface DemoState {
  profile: Profile;
  txs: Transaction[];
  goals?: SavingsGoal[];
}

const demoProfile: Profile = {
  id: 'demo',
  displayName: 'ผู้ทดลองใช้',
  openingBalanceSatang: DEMO_OPENING_BALANCE_SATANG,
  runwayFloorSatang: 50_000,
  monthlyBudgetSatang: 1_000_000,
  coachTone: 'friend',
  onboarded: true,
};

const newId = () => `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export async function resetDemoData() {
  await Storage.removeItem(DEMO_KEY);
}

export function createDemoRepo(): Repo {
  let cache: DemoState | null = null;

  async function load(): Promise<DemoState> {
    if (cache) return cache;
    try {
      const raw = await Storage.getItem(DEMO_KEY);
      if (raw) cache = JSON.parse(raw) as DemoState;
    } catch {
      cache = null;
    }
    if (!cache) {
      cache = { profile: demoProfile, txs: buildSampleTransactions() };
      await save();
    }
    return cache;
  }
  async function save() {
    try {
      await Storage.setItem(DEMO_KEY, JSON.stringify(cache));
    } catch {
      // Storage full or unavailable: keep working in memory.
    }
  }
  const dupe = (s: DemoState, input: Partial<TransactionInput>, exceptId?: string) =>
    s.txs.some(
      (t) =>
        t.id !== exceptId &&
        ((input.slipRef && t.slipRef === input.slipRef) || (input.slipImageHash && t.slipImageHash === input.slipImageHash)),
    );

  return {
    mode: 'demo',
    async getProfile() {
      return (await load()).profile;
    },
    async updateProfile(patch) {
      const s = await load();
      s.profile = { ...s.profile, ...patch };
      await save();
      return s.profile;
    },
    async listTransactions() {
      // Everything is on the phone: nothing is carried over.
      return { txs: [...(await load()).txs], carrySatang: 0 };
    },
    async insert(input) {
      const s = await load();
      if (dupe(s, input)) throw new DuplicateSlipError();
      const tx: Transaction = { ...input, id: newId(), createdAt: new Date().toISOString() };
      s.txs.push(tx);
      await save();
      return tx;
    },
    async update(id, patch) {
      const s = await load();
      if (dupe(s, patch, id)) throw new DuplicateSlipError();
      const i = s.txs.findIndex((t) => t.id === id);
      if (i < 0) throw new Error('ไม่พบรายการ');
      s.txs[i] = { ...s.txs[i], ...patch };
      await save();
      return s.txs[i];
    },
    async remove(id) {
      const s = await load();
      s.txs = s.txs.filter((t) => t.id !== id);
      await save();
    },
    async confirmMany(ids) {
      const s = await load();
      const set = new Set(ids);
      s.txs = s.txs.map((t) => (set.has(t.id) ? { ...t, status: 'confirmed', reviewFlags: [] } : t));
      await save();
    },
    async listGoals() {
      return [...((await load()).goals ?? [])];
    },
    async insertGoal(input) {
      const s = await load();
      const goal: SavingsGoal = { ...input, id: newId(), createdAt: new Date().toISOString() };
      s.goals = [...(s.goals ?? []), goal];
      await save();
      return goal;
    },
    async updateGoal(id, patch) {
      const s = await load();
      const list = s.goals ?? [];
      const i = list.findIndex((g) => g.id === id);
      if (i < 0) throw new Error('ไม่พบเป้าหมาย');
      list[i] = { ...list[i], ...patch };
      s.goals = list;
      await save();
      return list[i];
    },
    async removeGoal(id) {
      const s = await load();
      s.goals = (s.goals ?? []).filter((g) => g.id !== id);
      await save();
    },
  };
}
