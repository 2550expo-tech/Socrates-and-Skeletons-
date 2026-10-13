/**
 * The rail (MindPay ใหม่): one precise picture of the runway on the money card.
 * A thin line from today to the day the money reaches the reserve line, with a
 * tick at the end of the month. The part past the month end is light green
 * (money left to keep); when the money runs out first, the gap to the month end
 * is red. Still, no animation; read out as one sentence.
 */
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { addDays, formatThaiDay } from '../domain/dates';
import { formatBaht } from '../domain/money';
import type { MonthEndCheck } from '../domain/runway';
import { Row, T, type IconName } from './components';
import { alpha, fonts, useTheme } from './theme';

const H = 14;

/** What the month-end comparison says, in the owner's words ("✓ เหลือเก็บได้อีก N วัน" / "! ขาดอีก N วันถึงสิ้นเดือน"). */
export function monthEndStatus(m: MonthEndCheck): { text: string; icon: IconName; tone: 'good' | 'bad' | 'plain' } {
  switch (m.kind) {
    case 'surplus':
      return { text: `เหลือเก็บได้อีก${m.capped ? 'มากกว่า' : ''} ${m.days} วัน`, icon: 'checkmark-circle', tone: 'good' };
    case 'exact':
      return { text: 'พอดีถึงสิ้นเดือน', icon: 'ellipse', tone: 'plain' };
    case 'short':
      return { text: `ขาดอีก ${m.days} วันถึงสิ้นเดือน`, icon: 'alert-circle', tone: 'bad' };
    case 'below':
      return { text: 'แตะเส้นเงินสำรองแล้ว', icon: 'alert-circle', tone: 'bad' };
    default:
      return { text: 'ยังไม่มีรายจ่าย 7 วัน', icon: 'time-outline', tone: 'plain' };
  }
}

/** The rail read out as one sentence. */
export function railLabel(check: MonthEndCheck): string {
  if (check.kind === 'unknown') return '';
  const status = monthEndStatus(check);
  return `อีก ${check.daysToMonthEnd} วันถึงสิ้นเดือน ${check.kind === 'surplus' ? `เงินพอเกินสิ้นเดือนไปอีก ${check.days} วัน` : check.kind === 'short' ? `เงินหมดก่อนสิ้นเดือน ${check.days} วัน` : status.text}`;
}

export function RunwayRail({ check, label }: { check: MonthEndCheck; label: string }) {
  const theme = useTheme();
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  if (check.kind === 'unknown') return null;

  const monthEnd = check.daysToMonthEnd;
  const runDays = check.kind === 'below' ? 0 : check.kind === 'surplus' ? monthEnd + check.days : check.kind === 'short' ? monthEnd - check.days : monthEnd;
  // The scale: the longer of the runway and the month, with a little room at the end.
  const span = Math.max(1, Math.max(runDays, monthEnd) * 1.04);
  const x = (d: number) => 6 + (Math.min(d, span) / span) * Math.max(1, w - 12);
  const mid = H / 2;
  const ink = theme.heroInk;
  const good = theme.heroIncome;
  const bad = '#FF9A8F';
  const tickX = x(monthEnd);
  const endX = x(runDays);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ gap: 2 }}>
      <View onLayout={onLayout} style={{ height: H }}>
        {w > 0 ? (
          <Svg width={w} height={H}>
            {/* track */}
            <Rect x={6} y={mid - 2} width={Math.max(0, Math.max(endX, tickX) - 6)} height={4} rx={2} fill={alpha(ink, 0.16)} />
            {/* the money, from today to the run-out day */}
            {runDays > 0 ? <Rect x={6} y={mid - 2} width={Math.max(0, Math.min(endX, tickX) - 6)} height={4} rx={2} fill={alpha(ink, 0.85)} /> : null}
            {check.kind === 'surplus' ? <Rect x={tickX} y={mid - 2} width={Math.max(0, endX - tickX)} height={4} rx={2} fill={good} /> : null}
            {check.kind === 'short' || check.kind === 'below' ? (
              <Rect x={endX} y={mid - 2} width={Math.max(0, tickX - endX)} height={4} rx={2} fill={alpha(bad, 0.75)} />
            ) : null}
            {/* month end */}
            <Line x1={tickX} y1={1} x2={tickX} y2={H - 1} stroke={alpha(ink, 0.7)} strokeWidth={2} strokeLinecap="round" />
            {/* today and the run-out day */}
            <Circle cx={6} cy={mid} r={4} fill={ink} />
            {runDays > 0 ? <Circle cx={endX} cy={mid} r={4.5} fill={check.kind === 'short' ? bad : check.kind === 'surplus' ? good : ink} /> : null}
          </Svg>
        ) : null}
      </View>
      <View style={{ height: 18 }}>
        <T v="micro" color={theme.heroInkSoft} style={{ position: 'absolute', left: 0 }}>
          วันนี้
        </T>
        {w > 0 ? (
          // Under the tick, kept clear of "วันนี้" and inside the card.
          <T v="micro" color={theme.heroInkSoft} style={{ position: 'absolute', left: Math.max(44, Math.min(tickX - 28, w - 56)), width: 56, textAlign: 'center' }}>
            สิ้นเดือน
          </T>
        ) : null}
      </View>
    </View>
  );
}

const MARKS = [7, 14, 30];

/**
 * Money Runway screen: what would be left in 7, 14 and 30 days if spending
 * stays at the daily average (red once it is at or under the reserve line).
 */
export function Projection({ balanceSatang, floorSatang, averageSatang, today }: { balanceSatang: number; floorSatang: number; averageSatang: number; today: string }) {
  const theme = useTheme();
  const marks = MARKS.map((d) => {
    const left = balanceSatang - averageSatang * d;
    return { d, left, day: addDays(today, d), out: left <= floorSatang };
  });
  const label = `ถ้าใช้เท่าเดิม ` + marks.map((m) => `อีก ${m.d} วันเหลือ ${formatBaht(m.left, { decimals: false })}${m.out ? ' ต่ำกว่าเงินสำรอง' : ''}`).join(' ');
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={label}>
      <Row gap={8} align="flex-start">
        {marks.map((m, i) => (
          <View key={m.d} style={{ flex: 1, gap: 0, paddingLeft: i ? 10 : 0, borderLeftWidth: i ? 1 : 0, borderLeftColor: theme.line }}>
            <T v="micro" color={theme.inkSoft} numberOfLines={1}>
              อีก {m.d} วัน
            </T>
            <T v="body" color={m.out ? theme.critical : theme.ink} style={{ fontFamily: fonts.sansSemi, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
              {formatBaht(m.left, { decimals: false })}
            </T>
            <T v="micro" color={theme.inkSoft} numberOfLines={1}>
              {formatThaiDay(m.day, { year: false })}
            </T>
          </View>
        ))}
      </Row>
    </View>
  );
}
