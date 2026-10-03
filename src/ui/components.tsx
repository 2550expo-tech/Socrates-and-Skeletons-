/**
 * Small building blocks used by every screen. Every color comes from the theme,
 * so light and dark mode stay consistent.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GrowBar, Reveal, Shine, usePressSpring } from './effects';
import { useCountUp, useNative, useReduceMotion } from './motion';
import { alpha, fonts, radius, space, type, useTheme } from './theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'micro' | 'label';

const VARIANT_FONT: Record<Variant, string> = {
  display: fonts.serif,
  h1: fonts.serif,
  h2: fonts.sansBold,
  h3: fonts.sansSemi,
  body: fonts.sans,
  small: fonts.sans,
  micro: fonts.sansMedium,
  label: fonts.sansSemi,
};

export function T({
  v = 'body',
  color,
  style,
  children,
  numberOfLines,
  center,
  selectable,
  accessibilityRole,
}: {
  v?: Variant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  center?: boolean;
  selectable?: boolean;
  accessibilityRole?: 'header' | 'text' | 'alert';
}) {
  const theme = useTheme();
  const size = v === 'label' ? type.micro : type[v];
  return (
    <Text
      accessibilityRole={accessibilityRole}
      numberOfLines={numberOfLines}
      selectable={selectable}
      style={[
        size,
        {
          fontFamily: VARIANT_FONT[v],
          color: color ?? (v === 'small' || v === 'micro' ? theme.inkSoft : theme.ink),
          textAlign: center ? 'center' : undefined,
        },
        // Labels are text: inkSoft (inkFaint is for placeholders, rules and quiet icons, below 4.5:1).
        v === 'label' && { letterSpacing: 0.8, textTransform: 'uppercase', color: color ?? theme.inkSoft },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Money set in the serif face with tabular digits. */
