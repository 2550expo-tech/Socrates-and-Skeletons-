/**
 * Sample data for demo mode. Dates are always relative to TODAY, so the
 * dashboard and the Money Runway are never empty during a presentation
 * (the old prototype's sample data was fixed to 14 Sep and went stale).
 */
import { addDays, bkkDayKey, bkkToIso } from './dates';
import type { Transaction } from './types';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const DAILY: { title: string; cat: string; min: number; max: number; p: number; time: string }[] = [
  { title: 'รถไปเรียน', cat: 'transport', min: 20, max: 40, p: 0.6, time: '08:10' },
  { title: 'กาแฟยามเช้า', cat: 'food', min: 40, max: 65, p: 0.35, time: '08:40' },
  { title: 'ข้าวกลางวัน', cat: 'food', min: 45, max: 70, p: 0.85, time: '12:15' },
  { title: '7-Eleven', cat: 'convenience', min: 20, max: 90, p: 0.35, time: '16:30' },
  { title: 'ข้าวเย็น', cat: 'food', min: 50, max: 100, p: 0.6, time: '18:45' },
];

const OCCASIONAL: { title: string; cat: string; min: number; max: number; p: number; time: string }[] = [
  { title: 'Shopee', cat: 'shopping', min: 150, max: 590, p: 0.06, time: '21:10' },
  { title: 'ดูหนัง Major', cat: 'fun', min: 160, max: 280, p: 0.06, time: '19:30' },
  { title: 'ถ่ายเอกสาร', cat: 'study', min: 20, max: 80, p: 0.12, time: '10:20' },
  { title: 'Grab', cat: 'transport', min: 80, max: 180, p: 0.08, time: '22:05' },
];

export function buildSampleTransactions(now: Date = new Date(), days = 75): Transaction[] {
  const rnd = seeded(42);
  const today = bkkDayKey(now);
  const out: Transaction[] = [];
  let n = 0;
  const push = (day: string, time: string, p: Omit<Transaction, 'id' | 'createdAt' | 'occurredAt'>) => {
    out.push({ ...p, id: `demo-${++n}`, occurredAt: bkkToIso(day, time), createdAt: new Date().toISOString() });
  };
  const base = { note: null, source: 'manual' as const, status: 'confirmed' as const, slipRef: null, slipImageHash: null, ocrConfidence: null, reviewFlags: [] };

  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    const dom = Number(day.slice(8, 10));
    const nowTime = i === 0 ? bkkToIso(today, '23:59') : null;
    // Allowance on the 1st, part-time pay on the 15th.
    if (dom === 1) push(day, '09:00', { ...base, kind: 'income', amountSatang: 1_000_000, categoryKey: 'allowance', title: 'ค่าขนมจากที่บ้าน' });
    if (dom === 15) push(day, '18:00', { ...base, kind: 'income', amountSatang: 200_000, categoryKey: 'part_time', title: 'ค่าจ้างสอนพิเศษ' });
    if (dom === 5) push(day, '10:00', { ...base, kind: 'expense', amountSatang: 350_000, categoryKey: 'bills', title: 'ค่าหอพัก' });
    for (const item of [...DAILY, ...OCCASIONAL]) {
      if (rnd() > item.p) continue;
      const iso = bkkToIso(day, item.time);
      if (nowTime && iso > new Date(now).toISOString()) continue; // no future items today
      const baht = Math.round(item.min + rnd() * (item.max - item.min));
      push(day, item.time, { ...base, kind: 'expense', amountSatang: baht * 100, categoryKey: item.cat, title: item.title });
    }
  }
  return out;
}

/** Demo users start with this much. Chosen so the balance today leaves about 3–4 weeks of runway. */
export const DEMO_OPENING_BALANCE_SATANG = 300_000;
