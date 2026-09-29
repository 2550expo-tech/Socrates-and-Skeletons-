/**
 * ภารกิจการเงิน: money missions on the achievements screen. Each one unlocks a
 * skin for น้องกล้า (src/domain/skins.ts). Progress is worked out from the
 * user's own records, plus the days the app was opened (for "open the app 30
 * days in a row"), so nothing can go out of sync.
 * Unit tests: __tests__/missions.test.ts.
 */
import { VOICE_NOTE } from './achievements';
import { addDays, bkkDayKey, daysBetween, formatThaiMonth, previousMonth } from './dates';
import { formatBaht } from './money';
import type { SkinId } from './skins';
import type { Transaction } from './types';

export type MissionId = 'open_30' | 'streak_14' | 'slips_20' | 'voice_10' | 'goal_done' | 'thrifty_week' | 'budget_month' | 'badges_8';

export interface Mission {
  id: MissionId;
  title: string;
  /** What to do. */
  how: string;
  /** Ionicons name. */
  icon: string;
  /** The skin it unlocks. */
  skin: SkinId;
  done: boolean;
  progress: { value: number; target: number };
  /** A line with the user's own numbers ("7 วันนี้ ฿1,200 · 7 วันก่อน ฿1,500"). */
  note?: string;
}

export interface MissionInput {
  txs: Transaction[];
  /** Bangkok days the app was opened (any order). */
  openDays: readonly string[];
  /** Longest run of days in a row with a record (src/domain/achievements.ts). */
  recordBest: number;
  /** Achievement badges earned so far. */
  badgesEarned: number;
  goals: { savedSatang: number; targetSatang: number }[];
  monthlyBudgetSatang: number | null;
  today: string;
}

export const OPEN_TARGET = 30;
export const RECORD_TARGET = 14;
export const SLIPS_TARGET = 20;
export const VOICE_TARGET = 10;
export const BADGES_TARGET = 8;
/** A month counts for "คุมงบได้ทั้งเดือน" only if it was really recorded. */
export const BUDGET_MONTH_MIN_RECORDS = 10;

/** Days in a row the app was opened, ending today (0 if not opened today). */
export function openStreak(openDays: readonly string[], today: string): number {
  const days = new Set(openDays);
  let run = 0;
  for (let d = today; days.has(d); d = addDays(d, -1)) run++;
  return run;
}

/** Add today to the list of open days (sorted, without repeats, only the most recent `keep`). */
export function recordOpen(openDays: readonly string[], today: string, keep = 120): string[] {
  const all = [...new Set([...openDays, today])].sort();
  return all.slice(Math.max(0, all.length - keep));
}

const baht = (s: number) => formatBaht(s, { decimals: false });

function spendBetween(txs: Transaction[], today: string, fromAge: number, toAge: number): number {
  let sum = 0;
  for (const t of txs) {
    if (t.status !== 'confirmed' || t.kind !== 'expense') continue;
    const age = daysBetween(bkkDayKey(t.occurredAt), today);
    if (age >= fromAge && age < toAge) sum += t.amountSatang;
  }
  return sum;
}

/** Last month's confirmed spending and how many expenses were recorded in it. */
export function monthSpend(txs: Transaction[], monthKey: string): { spent: number; records: number } {
  let spent = 0;
  let records = 0;
  for (const t of txs) {
    if (t.status !== 'confirmed' || t.kind !== 'expense') continue;
    if (bkkDayKey(t.occurredAt).slice(0, 7) !== monthKey) continue;
    spent += t.amountSatang;
    records++;
  }
  return { spent, records };
}