export function Money({
  satang,
  size = 'h2',
  color,
  sign,
  decimals = true,
  style,
  countUp,
}: {
  satang: number;
  size?: 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'small';
  color?: string;
  sign?: boolean;
  decimals?: boolean;
  style?: StyleProp<TextStyle>;
  /** Count up to the amount when it first shows or changes (the balance on the home screen). */
  countUp?: boolean;
}) {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const value = useCountUp(satang, !!countUp && !reduce);
  const abs = Math.abs(value);
  // Whole baht only: round to the nearest baht, like formatBaht (฿99.99 shows ฿100).
  const whole = String(decimals ? Math.floor(abs / 100) : Math.round(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = String(abs % 100).padStart(2, '0');
  const prefix = sign ? (value < 0 ? '−' : '+') : value < 0 ? '−' : '';
  const big = type[size];
  return (
    <Text
      style={[
        { fontFamily: fonts.serif, color: color ?? theme.ink, fontVariant: ['tabular-nums'] },
        big,
        style,
      ]}
    >
      {prefix}฿{whole}
      {decimals ? <Text style={{ fontSize: big.fontSize * 0.6 }}>.{frac}</Text> : null}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ['top'],
  contentStyle,
  refreshControl,
  scrollY,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: ('top' | 'bottom')[];
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ComponentProps<typeof ScrollView>['refreshControl'];
  /** Receives the scroll position, for effects that follow scrolling (parallax). */
  scrollY?: Animated.Value;
}) {
  const theme = useTheme();
  const pad = padded ? { paddingHorizontal: space.lg } : null;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: theme.bg }}>
      {scroll && scrollY ? (
        <Animated.ScrollView
          contentContainerStyle={[pad, { paddingBottom: 120, gap: space.lg }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          // iOS: scroll a focused field above the keyboard (e.g. the price in "เช็กก่อนจ่าย").
          automaticallyAdjustKeyboardInsets
          refreshControl={refreshControl}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: useNative })}
        >
          {children}
        </Animated.ScrollView>
      ) : scroll ? (
        <ScrollView
          contentContainerStyle={[pad, { paddingBottom: 120, gap: space.lg }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          // iOS: scroll a focused field above the keyboard (e.g. the price in "เช็กก่อนจ่าย").
          automaticallyAdjustKeyboardInsets
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Row({
  children,
  gap = space.sm,
  style,
  align = 'center',
  justify,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
}) {
  return <View style={[{ flexDirection: 'row', alignItems: align, justifyContent: justify, gap }, style]}>{children}</View>;
}

export function Card({
  children,
  style,
  onPress,
  tone = 'surface',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  tone?: 'surface' | 'alt' | 'accent';
}) {
  const theme = useTheme();
  const press = usePressSpring(0.975);
  const bg = tone === 'alt' ? theme.surfaceAlt : tone === 'accent' ? theme.accentSoft : theme.surface;
  const base: ViewStyle = {
    backgroundColor: bg,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: tone === 'surface' ? StyleSheet.hairlineWidth : 0,
    borderColor: theme.line,
    gap: space.md,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      style={[base, style, { transform: [{ scale: press.scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const theme = useTheme();
  return (
    <Row justify="space-between" style={{ marginTop: space.sm }}>
      <T v="h3">{title}</T>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <T v="small" color={theme.primary} style={{ fontFamily: fonts.sansSemi }}>
            {action}
          </T>
        </Pressable>
      ) : null}
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  loading,
  disabled,
  style,
  small,
  shine,
}: {
  label: string;
  onPress: () => void;
  /** onDark: outline button on the dark green hero surfaces */
  kind?: 'primary' | 'gold' | 'ghost' | 'danger' | 'soft' | 'onDark';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
  /** A band of light sweeps across (for the one main action on a screen). */
  shine?: boolean;
}) {
  const theme = useTheme();
  const press = usePressSpring(0.95);
  const colors = {
    primary: { bg: theme.primary, fg: theme.onPrimary, border: theme.primary },
    gold: { bg: theme.accent, fg: theme.onAccent, border: theme.accent },
    ghost: { bg: 'transparent', fg: theme.ink, border: theme.line },
    danger: { bg: 'transparent', fg: theme.critical, border: theme.critical },
    soft: { bg: theme.surfaceAlt, fg: theme.ink, border: theme.surfaceAlt },
    onDark: { bg: 'rgba(244,241,230,0.10)', fg: '#F4F1E6', border: 'rgba(244,241,230,0.45)' },
  }[kind];
  const off = disabled || loading;
  return (
    <AnimatedPressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      onPressIn={off ? undefined : press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={off}
      // Small buttons are about 40pt tall: the touch area reaches 44pt and more (up and down only,
      // so buttons side by side never share a touch area).
      hitSlop={small ? { top: 4, bottom: 4 } : undefined}
      accessibilityRole="button"
      aria-disabled={!!off}
      aria-busy={!!loading}
      style={[
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: 1.5,
          borderRadius: radius.pill,
          paddingVertical: small ? 8 : 12,
          paddingHorizontal: small ? 14 : 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: off ? 0.5 : 1,
          overflow: shine ? 'hidden' : undefined,
        },
        style,
        { transform: [{ scale: press.scale }] },
      ]}
    >
      {shine && !off ? <Shine times={1} delay={900} color={kind === 'gold' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.28)'} /> : null}
      {loading ? (
        <ActivityIndicator color={colors.fg} />
      ) : icon ? (
        <Ionicons name={icon} size={small ? 16 : 19} color={colors.fg} />
      ) : null}
      <Text style={[small ? type.small : type.body, { fontFamily: fonts.sansSemi, color: colors.fg }]}>{label}</Text>
    </AnimatedPressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? theme.surfaceAlt : 'transparent',
      })}
    >
      <Ionicons name={icon} size={22} color={color ?? theme.ink} />
    </Pressable>
  );
}

/** Segmented control, e.g. วันนี้ / 7 วัน / 1 เดือน. The white pill slides to the chosen one. */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const [slide] = useState(() => new Animated.Value(index));
  useEffect(() => {
    if (reduce) {
      slide.setValue(index);
      return;
    }
    Animated.spring(slide, { toValue: index, speed: 16, bounciness: 8, useNativeDriver: useNative }).start();
  }, [index, reduce, slide]);
  const seg = width / Math.max(1, options.length);
  const last = Math.max(1, options.length - 1);
  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - 8)}
      style={{
        flexDirection: 'row',
        backgroundColor: theme.surfaceAlt,
        borderRadius: radius.pill,
        padding: 4,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 4,
            top: 4,
            bottom: 4,
            width: seg,
            borderRadius: radius.pill,
            // Light: a white pill with a soft shadow. Dark: shadows do not show, so a tint of the theme colour.
            backgroundColor: theme.dark ? alpha(theme.primary, 0.26) : theme.surface,
            borderWidth: theme.dark ? 1 : 0,
            borderColor: alpha(theme.primary, 0.5),
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
            transform: [{ translateX: slide.interpolate({ inputRange: [0, last], outputRange: [0, seg * last] }) }],
          }}
        />
      ) : null}
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            disabled={disabled}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(o.key);
            }}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="tab"
            // aria-* (not accessibilityState) so screen readers on the web also hear which one is chosen
            aria-selected={active}
            aria-disabled={!!disabled}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: radius.pill,
              alignItems: 'center',
              // Before the first layout the pill is not drawn yet: show the choice the plain way.
              backgroundColor: active && width === 0 ? (theme.dark ? alpha(theme.primary, 0.26) : theme.surface) : 'transparent',
            }}
          >
            <Text
              numberOfLines={1}
              style={[type.small, { fontFamily: active ? fonts.sansSemi : fonts.sansMedium, color: active ? theme.ink : theme.inkSoft }]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  glyph,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  glyph?: string;
}) {
  const theme = useTheme();
  const press = usePressSpring(0.93);
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={{ top: 6, bottom: 6 }}
      accessibilityRole="button"
      aria-selected={!!selected}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: selected ? theme.primary : theme.line,
        backgroundColor: selected ? alpha(theme.primary, theme.dark ? 0.22 : 0.12) : theme.surface,
        transform: [{ scale: press.scale }],
      }}
    >
      {glyph ? <Text style={{ fontSize: 14 }}>{glyph}</Text> : null}
      <Text style={[type.small, { fontFamily: selected ? fonts.sansSemi : fonts.sans, color: theme.ink }]}>{label}</Text>
    </AnimatedPressable>
  );
}

