/**
 * Savings goals ("กระปุกออม"): money set aside for something the user wants.
 * The money stays in the user's account, so what is saved is kept out of the
 * money that can be spent (Money Runway) until the goal is used or removed.
 * Pure; unit tests in __tests__/goals.test.ts (TC-71).
 */
import { addDays, daysBetween, formatThaiDay } from './dates';
import { formatBaht } from './money';

export interface SavingsGoal {
  id: string;
  title: string;
  emoji: string;
  targetSatang: number;
  savedSatang: number;
  /** "YYYY-MM-DD", or null for no deadline. */
  dueDay: string | null;
  /** When the goal was reached (ISO), or null. */
  doneAt: string | null;
  createdAt: string;
}

export type GoalInput = Omit<SavingsGoal, 'id' | 'createdAt'>;

export const GOAL_EMOJIS = ['🎧', '📱', '💻', '✈️', '🎓', '🎁', '🚲', '👟', '🏠', '🐷'];

/** Quick deadlines offered when creating a goal (days from today; null = none). */
export const GOAL_DEADLINES: { label: string; days: number | null }[] = [
  { label: '1 เดือน', days: 30 },
  { label: '3 เดือน', days: 91 },
  { label: '6 เดือน', days: 182 },
  { label: 'ไม่กำหนด', days: null },
];

export const deadlineDay = (today: string, days: number | null) => (days === null ? null : addDays(today, days));

export function goalProgress(g: Pick<SavingsGoal, 'savedSatang' | 'targetSatang'>): number {
  return g.targetSatang > 0 ? Math.max(0, Math.min(1, g.savedSatang / g.targetSatang)) : 0;
}

/** Money set aside in all goals: kept out of what can be spent. */
export function reservedSatang(goals: Pick<SavingsGoal, 'savedSatang'>[]): number {
  return goals.reduce((s, g) => s + Math.max(0, g.savedSatang), 0);
}

/**
 * How much to put in per day to reach the goal by its deadline (today counts),
 * rounded up to whole baht. Null when there is no deadline or it is reached.
 */
export function perDayToReach(g: Pick<SavingsGoal, 'savedSatang' | 'targetSatang' | 'dueDay'>, today: string): number | null {
  const left = g.targetSatang - g.savedSatang;
  if (left <= 0 || !g.dueDay) return null;
  const days = Math.max(1, daysBetween(today, g.dueDay) + 1);
  return Math.ceil(left / days / 100) * 100;
}

/** Add (or take out, when negative) money; the goal is reached when the saved amount meets the target. */
export function applyDeposit(g: SavingsGoal, deltaSatang: number, now: Date = new Date()): Pick<SavingsGoal, 'savedSatang' | 'doneAt'> {
  const saved = Math.max(0, g.savedSatang + deltaSatang);
  const reached = saved >= g.targetSatang;
  return { savedSatang: saved, doneAt: reached ? (g.doneAt ?? now.toISOString()) : null };
}

/** One friendly line under a goal. */
export function goalLine(g: SavingsGoal, today: string): string {
  const left = g.targetSatang - g.savedSatang;
  // What is still to save is rounded up to whole baht, so it never reads "อีก ฿0" while short.
  const upBaht = (s: number) => formatBaht(Math.ceil(s / 100) * 100, { decimals: false });
  if (left <= 0) return 'ครบแล้ว! เก่งมาก ถึงเวลาใช้เงินก้อนนี้อย่างสบายใจ';
  if (!g.dueDay) return `อีก ${upBaht(left)} ก็ครบ`;
  const days = daysBetween(today, g.dueDay);
  if (days < 0) return `เลยกำหนดมาแล้ว อีก ${upBaht(left)} ก็ครบ ค่อย ๆ เก็บต่อได้นะ`;
  const per = perDayToReach(g, today)!;
  return `เก็บวันละ ${upBaht(per)} ก็ทันวันที่ ${formatThaiDay(g.dueDay, { year: false })}`;
}
