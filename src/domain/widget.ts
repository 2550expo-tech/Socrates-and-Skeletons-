/**
 * Quick Access (MindPay ใหม่): today's spending next to the (+) button, in the
 * app's tab bar and on the Android home-screen widget.
 *
 * The widget is drawn by Android while the app is closed, so it only knows a
 * small snapshot that the app saves whenever the numbers change. A snapshot
 * from an earlier day means nothing has been recorded yet today: the widget then
 * shows ฿0 for today instead of yesterday's spending.
 */
import { bkkDayKey, daysBetween } from './dates';
import { formatBaht } from './money';

export const WIDGET_NAME = 'MyPayQuick';
export const WIDGET_SNAPSHOT_KEY = 'mypay.widget.snapshot';
/** Deep links the widget's buttons open (a scheme only MindPay ใหม่ has, so Android never asks which app). */
export const WIDGET_LINKS = {
  open: 'mypay://',
  add: 'mypay://add',
  scan: 'mypay://scan',
  voice: 'mypay://voice',
  today: 'mypay://transactions',
} as const;

export interface WidgetColors {
  top: string;
  deep: string;
  accent: string;
  ink: string;
  inkSoft: string;
}

/** The ป่าทอง theme, used until the app has saved the user's own theme colours. */
export const DEFAULT_WIDGET_COLORS: WidgetColors = { top: '#135A40', deep: '#082A1F', accent: '#E2B64A', ink: '#F4F1E6', inkSoft: '#B9CEC2' };

export interface WidgetSnapshot {
  v: 1;
  /** Bangkok day the numbers belong to. */
  day: string;
  /** Confirmed spending on that day. */
  spentSatang: number;
  balanceSatang: number;
  /** Day the money reaches the reserve line (null: no spending to project from). */
  depletionDay: string | null;
  runwayCapped: boolean;
  belowFloor: boolean;
  signedIn: boolean;
  colors: WidgetColors;
}

export interface WidgetView {
  label: string;
  amount: string;
  sub: string;
  /** For screen readers: the whole widget in one sentence. */
  spoken: string;
  colors: WidgetColors;
}

/** Short amount for small spaces: ฿142, ฿12,350 (no satang). */
export function shortBaht(satang: number): string {
  return formatBaht(satang, { decimals: false });
}

export function widgetView(s: WidgetSnapshot | null | undefined, nowMs: number = Date.now()): WidgetView {
  const colors = s?.colors ?? DEFAULT_WIDGET_COLORS;
  if (!s || !s.signedIn) {
    return { label: 'MyPay', amount: '฿0', sub: 'เปิดแอปเพื่อเริ่มใช้', spoken: 'MyPay เปิดแอปเพื่อเริ่มใช้', colors };
  }
  const today = bkkDayKey(nowMs);
  const spent = s.day === today ? s.spentSatang : 0;
  const amount = shortBaht(spent);
  // Counted from today, so a snapshot from yesterday still shows the right number of days.
  const days = s.depletionDay ? Math.max(0, daysBetween(today, s.depletionDay)) : null;
  const sub = s.belowFloor
    ? 'แตะเส้นเงินสำรองแล้ว'
    : days === null
      ? `คงเหลือ ${shortBaht(s.balanceSatang)}`
      : `เงินพอใช้อีก ${s.runwayCapped ? '365+' : days} วัน`;
  return { label: 'วันนี้ใช้ไป', amount, sub, spoken: `วันนี้ใช้ไป ${amount} ${sub}`, colors };
}
