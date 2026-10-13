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
import { Row, T } from './components';
import { alpha, fonts, useTheme } from './theme';

const H = 14;

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
            <Rect x={6} y={mid - 2} width={w - 12} height={4} rx={2} fill={alpha(ink, 0.16)} />
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
 * Money Runway screen: the same idea on a plain card, looking ahead. The line
 * runs from today to the day the money reaches the reserve line, with ticks at
 * 7, 14 and 30 days; under it, what would be left on each of those days if
 * spending stays at the daily average (red once it is at or under the reserve).
 */
export function ProjectionRail({
  balanceSatang,
  floorSatang,
  averageSatang,
  runDays,
  today,
}: {
  balanceSatang: number;
  floorSatang: number;
  averageSatang: number;
  /** Days until the reserve line (null: more than a year). */
  runDays: number | null;
  today: string;
}) {
  const theme = useTheme();
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  const run = runDays === null ? Infinity : Math.max(0, runDays);
  // The scale: a little past the longer of 30 days and the runway, at most 4 months.
  const span = Math.min(120, Math.max(30, run)) * 1.06;
  const pad = 6;
  const x = (d: number) => pad + (Math.min(d, span) / span) * Math.max(1, w - pad * 2);
  const H = 30;
  const mid = 22;
  const marks = MARKS.map((d) => {
    const left = balanceSatang - averageSatang * d;
    return { d, left, day: addDays(today, d), out: left <= floorSatang };
  });
  const runX = x(run);
  const label =
    `ถ้าใช้เท่าเดิม ` +
    marks.map((m) => `อีก ${m.d} วันเหลือ ${formatBaht(m.left, { decimals: false })}${m.out ? ' ต่ำกว่าเงินสำรอง' : ''}`).join(' ');

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ gap: 10 }}>
      <View onLayout={onLayout} style={{ height: H }}>
        {w > 0 ? (
          <Svg width={w} height={H}>
            <Rect x={pad} y={mid - 3} width={w - pad * 2} height={6} rx={3} fill={theme.surfaceAlt} />
            {/* the money, from today to the run-out day */}
            {run > 0 ? <Rect x={pad} y={mid - 3} width={Math.max(0, runX - pad)} height={6} rx={3} fill={theme.primary} /> : null}
            {/* past the run-out day, up to 30 days: the days that are not covered */}
            {run < 30 ? <Rect x={runX} y={mid - 3} width={Math.max(0, x(30) - runX)} height={6} rx={3} fill={alpha(theme.critical, 0.45)} /> : null}
            {marks.map((m) => (
              <Line key={m.d} x1={x(m.d)} x2={x(m.d)} y1={mid - 8} y2={mid + 8} stroke={theme.ink} strokeOpacity={0.55} strokeWidth={2} strokeLinecap="round" />
            ))}
            <Circle cx={pad} cy={mid} r={5} fill={theme.ink} />
            {Number.isFinite(run) && run > 0 ? <Circle cx={runX} cy={mid} r={5.5} fill={run < 30 ? theme.critical : theme.primary} stroke={theme.surface} strokeWidth={2} /> : null}
          </Svg>
        ) : null}
        {/* The day numbers above the ticks (short, so they never collide). */}
        {w > 0
          ? marks.map((m) => (
              <T key={m.d} v="micro" color={theme.inkSoft} style={{ position: 'absolute', top: -2, left: x(m.d) - 14, width: 28, textAlign: 'center' }}>
                {m.d}
              </T>
            ))
          : null}
      </View>
      <Row gap={8} align="flex-start">
        {marks.map((m) => (
          <View key={m.d} style={{ flex: 1, gap: 0 }}>
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