export function computeMissions(p: MissionInput): Mission[] {
  const out: Mission[] = [];
  const add = (m: Omit<Mission, 'done'>, done: boolean) => out.push({ ...m, done });

  const open = openStreak(p.openDays, p.today);
  add(
    {
      id: 'open_30',
      title: 'มาหากล้าทุกวัน',
      how: `เปิดแอปติดต่อกัน ${OPEN_TARGET} วัน`,
      icon: 'calendar',
      skin: 'thai',
      progress: { value: Math.min(open, OPEN_TARGET), target: OPEN_TARGET },
      note: open > 0 ? `ตอนนี้ต่อเนื่อง ${open} วัน ถ้าเว้นวันไหนจะเริ่มนับใหม่` : undefined,
    },
    open >= OPEN_TARGET,
  );

  add(
    {
      id: 'streak_14',
      title: 'จดครบสองสัปดาห์',
      how: `จดรายการต่อเนื่อง ${RECORD_TARGET} วัน`,
      icon: 'flame',
      skin: 'graduate',
      progress: { value: Math.min(p.recordBest, RECORD_TARGET), target: RECORD_TARGET },
    },
    p.recordBest >= RECORD_TARGET,
  );

  const slips = p.txs.filter((t) => t.source === 'slip' && t.status === 'confirmed').length;
  add(
    {
      id: 'slips_20',
      title: 'นักสืบสลิป',
      how: `บันทึกสลิปเข้ายอดเงิน ${SLIPS_TARGET} ใบ`,
      icon: 'receipt',
      skin: 'detective',
      progress: { value: Math.min(slips, SLIPS_TARGET), target: SLIPS_TARGET },
    },
    slips >= SLIPS_TARGET,
  );

  const voice = p.txs.filter((t) => t.note === VOICE_NOTE).length;
  add(
    {
      id: 'voice_10',
      title: 'พูดแล้วจด',
      how: `จดด้วยเสียง ${VOICE_TARGET} รายการ`,
      icon: 'mic',
      skin: 'dj',
      progress: { value: Math.min(voice, VOICE_TARGET), target: VOICE_TARGET },
    },
    voice >= VOICE_TARGET,
  );

  // Closest jar to its target, in percent.
  const best = p.goals.reduce((m, g) => (g.targetSatang > 0 ? Math.max(m, Math.min(100, Math.floor((g.savedSatang / g.targetSatang) * 100))) : m), 0);
  const reached = p.goals.some((g) => g.targetSatang > 0 && g.savedSatang >= g.targetSatang);
  add(
    {
      id: 'goal_done',
      title: 'ออมครบเป้า',
      how: 'หยอดกระปุกออมจนครบเป้า 1 ใบ',
      icon: 'wallet',
      skin: 'saver',
      progress: { value: reached ? 100 : best, target: 100 },
      note: p.goals.length === 0 ? 'ยังไม่มีกระปุก ตั้งได้ที่หน้าหลัก' : reached ? undefined : `กระปุกที่ใกล้สุดได้ ${best}% แล้ว`,
    },
    reached,
  );

  const last = spendBetween(p.txs, p.today, 0, 7);
  const before = spendBetween(p.txs, p.today, 7, 14);
  const thrifty = last > 0 && before > 0 && last < before;
  add(
    {
      id: 'thrifty_week',
      title: 'สัปดาห์ประหยัด',
      how: 'ใช้จ่าย 7 วันล่าสุดให้น้อยกว่า 7 วันก่อนหน้า',
      icon: 'trending-down',
      skin: 'chill',
      progress: { value: thrifty ? 1 : 0, target: 1 },
      note: before > 0 ? `7 วันนี้ ${baht(last)} · 7 วันก่อน ${baht(before)}` : 'ต้องมีรายจ่ายอย่างน้อย 2 สัปดาห์ก่อนนะ',
    },
    thrifty,
  );

  const thisMonth = p.today.slice(0, 7);
  const lastMonth = previousMonth(thisMonth);
  const prev = monthSpend(p.txs, lastMonth);
  const budget = p.monthlyBudgetSatang;
  const kept = !!budget && prev.records >= BUDGET_MONTH_MIN_RECORDS && prev.spent <= budget;
  const now = monthSpend(p.txs, thisMonth);
  add(
    {
      id: 'budget_month',
      title: 'คุมงบได้ทั้งเดือน',
      how: 'ตั้งงบรายเดือน แล้วใช้ไม่เกินงบจนจบเดือน',
      icon: 'shield-checkmark',
      skin: 'hero',
      progress: { value: kept ? 1 : 0, target: 1 },
      note: !budget
        ? 'ตั้งงบรายเดือนในหน้าตั้งค่าก่อนนะ'
        : kept
          ? `${formatThaiMonth(lastMonth)} ใช้ ${baht(prev.spent)} จากงบ ${baht(budget)}`
          : `เดือนนี้ใช้ไป ${baht(now.spent)} จากงบ ${baht(budget)} จบเดือนแบบไม่เกินงบเพื่อปลดล็อก`,
    },
    kept,
  );

  add(
    {
      id: 'badges_8',
      title: 'นักสะสมเหรียญ',
      how: `สะสมเหรียญความสำเร็จ ${BADGES_TARGET} เหรียญ`,
      icon: 'medal',
      skin: 'sakura',
      progress: { value: Math.min(p.badgesEarned, BADGES_TARGET), target: BADGES_TARGET },
    },
    p.badgesEarned >= BADGES_TARGET,
  );

  return out;
}

/** The mission that unlocks a skin, if any. */
export function missionForSkin(missions: readonly Mission[], skin: SkinId): Mission | undefined {
  return missions.find((m) => m.skin === skin);
}