export function Badge({
  label,
  tone = 'neutral',
  center,
  onDark,
}: {
  label: string;
  tone?: 'neutral' | 'good' | 'watch' | 'critical' | 'gold';
  center?: boolean;
  /** Badge sits on the dark green hero: use light, high-contrast colors. */
  onDark?: boolean;
}) {
  const theme = useTheme();
  const map = {
    neutral: { bg: theme.surfaceAlt, fg: theme.inkSoft },
    good: { bg: theme.goodSoft, fg: theme.good },
    watch: { bg: theme.watchSoft, fg: theme.watch },
    critical: { bg: theme.criticalSoft, fg: theme.critical },
    gold: { bg: theme.accentSoft, fg: theme.accentInk },
  }[tone];
  const dark = {
    neutral: { bg: 'rgba(244,241,230,0.14)', fg: '#F4F1E6' },
    good: { bg: 'rgba(92,192,142,0.22)', fg: '#B8F0CF' },
    watch: { bg: 'rgba(224,165,72,0.25)', fg: '#FFD89A' },
    critical: { bg: 'rgba(224,122,99,0.28)', fg: '#FFC2B3' },
    gold: { bg: 'rgba(226,182,74,0.25)', fg: '#FFE3A1' },
  }[tone];
  const c = onDark ? dark : map;
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: center ? 'center' : 'flex-start' }}>
      <Text style={[type.micro, { fontFamily: fonts.sansSemi, color: c.fg }]}>{label}</Text>
    </View>
  );
}

/**
 * On/off switch. Track in the theme colour when on and in inkFaint when off (visible on every
 * surface); a white knob on every platform (the web's default knob is Material teal).
 */
export function Toggle({ value, onValueChange, label }: { value: boolean; onValueChange: (v: boolean) => void; label: string }) {
  const theme = useTheme();
  const webKnob = { activeThumbColor: '#FFFFFF' } as Record<string, string>;
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ true: theme.primary, false: theme.inkFaint }}
      ios_backgroundColor={theme.inkFaint}
      thumbColor="#FFFFFF"
      accessibilityLabel={label}
      {...webKnob}
    />
  );
}

/** A bar that grows smoothly to `value` (0..1). */
export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const theme = useTheme();
  return <GrowBar value={value} color={color ?? theme.primary} track={theme.surfaceAlt} />;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  onAction,
  art,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
  /** A picture instead of the icon, e.g. <Buddy mood="sleepy" /> */
  art?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Reveal zoom from={10} style={{ alignItems: 'center', paddingVertical: space.xxl, gap: space.sm }}>
      {art ?? (
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={28} color={theme.primary} />
        </View>
      )}
      <T v="h3" center>{title}</T>
      <T v="small" center style={{ maxWidth: 300 }}>{body}</T>
      {action && onAction ? <Button label={action} onPress={onAction} small kind="soft" style={{ marginTop: space.sm }} /> : null}
    </Reveal>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.line }} />;
}

export { Ionicons };
