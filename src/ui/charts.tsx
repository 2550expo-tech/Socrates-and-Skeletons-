/**
 * Small charts drawn with react-native-svg. One scale per chart; every label
 * names a value the chart actually shows.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { formatBaht } from '../domain/money';
import type { CategoryTotal, TrendBucket } from '../domain/summary';
import { categoryLook } from './category';
import { Ionicons, Row, T } from './components';
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

/**
 * Expense bars over time (days or months, from `spendingTrend`), with an optional
 * dashed line at the daily average. The current day/month is gold and full
 * strength; the biggest bar carries its amount.
 */
export function TrendBars({ buckets, averageSatang, height = 140, label }: { buckets: TrendBucket[]; averageSatang?: number; height?: number; label: string }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const max = Math.max(1, ...buckets.map((d) => d.expenseSatang), averageSatang ?? 0);
  const top = 18;
  const bottom = 22;
  const plotH = height - top - bottom;
  // Many bars (30 days): narrow gaps so each bar keeps some width.
  const gap = buckets.length > 14 ? 3 : 8;
  const barW = width > 0 ? (width - gap * (buckets.length - 1)) / buckets.length : 0;
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const peak = buckets.reduce((best, d) => (d.expenseSatang > best.expenseSatang ? d : best), buckets[0]);
  const peakIndex = buckets.indexOf(peak);
  const summary = peak && peak.expenseSatang > 0 ? `${label} สูงสุด ${formatBaht(peak.expenseSatang, { decimals: false })}` : `${label} ยังไม่มีรายจ่าย`;

  return (
    <View onLayout={onLayout} style={{ height }} accessibilityRole="image" accessibilityLabel={summary}>
      {/* Bars first, then the lines and labels drawn over them. */}
      {width > 0
        ? buckets.map((d, i) => {
            const h = Math.max(d.expenseSatang > 0 ? 3 : 0, top + plotH - y(d.expenseSatang));
            return (
              <RisingBar
                key={d.key}
                x={i * (barW + gap)}
                top={top + plotH - h}
                width={barW}
                height={h}
                color={d.current ? theme.accent : theme.primary}
                // The current one stands out by brightness as well as colour (in some dark themes the two are close).
                opacity={d.current ? 1 : 0.5}
                delay={120 + Math.min(i, 14) * 45}
              />
            );
          })
        : null}
      {width > 0 ? (
        <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
          <Line x1={0} x2={width} y1={top + plotH} y2={top + plotH} stroke={theme.line} strokeWidth={1} />
          {buckets.map((d, i) =>
            d.label ? (
              <SvgText
                key={`l${d.key}`}
                x={Math.min(width - 12, Math.max(12, i * (barW + gap) + barW / 2))}
                y={height - 6}
                fontSize={11}
                fontFamily={d.current ? fonts.sansSemi : fonts.sansMedium}
                fill={d.current ? theme.ink : theme.inkSoft}
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            ) : null,
          )}
          {peak && peak.expenseSatang > 0 ? (
            <SvgText
              x={Math.min(width - 18, Math.max(18, peakIndex * (barW + gap) + barW / 2))}
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

/** A category's icon on its soft tile (the same look as in the list rows). */
function CategoryIcon({ k, size = 28 }: { k: string; size?: number }) {
  const theme = useTheme();
  const look = categoryLook(k, theme);
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: look.tile, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={look.icon} size={size * 0.58} color={look.ink} />
    </View>
  );
}

/** Horizontal bars for categories, biggest first, each in its category colour. */
export function CategoryBars({ items, limit = 5 }: { items: CategoryTotal[]; limit?: number }) {
  const theme = useTheme();
  const shown = items.slice(0, limit);
  const max = Math.max(1, ...shown.map((c) => c.totalSatang));
  return (
    <View style={{ gap: space.md }}>
      {shown.map((c, i) => (
        <View key={c.key} style={{ gap: 6 }}>
          <Row gap={space.sm}>
            <CategoryIcon k={c.key} />
            <T v="small" color={theme.ink} numberOfLines={1} style={{ flex: 1 }}>
              {c.label}
            </T>
            <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi, fontVariant: ['tabular-nums'] }}>
              {formatBaht(c.totalSatang, { decimals: false })}
            </T>
            <T v="micro" style={{ width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
              {Math.round(c.share * 100)}%
            </T>
          </Row>
          <GrowBar value={c.totalSatang / max} color={categoryLook(c.key, theme).color} track={theme.surfaceAlt} delay={100 + i * 90} />
        </View>
      ))}
    </View>
  );
}

/** More than five categories fold into "อื่น ๆ" (grey) so slices stay tellable apart. */
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
  const total = items.reduce((s, c) => s + c.totalSatang, 0);
  const top = items.slice(0, DONUT_SLOTS);
  const rest = items.slice(DONUT_SLOTS);
  // Colour follows the category (the same as its icon in the list), never its rank.
  const slices = [
    ...top.map((c) => ({ key: c.key, label: c.label, satang: c.totalSatang, color: categoryLook(c.key, theme).color, icon: true })),
    ...(rest.length
      ? [{ key: 'rest', label: `อื่น ๆ (${rest.length} หมวด)`, satang: rest.reduce((s, c) => s + c.totalSatang, 0), color: theme.inkFaint, icon: false }]
      : []),
  ];
  const lead = top[0];
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = size / 2;
  // A 2° gap between slices (none when one category is everything).
  const gap = slices.length > 1 ? 2 : 0;
  let angle = 0;
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ alignItems: 'center' }}>
        <View
          style={{ width: size, height: size }}
          accessible
          accessibilityRole="image"
          accessibilityLabel={slices.map((sl) => `${sl.label} ${total > 0 ? Math.round((sl.satang / total) * 100) : 0}%`).join(', ')}
        >
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
          {/* The middle names the biggest slice (the total is already shown above the chart). */}
          {lead && total > 0 ? (
            <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <CategoryIcon k={lead.key} size={34} />
              <T v="h2" style={{ fontVariant: ['tabular-nums'] }}>
                {Math.round((lead.totalSatang / total) * 100)}%
              </T>
              <T v="micro" numberOfLines={1} style={{ maxWidth: size * 0.55, textAlign: 'center' }}>
                {lead.label}
              </T>
            </View>
          ) : null}
        </View>
      </View>
      <View style={{ gap: space.sm }}>
        {slices.map((sl) => (
          <Row key={sl.key} gap={space.sm}>
            {sl.icon ? (
              <CategoryIcon k={sl.key} />
            ) : (
              <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="ellipsis-horizontal" size={16} color={theme.inkSoft} />
              </View>
            )}
            <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: sl.color }} />
            <T v="small" color={theme.ink} numberOfLines={1} style={{ flex: 1 }}>
              {sl.label}
            </T>
            <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi, fontVariant: ['tabular-nums'] }}>
              {formatBaht(sl.satang, { decimals: false })}
            </T>
            <T v="micro" style={{ width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
              {total > 0 ? Math.round((sl.satang / total) * 100) : 0}%
            </T>
          </Row>
        ))}
      </View>
    </View>
  );
}
