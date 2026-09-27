/**
 * Brand illustration: the money tree.
 *
 * The tree is the visual form of the Money Runway (FR-6): the more days the
 * money will last, the more gold leaves it carries. It is drawn from code
 * (not an image) so it can change with the user's data.
 */
import { useMemo } from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

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
}: {
  /** 0..1 — share of leaves shown in gold */
  health: number;
  size?: number;
  trunk: string;
  leaf: string;
  bare: string;
}) {
  const leaves = useMemo(() => buildLeaves(), []);
  const lit = Math.round(Math.max(0, Math.min(1, health)) * leaves.length);
  return (
    <Svg width={size} height={(size * 150) / 140} viewBox="0 0 140 150" accessibilityLabel="ต้นไม้เงิน">
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
