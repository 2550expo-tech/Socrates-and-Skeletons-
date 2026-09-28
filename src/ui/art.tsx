/**
 * Brand illustration: the money tree.
 *
 * The tree is the visual form of the Money Runway (FR-6): the more days the
 * money will last, the more gold leaves it carries. It is drawn from code
 * (not an image) so it can change with the user's data.
 */
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { useCountUp, useNative, useReduceMotion } from './motion';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Branch tips (x, y) on a 140 x 150 canvas; the trunk base is at (70, 146).
const TIPS: [number, number][] = [
  [70, 22], [40, 38], [100, 36], [22, 64], [118, 62], [48, 70], [92, 70], [30, 96], [112, 94],
];

const BRANCHES = [
  'M70 146 C70 120 68 100 70 22',
  'M70 104 C58 86 48 60 40 38',
  'M70 96 C82 80 94 58 100 36',
  'M69 110 C52 96 34 84 22 64',
  'M71 108 C88 94 106 82 118 62',
  'M69 88 C60 82 52 76 48 70',
  'M71 86 C80 80 88 76 92 70',
  'M69 124 C56 116 40 108 30 96',
  'M71 122 C86 114 102 104 112 94',
];

interface Leaf {
  x: number;
  y: number;
  r: number;
  angle: number;
}

function buildLeaves(): Leaf[] {
  const rnd = seeded(20260927);
  const leaves: Leaf[] = [];
  for (const [tx, ty] of TIPS) {
    for (let i = 0; i < 5; i++) {
      const a = rnd() * Math.PI * 2;
      const d = 4 + rnd() * 12;
      leaves.push({ x: tx + Math.cos(a) * d, y: ty + Math.sin(a) * d * 0.8, r: 5 + rnd() * 3, angle: (a * 180) / Math.PI });
    }
  }
  // Grow order: from the top of the tree down, so a young tree looks natural.
  return leaves.sort((p, q) => p.y - q.y);
}

export function MoneyTree({
  health,
  size = 140,
  trunk,
  leaf,
  bare,
  grow,
  sway,
  glow,
  wiggle = 0,
}: {
  /** 0..1 — share of leaves shown in gold */
  health: number;
  size?: number;
  trunk: string;
  leaf: string;
  bare: string;
  /** Leaves turn gold one after another from the top when the tree appears or its health changes. */
  grow?: boolean;
  /** The tree sways gently a couple of times, like in a breeze. */
  sway?: boolean;
  /** A soft glow of this color behind the canopy. */
  glow?: string;
  /** Changes when the user taps the tree: it shakes its leaves. */
  wiggle?: number;
}) {
  const reduce = useReduceMotion();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const leaves = useMemo(() => buildLeaves(), []);
  const target = Math.round(Math.max(0, Math.min(1, health)) * leaves.length);
  const lit = useCountUp(target, !!grow && !reduce, 1100);
  const [rock] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!sway || reduce) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(rock, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
        Animated.timing(rock, { toValue: -1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
        Animated.timing(rock, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
      ]),
      { iterations: 2 },
    );
    anim.start();
    return () => anim.stop();
  }, [sway, reduce, rock, target]);
  const [shake] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!wiggle || reduce) return;
    shake.setValue(0);
    const step = (to: number, duration: number) => Animated.timing(shake, { toValue: to, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative });
    const anim = Animated.sequence([step(1, 90), step(-0.8, 150), step(0.55, 140), step(-0.3, 130), step(0, 120)]);
    anim.start();
    return () => anim.stop();
  }, [wiggle, reduce, shake]);
  return (
    <Animated.View
      style={{
        transformOrigin: 'bottom',
        transform: [
          { rotate: rock.interpolate({ inputRange: [-1, 1], outputRange: ['-2.5deg', '2.5deg'] }) },
          { rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] }) },
        ],
      }}
    >
      <Svg width={size} height={(size * 150) / 140} viewBox="0 0 140 150" accessibilityLabel="ต้นไม้เงิน">
        {glow ? (
          <>
            <Defs>
              <RadialGradient id={`${id}glow`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={glow} stopOpacity={0.45 * Math.max(0.3, lit / leaves.length)} />
                <Stop offset="1" stopColor={glow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={70} cy={62} r={66} fill={`url(#${id}glow)`} />
          </>
        ) : null}
        <G stroke={trunk} strokeLinecap="round" fill="none">
          {BRANCHES.map((d, i) => (
            <Path key={d} d={d} strokeWidth={i === 0 ? 5 : 2.2} />
          ))}
        </G>
        <Path d="M50 146 Q70 140 90 146" stroke={trunk} strokeWidth={2} fill="none" strokeLinecap="round" />
        {leaves.map((l, i) => (
          <Ellipse
            key={i}
            cx={l.x}
            cy={l.y}
            rx={l.r}
            ry={l.r * 0.55}
            rotation={l.angle}
            origin={`${l.x}, ${l.y}`}
            fill={i < lit ? leaf : 'none'}
            stroke={i < lit ? leaf : bare}
            strokeWidth={i < lit ? 0 : 1}
            opacity={i < lit ? 0.95 : 0.5}
          />
        ))}
        {lit > leaves.length * 0.8 ? <Circle cx={70} cy={16} r={3} fill={leaf} /> : null}
      </Svg>
    </Animated.View>
  );
}

/**
 * A ring that fills up to `value` (0..1) around its content, e.g. how full the
 * Money Runway is compared with a comfortable 45 days.
 */
export function ProgressRing({
  value,
  size,
  color,
  track,
  width = 6,
  children,
}: {
  value: number;
  size: number;
  color: string;
  track: string;
  width?: number;
  children?: ReactNode;
}) {
  const reduce = useReduceMotion();
  const shown = useCountUp(Math.round(Math.max(0, Math.min(1, value)) * 1000), !reduce, 1300) / 1000;
  const r = size / 2 - width;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={width} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={width}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - shown)}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children}
    </View>
  );
}

/**
 * Decorative contour strokes for hero surfaces (brand request: add line work so
 * screens do not feel empty). Purely decorative, hidden from screen readers.
 */
export function ContourLines({ width, height, color }: { width: number; height: number; color: string }) {
  const lines = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 7; i++) {
      const y = height * 0.25 + i * 16;
      out.push(
        `M-20 ${y} C ${width * 0.25} ${y - 40 + i * 4}, ${width * 0.55} ${y + 30 - i * 3}, ${width + 20} ${y - 18 + i * 2}`,
      );
    }
    return out;
  }, [width, height]);
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {lines.map((d, i) => (
        <Path key={i} d={d} stroke={color} strokeWidth={1} fill="none" opacity={0.10 + i * 0.015} />
      ))}
    </Svg>
  );
}

/** Tree health from the runway: 45+ days = full tree. */
export function treeHealth(status: string, days: number | null): number {
  if (status === 'below_floor') return 0.04;
  if (status === 'no_spending' || days === null) return 0.7;
  return Math.max(0.08, Math.min(1, days / 45));
}
