/**
 * Small charts drawn with react-native-svg. One scale per chart; every label
 * names a value the chart actually shows.
 */
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { formatBaht } from '../domain/money';
import type { CategoryTotal, DayTotal } from '../domain/summary';
import { Row, T } from './components';
import { fonts, radius, space, useTheme } from './theme';

const WEEKDAY_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

/** Daily expense bars with a dashed line at the average. */
export function DayBars({ days, averageSatang, height = 140 }: { days: DayTotal[]; averageSatang?: number; height?: number }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const max = Math.max(1, ...days.map((d) => d.expenseSatang), averageSatang ?? 0);
  const top = 18;
  const bottom = 22;
  const plotH = height - top - bottom;
  const gap = 8;
  const barW = width > 0 ? (width - gap * (days.length - 1)) / days.length : 0;
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const peak = days.reduce((best, d) => (d.expenseSatang > best.expenseSatang ? d : best), days[0]);

  return (
    <View onLayout={onLayout} style={{ height }} accessibilityLabel={`รายจ่าย ${days.length} วันล่าสุด`}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line x1={0} x2={width} y1={top + plotH} y2={top + plotH} stroke={theme.line} strokeWidth={1} />
          {days.map((d, i) => {
            const x = i * (barW + gap);
            const isToday = i === days.length - 1;
            const h = Math.max(d.expenseSatang > 0 ? 3 : 0, top + plotH - y(d.expenseSatang));
            const dow = new Date(`${d.day}T00:00:00Z`).getUTCDay();
            return [
              <Rect
                key={`b${d.day}`}
                x={x}
                y={top + plotH - h}
                width={barW}
                height={h}
                rx={Math.min(6, barW / 2)}
                fill={isToday ? theme.accent : theme.primary}
                opacity={isToday ? 1 : 0.85}
              />,
              <SvgText
                key={`l${d.day}`}
                x={x + barW / 2}
                y={height - 6}
                fontSize={11}
                fontFamily={fonts.sansMedium}
                fill={isToday ? theme.ink : theme.inkFaint}
                textAnchor="middle"
              >
                {isToday ? 'วันนี้' : WEEKDAY_SHORT[dow]}
              </SvgText>,
            ];
          })}
          {peak && peak.expenseSatang > 0 ? (
            <SvgText
              x={Math.min(width - 4, Math.max(4, days.indexOf(peak) * (barW + gap) + barW / 2))}
              y={Math.max(11, y(peak.expenseSatang) - 5)}
              fontSize={10}
              fontFamily={fonts.sansSemi}
              fill={theme.inkSoft}
              textAnchor="middle"
            >
              {formatBaht(peak.expenseSatang, { decimals: false })}
            </SvgText>
          ) : null}
          {averageSatang && averageSatang > 0 ? (
            <Line
              x1={0}
              x2={width}
              y1={y(averageSatang)}
              y2={y(averageSatang)}
              stroke={theme.inkSoft}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

/** Horizontal bars for categories, biggest first. */
export function CategoryBars({ items, limit = 5 }: { items: CategoryTotal[]; limit?: number }) {
  const theme = useTheme();
  const shown = items.slice(0, limit);
  const max = Math.max(1, ...shown.map((c) => c.totalSatang));
  return (
    <View style={{ gap: space.md }}>
      {shown.map((c, i) => (
        <View key={c.key} style={{ gap: 6 }}>
          <Row justify="space-between">
            <Row gap={6} style={{ flex: 1 }}>
              <T v="body">{c.glyph}</T>
              <T v="small" color={theme.ink} numberOfLines={1} style={{ flex: 1 }}>
                {c.label}
              </T>
            </Row>
            <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi, fontVariant: ['tabular-nums'] }}>
              {formatBaht(c.totalSatang, { decimals: false })}
            </T>
            <T v="micro" style={{ width: 38, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
              {Math.round(c.share * 100)}%
            </T>
          </Row>
          <View style={{ height: 8, backgroundColor: theme.surfaceAlt, borderRadius: radius.sm, overflow: 'hidden' }}>
            <View
              style={{
                width: `${(c.totalSatang / max) * 100}%`,
                height: '100%',
                borderRadius: radius.sm,
                backgroundColor: i === 0 ? theme.accent : theme.primary,
                opacity: i === 0 ? 1 : 0.75 - i * 0.08,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
