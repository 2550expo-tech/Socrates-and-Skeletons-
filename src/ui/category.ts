/**
 * How a category looks (MindPay ใหม่): one Ionicon and one fixed hue per
 * category, the same in every colour theme, so a category is recognised by
 * its icon AND its colour everywhere — list rows, filter chips, the donut and
 * its legend. Money in always uses the income green (it is a meaning, not a
 * category colour). Hues are the dataviz reference steps for light and dark
 * surfaces; legends always carry the icon and the name, so colour is never the
 * only cue.
 */
import { getCategory } from '../domain/categories';
import type { IconName } from './components';
import { alpha, contrast, mix, type Theme } from './theme';

const LOOK: Record<string, { icon: IconName; light: string; dark: string }> = {
  food: { icon: 'restaurant', light: '#EB6834', dark: '#D95926' },
  transport: { icon: 'bus', light: '#2A78D6', dark: '#3987E5' },
  shopping: { icon: 'bag-handle', light: '#E87BA4', dark: '#D55181' },
  convenience: { icon: 'storefront', light: '#1BAF7A', dark: '#199E70' },
  bills: { icon: 'receipt', light: '#4A3AA7', dark: '#9085E9' },
  fun: { icon: 'film', light: '#EDA100', dark: '#C98500' },
  study: { icon: 'book', light: '#9A6B2F', dark: '#C08A45' },
  health: { icon: 'medkit', light: '#E34948', dark: '#E66767' },
  transfer_out: { icon: 'paper-plane', light: '#5F7A8C', dark: '#8EA6B6' },
  other_expense: { icon: 'ellipsis-horizontal', light: '#7D857F', dark: '#8A938C' },
  allowance: { icon: 'home', light: '', dark: '' },
  salary: { icon: 'briefcase', light: '', dark: '' },
  part_time: { icon: 'sparkles', light: '', dark: '' },
  transfer_in: { icon: 'arrow-down', light: '', dark: '' },
  other_income: { icon: 'ellipsis-horizontal', light: '', dark: '' },
};

export interface CategoryLook {
  icon: IconName;
  /** The category's hue (chart slices, legend dots). */
  color: string;
  /** Icon tile: a soft tint of the hue, and the icon in a step that reads on it (≥ 3:1). */
  tile: string;
  ink: string;
}

const cache = new Map<string, CategoryLook>();

export function categoryLook(key: string, theme: Theme): CategoryLook {
  const id = `${key}:${theme.colorTheme}:${theme.dark ? 'd' : 'l'}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const cat = getCategory(key);
  const look = LOOK[cat.key] ?? LOOK.other_expense;
  const color = cat.kind === 'income' ? theme.income : theme.dark ? look.dark : look.light;
  const tile = mix(color, theme.surface, theme.dark ? 0.22 : 0.14);
  let ink = color;
  // Darken (light mode) or lighten (dark mode) the icon until it stands out from its tile.
  for (let i = 0; i < 20 && contrast(ink, tile) < 3; i++) ink = mix(ink, theme.dark ? '#FFFFFF' : '#000000', 0.88);
  const out = { icon: look.icon, color, tile, ink };
  cache.set(id, out);
  return out;
}

/** The selected-chip and soft-tint backgrounds use the same rule. */
export const tint = (color: string, theme: Theme) => alpha(color, theme.dark ? 0.24 : 0.14);
