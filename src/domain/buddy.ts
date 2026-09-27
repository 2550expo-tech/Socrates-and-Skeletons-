/**
 * "น้องกล้า", the MindPay companion: a money-tree sapling that talks to the
 * user in a warm voice (idea from MeowJot's cat and Hugging Face's Huggy: one
 * friendly character with moods). This file decides what it says; the drawing
 * is in src/ui/Buddy.tsx. Unit-tested in __tests__/buddy.test.ts.
 *
 * Rules for the voice (same as the AI coach): kind, short, numbers only from
 * the user's own confirmed data, never shaming.
 */
import { bkkDayKey } from './dates';
import { formatBaht } from './money';
import type { RunwayStatus } from './runway';
import type { Transaction } from './types';

export const BUDDY_NAME = 'กล้า';

export type BuddyMood = 'happy' | 'calm' | 'worried' | 'sleepy' | 'thinking' | 'cheer';

export interface BuddyLine {
  mood: BuddyMood;
  text: string;
}

/** Confirmed spending today (Bangkok day). */
export function spentToday(txs: Transaction[], now: Date = new Date()): number {
  const today = bkkDayKey(now);
  return txs
    .filter((t) => t.status === 'confirmed' && t.kind === 'expense' && bkkDayKey(t.occurredAt) === today)
    .reduce((sum, t) => sum + t.amountSatang, 0);
}

/** A slip the app recorded today by itself (shown with a "ใหม่" mark, like MeowJot). */
export function isNewFromSlip(tx: Transaction, now: Date = new Date()): boolean {
  return tx.source === 'slip' && bkkDayKey(tx.createdAt) === bkkDayKey(now);
}

const baht = (satang: number) => formatBaht(satang, { decimals: false });

/** What the companion says on the home screen. */
export function buddyLine(p: {
  status: RunwayStatus;
  days: number | null;
  capped?: boolean;
  safeTodaySatang: number;
  spentTodaySatang: number;
  draftsToReview: number;
  hasAnyTransaction: boolean;
}): BuddyLine {
  if (!p.hasAnyTransaction) {
    return { mood: 'sleepy', text: `ยังไม่มีรายการให้${BUDDY_NAME}ดูเลย ลองสแกนสลิปหรือจดรายการแรกกันนะ` };
  }
  if (p.draftsToReview > 0) {
    return { mood: 'thinking', text: `มีสลิป ${p.draftsToReview} ใบที่${BUDDY_NAME}อ่านไม่ชัด ช่วยดูให้หน่อยนะ` };
  }
  switch (p.status) {
    case 'below_floor':
      return { mood: 'worried', text: `เงินแตะเส้นเงินสำรองแล้ว ช่วงนี้ใช้เท่าที่จำเป็นก่อนนะ ${BUDDY_NAME}เป็นกำลังใจให้` };
    case 'critical':
      return { mood: 'worried', text: `เงินพอใช้อีก ${p.days} วัน ลองพักของที่ไม่จำเป็นสักหน่อยนะ ค่อย ๆ ไปด้วยกัน` };
    case 'watch':
      return { mood: 'calm', text: `วันนี้ใช้ได้ราว ${baht(p.safeTodaySatang)} เงินจะพอถึงสิ้นเดือนพอดี` };
    case 'no_spending':
      return { mood: 'calm', text: `7 วันนี้ยังไม่มีรายจ่าย ${BUDDY_NAME}เลยยังนับวันไม่ได้ ถ้าจ่ายอะไรอย่าลืมเก็บสลิปไว้นะ` };
    case 'healthy': {
      const days = `${p.days}${p.capped ? '+' : ''}`;
      if (p.spentTodaySatang > 0) {
        return { mood: 'happy', text: `วันนี้ใช้ไป ${baht(p.spentTodaySatang)} ยังอยู่ในแผน เงินพอใช้อีก ${days} วัน` };
      }
      return { mood: 'cheer', text: `เงินพอใช้อีก ${days} วัน ต้นไม้เงินแข็งแรงดี สบาย ๆ เลย` };
    }
  }
}
