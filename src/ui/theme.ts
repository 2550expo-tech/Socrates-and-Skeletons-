/**
 * MindPay design system tokens.
 *
 * Brand: Green (money, growth, stability) + Gold (accent for what matters most).
 * Rule from the brand direction: green is for structure, gold is used sparingly
 * for the single most important thing on a screen (the balance, the main action).
 * Never paint a whole screen green.
 */
import { useColorThemeKey, useSchemeChoice } from './themeMode';

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
  /** Which colour theme this is (see COLOR_THEMES). */
  colorTheme: ColorThemeKey;
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
  /** Text and icons on an accent fill (the gold button). */
  onAccent: string;
  /** The accent colour for text and icons on light surfaces: dark enough to read (≥ 4.5:1). */
  accentInk: string;
  income: string;
  expense: string;
  good: string;
  watch: string;
  critical: string;
  /** Soft backgrounds of the meaning colours (badges, notes): text in good/watch/critical reads on them. */
  goodSoft: string;
  watchSoft: string;
  criticalSoft: string;
  /** Hero surfaces (balance card, story screens): a gradient from heroTop to heroDeep. */
  heroTop: string;
  hero: string;
  heroDeep: string;
  /** The bright accent on hero surfaces: the balance, the money tree's leaves, rings. */
  heroAccent: string;
  /** Unlit leaves of the money tree on hero surfaces. */
  heroBare: string;
  heroInk: string;
  heroInkSoft: string;
  /** Money in, on hero surfaces (light green that reads on every hero gradient). */
  heroIncome: string;
  overlay: string;
}

export type ColorThemeKey = 'forest' | 'redvelvet' | 'purple' | 'sapphire' | 'amber' | 'sunset' | 'rose' | 'onyx' | 'halloween';

type ModeColors = Pick<Theme, 'bg' | 'surface' | 'surfaceAlt' | 'line' | 'ink' | 'inkSoft' | 'inkFaint' | 'primary' | 'onPrimary' | 'accent' | 'accentSoft'>;

interface ColorThemeSpec {
  key: ColorThemeKey;
  /** Thai name and a short English one, shown in settings. */
  name: string;
  nameEn: string;
  /** Hero gradient (top, middle, deep), in light mode; dark mode starts a little deeper. */
  hero: [string, string, string];
  heroDarkTop: string;
  heroAccent: string;
  heroBare: string;
  heroInkSoft: string;
  light: ModeColors;
  dark: ModeColors;
  /** A festival theme: comes with its own decorations (ghosts, bats), see src/ui/halloween.tsx. */
  festival?: boolean;
}

/**
 * Colour themes: every primary colour (แม่สี) as a quiet jewel tone with a
 * warm metallic accent, easy on the eyes in both light and dark mode.
 * Meaning colours (money in = green, warning, critical) stay the same in
 * every theme so they always read the same.
 */
