/**
 * Small charts drawn with react-native-svg. One scale per chart; every label
 * names a value the chart actually shows.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Text as SvgText } from 'react-native-svg';
import { formatBaht } from '../domain/money';
import type { CategoryTotal, DayTotal } from '../domain/summary';
import { Row, T } from './components';
import { GrowBar } from './effects';
import { useNative, useReduceMotion } from './motion';
import { fonts, space, useTheme } from './theme';

/** One bar of DayBars: it rises out of the baseline (its rounded top stays round). */
function RisingBar({ x, top, width, height, color, opacity, delay }: { x: number; top: number; width: number; height: number; color: string; opacity: number; delay: number }) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(reduce ? 1 : 0));
  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    const anim = Animated.timing(v, { toValue: 1, duration: 650, delay, easing: Easing.out(Easing.back(1.4)), useNativeDriver: useNative });
    anim.start();
    return () => anim.stop();
  }, [reduce, v, delay, height]);
  if (height <= 0) return null;
  return (
    <View style={{ position: 'absolute', left: x, top, width, height, overflow: 'hidden', borderRadius: Math.min(6, width / 2) }}>
      <Animated.View
        style={{
          flex: 1,
          borderRadius: Math.min(6, width / 2),
          backgroundColor: color,
          opacity,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }],
        }}
      />
    </View>
  );
}

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
      {/* Bars first, then the lines and labels drawn over them. */}
      {width > 0
        ? days.map((d, i) => {
            const h = Math.max(d.expenseSatang > 0 ? 3 : 0, top + plotH - y(d.expenseSatang));
            const isToday = i === days.length - 1;
            return (
              <RisingBar
                key={d.day}
                x={i * (barW + gap)}
                top={top + plotH - h}
                width={barW}
                height={h}
                color={isToday ? theme.accent : theme.primary}
                // Today stands out by brightness as well as colour (in some dark themes the two are close).
                opacity={isToday ? 1 : 0.5}
                delay={120 + i * 55}
              />
            );
          })
        : null}
      {width > 0 ? (
        <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
          <Line x1={0} x2={width} y1={top + plotH} y2={top + plotH} stroke={theme.line} strokeWidth={1} />
          {days.map((d, i) => {
            const x = i * (barW + gap);
            const isToday = i === days.length - 1;
            const dow = new Date(`${d.day}T00:00:00Z`).getUTCDay();
            return [
              <SvgText
                key={`l${d.day}`}
                x={x + barW / 2}
                y={height - 6}
                fontSize={11}
                fontFamily={fonts.sansMedium}
                fill={isToday ? theme.ink : theme.inkSoft}
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
          <GrowBar
            value={c.totalSatang / max}
            color={i === 0 ? theme.accent : theme.primary}
            opacity={i === 0 ? 1 : Math.max(0.3, 0.55 - i * 0.06)}
            track={theme.surfaceAlt}
            delay={100 + i * 90}
          />
        </View>
      ))}
    </View>
  );
}
