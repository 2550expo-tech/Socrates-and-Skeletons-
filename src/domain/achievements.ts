/**
 * Streak and badges: small rewards for keeping the money diary going.
 * Everything is worked out from the transactions themselves, so nothing can
 * go out of sync. Unit tests: __tests__/achievements.test.ts (TC-67, TC-68).
 */
import { addDays, bkkDayKey, daysBetween } from './dates';
import type { RunwayStatus } from './runway';
import type { Transaction } from './types';

/** The note voice entries are saved with (src/app/voice.tsx). */
export const VOICE_NOTE = 'จดด้วยเสียง';

/**
 * The day something was recorded: a slip counts on the day it was scanned
 * (its own date may be long ago), a typed or spoken entry on its own day.
 */
export function activityDay(t: Pick<Transaction, 'source' | 'createdAt' | 'occurredAt'>): string {
  return bkkDayKey(t.source === 'slip' ? t.createdAt : t.occurredAt);
}

export interface Streak {
  /** Days in a row with a record, up to today (or yesterday while today is still open). */
  days: number;
  /** Something was recorded today. */
  today: boolean;
  /** Longest run ever. */
  best: number;
  /** The last 14 days, oldest first: was anything recorded that day? */
  recent: { day: string; active: boolean }[];
}

export function computeStreak(txs: Pick<Transaction, 'source' | 'createdAt' | 'occurredAt'>[], today: string): Streak {
  const days = new Set(txs.map(activityDay).filter((d) => d <= today));
  const recordedToday = days.has(today);
  let run = 0;
  // Today not recorded yet: the streak is still alive if yesterday was.
  for (let d = recordedToday ? today : addDays(today, -1); days.has(d); d = addDays(d, -1)) run++;

  let best = 0;
  let current = 0;
  let prev: string | null = null;
  for (const d of [...days].sort()) {
    current = prev && daysBetween(prev, d) === 1 ? current + 1 : 1;
    best = Math.max(best, current);
    prev = d;
  }
  const recent = Array.from({ length: 14 }, (_, i) => {
    const day = addDays(today, i - 13);
    return { day, active: days.has(day) };
  });
  return { days: run, today: recordedToday, best: Math.max(best, run), recent };
}

export type BadgeId =
  | 'first_step'
  | 'first_slip'
  | 'voice'
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'
  | 'slips_10'
  | 'slips_100'
  | 'all_clear'
  | 'saver_week'
  | 'healthy_tree'
  | 'first_goal'
  | 'goal_reached';

export interface Badge {
  id: BadgeId;
  title: string;
  /** How to earn it (shown on locked badges) or what it means. */
  how: string;
  /** Ionicons name for the medal. */
  icon: string;
  earned: boolean;
  progress?: { value: number; target: number };
}

export interface BadgeInput {
  txs: Transaction[];
  streak: Streak;
  runwayStatus: RunwayStatus;
  /** Badges earned before (kept even if, say, the runway later drops). */
  earnedBefore?: ReadonlySet<string>;
  /** Savings goals: saved and target amounts. */
  goals?: { savedSatang: number; targetSatang: number }[];
  today: string;
}

/** Spending of the last 7 days vs the 7 before: lower = a thrifty week. */
function thriftyWeek(txs: Transaction[], today: string): boolean {
  let last = 0;
  let before = 0;
  for (const t of txs) {
    if (t.status !== 'confirmed' || t.kind !== 'expense') continue;
    const age = daysBetween(bkkDayKey(t.occurredAt), today);
    if (age >= 0 && age < 7) last += t.amountSatang;
    else if (age >= 7 && age < 14) before += t.amountSatang;
  }
  return last > 0 && before > 0 && last < before;
}

export function computeBadges(p: BadgeInput): Badge[] {
  const slips = p.txs.filter((t) => t.source === 'slip');
  const confirmedSlips = slips.filter((t) => t.status === 'confirmed').length;
  const waiting = slips.some((t) => t.status === 'draft');
  const best = p.streak.best;
  const list: Badge[] = [];
  const add = (b: Omit<Badge, 'earned'>, earnedNow: boolean) => list.push({ ...b, earned: earnedNow || !!p.earnedBefore?.has(b.id) });
  add({ id: 'first_step', title: 'ก้าวแรก', how: 'จดรายการแรก', icon: 'footsteps' }, p.txs.length > 0);
  add({ id: 'first_slip', title: 'สลิปแรก', how: 'บันทึกรายการจากสลิปครั้งแรก', icon: 'receipt' }, slips.length > 0);
  add({ id: 'voice', title: 'พูดแล้วจด', how: 'จดรายการด้วยเสียงครั้งแรก', icon: 'mic' }, p.txs.some((t) => t.note === VOICE_NOTE));
  add({ id: 'streak_3', title: 'ติดเครื่อง', how: 'จดต่อเนื่อง 3 วัน', icon: 'flame', progress: { value: Math.min(best, 3), target: 3 } }, best >= 3);
  add({ id: 'streak_7', title: 'สัปดาห์ทอง', how: 'จดต่อเนื่อง 7 วัน', icon: 'medal', progress: { value: Math.min(best, 7), target: 7 } }, best >= 7);
  add({ id: 'streak_30', title: 'เดือนแห่งวินัย', how: 'จดต่อเนื่อง 30 วัน', icon: 'trophy', progress: { value: Math.min(best, 30), target: 30 } }, best >= 30);
  add({ id: 'slips_10', title: 'นักสะสมสลิป', how: 'สลิปรวมในยอดเงิน 10 ใบ', icon: 'albums', progress: { value: Math.min(confirmedSlips, 10), target: 10 } }, confirmedSlips >= 10);
  add({ id: 'slips_100', title: 'เซียนสลิป', how: 'สลิปรวมในยอดเงิน 100 ใบ', icon: 'ribbon', progress: { value: Math.min(confirmedSlips, 100), target: 100 } }, confirmedSlips >= 100);
  add({ id: 'all_clear', title: 'ตรวจครบ', how: 'มีสลิปแล้ว และไม่เหลือสลิปรอตรวจ', icon: 'checkmark-done' }, confirmedSlips > 0 && !waiting);
  add({ id: 'saver_week', title: 'สัปดาห์ประหยัด', how: '7 วันล่าสุดใช้น้อยกว่า 7 วันก่อนหน้า', icon: 'trending-down' }, thriftyWeek(p.txs, p.today));
  add({ id: 'healthy_tree', title: 'ต้นไม้งาม', how: 'เงินพอใช้ในระดับสบาย ๆ', icon: 'leaf' }, p.runwayStatus === 'healthy');
  const goals = p.goals ?? [];
  add({ id: 'first_goal', title: 'เริ่มออม', how: 'หยอดกระปุกออมครั้งแรก', icon: 'wallet' }, goals.some((g) => g.savedSatang > 0));
  add({ id: 'goal_reached', title: 'ออมสำเร็จ', how: 'หยอดกระปุกจนครบเป้า', icon: 'gift' }, goals.some((g) => g.savedSatang >= g.targetSatang));
  return list;
}

/** Badges earned now that were not earned before (for the "new badge" card). */
export function newlyEarned(badges: Badge[], seen: ReadonlySet<string>): Badge[] {
  return badges.filter((b) => b.earned && !seen.has(b.id));
}
