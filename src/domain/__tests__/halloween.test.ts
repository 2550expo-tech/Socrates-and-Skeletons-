/**
 * TC-77: ฮาโลวีน 2569 — ghosts to catch each day, candies from ghosts and from
 * days with a record, and the Halloween skins they unlock.
 */
import { describe, expect, it } from 'vitest';
import { bkkToIso } from '../dates';
import { catchGhost, countCandies, ghostsLeft, ghostSays, HALLOWEEN, halloweenOn } from '../halloween';
import { limitedOpenToday, skinById, skinState } from '../skins';

const rec = (day: string) => ({ source: 'manual' as const, createdAt: bkkToIso(day), occurredAt: bkkToIso(day) });

describe('Halloween', () => {
  it('TC-77 the event runs from 29 Sep to 2 Nov 2569; three ghosts a day can be caught', () => {
    expect(halloweenOn('2026-09-28')).toBe(false);
    expect(halloweenOn(HALLOWEEN.from)).toBe(true);
    expect(halloweenOn('2026-10-31')).toBe(true);
    expect(halloweenOn('2026-11-03')).toBe(false);
    let caught = {};
    for (let i = 0; i < 5; i++) caught = catchGhost(caught, '2026-10-10');
    expect(caught).toEqual({ '2026-10-10': 3 }); // never more than 3 a day
    expect(ghostsLeft(caught, '2026-10-10')).toBe(0);
    expect(ghostsLeft(caught, '2026-10-11')).toBe(3);
    expect(ghostsLeft({}, '2026-12-01')).toBe(0); // no ghosts after the event
    expect(catchGhost({}, '2026-12-01')).toEqual({});
    expect(ghostSays(4)).toContain('มี 4 เม็ด');
  });

  it('TC-77 candies: 1 per ghost, 2 per day with a record during the event (days outside do not count)', () => {
    const c = countCandies({
      caught: { '2026-10-01': 3, '2026-10-02': 2, '2026-09-01': 3, '2026-10-03': 9 },
      txs: [rec('2026-10-01'), rec('2026-10-01'), rec('2026-10-05'), rec('2026-09-10')],
    });
    expect(c).toEqual({ fromGhosts: 8, fromRecords: 4, recordDays: 2, total: 12 });
  });

  it('TC-77 Halloween skins: the pumpkin ghost is free during the event; the others need candies; after it they are gone', () => {
    const none = new Set<string>();
    expect(limitedOpenToday('2026-10-10', 0)).toContain('pumpkin');
    expect(limitedOpenToday('2026-10-10', 0)).not.toContain('sheetghost');
    expect(limitedOpenToday('2026-10-10', 12)).toEqual(expect.arrayContaining(['pumpkin', 'sheetghost', 'witch']));
    expect(limitedOpenToday('2026-10-10', 12)).not.toContain('mummy');
    expect(limitedOpenToday('2026-10-10', 40)).toContain('frankenstein');
    expect(skinState(skinById('frankenstein'), none, '2026-10-10', 7)).toEqual({ kind: 'candy', need: 40, have: 7, until: HALLOWEEN.to });
    expect(skinState(skinById('frankenstein'), none, '2026-11-10', 99)).toEqual({ kind: 'limited_ended' });
    expect(skinState(skinById('frankenstein'), new Set(['frankenstein']), '2027-03-01')).toEqual({ kind: 'owned' });
  });
});
