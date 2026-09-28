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

/** Confirmed spending on one Bangkok day (default: today). */
export function spentOnDay(txs: Transaction[], dayKey: string): number {
  return txs
    .filter((t) => t.status === 'confirmed' && t.kind === 'expense' && bkkDayKey(t.occurredAt) === dayKey)
    .reduce((sum, t) => sum + t.amountSatang, 0);
}

/** Confirmed spending today (Bangkok day). */
export function spentToday(txs: Transaction[], now: Date = new Date()): number {
  return spentOnDay(txs, bkkDayKey(now));
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
  /** Set on the first look at the home screen on a new day: yesterday's confirmed spending. */
  newDay?: { yesterdaySpentSatang: number } | null;
}): BuddyLine {
  if (!p.hasAnyTransaction) {
    return { mood: 'sleepy', text: `ยังไม่มีรายการให้${BUDDY_NAME}ดูเลย ลองสแกนสลิปหรือจดรายการแรกกันนะ` };
  }
  if (p.draftsToReview > 0) {
    return { mood: 'thinking', text: `มีสลิป ${p.draftsToReview} ใบที่${BUDDY_NAME}อ่านไม่ชัด ช่วยดูให้หน่อยนะ` };
  }
  if (p.newDay && p.status !== 'below_floor' && p.status !== 'critical') {
    const y = p.newDay.yesterdaySpentSatang;
    const yesterday = y > 0 ? `เมื่อวานใช้ไป ${baht(y)}` : 'เมื่อวานไม่มีรายจ่ายเลย';
    const today = p.status === 'no_spending' ? 'วันนี้เริ่มนับใหม่แล้วนะ' : `วันนี้ใช้ได้ราว ${baht(p.safeTodaySatang)}`;
    return { mood: 'cheer', text: `วันใหม่แล้ว! ${yesterday} ${today}` };
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

/** Friendly tips น้องกล้า gives when tapped (short, kind, about using MindPay well). */
export const BUDDY_TIPS: readonly string[] = [
  `เก็บสลิปไว้ในเครื่องได้เลย เปิดแอปเมื่อไหร่ ${BUDDY_NAME}จดให้เอง`,
  'ใบทองบนต้นไม้คือจำนวนวันที่เงินพอใช้ ยิ่งใบเยอะยิ่งสบาย',
  'ก่อนซื้อของชิ้นใหญ่ ลองกด "เช็กก่อนจ่าย" ในหน้าเงินพอถึงดูนะ',
  'ตั้งงบรายเดือนไว้ในหน้าตั้งค่า แล้วจะเห็นว่าเดือนนี้ใช้ไปกี่เปอร์เซ็นต์',
  'สงสัยอะไรเรื่องเงิน ถามโค้ชได้เลย เช่น หมวดไหนควรลดก่อน',
  'เงินสำรองคือเงินที่ไม่นับเป็นเงินใช้ เผื่อไว้ยามฉุกเฉินนะ',
  'จดทุกวันนิดเดียว ต้นไม้เงินก็โตได้ทุกวัน',
  'ขี้เกียจพิมพ์? แตะไมค์ทองแล้วพูดว่า "ข้าว 50 บาท" ก็จดให้แล้ว',
];

/** After this many taps in a row the companion giggles instead of giving a tip. */
export const BUDDY_TICKLE_AFTER = 6;

/**
 * What the companion says when the user taps it (`n` = taps so far, from 1).
 * Tips in turn, so two taps in a row never repeat; a kind word first when money
 * is tight; and a giggle when tapped a lot.
 */
export function buddyPoke(n: number, status: RunwayStatus): BuddyLine {
  if (n >= BUDDY_TICKLE_AFTER && n % BUDDY_TICKLE_AFTER === 0) {
    return { mood: 'cheer', text: `จั๊กจี้แล้วน้า~ ${BUDDY_NAME}ยังอยู่ตรงนี้ ไปจดรายการต่อกันดีกว่า` };
  }
  const tight = status === 'critical' || status === 'below_floor';
  if (tight && n % 3 === 1) {
    return { mood: 'calm', text: `ไม่เป็นไรนะ เดือนไหนตึงก็ค่อย ๆ ปรับไปด้วยกัน ${BUDDY_NAME}เป็นกำลังใจให้` };
  }
  const tip = BUDDY_TIPS[(n - 1) % BUDDY_TIPS.length];
  return { mood: n % 2 === 0 ? 'happy' : 'thinking', text: tip };
}

/**
 * What the money tree means, said when the user taps the tree: gold leaves
 * are the days the money lasts (a full tree = 45 days or more).
 */
export function treeLine(p: { status: RunwayStatus; days: number | null; capped: boolean }): BuddyLine {
  if (p.status === 'no_spending' || p.days === null) {
    return { mood: 'thinking', text: 'ใบทองบอกว่าเงินพอใช้อีกกี่วัน ตอนนี้ 7 วันล่าสุดยังไม่มีรายจ่าย ต้นไม้เลยยังนับไม่ได้' };
  }
  if (p.status === 'below_floor') {
    return { mood: 'worried', text: 'ใบทองร่วงเกือบหมด เพราะเงินต่ำกว่าเงินสำรองแล้ว ลองใช้เท่าที่จำเป็นสักพัก ใบจะกลับมานะ' };
  }
  if (p.capped) return { mood: 'cheer', text: 'ใบทองเต็มต้น! เงินพอใช้เกิน 1 ปี ต้นไม้เงินแข็งแรงสุด ๆ' };
  if (p.status === 'critical') {
    return { mood: 'worried', text: `ใบทองเหลือน้อย เงินพอใช้อีก ${p.days} วัน ใช้น้อยลงวันละนิด ใบทองจะเพิ่มขึ้น` };
  }
  if (p.status === 'watch') {
    return { mood: 'calm', text: `ใบทองคือวันที่เงินพอใช้ ตอนนี้ ${p.days} วัน ยิ่งใช้น้อยลง ใบทองยิ่งเต็มต้น` };
  }
  return { mood: 'happy', text: `ใบทองคือวันที่เงินพอใช้ ตอนนี้ ${p.days} วัน ต้นไม้เงินงามมาก รักษาไว้แบบนี้นะ` };
}
