/**
 * MindPay motion effects: entrance reveals, springy presses, light sweeps,
 * sparkles, glowing auroras, confetti and more.
 *
 * Rules every effect here follows:
 * - Only transform and opacity move, on the UI thread on phones (native
 *   driver), so effects stay smooth on low-cost Android phones.
 * - Every effect ends by itself. Nothing keeps moving while the screen is idle
 *   (battery); the only loops run while something is really happening
 *   (scanning, the coach typing).
 * - With the phone's "Reduce motion" setting on, content appears at once.
 */
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { useNative, useReduceMotion } from './motion';
import { palette, useTheme } from './theme';

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };

/** Repeatable pseudo-random numbers, so decorations look the same on every render. */
export function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ---------------------------------------------------------------------------
// Entrance
// ---------------------------------------------------------------------------

/**
 * Content rises and fades in when it first appears. Give items in a list their
 * `index` for a cascade (capped, so long lists do not wait).
 */
export function Reveal({
  children,
  index = 0,
  delay = 0,
  from = 18,
  zoom,
  style,
}: {
  children: ReactNode;
  index?: number;
  delay?: number;
  /** Distance in points the content rises from. */
  from?: number;
  /** Also grow from 96%. */
  zoom?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(reduce ? 1 : 0));
  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    const anim = Animated.timing(v, {
      toValue: 1,
      duration: 480,
      delay: delay + Math.min(index, 10) * 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: useNative,
    });
    anim.start();
    return () => anim.stop();
  }, [reduce, v, index, delay]);
  const rise = v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] });
  const grow = v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  return (
    <Animated.View style={[style, { opacity: v, transform: zoom ? [{ translateY: rise }, { scale: grow }] : [{ translateY: rise }] }]}>
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Press
// ---------------------------------------------------------------------------

/** A springy squeeze while a button or card is held, with a small bounce back. */
export function usePressSpring(to = 0.96) {
  const reduce = useReduceMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const onPressIn = useCallback(() => {
    if (reduce) return;
    Animated.spring(scale, { toValue: to, speed: 60, bounciness: 0, useNativeDriver: useNative }).start();
  }, [reduce, scale, to]);
  const onPressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, speed: 18, bounciness: 14, useNativeDriver: useNative }).start();
  }, [scale]);
  return { scale, onPressIn, onPressOut };
}

// ---------------------------------------------------------------------------
// Light
// ---------------------------------------------------------------------------

/**
 * A band of light that sweeps across a surface (like light on gold), a couple
 * of times after it appears and again whenever `trigger` changes.
 * Put it inside a container with overflow: 'hidden'.
 */
