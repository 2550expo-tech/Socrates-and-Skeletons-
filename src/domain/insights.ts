/**
 * FR-5 AI Persona Coach — the data side.
 *
 * The coach only talks about CONFIRMED data. This file:
 *   1. finds simple, checkable facts ("food is up 40% this week") with plain rules,
 *      so the coach still works offline and every claim can be traced to numbers;
 *   2. words those facts in the tone the user picked;
 *   3. builds the compact data summary sent to the AI for free-form questions.
 *
 * Tone rule for every persona: inform -> explain -> suggest -> let the user decide.
 * Never shame ("คุณใช้เงินเยอะเกินไป!").
 */
import { getCategory } from './categories';
import { addDays, bkkDayKey, formatThaiDay } from './dates';
import { formatBaht } from './money';
import type { Runway } from './runway';
import { confirmedOnly, monthExpense } from './summary';
import type { CoachTone, Profile, Transaction } from './types';

export interface CoachPersona {
  tone: CoachTone;
  name: string;
  tagline: string;
  glyph: string;
}

export const PERSONAS: CoachPersona[] = [
  { tone: 'friend', name: 'เพื่อนซี้', tagline: 'คุยสบาย ๆ ไม่กดดัน', glyph: '🌱' },
  { tone: 'coach', name: 'โค้ชตรงประเด็น', tagline: 'สั้น ชัด มีตัวเลขและสิ่งที่ต้องทำ', glyph: '🎯' },
  { tone: 'senior', name: 'พี่ใจดี', tagline: 'อบอุ่น ให้กำลังใจ อธิบายละเอียด', glyph: '🌳' },
];

export const personaFor = (tone: CoachTone) => PERSONAS.find((p) => p.tone === tone) ?? PERSONAS[0];

export type InsightKind = 'category_up' | 'budget_pace' | 'runway' | 'no_data' | 'steady';

