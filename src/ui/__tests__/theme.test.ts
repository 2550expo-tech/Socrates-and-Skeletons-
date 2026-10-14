/**
 * TC-78: every colour theme stays readable. The snackbar message and its
 * button, and the main text on the page, reach WCAG AA (4.5:1) in light and
 * dark mode, including the Halloween theme.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Appearance: { setColorScheme: () => {} }, Platform: { OS: 'web' }, useColorScheme: () => 'light' }));
vi.mock('../../data/storage', () => ({ Storage: { getItem: async () => null, setItem: async () => {} } }));

const { COLOR_THEMES, buildTheme, contrast, readableOn } = await import('../theme');

describe('TC-78 colour themes stay readable', () => {
  it('contrast() matches known WCAG values', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
    expect(readableOn('#FFFFFF', '#FFFF00', '#000000')).toBe('#000000');
  });

  for (const spec of COLOR_THEMES) {
    for (const dark of [false, true]) {
      it(`${spec.key} ${dark ? 'dark' : 'light'}: text, snackbar and its button`, () => {
        const t = buildTheme(spec.key, dark);
        expect(contrast(t.ink, t.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.ink, t.surface)).toBeGreaterThanOrEqual(4.5);
        // Snackbar: message in the page colour on the ink, button as chosen in ui/feedback.tsx.
        expect(contrast(t.bg, t.ink)).toBeGreaterThanOrEqual(4.5);
        const action = readableOn(t.ink, dark ? buildTheme(spec.key, false).primary : t.accent, t.bg);
        expect(contrast(action, t.ink)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  for (const spec of COLOR_THEMES) {
    for (const dark of [false, true]) {
      it(`${spec.key} ${dark ? 'dark' : 'light'}: every text colour reads on the background it is used on`, () => {
        const t = buildTheme(spec.key, dark);
        const pairs: [string, string, string][] = [
          ['inkSoft on bg', t.inkSoft, t.bg],
          ['inkSoft on surface', t.inkSoft, t.surface],
          ['onPrimary on primary', t.onPrimary, t.primary],
          ['onAccent on accent', t.onAccent, t.accent],
          ['accentInk on surface', t.accentInk, t.surface],
          ['accentInk on accentSoft', t.accentInk, t.accentSoft],
          ['good on goodSoft', t.good, t.goodSoft],
          ['watch on watchSoft', t.watch, t.watchSoft],
          ['critical on criticalSoft', t.critical, t.criticalSoft],
          ['good on bg', t.good, t.bg],
          ['watch on bg', t.watch, t.bg],
          ['critical on bg', t.critical, t.bg],
          ['heroInkSoft on hero', t.heroInkSoft, t.hero],
          ['heroInk on heroTop', t.heroInk, t.heroTop],
          // Text also sits at the top of the hero gradient, where it is lightest (pre-ship D4-1).
          ['heroInkSoft on heroTop', t.heroInkSoft, t.heroTop],
          ['heroIncome on heroTop', t.heroIncome, t.heroTop],
          ['heroIncome on hero', t.heroIncome, t.hero],
          ['heroCritical on heroTop', t.heroCritical, t.heroTop],
          ['heroCritical on hero', t.heroCritical, t.hero],
        ];
        const low = pairs.filter(([, a, b]) => contrast(a, b) < 4.5).map(([n, a, b]) => `${n} ${contrast(a, b).toFixed(2)}`);
        expect(low).toEqual([]);
      });
    }
  }

  it('the Halloween theme is one of the choices', () => {
    expect(COLOR_THEMES.map((t) => t.key)).toContain('halloween');
  });
});

describe('TC-95 MindPay ใหม่: control edges and category icons stand out (WCAG 1.4.11, 3:1)', () => {
  it('every theme, light and dark: inputs/switches use lineStrong, category icons read on their tiles', async () => {
    const { categoryLook } = await import('../category');
    const { CATEGORIES } = await import('../../domain/categories');
    for (const spec of COLOR_THEMES) {
      for (const dark of [false, true]) {
        const t = buildTheme(spec.key, dark);
        expect(contrast(t.lineStrong, t.surface), `${spec.key} ${dark} lineStrong`).toBeGreaterThanOrEqual(3);
        expect(contrast(t.lineStrong, t.bg), `${spec.key} ${dark} lineStrong/bg`).toBeGreaterThanOrEqual(3);
        for (const c of CATEGORIES) {
          const look = categoryLook(c.key, t);
          expect(contrast(look.ink, look.tile), `${spec.key} ${dark} ${c.key}`).toBeGreaterThanOrEqual(3);
        }
        // Placeholders now use inkSoft: readable as text on inputs.
        expect(contrast(t.inkSoft, t.surface)).toBeGreaterThanOrEqual(4.5);
        // The lit streak flame stands out from the page and from the hero (pre-ship D1-2).
        expect(contrast(t.streak, t.bg), `${spec.key} ${dark} streak`).toBeGreaterThanOrEqual(3);
        expect(contrast(t.heroStreak, t.heroTop), `${spec.key} ${dark} heroStreak`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
