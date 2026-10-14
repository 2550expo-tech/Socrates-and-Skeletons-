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
import { GrowBar, Reveal, usePressSpring } from './effects';
import { KeyboardAvoid } from './KeyboardAvoid';
import { useCountUp, useNative, useReduceMotion } from './motion';
import { alpha, fonts, radius, space, type, useTheme } from './theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

type Variant = 'hero' | 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'micro' | 'label';

const VARIANT_FONT: Record<Variant, string> = {
  hero: fonts.serif,
  display: fonts.serif,
  // Page titles in the sans face: the serif is kept for money.
  h1: fonts.sansBold,
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
        // Labels are text: inkSoft (inkFaint is for rules and quiet icons, below 4.5:1). No letter
        // spacing or capitals: Thai never needs them.
        v === 'label' && { color: color ?? theme.inkSoft },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * Money with tabular digits. Headline sizes (display, h1, h2) use the serif face, the voice of money;
 * amounts in rows and tables use the sans face. Satang: `decimals` 'auto' (default) shows them only
 * when they are not zero ("฿90", "฿89.50"); true always shows them (forms, slip review); false rounds
 * to whole baht (totals, averages, projections).
 */
export function Money({
  satang,
  size = 'h2',
  color,
  sign,
  decimals = 'auto',
  style,
  countUp,
}: {
  satang: number;
  size?: 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'small';
  color?: string;
  sign?: boolean;
  decimals?: boolean | 'auto';
  style?: StyleProp<TextStyle>;
  /** Ease to new amounts when the value changes (it shows at once the first time). */
  countUp?: boolean;
}) {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const value = useCountUp(satang, !!countUp && !reduce);
  const abs = Math.abs(value);
  const showFrac = decimals === true || (decimals === 'auto' && abs % 100 !== 0);
  // Whole baht only: round to the nearest baht, like formatBaht (฿99.99 shows ฿100).
  const whole = String(showFrac ? Math.floor(abs / 100) : Math.round(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = String(abs % 100).padStart(2, '0');
  const prefix = sign ? (value < 0 ? '−' : '+') : value < 0 ? '−' : '';
  const big = type[size];
  const headline = size === 'display' || size === 'h1' || size === 'h2';
  return (
    <Text
      style={[
        { fontFamily: headline ? fonts.serif : fonts.sansSemi, color: color ?? theme.ink, fontVariant: ['tabular-nums'] },
        big,
        style,
      ]}
    >
      {prefix}฿{whole}
      {showFrac ? <Text style={headline ? { fontSize: big.fontSize * 0.6 } : undefined}>.{frac}</Text> : null}
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
  header,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: ('top' | 'bottom')[];
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ComponentProps<typeof ScrollView>['refreshControl'];
  /** Receives the scroll position, for effects that follow scrolling (parallax). */
  scrollY?: Animated.Value;
  /** Stays put above the scrolling content (the stack screens' StackHeader). */
  header?: ReactNode;
}) {
  const theme = useTheme();
  const pad = padded ? { paddingHorizontal: space.lg } : null;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: theme.bg }}>
      {header}
      {/* Android: room for the keyboard (iOS scrolls the field into view with automaticallyAdjustKeyboardInsets). */}
      <KeyboardAvoid ios={false}>
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
      </KeyboardAvoid>
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
    // Tonal surfaces, no outline: outlines everywhere were the texture of clutter.
    borderWidth: 0,
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
    ghost: { bg: 'transparent', fg: theme.ink, border: theme.lineStrong },
    danger: { bg: 'transparent', fg: theme.critical, border: theme.critical },
    soft: { bg: theme.surfaceAlt, fg: theme.ink, border: theme.surfaceAlt },
    onDark: { bg: alpha(theme.heroInk, 0.1), fg: theme.heroInk, border: alpha(theme.heroInk, 0.45) },
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
          overflow: undefined,
        },
        style,
        { transform: [{ scale: press.scale }] },
      ]}
    >
      {/* (No light sweep on buttons any more: the screen stays still.) */}
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
  disabled,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  /** Shown faint, not pressable, and announced as unavailable. */
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      aria-disabled={!!disabled}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed && !disabled ? theme.surfaceAlt : 'transparent',
      })}
    >
      <Ionicons name={icon} size={22} color={disabled ? theme.lineStrong : (color ?? theme.ink)} />
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
  icon,
  iconColor,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  glyph?: string;
  icon?: IconName;
  iconColor?: string;
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
      // The label alone (an icon font glyph is not part of the name).
      accessibilityLabel={label}
      aria-selected={!!selected}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: radius.pill,
        // Tonal: a quiet fill, and the chosen one in the main colour (no outlines).
        borderWidth: 1.5,
        borderColor: selected ? theme.primary : 'transparent',
        backgroundColor: selected ? alpha(theme.primary, theme.dark ? 0.24 : 0.12) : theme.surfaceAlt,
        transform: [{ scale: press.scale }],
      }}
    >
      {icon ? <Ionicons name={icon} size={16} color={iconColor ?? theme.inkSoft} /> : glyph ? <Text style={{ fontSize: 14 }}>{glyph}</Text> : null}
      <Text style={[type.small, { fontFamily: selected ? fonts.sansSemi : fonts.sans, color: theme.ink }]}>{label}</Text>
    </AnimatedPressable>
  );
}

export function Badge({
  label,
  tone = 'neutral',
  center,
  onDark,
  icon,
}: {
  label: string;
  /** A small icon before the label (instead of text marks like ✓, which some fonts draw as √). */
  icon?: IconName;
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
    neutral: { bg: alpha(theme.heroInk, 0.14), fg: theme.heroInk },
    good: { bg: 'rgba(92,192,142,0.22)', fg: '#B8F0CF' },
    watch: { bg: 'rgba(224,165,72,0.25)', fg: '#FFD89A' },
    critical: { bg: 'rgba(224,122,99,0.28)', fg: '#FFC2B3' },
    gold: { bg: 'rgba(226,182,74,0.25)', fg: '#FFE3A1' },
  }[tone];
  const c = onDark ? dark : map;
  return (
    <View
      style={{ backgroundColor: c.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: center ? 'center' : 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 }}
    >
      {icon ? <Ionicons name={icon} size={13} color={c.fg} /> : null}
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
      trackColor={{ true: theme.primary, false: theme.lineStrong }}
      ios_backgroundColor={theme.lineStrong}
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

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: theme.line }, style]} />;
}

export { Ionicons };
