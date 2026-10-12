/**
 * Small charts drawn with react-native-svg. One scale per chart; every label
 * names a value the chart actually shows.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
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

/**
 * Categorical colours for the spending donut (validated palette, fixed order:
 * the biggest category always gets slot 1). Dark mode uses the same hues stepped
 * for a dark surface. More than five categories fold into "อื่น ๆ" (grey).
 */
const DONUT_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];
const DONUT_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
const DONUT_SLOTS = 5;

function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const a0 = (start - 90) * (Math.PI / 180);
  const a1 = (end - 90) * (Math.PI / 180);
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = end - start > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/**
 * Spending by category as a donut, with the total in the middle and a legend
 * that names every slice with its amount and share (colour is never the only cue).
 */
export function CategoryDonut({ items, size = 190 }: { items: CategoryTotal[]; size?: number }) {
  const theme = useTheme();
  const colors = theme.dark ? DONUT_DARK : DONUT_LIGHT;
  const total = items.reduce((s, c) => s + c.totalSatang, 0);
  const top = items.slice(0, DONUT_SLOTS);
  const rest = items.slice(DONUT_SLOTS);
  const slices = [
    ...top.map((c, i) => ({ key: c.key, label: `${c.glyph} ${c.label}`, satang: c.totalSatang, color: colors[i] })),
    ...(rest.length
      ? [{ key: 'rest', label: `อื่น ๆ (${rest.length} หมวด)`, satang: rest.reduce((s, c) => s + c.totalSatang, 0), color: theme.inkFaint }]
      : []),
  ];
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = size / 2;
  // A 2° gap between slices (none when one category is everything).
  const gap = slices.length > 1 ? 2 : 0;
  let angle = 0;
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size}>
            <Circle cx={c} cy={c} r={r} stroke={theme.surfaceAlt} strokeWidth={stroke} fill="none" />
            {total > 0
              ? slices.map((sl) => {
                  const sweep = (sl.satang / total) * 360;
                  const start = angle + gap / 2;
                  const end = angle + Math.max(gap / 2 + 0.5, sweep - gap / 2);
                  angle += sweep;
                  if (sweep >= 359.99) return <Circle key={sl.key} cx={c} cy={c} r={r} stroke={sl.color} strokeWidth={stroke} fill="none" />;
                  return <Path key={sl.key} d={arcPath(c, c, r, start, end)} stroke={sl.color} strokeWidth={stroke} fill="none" strokeLinecap="butt" />;
                })
              : null}
          </Svg>
          <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
            <T v="micro">รายจ่ายรวม</T>
            <T v="h3" style={{ fontVariant: ['tabular-nums'] }}>
              {formatBaht(total, { decimals: false })}
            </T>
          </View>
        </View>
      </View>
      <View style={{ gap: space.sm }}>
        {slices.map((sl) => (
          <Row key={sl.key} gap={space.sm}>
            <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: sl.color }} />
            <T v="small" color={theme.ink} numberOfLines={1} style={{ flex: 1 }}>
              {sl.label}
            </T>
            <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi, fontVariant: ['tabular-nums'] }}>
              {formatBaht(sl.satang, { decimals: false })}
            </T>
            <T v="micro" style={{ width: 38, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
              {total > 0 ? Math.round((sl.satang / total) * 100) : 0}%
            </T>
          </Row>
        ))}
      </View>
    </View>
  );
}