export const COLOR_THEMES: ColorThemeSpec[] = [
  {
    key: 'forest',
    name: 'ป่าทอง',
    nameEn: 'Forest Gold',
    hero: ['#135A40', '#0E3B2C', '#082A1F'],
    heroDarkTop: '#124232',
    heroAccent: '#E2B64A',
    heroBare: '#6F9483',
    heroInkSoft: '#B9CEC2',
    light: { bg: '#F2F5F1', surface: '#FFFFFF', surfaceAlt: '#E8EEE8', line: '#D6E0D8', ink: '#11231B', inkSoft: '#4B5F55', inkFaint: '#8A9A91', primary: '#1F7A52', onPrimary: '#FFFFFF', accent: '#C8992A', accentSoft: '#F4E7C2' },
    dark: { bg: '#0A1410', surface: '#111E18', surfaceAlt: '#182820', line: '#22362B', ink: '#E7EFE9', inkSoft: '#A2B6AA', inkFaint: '#6B8076', primary: '#3FA774', onPrimary: '#06140E', accent: '#E2B64A', accentSoft: '#3A3118' },
  },
  {
    key: 'redvelvet',
    name: 'เรดเวลเวท',
    nameEn: 'Red Velvet',
    hero: ['#7B2233', '#5A1624', '#360B14'],
    heroDarkTop: '#661B2A',
    heroAccent: '#EBC894',
    heroBare: '#A3707A',
    heroInkSoft: '#E6C6CB',
    light: { bg: '#F8F3F2', surface: '#FFFFFF', surfaceAlt: '#F2E6E6', line: '#E6D4D5', ink: '#2A1216', inkSoft: '#6B4A50', inkFaint: '#A08A8E', primary: '#8E2436', onPrimary: '#FFFFFF', accent: '#B98A4E', accentSoft: '#F5E6D3' },
    dark: { bg: '#140A0C', surface: '#1E1013', surfaceAlt: '#2A171B', line: '#3B2328', ink: '#F4E9EA', inkSoft: '#C4A9AE', inkFaint: '#8A6E73', primary: '#D0566C', onPrimary: '#1A0508', accent: '#E3BE8A', accentSoft: '#3A2A1C' },
  },
  {
    key: 'purple',
    name: 'ม่วงราชวงศ์',
    nameEn: 'Royal Purple',
    hero: ['#5A3490', '#3E2268', '#23123F'],
    heroDarkTop: '#4A2A78',
    heroAccent: '#E6C35E',
    heroBare: '#8F7AB0',
    heroInkSoft: '#D4C6EA',
    light: { bg: '#F5F3F8', surface: '#FFFFFF', surfaceAlt: '#ECE7F3', line: '#DCD3E8', ink: '#1E1530', inkSoft: '#5A4E70', inkFaint: '#968CA8', primary: '#5E3A96', onPrimary: '#FFFFFF', accent: '#B8912F', accentSoft: '#F2E8CC' },
    dark: { bg: '#0F0B16', surface: '#181221', surfaceAlt: '#221A2E', line: '#33283F', ink: '#EEE9F5', inkSoft: '#B6A9C9', inkFaint: '#7E7193', primary: '#A07CD6', onPrimary: '#140A22', accent: '#E2BE5A', accentSoft: '#33291A' },
  },
  {
    key: 'sapphire',
    name: 'น้ำเงินแซฟไฟร์',
    nameEn: 'Royal Sapphire',
    hero: ['#1D4F8F', '#153A6B', '#0B2142'],
    heroDarkTop: '#18427A',
    heroAccent: '#E6C35E',
    heroBare: '#7892B5',
    heroInkSoft: '#C2D3EA',
    light: { bg: '#F2F5F9', surface: '#FFFFFF', surfaceAlt: '#E6ECF4', line: '#D2DCE8', ink: '#0F1B2D', inkSoft: '#4A5B72', inkFaint: '#8A99AD', primary: '#1F5AA6', onPrimary: '#FFFFFF', accent: '#B8912F', accentSoft: '#F2E8CC' },
    dark: { bg: '#080E17', surface: '#0F1824', surfaceAlt: '#162233', line: '#213247', ink: '#E7EEF7', inkSoft: '#A6B7CC', inkFaint: '#6C7F96', primary: '#5C9BE6', onPrimary: '#06101E', accent: '#E2BE5A', accentSoft: '#2E2918' },
  },
  {
    key: 'amber',
    name: 'ทองอำพัน',
    nameEn: 'Golden Amber',
    hero: ['#8C5E14', '#63400C', '#3C2607'],
    heroDarkTop: '#754E10',
    heroAccent: '#F5D37A',
    heroBare: '#B49A6C',
    heroInkSoft: '#EBD9B4',
    light: { bg: '#FAF7EF', surface: '#FFFFFF', surfaceAlt: '#F3ECDB', line: '#E7DCC3', ink: '#2A2010', inkSoft: '#6B5C40', inkFaint: '#A89A7D', primary: '#9A6412', onPrimary: '#FFFFFF', accent: '#C9961A', accentSoft: '#FBF0CF' },
    dark: { bg: '#14100A', surface: '#1E1810', surfaceAlt: '#2A2216', line: '#3B3120', ink: '#F6EFDF', inkSoft: '#CDBE9E', inkFaint: '#8F8266', primary: '#E3B34A', onPrimary: '#1A1204', accent: '#F0C85A', accentSoft: '#3A2E14' },
  },
  {
    key: 'sunset',
    name: 'ส้มพระอาทิตย์',
    nameEn: 'Sunset Copper',
    hero: ['#A5471F', '#7A3216', '#471B0B'],
    heroDarkTop: '#8C3C1A',
    heroAccent: '#F2C882',
    heroBare: '#C08E78',
    heroInkSoft: '#F0CDBD',
    light: { bg: '#F9F4F0', surface: '#FFFFFF', surfaceAlt: '#F2E7DF', line: '#E6D6CA', ink: '#2A1810', inkSoft: '#6E5244', inkFaint: '#A68F83', primary: '#B24E25', onPrimary: '#FFFFFF', accent: '#C8962A', accentSoft: '#F6E6CC' },
    dark: { bg: '#150D09', surface: '#20150F', surfaceAlt: '#2C1E16', line: '#3E2B20', ink: '#F6ECE5', inkSoft: '#CDB3A5', inkFaint: '#93786A', primary: '#EC8455', onPrimary: '#1E0A02', accent: '#E8BE62', accentSoft: '#3A2A18' },
  },
  {
    key: 'rose',
    name: 'ชมพูโรสควอตซ์',
    nameEn: 'Rose Quartz',
    hero: ['#94365D', '#6E2645', '#431429'],
    heroDarkTop: '#7E2E50',
    heroAccent: '#F0C4AA',
    heroBare: '#B98A9D',
    heroInkSoft: '#EDC8D7',
    light: { bg: '#F9F3F5', surface: '#FFFFFF', surfaceAlt: '#F2E6EB', line: '#E6D3DB', ink: '#2A1420', inkSoft: '#6E4D5E', inkFaint: '#A68C98', primary: '#A83E6A', onPrimary: '#FFFFFF', accent: '#B9876A', accentSoft: '#F6E3DA' },
    dark: { bg: '#150A10', surface: '#20111A', surfaceAlt: '#2C1824', line: '#3E2433', ink: '#F6E9EF', inkSoft: '#CFABBD', inkFaint: '#94727F', primary: '#E07BA5', onPrimary: '#22040F', accent: '#E8B79C', accentSoft: '#3A2620' },
  },
  {
    key: 'onyx',
    name: 'นิลทอง',
    nameEn: 'Onyx Gold',
    hero: ['#2E2D2B', '#1B1A19', '#0B0B0A'],
    heroDarkTop: '#262523',
    heroAccent: '#E2BE5A',
    heroBare: '#77736B',
    heroInkSoft: '#CFCAC0',
    light: { bg: '#F4F3F1', surface: '#FFFFFF', surfaceAlt: '#EAE8E4', line: '#DAD7D1', ink: '#161514', inkSoft: '#55524D', inkFaint: '#95918A', primary: '#2A2826', onPrimary: '#F4E7C2', accent: '#B8912F', accentSoft: '#F2E8CC' },
    dark: { bg: '#0A0A0A', surface: '#141413', surfaceAlt: '#1D1C1A', line: '#2C2B28', ink: '#EEEAE3', inkSoft: '#B3ADA2', inkFaint: '#7A756C', primary: '#D9B45A', onPrimary: '#151209', accent: '#E2BE5A', accentSoft: '#2F2816' },
  },
  {
    // Festival: spooky-cute Halloween, midnight purple with pumpkin orange.
    key: 'halloween',
    name: 'ฮาโลวีน',
    nameEn: 'Spooky Night',
    hero: ['#3B1E5C', '#24123D', '#120822'],
    heroDarkTop: '#2F174C',
    heroAccent: '#FF9A3C',
    heroBare: '#6E5A8A',
    heroInkSoft: '#D9C8F0',
    light: { bg: '#F7F3FA', surface: '#FFFFFF', surfaceAlt: '#EFE8F5', line: '#E0D5EA', ink: '#1C1226', inkSoft: '#5C4B6E', inkFaint: '#9A8CA8', primary: '#6A35A8', onPrimary: '#FFFFFF', accent: '#E0761E', accentSoft: '#FCE4CF' },
    dark: { bg: '#0E0914', surface: '#1A1224', surfaceAlt: '#241A31', line: '#352845', ink: '#F2ECF8', inkSoft: '#BBA9CF', inkFaint: '#7F6F92', primary: '#B48CF0', onPrimary: '#150A24', accent: '#FF9A3C', accentSoft: '#3B2414' },
    festival: true,
  },
];

