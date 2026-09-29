/**
 * TC-73: น้องกล้า's skins — who owns what, limited skins by date, and what the
 * collection says about each one.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SKIN, formatWindow, isSkinId, limitedOpenToday, skinById, SKINS, skinState, skinStatusLine, wearable } from '../skins';

describe('Skins', () => {
  it('TC-73 every skin has a unique id and a Thai name; limited skins have a window', () => {
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(SKINS.length);
    expect(SKINS.length).toBe(19);
    for (const s of SKINS) {
      expect(s.name).toMatch(/[฀-๿]/);
      expect(!!s.window).toBe(s.kind === 'limited');
      if (s.window) expect(s.window.from <= s.window.to).toBe(true);
    }
    expect(skinById('nope').id).toBe(DEFAULT_SKIN);
    expect(isSkinId('thai')).toBe(true);
    expect(isSkinId('gold')).toBe(false);
  });

  it('TC-73 limited skins: collectable only inside their window, "หมดเวลาแล้ว" after it, "เร็ว ๆ นี้" before it', () => {
    const none = new Set<string>();
    const pioneer = skinById('pioneer');
    expect(skinState(pioneer, none, '2026-09-29')).toEqual({ kind: 'limited_open', until: '2026-10-31' });
    expect(skinState(pioneer, none, '2026-11-01')).toEqual({ kind: 'limited_ended' });
    expect(skinState(pioneer, new Set(['pioneer']), '2027-05-01')).toEqual({ kind: 'owned' }); // kept for good
    expect(skinState(skinById('newyear2570'), none, '2026-09-29')).toEqual({ kind: 'limited_soon', from: '2026-12-25' });
    expect(skinState(skinById('songkran2569'), none, '2026-09-29')).toEqual({ kind: 'limited_ended' });
    expect(limitedOpenToday('2026-09-29')).toEqual(['pioneer', 'pumpkin']); // Halloween candy skins need candies
    expect(limitedOpenToday('2027-01-01')).toEqual(['newyear2570']);
    expect(limitedOpenToday('2026-12-01')).toEqual([]);

    expect(skinStatusLine(skinById('songkran2569'), { kind: 'limited_ended' })).toBe('สกินลิมิเต็ด · หมดเวลาแล้ว หาไม่ได้อีก (แจกช่วง 10–16 เม.ย. 2569)');
    expect(skinStatusLine(skinById('newyear2570'), { kind: 'limited_soon', from: '2026-12-25' })).toContain('25 ธ.ค. 2569 – 5 ม.ค. 2570');
    expect(formatWindow({ from: '2025-12-25', to: '2026-01-05' })).toBe('25 ธ.ค. 2568 – 5 ม.ค. 2569');
  });

  it('TC-73 mission skins stay locked until owned; the starter look is always there; only owned skins can be worn', () => {
    expect(skinState(skinById('thai'), new Set(), '2026-09-29')).toEqual({ kind: 'locked' });
    expect(skinState(skinById('thai'), new Set(['thai']), '2026-09-29')).toEqual({ kind: 'owned' });
    expect(skinState(skinById('classic'), new Set(), '2026-09-29')).toEqual({ kind: 'owned' });
    expect(wearable('thai', new Set(['thai']))).toBe('thai');
    expect(wearable('thai', new Set())).toBe(DEFAULT_SKIN);
    expect(wearable('made-up', new Set(['made-up']))).toBe(DEFAULT_SKIN);
    expect(wearable(undefined, new Set())).toBe(DEFAULT_SKIN);
  });
});
