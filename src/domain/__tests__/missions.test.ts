/**
 * TC-74, TC-75: money missions (ภารกิจการเงิน) that unlock น้องกล้า's skins,
 * including "open the app 30 days in a row" for the Thai costume.
 */
import { describe, expect, it } from 'vitest';
import { VOICE_NOTE } from '../achievements';
import { addDays, bkkToIso } from '../dates';
import { computeMissions, missionForSkin, openStreak, recordOpen, type MissionInput } from '../missions';
import type { Transaction } from '../types';

const TODAY = '2026-09-29';
let n = 0;
function tx(day: string, over: Partial<Transaction> = {}): Transaction {
  const at = bkkToIso(day, '12:00');
  return {
    id: `m${++n}`,
    kind: 'expense',
    amountSatang: 10_000,
    categoryKey: 'food',
    title: 'ข้าว',
    note: null,
    occurredAt: at,
    source: 'manual',
    status: 'confirmed',
    slipRef: null,
    slipImageHash: null,
    ocrConfidence: null,
    reviewFlags: [],
    createdAt: at,
    ...over,
  };
}
const base: MissionInput = { txs: [], openDays: [TODAY], recordBest: 0, badgesEarned: 0, goals: [], monthlyBudgetSatang: null, today: TODAY };
const mission = (p: Partial<MissionInput>, id: string) => computeMissions({ ...base, ...p }).find((m) => m.id === id)!;

describe('Open days', () => {
  it('TC-74 counts days in a row the app was opened, ending today; a missed day starts again', () => {
    const run = (k: number) => Array.from({ length: k }, (_, i) => addDays(TODAY, -i));
    expect(openStreak(run(30), TODAY)).toBe(30);
    expect(openStreak([...run(3), addDays(TODAY, -5)], TODAY)).toBe(3);
    expect(openStreak(run(10).slice(1), TODAY)).toBe(0); // not opened today yet
    expect(recordOpen(['2026-09-27', '2026-09-28'], TODAY)).toEqual(['2026-09-27', '2026-09-28', TODAY]);
    expect(recordOpen([TODAY], TODAY)).toEqual([TODAY]);
    expect(recordOpen(run(200), addDays(TODAY, 1), 120)).toHaveLength(120);

    expect(mission({ openDays: run(29) }, 'open_30')).toMatchObject({ done: false, skin: 'thai', progress: { value: 29, target: 30 } });
    expect(mission({ openDays: run(30) }, 'open_30')).toMatchObject({ done: true, skin: 'thai' });
  });
});

describe('Money missions', () => {
  it('TC-75 each mission counts the user’s own records and names the skin it unlocks', () => {
    const all = computeMissions(base);
    expect(all.map((m) => m.id)).toEqual(['open_30', 'streak_14', 'slips_20', 'voice_10', 'goal_done', 'thrifty_week', 'budget_month', 'badges_8']);
    expect(new Set(all.map((m) => m.skin)).size).toBe(all.length); // one skin each
    expect(missionForSkin(all, 'thai')?.id).toBe('open_30');

    expect(mission({ recordBest: 14 }, 'streak_14').done).toBe(true);
    const slips = Array.from({ length: 20 }, () => tx(TODAY, { source: 'slip' }));
    expect(mission({ txs: slips.slice(0, 19) }, 'slips_20').progress).toEqual({ value: 19, target: 20 });
    expect(mission({ txs: [...slips.slice(0, 19), tx(TODAY, { source: 'slip', status: 'draft' })] }, 'slips_20').done).toBe(false); // drafts do not count
    expect(mission({ txs: slips }, 'slips_20').done).toBe(true);
    const voice = Array.from({ length: 10 }, () => tx(TODAY, { note: VOICE_NOTE }));
    expect(mission({ txs: voice }, 'voice_10').done).toBe(true);
    expect(mission({ badgesEarned: 8 }, 'badges_8').done).toBe(true);

    // Savings jar: the closest one in percent, done when one is full.
    expect(mission({ goals: [{ savedSatang: 45_000, targetSatang: 100_000 }] }, 'goal_done')).toMatchObject({ done: false, progress: { value: 45, target: 100 } });
    expect(mission({ goals: [{ savedSatang: 100_000, targetSatang: 100_000 }] }, 'goal_done').done).toBe(true);
    expect(mission({}, 'goal_done').note).toContain('ยังไม่มีกระปุก');
  });

  it('TC-75 thrifty week compares the last 7 days with the 7 before; a budget month needs a full, recorded month within budget', () => {
    const week = (ago: number, baht: number) => tx(addDays(TODAY, -ago), { amountSatang: baht * 100 });
    const thrifty = mission({ txs: [week(1, 300), week(9, 500)] }, 'thrifty_week');
    expect(thrifty).toMatchObject({ done: true, skin: 'chill' });
    expect(thrifty.note).toBe('7 วันนี้ ฿300 · 7 วันก่อน ฿500');
    expect(mission({ txs: [week(1, 600), week(9, 500)] }, 'thrifty_week').done).toBe(false);

    // August 2026: 10 records, ฿2,000 in all.
    const august = Array.from({ length: 10 }, (_, i) => tx(`2026-08-${String(i + 10).padStart(2, '0')}`, { amountSatang: 20_000 }));
    expect(mission({ txs: august }, 'budget_month').note).toContain('ตั้งงบรายเดือน');
    expect(mission({ txs: august, monthlyBudgetSatang: 300_000 }, 'budget_month')).toMatchObject({ done: true, skin: 'hero' });
    expect(mission({ txs: august, monthlyBudgetSatang: 150_000 }, 'budget_month').done).toBe(false); // over budget
    expect(mission({ txs: august.slice(0, 9), monthlyBudgetSatang: 300_000 }, 'budget_month').done).toBe(false); // too few records
  });
});
