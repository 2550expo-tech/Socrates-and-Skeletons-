/**
 * ฮาโลวีน 2569: a spooky-cute event the user can join by choosing the
 * Halloween colour theme. Little ghosts float on the home screen; catching
 * one gives a candy (ลูกอม), and so does every day with a record. Candies
 * unlock the Halloween skins for น้องกล้า (src/domain/skins.ts), which are
 * limited: after the event they cannot be collected any more.
 * Unit tests: __tests__/halloween.test.ts.
 */
import { activityDay } from './achievements';
import { BUDDY_NAME } from './buddy';
import type { Transaction } from './types';

export const HALLOWEEN = {
  /** Bangkok days (inclusive). Opens a little early to welcome October. */
  from: '2026-09-29',
  to: '2026-11-02',
  /** Ghosts that can be caught each day. */
  ghostsPerDay: 3,
  /** Candies for each day with at least one record. */
  candiesPerRecordDay: 2,
} as const;

export function halloweenOn(today: string): boolean {
  return today >= HALLOWEEN.from && today <= HALLOWEEN.to;
}

/** Ghosts caught per Bangkok day, as kept on the phone. */
export type GhostCatches = Readonly<Record<string, number>>;

export function ghostsLeft(caught: GhostCatches, today: string): number {
  if (!halloweenOn(today)) return 0;
  return Math.max(0, HALLOWEEN.ghostsPerDay - (caught[today] ?? 0));
}

/** One more ghost caught today (never more than the daily number, only during the event). */
export function catchGhost(caught: GhostCatches, today: string): Record<string, number> {
  if (ghostsLeft(caught, today) === 0) return { ...caught };
  return { ...caught, [today]: (caught[today] ?? 0) + 1 };
}

export interface Candies {
  total: number;
  fromGhosts: number;
  fromRecords: number;
  /** Days with a record during the event. */
  recordDays: number;
}

export function countCandies(p: { txs: Pick<Transaction, 'source' | 'createdAt' | 'occurredAt'>[]; caught: GhostCatches }): Candies {
  let fromGhosts = 0;
  for (const [day, n] of Object.entries(p.caught)) {
    if (halloweenOn(day)) fromGhosts += Math.min(HALLOWEEN.ghostsPerDay, Math.max(0, Math.floor(n)));
  }
  const days = new Set(p.txs.map(activityDay).filter(halloweenOn));
  const fromRecords = days.size * HALLOWEEN.candiesPerRecordDay;
  return { total: fromGhosts + fromRecords, fromGhosts, fromRecords, recordDays: days.size };
}

/** What a caught ghost says. */
export function ghostSays(total: number): string {
  const lines = ['บู้! ตกใจไหม 👻', 'บู้ว~ หลอกเล่นเฉย ๆ', 'จ๊ะเอ๋! ผีน้อยใจดี', 'บู้! เอาลูกอมไปเลย'];
  return `${lines[total % lines.length]} ได้ลูกอม 1 เม็ด (มี ${total} เม็ด)`;
}

/** น้องกล้า's spooky-cute Halloween lines (said when tapped in the Halloween theme). */
export const HALLOWEEN_LINES: readonly string[] = [
  `ฮาโลวีนนี้ ระวังผีค่าขนมมาหลอกเงินในกระเป๋านะ ${BUDDY_NAME}ช่วยจดให้`,
  'ผีที่น่ากลัวที่สุดคือยอดบัตรปลายเดือน จดไว้ก่อนจะไม่หลอนนะ',
  'จับผีบนหน้าหลักได้วันละ 3 ตัว ได้ลูกอมไปแลกชุดฮาโลวีน',
  'จดรายการวันไหน ได้ลูกอม 2 เม็ด ครบแล้วชุดแฟรงเกนสไตน์รออยู่',
  'Trick or treat! เก็บเงินไว้เป็น treat ของตัวเองดีกว่านะ',
];