export function Shine({
  trigger,
  times = 2,
  delay = 450,
  duration = 1150,
  color = 'rgba(255,255,255,0.20)',
}: {
  trigger?: unknown;
  times?: number;
  delay?: number;
  duration?: number;
  color?: string;
}) {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce || !w) return;
    v.setValue(0);
    const passes: Animated.CompositeAnimation[] = [];
    for (let i = 0; i < times; i++) {
      passes.push(Animated.delay(i === 0 ? delay : 1300));
      passes.push(Animated.timing(v, { toValue: i + 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: useNative }));
    }
    const anim = Animated.sequence(passes);
    anim.start();
    return () => anim.stop();
  }, [reduce, w, trigger, times, delay, duration, v]);
  if (reduce) return null;
  const band = Math.max(90, w * 0.32);
  const progress = Animated.modulo(v, 1);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} {...hidden}>
      {w ? (
        <Animated.View
          style={{
            position: 'absolute',
            top: -60,
            bottom: -60,
            width: band,
            opacity: v.interpolate({ inputRange: [0, 0.02, times], outputRange: [0, 1, 1] }),
            transform: [
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-band * 1.6, w + band * 0.6] }) },
              { rotate: '20deg' },
            ],
          }}
        >
          <LinearGradient colors={['rgba(255,255,255,0)', color, 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Soft glowing clouds of color behind a surface. They drift gently a few times
 * after appearing, then rest. Put it inside a container with overflow: 'hidden'.
 */
export function Aurora({
  colors: given,
  strength = 0.34,
  cycles = 1,
  seed = 3,
}: {
  colors?: string[];
  strength?: number;
  /** How many times the clouds drift there and back (0 = still). */
  cycles?: number;
  seed?: number;
}) {
  const reduce = useReduceMotion();
  const theme = useTheme();
  // Clouds in the colour theme: its bright accent, its main colour and a soft tint.
  const colorsKey = given ? given.join(',') : `${theme.heroAccent},${theme.primary},${theme.heroInkSoft}`;
  const colors = useMemo(() => colorsKey.split(','), [colorsKey]);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [v] = useState(() => new Animated.Value(0));
  const blobs = useMemo(() => {
    const rnd = seeded(seed);
    return colors.map((color, i) => ({
      color,
      x: [0.78, 0.12, 0.55][i % 3] + (rnd() - 0.5) * 0.12,
      y: [0.12, 0.85, 0.5][i % 3] + (rnd() - 0.5) * 0.12,
      r: 0.55 + rnd() * 0.25,
      dx: (rnd() - 0.5) * 60,
      dy: (rnd() - 0.5) * 40,
    }));
  }, [colors, seed]);
  useEffect(() => {
    if (reduce || !cycles || !size.w) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
        Animated.timing(v, { toValue: 0, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
      ]),
      { iterations: cycles },
    );
    anim.start();
    return () => anim.stop();
  }, [reduce, cycles, size.w, v]);
  const base = Math.max(size.w, size.h);
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      {...hidden}
    >
      {size.w
        ? blobs.map((b, i) => {
            const d = base * b.r;
            return (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  left: size.w * b.x - d / 2,
                  top: size.h * b.y - d / 2,
                  width: d,
                  height: d,
                  transform: [
                    { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, b.dx] }) },
                    { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, b.dy] }) },
                  ],
                }}
              >
                <Svg width={d} height={d}>
                  <Defs>
                    <RadialGradient id={`${id}a${i}`} cx="50%" cy="50%" r="50%">
                      <Stop offset="0" stopColor={b.color} stopOpacity={strength} />
                      <Stop offset="0.55" stopColor={b.color} stopOpacity={strength * 0.35} />
                      <Stop offset="1" stopColor={b.color} stopOpacity={0} />
                    </RadialGradient>
                  </Defs>
                  <Circle cx={d / 2} cy={d / 2} r={d / 2} fill={`url(#${id}a${i})`} />
                </Svg>
              </Animated.View>
            );
          })
        : null}
    </View>
  );
}

const STAR = 'M5 0 L6.2 3.8 L10 5 L6.2 6.2 L5 10 L3.8 6.2 L0 5 L3.8 3.8 Z';

/**
 * Little gold stars that twinkle and float up for a few seconds, e.g. over the
 * balance. `trigger` starts them again (for example when the balance changes).
 */
