/**
 * FR-5 AI coach (น้องกล้า) — the data side.
 *
 * The coach is น้องกล้า, and it only talks about CONFIRMED data. This file:
 *   1. finds simple, checkable facts ("food is up 40% this week") with plain rules,
 *      so the coach still works offline and every claim can be traced to numbers;
 *   2. words those facts in น้องกล้า's voice: calm, warm, never pushy;
 *   3. builds the compact data summary sent to the AI for free-form questions.
 *
 * Voice rule: inform -> explain -> suggest -> let the user decide.
 * Never shame ("คุณใช้เงินเยอะเกินไป!").
 */
import { BUDDY_NAME } from './buddy';
import { getCategory } from './categories';
import { addDays, bkkDayKey, formatThaiDay } from './dates';
import { formatBaht } from './money';
import type { Runway } from './runway';
import { confirmedOnly, monthExpense } from './summary';
import type { Profile, Transaction } from './types';

export type InsightKind = 'category_up' | 'budget_pace' | 'runway' | 'no_data' | 'steady';

export interface Insight {
  kind: InsightKind;
  severity: 'good' | 'info' | 'watch';
  /** The fact in neutral words, with the numbers behind it. */
  fact: string;
  /** The same fact in น้องกล้า's voice. */
  message: string;
}

function sumExpense(txs: Transaction[], from: string, to: string, categoryKey?: string) {
  return txs
    .filter((t) => t.kind === 'expense')
    .filter((t) => !categoryKey || t.categoryKey === categoryKey)
    .filter((t) => {
      const d = bkkDayKey(t.occurredAt);
      return d >= from && d <= to;
    })
    .reduce((s, t) => s + t.amountSatang, 0);
}

/** Category whose last-7-day spend rose most against the 3 weeks before it. */
export function findCategoryIncrease(txs: Transaction[], now: Date = new Date()) {
  const confirmed = confirmedOnly(txs);
  const today = bkkDayKey(now);
  const weekFrom = addDays(today, -6);
  const baseFrom = addDays(today, -27);
  const baseTo = addDays(today, -7);
  const keys = new Set(confirmed.filter((t) => t.kind === 'expense').map((t) => t.categoryKey));
  let best: { key: string; week: number; usualWeek: number; changePct: number } | null = null;
  for (const key of keys) {
    const week = sumExpense(confirmed, weekFrom, today, key);
    const base = sumExpense(confirmed, baseFrom, baseTo, key);
    const usualWeek = Math.round(base / 3);
    if (usualWeek <= 0 || week - usualWeek < 10_000) continue; // ignore rises under ฿100
    const changePct = Math.round(((week - usualWeek) / usualWeek) * 100);
    if (changePct >= 25 && (!best || changePct > best.changePct)) best = { key, week, usualWeek, changePct };
  }
  return best;
}