export interface Insight {
  kind: InsightKind;
  severity: 'good' | 'info' | 'watch';
  /** The fact in neutral words, with the numbers behind it. */
  fact: string;
  /** The same fact in the persona's voice. */
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

function voice(tone: CoachTone, parts: { friend: string; coach: string; senior: string }) {
  return parts[tone];
}

export function buildInsights(params: {
  txs: Transaction[];
  profile: Profile;
  runway: Runway;
  now?: Date;
}): Insight[] {
  const { txs, profile, runway } = params;
  const now = params.now ?? new Date();
  const tone = profile.coachTone;
  const out: Insight[] = [];

  if (confirmedOnly(txs).length === 0) {
    const fact = 'ยังไม่มีรายการที่ยืนยัน';
    out.push({
      kind: 'no_data',
      severity: 'info',
      fact,
      message: voice(tone, {
        friend: 'ยังไม่มีข้อมูลให้ดูเลย ลองสแกนสลิปหรือจดรายการแรกก่อนนะ แล้วเราจะช่วยดูให้',
        coach: 'ยังไม่มีข้อมูล เริ่มจากสแกนสลิป 7 วันล่าสุด แล้วค่อยกลับมาดูภาพรวม',
        senior: 'เริ่มจากจดรายการแรกก่อนนะ ไม่ต้องครบทุกอย่างก็ได้ ค่อย ๆ เติมไป เดี๋ยวพี่ช่วยดูให้',
      }),
    });
    return out;
  }

  // Runway first: it is the most important number in the app.
  if (runway.status === 'below_floor') {
    const fact = `ยอดคงเหลือ ${formatBaht(runway.balanceSatang)} ต่ำกว่าเส้นเงินสำรอง ${formatBaht(runway.floorSatang)}`;
    out.push({ kind: 'runway', severity: 'watch', fact, message: voice(tone, {
      friend: `ตอนนี้เงินต่ำกว่าเส้นสำรองที่ตั้งไว้แล้วนะ (${formatBaht(runway.floorSatang)}) ช่วงนี้ใช้เฉพาะที่จำเป็นก่อนดีไหม`,
      coach: `${fact} งดรายจ่ายที่เลื่อนได้จนกว่าจะมีรายรับเข้า`,
      senior: `ตอนนี้เงินต่ำกว่าเงินสำรองที่น้องตั้งไว้แล้ว ไม่เป็นไรนะ ลองดูว่ามีรายจ่ายไหนเลื่อนออกไปได้บ้าง`,
    }) });
  } else if (runway.status === 'critical' || runway.status === 'watch') {
    const fact = `ถ้าใช้วันละ ${formatBaht(runway.averageSatang, { decimals: false })} เงินจะแตะเส้นสำรองใน ${runway.days} วัน (${formatThaiDay(runway.depletionDay!, { year: false })})`;
    out.push({ kind: 'runway', severity: runway.status === 'critical' ? 'watch' : 'info', fact, message: voice(tone, {
      friend: `${fact} ถ้าลดลงนิดหน่อยจะยืดไปได้อีกหลายวันเลย`,
      coach: `${fact} ลองกด "ลองปรับ" ในหน้าเงินพอถึง เพื่อดูว่าลดเท่าไหร่ถึงพอ`,
      senior: `${fact} ไม่ต้องตกใจนะ ลองดูหน้าเงินพอถึงด้วยกัน จะเห็นว่าปรับนิดเดียวก็ช่วยได้เยอะ`,
    }) });
  }

  const rise = findCategoryIncrease(txs, now);
  if (rise) {
    const label = getCategory(rise.key).label;
    const fact = `7 วันนี้ใช้หมวด${label} ${formatBaht(rise.week, { decimals: false })} สูงกว่าสัปดาห์ปกติ (${formatBaht(rise.usualWeek, { decimals: false })}) ${rise.changePct}%`;
    out.push({ kind: 'category_up', severity: 'watch', fact, message: voice(tone, {
      friend: `สัปดาห์นี้หมวด${label}มาแรงนะ ${formatBaht(rise.week, { decimals: false })} ปกติอยู่ที่ราว ${formatBaht(rise.usualWeek, { decimals: false })} มีอะไรพิเศษหรือเปล่า`,
      coach: `${fact} ตั้งเพดานหมวดนี้สัปดาห์หน้าไว้ที่ ${formatBaht(rise.usualWeek, { decimals: false })}`,
      senior: `สัปดาห์นี้หมวด${label}สูงกว่าปกติ ${rise.changePct}% ถ้าเป็นช่วงที่ต้องใช้จริงก็ไม่เป็นไร แค่อยากให้รู้ไว้นะ`,
    }) });
  }

  if (profile.monthlyBudgetSatang) {
    const spent = monthExpense(txs, now);
    const [y, m, d] = bkkDayKey(now).split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const expected = Math.round((profile.monthlyBudgetSatang * d) / daysInMonth);
    const pct = Math.round((spent / profile.monthlyBudgetSatang) * 100);
    const over = spent > profile.monthlyBudgetSatang;
    const ahead = spent > expected * 1.1;
    const fact = `เดือนนี้ใช้ไป ${formatBaht(spent, { decimals: false })} จากงบ ${formatBaht(profile.monthlyBudgetSatang, { decimals: false })} (${pct}%) ผ่านเดือนมาแล้ว ${Math.round((d / daysInMonth) * 100)}%`;
    const overBy = formatBaht(spent - profile.monthlyBudgetSatang, { decimals: false });
    out.push({ kind: 'budget_pace', severity: ahead ? 'watch' : 'good', fact, message: over
      ? voice(tone, {
          friend: `เดือนนี้ใช้เกินงบไปแล้ว ${overBy} ไม่เป็นไรนะ ลองดูว่าเดือนหน้าจะตั้งงบเท่าเดิมหรือปรับให้ตรงกับชีวิตจริงขึ้น`,
          coach: `${fact} เกินงบ ${overBy} ช่วงที่เหลือของเดือนใช้เฉพาะที่จำเป็น และทบทวนงบเดือนหน้า`,
          senior: `เดือนนี้ใช้เกินงบไป ${overBy} แล้ว ไม่ต้องโทษตัวเองนะ ลองดูด้วยกันว่าหมวดไหนเกินเพราะอะไร`,
        })
      : ahead
      ? voice(tone, {
          friend: `งบเดือนนี้ไปเร็วกว่าเวลานิดนึง (${pct}%) ช่วงที่เหลือค่อย ๆ ผ่อนลงก็ทันนะ`,
          coach: `${fact} ใช้เร็วกว่าแผน ลดรายจ่ายรายวันลงให้กลับมาตามแผน`,
          senior: `เดือนนี้ใช้งบไป ${pct}% แล้ว เร็วกว่าเวลาอยู่นิดหน่อย ยังมีเวลาปรับนะ`,
        })
      : voice(tone, {
          friend: `งบเดือนนี้ยังอยู่ในแผนดีเลย (${pct}%) เก่งมาก`,
          coach: `${fact} อยู่ในแผน รักษาจังหวะนี้ไว้`,
          senior: `เดือนนี้ใช้เงินได้ตามแผนดีมาก (${pct}%) ภูมิใจในตัวเองได้เลยนะ`,
        }) });
  }

  if (out.length === 0) {
    out.push({ kind: 'steady', severity: 'good', fact: 'รายจ่ายสัปดาห์นี้ใกล้เคียงปกติ', message: voice(tone, {
      friend: 'สัปดาห์นี้ใช้เงินสม่ำเสมอดี ไม่มีอะไรน่าห่วง',
      coach: 'รายจ่ายคงที่ตามปกติ ไม่มีหมวดไหนเกินเกณฑ์',
      senior: 'สัปดาห์นี้ใช้เงินสม่ำเสมอดีมากเลย รักษาไว้แบบนี้นะ',
    }) });
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