export function Sparkles({
  count = 10,
  color = palette.goldBright,
  cycles = 2,
  trigger,
  seed = 11,
  area = { top: 8, bottom: 92 },
}: {
  count?: number;
  color?: string;
  cycles?: number;
  trigger?: unknown;
  seed?: number;
  /** Vertical band (percent of the container) the stars appear in. */
  area?: { top: number; bottom: number };
}) {
  const reduce = useReduceMotion();
  const [p] = useState(() => new Animated.Value(0));
  const stars = useMemo(() => {
    const rnd = seeded(seed);
    return Array.from({ length: count }, () => ({
      x: 4 + rnd() * 90,
      y: area.top + rnd() * (area.bottom - area.top),
      size: 6 + rnd() * 9,
      phase: rnd(),
      drift: 10 + rnd() * 26,
      turn: rnd() > 0.5 ? 90 : -90,
    }));
  }, [count, seed, area.top, area.bottom]);
  useEffect(() => {
    if (reduce) return;
    p.setValue(0);
    const anim = Animated.timing(p, { toValue: cycles, duration: 2400 * cycles, easing: Easing.linear, useNativeDriver: useNative });
    anim.start();
    return () => anim.stop();
  }, [reduce, p, cycles, trigger]);
  if (reduce) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity: p.interpolate({ inputRange: [0, 0.25, Math.max(0.5, cycles - 0.35), cycles], outputRange: [0, 1, 1, 0] }) }]}
      {...hidden}
    >
      {stars.map((s, i) => {
        const local = Animated.modulo(Animated.add(p, s.phase), 1);
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: `${s.x}%`,
              top: `${s.y}%`,
              opacity: local.interpolate({ inputRange: [0, 0.2, 0.55, 1], outputRange: [0, 1, 0.55, 0] }),
              transform: [
                { translateY: local.interpolate({ inputRange: [0, 1], outputRange: [0, -s.drift] }) },
                { scale: local.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.2, 1, 0.5] }) },
                { rotate: local.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${s.turn}deg`] }) },
              ],
            }}
          >
            <Svg width={s.size} height={s.size} viewBox="0 0 10 10">
              <Path d={STAR} fill={color} />
            </Svg>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

/** Rings that ripple out from behind something, e.g. the scan button. Loops only while `active`. */
export function PulseRing({
  size,
  color = palette.goldBright,
  active = true,
  times = 3,
  width = 2,
}: {
  size: number;
  color?: string;
  active?: boolean;
  /** Pulses before resting (ignored while `active` is 'always'). */
  times?: number | 'always';
  width?: number;
}) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(0));
  // Fades the rings away when a counted run of pulses ends (no ring left hanging mid-ripple).
  const [fade] = useState(() => new Animated.Value(1));
  // The second ring joins half a pulse later instead of popping in mid-ripple.
  const [late] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce || !active) return;
    v.setValue(0);
    fade.setValue(1);
    late.setValue(0);
    const anim = Animated.parallel([
      Animated.loop(
        Animated.timing(v, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: useNative }),
        { iterations: times === 'always' ? -1 : times },
      ),
      Animated.timing(late, { toValue: 1, duration: 1, delay: 740, useNativeDriver: useNative }),
    ]);
    anim.start(({ finished }) => {
      if (finished) Animated.timing(fade, { toValue: 0, duration: 450, useNativeDriver: useNative }).start();
    });
    return () => anim.stop();
  }, [reduce, active, times, v, fade, late]);
  if (reduce || !active) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center' }} {...hidden}>
      {[0, 0.5].map((offset) => {
        const p = Animated.modulo(Animated.add(v, offset), 1);
        const joined = offset ? late : 1;
        return (
          <Animated.View
            key={offset}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: width,
              borderColor: color,
              opacity: Animated.multiply(Animated.multiply(p.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.55, 0] }), joined), fade),
              transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.75] }) }],
            }}
          />
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Numbers and bars
// ---------------------------------------------------------------------------

/**
 * A bar that grows to `value` (0..1) from the left, with a rounded end.
 * Used for categories, budgets and the runway timeline.
 */
export function GrowBar({
  value,
  color,
  track,
  height = 8,
  delay = 0,
  opacity = 1,
  animate = true,
}: {
  value: number;
  color: string;
  track: string;
  height?: number;
  delay?: number;
  opacity?: number;
  /** false: show the value at once (e.g. steps already done). */
  animate?: boolean;
}) {
  const reduce = useReduceMotion();
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const [w, setW] = useState(0);
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!w) return;
    if (reduce || !animate) {
      v.setValue(pct);
      return;
    }
    const anim = Animated.timing(v, { toValue: pct, duration: 750, delay, easing: Easing.out(Easing.cubic), useNativeDriver: useNative });
    anim.start();
    return () => anim.stop();
  }, [pct, reduce, v, delay, w, animate]);
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {w ? (
        <Animated.View
          style={{
            width: w,
            height,
            borderRadius: height / 2,
            backgroundColor: color,
            opacity,
            transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-w, 0] }) }],
          }}
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Waiting
// ---------------------------------------------------------------------------

/** Three dots that hop one after another while someone is "typing". */
export function TypingDots({ color, size = 7 }: { color: string; size?: number }) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1050, easing: Easing.linear, useNativeDriver: useNative }));
    loop.start();
    return () => loop.stop();
  }, [reduce, v]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.7, height: size * 3 }} {...hidden}>
      {[0, 1, 2].map((i) => {
        const a = 0.12 + i * 0.16;
        return (
          <Animated.View
            key={i}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              opacity: reduce ? 0.7 : v.interpolate({ inputRange: [0, a, a + 0.16, 1], outputRange: [0.35, 1, 0.35, 0.35] }),
              transform: reduce ? [] : [{ translateY: v.interpolate({ inputRange: [0, a, a + 0.16, 1], outputRange: [0, -size * 0.8, 0, 0] }) }],
            }}
          />
        );
      })}
    </View>
  );
}

/**
 * Text that writes itself out quickly (the coach's answers). Mount it with a
 * `key` per message; with Reduce motion the whole text shows at once.
 */
export function Typewriter({ text, children, maxMs = 1400 }: { text: string; children: (shown: string) => ReactNode; maxMs?: number }) {
  const reduce = useReduceMotion();
  const chars = useMemo(() => Array.from(text), [text]);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const began = Date.now();
    const total = Math.min(maxMs, Math.max(350, chars.length * 12));
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - began) / total);
      setN(Math.ceil(chars.length * (1 - Math.pow(1 - t, 2))));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [chars, reduce, maxMs]);
  return <>{children(reduce || n >= chars.length ? text : chars.slice(0, n).join(''))}</>;
}

/** A light beam that sweeps down and up over a picture of a slip while scanning. */
export function ScanBeam({ height, color = '#5CE0A0', active }: { height: number; color?: string; active: boolean }) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce || !active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: useNative }),
        Animated.timing(v, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: useNative }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, active, v]);
  if (reduce || !active) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -6,
        right: -6,
        top: 0,
        height: 26,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-8, height - 18] }) }],
      }}
      {...hidden}
    >
      <LinearGradient colors={['rgba(92,224,160,0)', `${color}55`, 'rgba(92,224,160,0)']} style={{ flex: 1 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: 12, height: 2, borderRadius: 1, backgroundColor: color }} />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Celebration: confetti of gold coins, leaves and ribbons
// ---------------------------------------------------------------------------

const CONFETTI_BASE = [palette.goldBright, palette.gold, '#F4F1E6'];
/** Halloween theme: pumpkin orange, candy purple and night black. */
const CONFETTI_SPOOKY = ['#FF9A3C', '#B48CF0', '#1B1026', '#F4F1E6'];
const SAMPLES = 10;

interface Piece {
  kind: 'ribbon' | 'coin' | 'leaf';
  color: string;
  w: number;
  h: number;
  xs: number[];
  ys: number[];
  spin: number;
  delay: number;
}

function makePieces(count: number, width: number, height: number, origin: { x: number; y: number }, seed: number, tints: string[], spooky = false): Piece[] {
  const CONFETTI_COLORS = [...(spooky ? CONFETTI_SPOOKY : CONFETTI_BASE), ...tints];
  const rnd = seeded(seed);
  const g = height * 1.9; // gravity, points per second²
  const duration = 1.9;
  return Array.from({ length: count }, (_, i) => {
    const angle = (-90 + (rnd() - 0.5) * 130) * (Math.PI / 180);
    const speed = height * (0.55 + rnd() * 0.75);
    const vx = Math.cos(angle) * speed * 0.8;
    const vy = Math.sin(angle) * speed;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let k = 0; k <= SAMPLES; k++) {
      const t = (k / SAMPLES) * duration;
      xs.push(origin.x + vx * t + Math.sin(t * 6 + i) * 8);
      ys.push(origin.y + vy * t + 0.5 * g * t * t);
    }
    const r = rnd();
    const kind: Piece['kind'] = r < 0.22 ? 'coin' : r < 0.48 ? 'leaf' : 'ribbon';
    return {
      kind,
      color: kind === 'coin' ? (spooky ? '#FF9A3C' : palette.goldBright) : CONFETTI_COLORS[Math.floor(rnd() * CONFETTI_COLORS.length)],
      w: kind === 'coin' ? 11 : kind === 'leaf' ? 13 : 6 + rnd() * 4,
      h: kind === 'coin' ? 11 : kind === 'leaf' ? 7 : 11 + rnd() * 6,
      xs,
      ys,
      spin: (rnd() - 0.5) * 1080,
      delay: rnd() * 120,
    };
  });
}

function ConfettiBurst({
  id,
  width,
  height,
  origin,
  onDone,
  tints,
  spooky,
}: {
  id: number;
  width: number;
  height: number;
  origin?: { x: number; y: number };
  onDone: (id: number) => void;
  /** Colours of the colour theme mixed in with the gold. */
  tints: string[];
  /** Halloween theme: pumpkins and candies instead of gold coins. */
  spooky: boolean;
}) {
  const [p] = useState(() => new Animated.Value(0));
  const tintKey = tints.join(',');
  const pieces = useMemo(
    () => makePieces(44, width, height, origin ?? { x: width / 2, y: height * 0.42 }, Math.floor(id) % 100000, tintKey.split(','), spooky),
    [width, height, origin, id, tintKey, spooky],
  );
  useEffect(() => {
    const anim = Animated.timing(p, { toValue: 1, duration: 1900, easing: Easing.linear, useNativeDriver: useNative });
    anim.start(() => onDone(id));
    return () => anim.stop();
  }, [p, onDone, id]);
  const input = Array.from({ length: SAMPLES + 1 }, (_, k) => k / SAMPLES);
  return (
    <>
      {pieces.map((c, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: c.w,
            height: c.h,
            borderRadius: c.kind === 'coin' ? c.w / 2 : c.kind === 'leaf' ? c.h : 2,
            backgroundColor: c.color,
            borderWidth: c.kind === 'coin' ? 2 : 0,
            borderColor: spooky ? '#B4530C' : palette.gold,
            opacity: p.interpolate({ inputRange: [0, 0.04, 0.72, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: p.interpolate({ inputRange: input, outputRange: c.xs }) },
              { translateY: p.interpolate({ inputRange: input, outputRange: c.ys }) },
              { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${c.spin}deg`] }) },
              { scaleX: c.kind === 'ribbon' ? p.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 0.2, 1, 0.2, 1] }) : 1 },
            ],
          }}
        />
      ))}
    </>
  );
}