export function buildInsights(params: {
  txs: Transaction[];
  profile: Profile;
  runway: Runway;
  now?: Date;
}): Insight[] {
  const { txs, profile, runway } = params;
  const now = params.now ?? new Date();
  const out: Insight[] = [];
  const baht = (s: number) => formatBaht(s, { decimals: false });

  if (confirmedOnly(txs).length === 0) {
    out.push({
      kind: 'no_data',
      severity: 'info',
      fact: 'ยังไม่มีรายการที่ยืนยัน',
      message: `ยังไม่มีรายการให้${BUDDY_NAME}ดูเลย ลองสแกนสลิปหรือจดรายการแรกก่อนนะ ไม่ต้องครบทุกอย่างก็ได้ แล้ว${BUDDY_NAME}จะช่วยดูให้`,
    });
    return out;
  }

  // Runway first: it is the most important number in the app.
  if (runway.status === 'below_floor') {
    const fact = `ยอดคงเหลือ ${formatBaht(runway.balanceSatang)} ต่ำกว่าเส้นเงินสำรอง ${formatBaht(runway.floorSatang)}`;
    out.push({
      kind: 'runway',
      severity: 'watch',
      fact,
      message: `ตอนนี้เงินต่ำกว่าเงินสำรองที่ตั้งไว้ (${formatBaht(runway.floorSatang)}) แล้วนะ ไม่เป็นไร ช่วงนี้ใช้เฉพาะที่จำเป็นก่อน แล้วลองดูว่ามีรายจ่ายไหนเลื่อนออกไปได้บ้าง`,
    });
  } else if (runway.status === 'critical' || runway.status === 'watch') {
    const fact = `ถ้าใช้วันละ ${baht(runway.averageSatang)} เงินจะแตะเส้นสำรองใน ${runway.days} วัน (${formatThaiDay(runway.depletionDay!, { year: false })})`;
    out.push({
      kind: 'runway',
      severity: runway.status === 'critical' ? 'watch' : 'info',
      fact,
      message: `${fact} ใช้น้อยลงวันละหน่อยก็ยืดไปได้อีกหลายวัน ลองกด "ลองปรับ" ในหน้าเงินพอถึงดูด้วยกันนะ`,
    });
  }

  const rise = findCategoryIncrease(txs, now);
  if (rise) {
    const label = getCategory(rise.key).label;
    const fact = `7 วันนี้ใช้หมวด${label} ${baht(rise.week)} สูงกว่าสัปดาห์ปกติ (${baht(rise.usualWeek)}) ${rise.changePct}%`;
    out.push({
      kind: 'category_up',
      severity: 'watch',
      fact,
      message: `สัปดาห์นี้หมวด${label}สูงกว่าปกติ ${rise.changePct}% (${baht(rise.week)} จากปกติราว ${baht(rise.usualWeek)}) ถ้าเป็นช่วงที่ต้องใช้จริงก็ไม่เป็นไร ${BUDDY_NAME}แค่อยากให้รู้ไว้นะ`,
    });
  }

  if (profile.monthlyBudgetSatang) {
    const spent = monthExpense(txs, now);
    const [y, m, d] = bkkDayKey(now).split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const expected = Math.round((profile.monthlyBudgetSatang * d) / daysInMonth);
    const pct = Math.round((spent / profile.monthlyBudgetSatang) * 100);
    const over = spent > profile.monthlyBudgetSatang;
    const ahead = spent > expected * 1.1;
    const fact = `เดือนนี้ใช้ไป ${baht(spent)} จากงบ ${baht(profile.monthlyBudgetSatang)} (${pct}%) ผ่านเดือนมาแล้ว ${Math.round((d / daysInMonth) * 100)}%`;
    const overBy = baht(spent - profile.monthlyBudgetSatang);
    out.push({
      kind: 'budget_pace',
      severity: ahead ? 'watch' : 'good',
      fact,
      message: over
        ? `เดือนนี้ใช้เกินงบไปแล้ว ${overBy} ไม่ต้องโทษตัวเองนะ ลองดูด้วยกันว่าหมวดไหนเกินเพราะอะไร แล้วค่อยตั้งงบเดือนหน้าให้ตรงกับชีวิตจริงขึ้น`
        : ahead
          ? `งบเดือนนี้ไปเร็วกว่าเวลาอยู่บ้าง ใช้ไปแล้ว ${pct}% ช่วงที่เหลือค่อย ๆ ผ่อนลงก็ยังทันนะ`
          : `งบเดือนนี้ยังอยู่ในแผนดีมาก ใช้ไป ${pct}% รักษาจังหวะนี้ไว้นะ ${BUDDY_NAME}ภูมิใจด้วย`,
    });
  }

  if (out.length === 0) {
    out.push({
      kind: 'steady',
      severity: 'good',
      fact: 'รายจ่ายสัปดาห์นี้ใกล้เคียงปกติ',
      message: 'สัปดาห์นี้ใช้เงินสม่ำเสมอดี ไม่มีหมวดไหนน่าห่วงเลย รักษาไว้แบบนี้นะ',
    });
  }
  return out;
}

/**
 * The only data the AI coach receives. Totals and categories, no slip images,
 * no account numbers, no names of people the user paid.
 */
export function buildCoachContext(params: {
  txs: Transaction[];
  profile: Profile;
  balanceSatang: number;
  runway: Runway;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const today = bkkDayKey(now);
  const confirmed = confirmedOnly(params.txs);
  const byCat = (from: string) => {
    const m = new Map<string, number>();
    for (const t of confirmed) {
      if (t.kind !== 'expense') continue;
      const d = bkkDayKey(t.occurredAt);
      if (d < from || d > today) continue;
      m.set(t.categoryKey, (m.get(t.categoryKey) ?? 0) + t.amountSatang);
    }
    return Object.fromEntries(
      [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [getCategory(k).label, formatBaht(v, { decimals: false })]),
    );
  };
  const income30 = confirmed
    .filter((t) => t.kind === 'income' && bkkDayKey(t.occurredAt) >= addDays(today, -29))
    .reduce((s, t) => s + t.amountSatang, 0);
  const r = params.runway;
  return {
    today: formatThaiDay(today),
    balance: formatBaht(params.balanceSatang),
    lowLine: formatBaht(r.floorSatang, { decimals: false }),
    averageDailySpend7d: formatBaht(r.averageSatang, { decimals: false }),
    runway:
      r.status === 'no_spending'
        ? 'ยังคำนวณไม่ได้ (ไม่มีรายจ่ายใน 7 วัน)'
        : r.status === 'below_floor'
          ? 'ต่ำกว่าเส้นเงินสำรองแล้ว'
          : `${r.capped ? 'มากกว่า ' : ''}${r.days} วัน (ถึง ${formatThaiDay(r.depletionDay!)})`,
    monthlyBudget: params.profile.monthlyBudgetSatang ? formatBaht(params.profile.monthlyBudgetSatang, { decimals: false }) : null,
    spentThisMonth: formatBaht(monthExpense(params.txs, now), { decimals: false }),
    expenseByCategoryLast7Days: byCat(addDays(today, -6)),
    expenseByCategoryLast30Days: byCat(addDays(today, -29)),
    incomeLast30Days: formatBaht(income30, { decimals: false }),
  };
}
