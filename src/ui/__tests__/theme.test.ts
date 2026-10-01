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