type Celebrate = (options?: { origin?: { x: number; y: number } }) => void;
const CelebrateContext = createContext<Celebrate>(() => {});

/** Call `useCelebrate()()` for a burst of confetti (and a success tap on phones). */
export function useCelebrate() {
  return useContext(CelebrateContext);
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const reduce = useReduceMotion();
  const theme = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [bursts, setBursts] = useState<{ id: number; origin?: { x: number; y: number } }[]>([]);
  const celebrate = useCallback<Celebrate>(
    (options) => {
      if (useNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (reduce) return;
      setBursts((b) => [...b.slice(-1), { id: Date.now() + Math.random(), origin: options?.origin }]);
    },
    [reduce],
  );
  const remove = useCallback((id: number) => setBursts((b) => b.filter((x) => x.id !== id)), []);
  return (
    <CelebrateContext.Provider value={celebrate}>
      {children}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { zIndex: 3000, elevation: 30 }]}
        onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        {...hidden}
      >
        {size.w
          ? bursts.map((b) => (
              <ConfettiBurst key={b.id} id={b.id} width={size.w} height={size.h} origin={b.origin} onDone={remove} tints={[theme.primary, theme.heroAccent, theme.heroInkSoft]} spooky={theme.colorTheme === 'halloween'} />
            ))
          : null}
      </View>
    </CelebrateContext.Provider>
  );
}
