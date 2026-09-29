/**
 * MindPay design system tokens.
 *
 * Brand: Green (money, growth, stability) + Gold (accent for what matters most).
 * Rule from the brand direction: green is for structure, gold is used sparingly
 * for the single most important thing on a screen (the balance, the main action).
 * Never paint a whole screen green.
 */
import { useSchemeChoice } from './themeMode';

export const palette = {
  forest: '#0E3B2C', // hero surfaces, brand
  forestDeep: '#082A1F',
  leaf: '#1F7A52', // primary actions, positive
  mint: '#DDEEE3',
  gold: '#C8992A', // accent: balance, main CTA ring, tree leaves
  goldBright: '#E2B64A',
  goldSoft: '#F4E7C2',
  clay: '#B4442F', // critical / expense emphasis
  amber: '#B7791F', // watch
};

export interface Theme {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  line: string;
  primary: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;
  income: string;
  expense: string;
  good: string;
  watch: string;
  critical: string;
  hero: string;
  heroInk: string;
  heroInkSoft: string;
  overlay: string;
}

export const lightTheme: Theme = {
  dark: false,
  bg: '#F2F5F1', // paper with a slight green bias, not cream
  surface: '#FFFFFF',
  surfaceAlt: '#E8EEE8',
  ink: '#11231B',
  inkSoft: '#4B5F55',
  inkFaint: '#8A9A91',
  line: '#D6E0D8',
  primary: palette.leaf,
  onPrimary: '#FFFFFF',
  accent: palette.gold,
  accentSoft: palette.goldSoft,
  income: '#1F7A52',
  expense: '#11231B',
  good: '#2E7D4F',
  watch: palette.amber,
  critical: palette.clay,
  hero: palette.forest,
  heroInk: '#F4F1E6',
  heroInkSoft: '#B9CEC2',
  overlay: 'rgba(8, 30, 22, 0.45)',
};

export const darkTheme: Theme = {
  dark: true,
  bg: '#0A1410',
  surface: '#111E18',
  surfaceAlt: '#182820',
  ink: '#E7EFE9',
  inkSoft: '#A2B6AA',
  inkFaint: '#6B8076',
  line: '#22362B',
  primary: '#3FA774',
  onPrimary: '#06140E',
  accent: palette.goldBright,
  accentSoft: '#3A3118',
  income: '#5CC08E',
  expense: '#E7EFE9',
  good: '#5CC08E',
  watch: '#E0A548',
  critical: '#E07A63',
  hero: '#0F3326',
  heroInk: '#F4F1E6',
  heroInkSoft: '#9DB8A8',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export function useTheme(): Theme {
  return useSchemeChoice() === 'dark' ? darkTheme : lightTheme;
}

/**
 * Two typefaces:
 * - Noto Serif Thai for money and headings: the "international banking" feel
 *   from the logo direction, and clear numerals.
 * - Anuphan for everything else: a modern Thai sans that reads well small.
 */
export const fonts = {
  serif: 'NotoSerifThai_600SemiBold',
  serifBold: 'NotoSerifThai_700Bold',
  sans: 'Anuphan_400Regular',
  sansMedium: 'Anuphan_500Medium',
  sansSemi: 'Anuphan_600SemiBold',
  sansBold: 'Anuphan_700Bold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };
export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 };

/** Type scale (size / line height). Thai needs generous line height for vowels above and below. */
export const type = {
  display: { fontSize: 38, lineHeight: 52 },
  h1: { fontSize: 26, lineHeight: 38 },
  h2: { fontSize: 20, lineHeight: 30 },
  h3: { fontSize: 17, lineHeight: 26 },
  body: { fontSize: 15, lineHeight: 24 },
  small: { fontSize: 13, lineHeight: 20 },
  micro: { fontSize: 11, lineHeight: 16 },
};