// Light-mode meaning colours are dark enough for text on the page and on their own soft tint (≥ 4.5:1).
const SEMANTIC = {
  light: { income: '#1F7A52', good: '#26704A', watch: '#8F5B0A', critical: '#A63A26', overlay: 'rgba(10, 16, 12, 0.45)' },
  dark: { income: '#5CC08E', good: '#5CC08E', watch: '#E0A548', critical: '#E07A63', overlay: 'rgba(0, 0, 0, 0.6)' },
};

/** Mix two hex colours: t = 1 gives `a`, t = 0 gives `b`. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.replace('#', '').slice(0, 6), 16);
  const pb = parseInt(b.replace('#', '').slice(0, 6), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * t + ((pb >> shift) & 255) * (1 - t));
  return `#${[16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** The colour darkened (towards black) step by step until it reads at 4.5:1 on every background given. */
function inkOf(color: string, backgrounds: string[]): string {
  let c = color;
  for (let i = 0; i < 20 && backgrounds.some((bg) => contrast(c, bg) < 4.5); i++) c = mix(c, '#000000', 0.9);
  return c;
}

export function buildTheme(key: ColorThemeKey, dark: boolean): Theme {
  const spec = COLOR_THEMES.find((t) => t.key === key) ?? COLOR_THEMES[0];
  const mode = dark ? spec.dark : spec.light;
  const sem = dark ? SEMANTIC.dark : SEMANTIC.light;
  const soft = (c: string) => (dark ? mix(c, mode.surface, 0.16) : mix(c, '#FFFFFF', 0.12));
  return {
    dark,
    colorTheme: spec.key,
    ...mode,
    ...sem,
    onAccent: readableOn(mode.accent, '#1D1405', '#FFFFFF'),
    accentInk: dark ? mode.accent : inkOf(mode.accent, [mode.surface, mode.bg, mode.accentSoft]),
    goodSoft: soft(sem.good),
    watchSoft: soft(sem.watch),
    criticalSoft: soft(sem.critical),
    expense: mode.ink,
    heroTop: dark ? spec.heroDarkTop : spec.hero[0],
    hero: spec.hero[1],
    heroDeep: spec.hero[2],
    heroAccent: spec.heroAccent,
    heroBare: spec.heroBare,
    heroInk: '#F4F1E6',
    heroInkSoft: spec.heroInkSoft,
    heroIncome: '#9BE8BF',
  };
}

/** A colour from the theme with some transparency: alpha('#6A35A8', 0.15) -> 'rgba(106,53,168,0.15)'. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}

/** WCAG contrast ratio between two hex colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The first colour that reads on `bg` at 4.5:1 or better (the last one otherwise). */
export function readableOn(bg: string, ...colors: string[]): string {
  return colors.find((c) => contrast(c, bg) >= 4.5) ?? colors[colors.length - 1];
}

const cache = new Map<string, Theme>();
function themeFor(key: ColorThemeKey, dark: boolean): Theme {
  const id = `${key}:${dark ? 'd' : 'l'}`;
  let t = cache.get(id);
  if (!t) {
    t = buildTheme(key, dark);
    cache.set(id, t);
  }
  return t;
}

export const lightTheme: Theme = themeFor('forest', false);
export const darkTheme: Theme = themeFor('forest', true);

export function useTheme(): Theme {
  const scheme = useSchemeChoice();
  const key = useColorThemeKey();
  return themeFor(key, scheme === 'dark');
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
