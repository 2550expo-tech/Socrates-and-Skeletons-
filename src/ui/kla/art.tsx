/**
 * น้องกล้า, drawn in code with soft 3D shading (light from the top left,
 * shaded clumps of leaves, glossy eyes, a round trunk). One canvas of
 * 200 × 240 for every size: the small companion shows the lower 200 × 200
 * and lets hats rise above it; the big coach shows all of it.
 *
 * The drawing is split into parts (back, arms, head, eyes, mouth) so the big
 * coach can move each part on the native driver (smooth, no redraws), while
 * the small companion draws them all in one picture. Skins add clothes and
 * props to the parts (src/domain/skins.ts lists them).
 */
import type { ReactNode } from 'react';
import { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { BuddyMood } from '../../domain/buddy';
import type { SkinId } from '../../domain/skins';

export const KLA_W = 200;
export const KLA_H = 240;
/** Pivots (canvas units) the big coach turns the parts around. */
export const PIVOT = { neck: { x: 100, y: 172 }, shoulderL: { x: 96, y: 196 }, shoulderR: { x: 104, y: 196 }, eyes: { x: 100, y: 128 }, mouth: { x: 100, y: 146 } };

const INK = '#2A1A0C';

interface Look {
  canopy: [string, string, string]; // light, base, shade
  trunk: [string, string];           // light, dark
  sprout: [string, string];
}

function lookFor(skin: SkinId, onDark: boolean): Look {
  const trunk: [string, string] = onDark ? ['#F1E9D2', '#BFAE86'] : ['#D8B57C', '#8E6B3A'];
  const sprout: [string, string] = ['#6FD39C', '#1F7A52'];
  if (skin === 'sakura') return { canopy: ['#FFE3EE', '#F5A9C4', '#D0668F'], trunk, sprout };
  if (skin === 'pioneer') return { canopy: ['#FFF4C2', '#F2C94C', '#C28A1E'], trunk, sprout };
  if (skin === 'pumpkin') return { canopy: ['#FFC27A', '#F28C28', '#B4530C'], trunk, sprout };
  if (skin === 'frankenstein') return { canopy: ['#D4F0B0', '#8CC66E', '#4A7F3C'], trunk, sprout };
  if (skin === 'sheetghost') return { canopy: ['#FFFFFF', '#EEF0F8', '#BFC5DD'], trunk, sprout };
  if (skin === 'mummy') return { canopy: ['#FFF8E6', '#EADFC4', '#B9A882'], trunk, sprout };
  if (skin === 'vampire') return { canopy: ['#FBEFD8', '#E6CC9C', '#B39460'], trunk, sprout };
  return { canopy: ['#FCE7A2', '#E7BC55', '#B8862A'], trunk, sprout };
}

/** Gradients used by the parts; `id` keeps them apart when many characters are on screen. */
export function KlaDefs({ id, skin, onDark }: { id: string; skin: SkinId; onDark: boolean }) {
  const look = lookFor(skin, onDark);
  return (
    <Defs>
      <RadialGradient id={`${id}canopy`} cx="72" cy="86" r="120" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={look.canopy[0]} />
        <Stop offset="0.5" stopColor={look.canopy[1]} />
        <Stop offset="1" stopColor={look.canopy[2]} />
      </RadialGradient>
      <RadialGradient id={`${id}shine`} cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.75} />
        <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
      </RadialGradient>
      <RadialGradient id={`${id}occl`} cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0" stopColor="#5A3A0A" stopOpacity={0.28} />
        <Stop offset="1" stopColor="#5A3A0A" stopOpacity={0} />
      </RadialGradient>
      <LinearGradient id={`${id}trunk`} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor={look.trunk[1]} />
        <Stop offset="0.45" stopColor={look.trunk[0]} />
        <Stop offset="1" stopColor={look.trunk[1]} />
      </LinearGradient>
      <LinearGradient id={`${id}sprout`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={look.sprout[0]} />
        <Stop offset="1" stopColor={look.sprout[1]} />
      </LinearGradient>
      <RadialGradient id={`${id}eye`} cx="0.4" cy="0.3" r="0.8">
        <Stop offset="0" stopColor="#5A4128" />
        <Stop offset="1" stopColor="#170E06" />
      </RadialGradient>
      <RadialGradient id={`${id}blush`} cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0" stopColor="#F28B6B" stopOpacity={0.6} />
        <Stop offset="1" stopColor="#F28B6B" stopOpacity={0} />
      </RadialGradient>
      <RadialGradient id={`${id}ground`} cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0" stopColor="#000000" stopOpacity={0.28} />
        <Stop offset="1" stopColor="#000000" stopOpacity={0} />
      </RadialGradient>
      <LinearGradient id={`${id}gold`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#FFF0B8" />
        <Stop offset="0.45" stopColor="#E9BE4E" />
        <Stop offset="1" stopColor="#A9761A" />
      </LinearGradient>
      <LinearGradient id={`${id}red`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#E0505E" />
        <Stop offset="1" stopColor="#8E1F2E" />
      </LinearGradient>
      <LinearGradient id={`${id}dark`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#4B4B52" />
        <Stop offset="1" stopColor="#15151A" />
      </LinearGradient>
      <LinearGradient id={`${id}leaf`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#8BE0AF" />
        <Stop offset="1" stopColor="#2E9A68" />
      </LinearGradient>
      <LinearGradient id={`${id}purple`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#9A6AD8" />
        <Stop offset="1" stopColor="#3E1F66" />
      </LinearGradient>
      <LinearGradient id={`${id}cloak`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#5B3486" />
        <Stop offset="1" stopColor="#1E0F33" />
      </LinearGradient>
      <RadialGradient id={`${id}aura`} cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0.55" stopColor="#FFE9A0" stopOpacity={0.55} />
        <Stop offset="1" stopColor="#FFE9A0" stopOpacity={0} />
      </RadialGradient>
    </Defs>
  );
}

// ---------------------------------------------------------------------------
// Back: ground shadow, cape, trunk and roots, things worn on the body
// ---------------------------------------------------------------------------

/** The soft shadow on the ground (kept still when the character hops). */
export function KlaGround({ id }: { id: string }): ReactNode {
  return <Ellipse cx={100} cy={231} rx={50} ry={8} fill={`url(#${id}ground)`} />;
}

export function KlaBack({ id, skin }: { id: string; skin: SkinId }): ReactNode {
  return (
    <G>
      {skin === 'pioneer' ? <Circle cx={100} cy={128} r={98} fill={`url(#${id}aura)`} /> : null}
      {skin === 'hero' ? (
        <Path d="M84 176 C64 196 54 214 50 230 C74 222 90 226 100 232 C110 226 126 222 150 230 C146 214 136 196 116 176 Z" fill={`url(#${id}red)`} />
      ) : null}
      {skin === 'vampire' ? (
        <G>
          {/* a black cape with red lining and a tall collar */}
          <Path d="M84 174 C62 196 50 214 46 232 C72 222 90 226 100 233 C110 226 128 222 154 232 C150 214 138 196 116 174 Z" fill={`url(#${id}dark)`} />
          <Path d="M88 178 C70 198 62 214 60 228 C80 222 92 225 100 229 C108 225 120 222 140 228 C138 214 130 198 112 178 Z" fill={`url(#${id}red)`} opacity={0.9} />
          <Path d="M84 176 L56 146 L90 166 Z M116 176 L144 146 L110 166 Z" fill={`url(#${id}dark)`} />
          <Path d="M84 176 L62 152 L88 168 Z M116 176 L138 152 L112 168 Z" fill="#8E1F2E" opacity={0.85} />
        </G>
      ) : null}
      {/* roots */}
      <Path d="M76 228 Q100 220 124 228" stroke={`url(#${id}trunk)`} strokeWidth={5} strokeLinecap="round" fill="none" />
      {/* trunk: slightly wider at the bottom, round with light in the middle */}
      <Path d="M89 166 C88 190 86 210 84 228 L116 228 C114 210 112 190 111 166 Z" fill={`url(#${id}trunk)`} />
      {skin === 'pumpkin' ? (
        <G>
          {/* a ghostly purple cloak with a ragged hem */}
          <Path
            d="M86 168 C80 190 72 212 64 229 L72 222 L79 230 L87 222 L94 230 L100 222 L106 230 L113 222 L121 230 L128 222 L136 229 C128 212 120 190 114 168 Z"
            fill={`url(#${id}cloak)`}
          />
          <Circle cx={100} cy={176} r={4} fill="#FF9A3C" stroke="#B4530C" strokeWidth={1} />
        </G>
      ) : null}
      {skin === 'sheetghost' ? (
        <Path
          d="M58 150 C56 180 58 206 56 226 Q64 218 71 226 Q78 218 85 226 Q92 218 100 226 Q108 218 115 226 Q122 218 129 226 Q136 218 144 226 C142 206 144 180 142 150 Z"
          fill="#F6F7FC"
          stroke="#C3C8DE"
          strokeWidth={1.5}
        />
      ) : null}
      {skin === 'mummy' ? (
        <G strokeLinecap="round">
          {['M86 182 L114 190', 'M86 198 L114 192', 'M85 211 L115 218', 'M84 224 L116 217'].map((d) => (
            <G key={d}>
              <Path d={d} stroke="#BFAE86" strokeWidth={7} />
              <Path d={d} stroke="#F6EEDA" strokeWidth={5} />
            </G>
          ))}
        </G>
      ) : null}
      {skin === 'frankenstein' ? (
        <G>
          {/* bolts on the neck */}
          <Rect x={79} y={181} width={10} height={7} rx={2} fill="#9AA3AE" stroke="#4B5563" strokeWidth={1.2} />
          <Rect x={111} y={181} width={10} height={7} rx={2} fill="#9AA3AE" stroke="#4B5563" strokeWidth={1.2} />
          <Path d="M75 184.5 h4 M121 184.5 h4" stroke="#4B5563" strokeWidth={2.5} strokeLinecap="round" />
        </G>
      ) : null}
      {skin === 'thai' ? (
        <G>
          {/* สไบ: a red silk sash over the shoulder with a gold edge */}
          <Path d="M84 184 C98 190 110 204 118 224 L108 226 C102 210 94 198 84 194 Z" fill={`url(#${id}red)`} />
          <Path d="M84 184 C98 190 110 204 118 224" stroke="#F2CB5E" strokeWidth={2} fill="none" />
          <Path d="M84 194 C94 198 102 210 108 226" stroke="#F2CB5E" strokeWidth={1.4} fill="none" />
        </G>
      ) : null}
      {skin === 'saver' ? (
        <G>
          <Path d="M90 172 Q100 190 110 172" stroke="#C9962E" strokeWidth={2} fill="none" />
          <Circle cx={100} cy={196} r={9} fill={`url(#${id}gold)`} stroke="#A9761A" strokeWidth={1.2} />
          <Path d="M100 190 v12 M97 193 h5 a2.2 2.2 0 0 1 0 4.4 h-5 a2.2 2.2 0 0 0 0 4.4 h5" stroke="#6E4A0C" strokeWidth={1.3} fill="none" strokeLinecap="round" />
        </G>
      ) : null}
      {skin === 'hero' ? (
        <Path d="M100 186 l3.2 6.6 7.2 1 -5.2 5 1.3 7.2 -6.5 -3.4 -6.5 3.4 1.3 -7.2 -5.2 -5 7.2 -1 z" fill="#FFD55A" stroke="#B8862A" strokeWidth={0.8} />
      ) : null}
      {skin === 'songkran2569' ? (
        <G>
          {/* พวงมาลัย: a garland of jasmine with red roses */}
          <Path d="M86 172 Q100 198 114 172" stroke="#FFFFFF" strokeWidth={5} strokeDasharray="3 2" fill="none" />
          <Circle cx={100} cy={186} r={4.5} fill="#E0505E" />
          <Circle cx={91} cy={181} r={3} fill="#E0505E" />
          <Circle cx={109} cy={181} r={3} fill="#E0505E" />
        </G>
      ) : null}
      {skin === 'newyear2570' ? (
        <G>
          <Rect x={92} y={176} width={16} height={6} rx={3} fill="#1F2A44" />
          <Path d="M92 179 l-6 -4 v8 z M108 179 l6 -4 v8 z" fill="#1F2A44" />
        </G>
      ) : null}
      {skin === 'dj' ? <Path d="M90 170 Q100 180 110 170" stroke="#2C2C34" strokeWidth={3} fill="none" /> : null}
    </G>
  );
}

// ---------------------------------------------------------------------------
// Arms (branches with a leaf hand), each turned around its shoulder
// ---------------------------------------------------------------------------

export function KlaArm({ id, skin, side, mood }: { id: string; skin: SkinId; side: 'L' | 'R'; mood: BuddyMood }): ReactNode {
  const s = side === 'L' ? -1 : 1;
  const up = mood === 'cheer';
  // Cheering: arms up and out, hands clear of the leaves so they can be seen.
  const hand = up ? { x: 100 + s * 66, y: 158 } : { x: 100 + s * 38, y: 186 };
  const elbow = up ? { x: 100 + s * 34, y: 192 } : { x: 100 + s * 22, y: 196 };
  const armPath = `M${100 + s * 6} 200 Q${elbow.x} ${elbow.y} ${hand.x} ${hand.y}`;
  if (skin === 'sheetghost') {
    // Arms under the sheet: soft white sleeves with a rounded end.
    return (
      <G>
        <Path d={armPath} stroke="#C3C8DE" strokeWidth={15} strokeLinecap="round" fill="none" />
        <Path d={armPath} stroke="#F6F7FC" strokeWidth={12} strokeLinecap="round" fill="none" />
      </G>
    );
  }
  return (
    <G>
      <Path d={armPath} stroke={`url(#${id}trunk)`} strokeWidth={7} strokeLinecap="round" fill="none" />
      <Ellipse cx={hand.x + s * 4} cy={hand.y - 3} rx={8} ry={5} fill={`url(#${id}leaf)`} rotation={s * -35} origin={`${hand.x + s * 4}, ${hand.y - 3}`} />
      {side === 'L' && skin === 'witch' ? (
        <G>
          {/* a magic broom */}
          <Path d={`M${hand.x + 6} ${hand.y - 18} L${hand.x - 14} ${hand.y + 26}`} stroke="#7A4A22" strokeWidth={3.5} strokeLinecap="round" />
          <Path
            d={`M${hand.x - 12} ${hand.y + 20} L${hand.x - 26} ${hand.y + 40} L${hand.x - 18} ${hand.y + 42} L${hand.x - 12} ${hand.y + 36} L${hand.x - 8} ${hand.y + 43} L${hand.x - 2} ${hand.y + 40} Z`}
            fill="#E2B04A"
            stroke="#A9761A"
            strokeWidth={1}
          />
        </G>
      ) : null}
      {side === 'R' && skin === 'pumpkin' ? (
        <G>
          {/* a trick-or-treat pail */}
          <Path d={`M${hand.x - 7} ${hand.y + 2} Q${hand.x + 4} ${hand.y - 14} ${hand.x + 15} ${hand.y + 2}`} stroke="#3A2A1A" strokeWidth={1.6} fill="none" />
          <Path d={`M${hand.x - 8} ${hand.y + 2} h24 l-3 15 q-9 4 -18 0 z`} fill="#F28C28" stroke="#B4530C" strokeWidth={1.2} />
          <Path d={`M${hand.x - 2} ${hand.y + 7} l2.5 -2.5 l2.5 2.5 z M${hand.x + 5} ${hand.y + 7} l2.5 -2.5 l2.5 2.5 z`} fill="#3A1E0E" />
          <Path d={`M${hand.x - 2} ${hand.y + 11} q6 4 12 0`} stroke="#3A1E0E" strokeWidth={1.4} fill="none" />
        </G>
      ) : null}
      {side === 'R' && skin === 'detective' ? (
        <G>
          <Path d={`M${hand.x + 2} ${hand.y} l10 -14`} stroke="#5A3A1A" strokeWidth={4} strokeLinecap="round" />
          <Circle cx={hand.x + 16} cy={hand.y - 22} r={10} fill="rgba(190,230,255,0.45)" stroke="#8C6A3A" strokeWidth={3} />
          <Path d={`M${hand.x + 11} ${hand.y - 26} q4 -4 8 -2`} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" fill="none" />
        </G>
      ) : null}
      {side === 'L' && skin === 'songkran2569' ? (
        <G>
          <Path d={`M${hand.x - 14} ${hand.y - 8} h22 l-3 10 h-16 z`} fill="#D9DDE3" stroke="#9AA3AE" strokeWidth={1.2} />
          <Ellipse cx={hand.x - 3} cy={hand.y - 8} rx={11} ry={2.5} fill="#7CC7F2" />
        </G>
      ) : null}
      {side === 'R' && skin === 'loykrathong2568' ? (
        <G>
          <Path d={`M${hand.x - 4} ${hand.y - 4} q14 10 28 0 q-14 -4 -28 0 z`} fill="#3E9A5E" />
          <Path d={`M${hand.x + 2} ${hand.y - 6} l4 -9 l4 9 l4 -9 l4 9`} fill="#F7A8C4" stroke="#D0668F" strokeWidth={0.8} />
          <Rect x={hand.x + 9} y={hand.y - 20} width={3} height={10} rx={1} fill="#FFF4D6" />
          <Ellipse cx={hand.x + 10.5} cy={hand.y - 22} rx={2} ry={3.5} fill="#FFB43A" />
        </G>
      ) : null}
    </G>
  );
}

// ---------------------------------------------------------------------------
// Head: shaded clumps of leaves, cheeks, sprout, and what is worn on the head
// ---------------------------------------------------------------------------

const CLUMPS: [number, number, number][] = [
  [100, 130, 50],
  [62, 142, 26],
  [138, 142, 26],
  [74, 100, 27],
  [126, 100, 27],
  [100, 88, 30],
];

/** Skins with something else on top of the head, so the sprout is hidden. */
const NO_SPROUT = new Set<SkinId>(['graduate', 'thai', 'detective', 'newyear2570', 'pumpkin', 'frankenstein', 'vampire', 'witch', 'sheetghost']);
const VEIN: Partial<Record<SkinId, string>> = { sakura: '#C25A82', frankenstein: '#3F6E34', vampire: '#9A7A40' };

/** The pumpkin head: ribbed segments, a curly stem and a leaf. */
function PumpkinHead({ id }: { id: string }) {
  const seg: [number, number, number][] = [
    [62, 22, 44],
    [138, 22, 44],
    [80, 26, 50],
    [120, 26, 50],
    [100, 30, 53],
  ];
  return (
    <G>
      <Path d="M100 80 C98 70 100 62 108 56" stroke="#5E7A2E" strokeWidth={6} strokeLinecap="round" fill="none" />
      <Path d="M106 60 q12 -10 22 -2 q-10 10 -22 2 z" fill={`url(#${id}leaf)`} />
      <Path d="M96 64 q-10 -6 -6 -14" stroke="#5E7A2E" strokeWidth={2} fill="none" strokeLinecap="round" />
      {seg.map(([cx, rx, ry]) => (
        <Ellipse key={cx} cx={cx} cy={130} rx={rx} ry={ry} fill={`url(#${id}canopy)`} stroke="#B4530C" strokeWidth={1.4} strokeOpacity={0.5} />
      ))}
      <Ellipse cx={100} cy={166} rx={44} ry={14} fill={`url(#${id}occl)`} />
      <Ellipse cx={82} cy={96} rx={16} ry={10} fill={`url(#${id}shine)`} rotation={-28} origin="82, 96" />
    </G>
  );
}

export function KlaHead({ id, skin, mood }: { id: string; skin: SkinId; mood: BuddyMood }): ReactNode {
  return (
    <G>
      {/* sprout */}
      {!NO_SPROUT.has(skin) ? (
        <G>
          <Path d="M100 62 C100 54 100 48 100 40" stroke={`url(#${id}sprout)`} strokeWidth={4.5} strokeLinecap="round" />
          <Ellipse cx={89} cy={42} rx={12} ry={6.5} fill={`url(#${id}sprout)`} rotation={-25} origin="89, 42" />
          <Ellipse cx={111} cy={40} rx={12} ry={6.5} fill={`url(#${id}sprout)`} rotation={25} origin="111, 40" />
        </G>
      ) : null}
      {skin === 'pumpkin' ? (
        <PumpkinHead id={id} />
      ) : (
        <G>
          {/* leaves */}
          <G fill={`url(#${id}canopy)`}>
            {CLUMPS.map(([cx, cy, r]) => (
              <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
            ))}
          </G>
          {/* soft shadow under the leaves, light on top */}
          <Ellipse cx={100} cy={160} rx={48} ry={18} fill={`url(#${id}occl)`} />
          <Ellipse cx={80} cy={92} rx={22} ry={13} fill={`url(#${id}shine)`} rotation={-28} origin="80, 92" />
          <Ellipse cx={128} cy={96} rx={8} ry={5} fill={`url(#${id}shine)`} opacity={0.6} />
          {/* leaf veins (a sheet or bandages have none) */}
          {skin !== 'sheetghost' && skin !== 'mummy' ? (
            <G stroke={VEIN[skin] ?? '#A87A1E'} strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={0.35}>
              <Path d="M60 132 q8 -8 16 -6" />
              <Path d="M138 128 q-8 -8 -16 -5" />
              <Path d="M96 76 q6 -6 13 -4" />
            </G>
          ) : null}
        </G>
      )}
      {skin === 'sheetghost' ? (
        <G stroke="#C9CEE2" strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.8}>
          <Path d="M70 86 q-6 14 -4 30" />
          <Path d="M132 86 q6 14 4 30" />
        </G>
      ) : null}
      {skin === 'mummy' ? (
        <G strokeLinecap="round" fill="none">
          {['M62 82 Q100 62 138 82', 'M44 106 Q70 96 92 104', 'M110 100 Q136 94 158 108', 'M40 156 Q58 150 74 166', 'M160 156 Q142 150 126 166', 'M84 172 Q100 178 116 172'].map((d) => (
            <G key={d}>
              <Path d={d} stroke="#BFAE86" strokeWidth={9} />
              <Path d={d} stroke="#F7F0DE" strokeWidth={7} />
            </G>
          ))}
        </G>
      ) : null}
      {skin === 'sakura' ? (
        <G>
          {[[70, 104], [128, 90], [142, 140], [58, 150], [108, 70]].map(([x, y]) => (
            <G key={`${x}-${y}`}>
              {[0, 72, 144, 216, 288].map((a) => (
                <Ellipse key={a} cx={x} cy={y - 4} rx={2.6} ry={4} fill="#FFFFFF" rotation={a} origin={`${x}, ${y}`} />
              ))}
              <Circle cx={x} cy={y} r={1.8} fill="#F2C94C" />
            </G>
          ))}
        </G>
      ) : null}
      {/* cheeks */}
      <Circle cx={66} cy={146} r={11} fill={`url(#${id}blush)`} />
      <Circle cx={134} cy={146} r={11} fill={`url(#${id}blush)`} />
      {/* eyebrows for some moods */}
      {mood === 'worried' ? (
        <G stroke={INK} strokeWidth={3} strokeLinecap="round">
          <Path d="M72 112 L88 107" />
          <Path d="M128 112 L112 107" />
        </G>
      ) : null}
      {mood === 'thinking' ? (
        <G stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none">
          <Path d="M74 110 q8 -5 16 -1" />
          <Path d="M110 106 q8 -5 16 0" />
        </G>
      ) : null}
      {/* things on the head */}
      {skin === 'thai' ? <ThaiCrown id={id} /> : null}
      {skin === 'frankenstein' ? (
        <G>
          {/* flat-top hair with ragged bangs, and a stitched scar */}
          <Path d="M56 98 L58 60 Q100 52 142 60 L144 98 Q132 86 120 95 Q110 84 100 95 Q90 84 80 95 Q68 86 56 98 Z" fill="#1E2A22" />
          <Path d="M64 64 Q100 58 136 64" stroke="#3E5446" strokeWidth={2} fill="none" />
          <G stroke="#2E3A30" strokeWidth={1.8} strokeLinecap="round" fill="none">
            <Path d="M112 106 L134 101" />
            <Path d="M116 101 l2 8 M122 100 l2 8 M128 99 l2 8" />
          </G>
        </G>
      ) : null}
      {skin === 'vampire' ? (
        <G>
          {/* slicked-back hair with a widow's peak */}
          <Path d="M50 114 C46 70 78 50 100 52 C122 50 154 70 150 114 C138 98 120 92 110 96 L100 110 L90 96 C80 92 62 98 50 114 Z" fill="#17151D" />
          <Path d="M70 70 Q92 58 118 62" stroke="#4A4658" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        </G>
      ) : null}
      {skin === 'witch' ? (
        <G>
          {/* a witch's hat with a bent tip, an orange band and a gold buckle */}
          <Ellipse cx={100} cy={74} rx={60} ry={13} fill={`url(#${id}purple)`} />
          <Path d="M68 72 Q82 42 94 24 Q104 8 128 6 Q114 18 112 32 Q118 52 132 72 Z" fill={`url(#${id}purple)`} />
          <Path d="M72 62 Q100 70 128 62 L131 70 Q100 79 69 70 Z" fill="#FF9A3C" />
          <Rect x={93} y={63} width={14} height={11} rx={2} fill="none" stroke="#F2C94C" strokeWidth={2.2} />
          <Path d="M118 40 l2 4.5 4.5 2 -4.5 2 -2 4.5 -2 -4.5 -4.5 -2 4.5 -2 z" fill="#FFE9A0" />
        </G>
      ) : null}
      {skin === 'pumpkin' ? (
        <G>
          {/* a little ghost friend peeking behind the pumpkin */}
          <Path d="M150 70 q10 -16 20 0 v12 l-3.5 -3 -3.5 3 -3.5 -3 -3.5 3 -3.5 -3 z" fill="#FFFFFF" opacity={0.9} />
          <Circle cx={157} cy={70} r={1.6} fill={INK} />
          <Circle cx={163} cy={70} r={1.6} fill={INK} />
        </G>
      ) : null}
      {skin === 'graduate' ? (
        <G>
          <Path d="M100 44 L148 58 L100 72 L52 58 Z" fill={`url(#${id}dark)`} />
          <Path d="M72 64 v14 q28 12 56 0 v-14 l-28 8 z" fill="#20202A" />
          <Path d="M100 58 L136 70 L140 92" stroke="#F2C94C" strokeWidth={2.2} fill="none" strokeLinecap="round" />
          <Circle cx={140} cy={96} r={4} fill="#F2C94C" />
          <Circle cx={100} cy={58} r={3} fill="#F2C94C" />
        </G>
      ) : null}
      {skin === 'detective' ? (
        <G>
          <Path d="M60 86 C60 50 140 50 140 86 Z" fill="#8C6A3A" />
          <Path d="M52 86 Q100 98 148 86 Q100 78 52 86 Z" fill="#6E5028" />
          <Path d="M64 80 Q100 70 136 80" stroke="#5A3A1A" strokeWidth={3} fill="none" />
          <G stroke="#A3824E" strokeWidth={1.2} opacity={0.7}>
            <Path d="M78 58 L86 84 M100 54 L100 82 M122 58 L114 84" />
          </G>
        </G>
      ) : null}
      {skin === 'dj' ? (
        <G>
          {/* headband over the top of the head, then the ear cups */}
          <Path d="M47 128 C40 44 160 44 153 128" stroke={`url(#${id}dark)`} strokeWidth={8} fill="none" strokeLinecap="round" />
          <Path d="M58 72 C80 48 120 48 142 72" stroke="#FFFFFF" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.35} />
          <Rect x={36} y={118} width={22} height={38} rx={11} fill={`url(#${id}dark)`} />
          <Rect x={142} y={118} width={22} height={38} rx={11} fill={`url(#${id}dark)`} />
          <Rect x={41} y={125} width={12} height={24} rx={6} fill="#8A6CF0" />
          <Rect x={147} y={125} width={12} height={24} rx={6} fill="#8A6CF0" />
          <Rect x={43} y={127} width={4} height={10} rx={2} fill="#FFFFFF" opacity={0.5} />
          <Rect x={149} y={127} width={4} height={10} rx={2} fill="#FFFFFF" opacity={0.5} />
        </G>
      ) : null}
      {skin === 'saver' ? (
        <G>
          {[[76, 66], [100, 56], [124, 66]].map(([x, y]) => (
            <G key={x}>
              <Circle cx={x} cy={y} r={10} fill={`url(#${id}gold)`} stroke="#A9761A" strokeWidth={1.4} />
              <Circle cx={x} cy={y} r={6} fill="none" stroke="#C9962E" strokeWidth={1.2} />
            </G>
          ))}
        </G>
      ) : null}
      {skin === 'chill' ? (
        <G>
          <Circle cx={138} cy={98} r={5} fill="#F7D774" />
          {[0, 72, 144, 216, 288].map((a) => (
            <Ellipse key={a} cx={138} cy={90} rx={4.5} ry={7} fill="#F26B7A" rotation={a} origin="138, 98" />
          ))}
          <Circle cx={138} cy={98} r={3.5} fill="#F7D774" />
        </G>
      ) : null}
      {skin === 'hero' ? <Path d="M66 118 Q100 104 134 118 L134 132 Q116 126 100 132 Q84 126 66 132 Z" fill="#1F3A7A" opacity={0.92} /> : null}
      {skin === 'pioneer' ? (
        <G>
          <Path d="M100 30 l5 10 11 1.5 -8 7.5 2 11 -10 -5.2 -10 5.2 2 -11 -8 -7.5 11 -1.5 z" fill={`url(#${id}gold)`} stroke="#A9761A" strokeWidth={1} />
        </G>
      ) : null}
      {skin === 'songkran2569' ? (
        <G>
          {[[70, 96], [132, 94], [100, 76]].map(([x, y]) => (
            <G key={x}>
              <Circle cx={x} cy={y} r={6} fill="#FFFFFF" />
              <Circle cx={x} cy={y} r={2.5} fill="#F2C94C" />
            </G>
          ))}
        </G>
      ) : null}
      {skin === 'loykrathong2568' ? (
        <G>
          <Path d="M88 64 q12 -22 24 0 q-12 8 -24 0 z" fill="#F7A8C4" stroke="#D0668F" strokeWidth={1} />
          <Path d="M82 66 q18 -10 36 0" stroke="#D0668F" strokeWidth={1.2} fill="none" />
        </G>
      ) : null}
      {skin === 'newyear2570' ? (
        <G>
          <Path d="M100 12 L122 70 Q100 78 78 70 Z" fill="#6B3FA0" />
          <Path d="M89 42 L111 42 M84 56 L116 56" stroke="#F2C94C" strokeWidth={4} />
          <Circle cx={100} cy={12} r={6} fill="#F2C94C" />
        </G>
      ) : null}
    </G>
  );
}

function ThaiCrown({ id }: { id: string }) {
  return (
    <G>
      {/* ชฎา: a tiered golden crown with a tall spire and small red gems */}
      <Path d="M70 78 Q100 66 130 78 L126 90 Q100 82 74 90 Z" fill={`url(#${id}gold)`} stroke="#8E6414" strokeWidth={1} />
      <Path d="M77 78 L85 56 Q100 50 115 56 L123 78 Q100 70 77 78 Z" fill={`url(#${id}gold)`} stroke="#8E6414" strokeWidth={1} />
      <Path d="M87 56 L93 37 Q100 33 107 37 L113 56 Q100 51 87 56 Z" fill={`url(#${id}gold)`} stroke="#8E6414" strokeWidth={1} />
      <Path d="M93.5 37 L100 6 L106.5 37 Q100 34 93.5 37 Z" fill={`url(#${id}gold)`} stroke="#8E6414" strokeWidth={1} />
      <G stroke="#8E6414" strokeWidth={0.9} fill="none" opacity={0.8}>
        <Path d="M81 74 Q100 66 119 74" />
        <Path d="M89 52 Q100 47 111 52" />
      </G>
      {[[100, 72], [86, 74], [114, 74], [100, 56], [100, 43]].map(([x, y]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r={2.6} fill="#D8344A" stroke="#FFE3A0" strokeWidth={0.6} />
      ))}
      {/* กรรเจียก: ornaments over the ears */}
      <Path d="M54 104 q-10 -18 2 -30 q2 16 10 24 z" fill={`url(#${id}gold)`} stroke="#8E6414" strokeWidth={0.9} />
      <Path d="M146 104 q10 -18 -2 -30 q-2 16 -10 24 z" fill={`url(#${id}gold)`} stroke="#8E6414" strokeWidth={0.9} />
    </G>
  );
}

// ---------------------------------------------------------------------------
// Face parts
// ---------------------------------------------------------------------------

/** Eyes. `closed` draws the blink (the big coach blinks by squeezing this layer instead). */
export function KlaEyes({ id, mood, closed }: { id: string; mood: BuddyMood; closed?: boolean }): ReactNode {
  if (mood === 'happy' || mood === 'cheer') {
    return (
      <G stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none">
        <Path d="M74 130 Q82 119 90 130" />
        <Path d="M110 130 Q118 119 126 130" />
      </G>
    );
  }
  if (mood === 'sleepy' || closed) {
    return (
      <G stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none">
        <Path d="M74 126 Q82 133 90 126" />
        <Path d="M110 126 Q118 133 126 126" />
      </G>
    );
  }
  const dx = mood === 'thinking' ? 3 : 0;
  const dy = mood === 'thinking' ? -3 : 0;
  return (
    <G>
      <Ellipse cx={82 + dx} cy={127 + dy} rx={7.5} ry={9.5} fill={`url(#${id}eye)`} />
      <Ellipse cx={118 + dx} cy={127 + dy} rx={7.5} ry={9.5} fill={`url(#${id}eye)`} />
      <Circle cx={84.5 + dx} cy={123 + dy} r={3} fill="#FFFFFF" />
      <Circle cx={120.5 + dx} cy={123 + dy} r={3} fill="#FFFFFF" />
      <Circle cx={80 + dx} cy={131 + dy} r={1.4} fill="#FFFFFF" opacity={0.85} />
      <Circle cx={116 + dx} cy={131 + dy} r={1.4} fill="#FFFFFF" opacity={0.85} />
    </G>
  );
}

/** Sunglasses sit on the eyes, so they are drawn with them. */
export function KlaGlasses({ skin }: { skin: SkinId }): ReactNode {
  if (skin !== 'chill') return null;
  return (
    <G>
      <Path d="M70 120 h26 v8 q0 10 -13 10 q-13 0 -13 -10 z" fill="#1B1B22" />
      <Path d="M104 120 h26 v8 q0 10 -13 10 q-13 0 -13 -10 z" fill="#1B1B22" />
      <Path d="M96 123 h8" stroke="#1B1B22" strokeWidth={3} />
      <Path d="M75 124 l6 -3 M109 124 l6 -3" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
    </G>
  );
}

/** Where the top of the mouth is for each mood (vampire fangs hang from it). */
const FANG_Y: Record<BuddyMood, number | null> = { happy: 142.5, cheer: 142.5, calm: 147, worried: 149, thinking: 148.5, sleepy: null };

function Fangs({ y }: { y: number }) {
  return <Path d={`M92.5 ${y} l2.5 6 l2.5 -6 z M102.5 ${y} l2.5 6 l2.5 -6 z`} fill="#FFFFFF" stroke="#D8D2CC" strokeWidth={0.6} />;
}

/** The mouth at rest for each mood (with little fangs for the vampire). */
export function KlaMouth({ mood, skin }: { mood: BuddyMood; skin?: SkinId }): ReactNode {
  const fangY = skin === 'vampire' ? FANG_Y[mood] : null;
  return (
    <G>
      <MouthShape mood={mood} />
      {fangY !== null ? <Fangs y={fangY} /> : null}
    </G>
  );
}

function MouthShape({ mood }: { mood: BuddyMood }): ReactNode {
  switch (mood) {
    case 'happy':
    case 'cheer':
      return (
        <G>
          <Path d="M88 142 Q100 160 112 142 Z" fill="#3A1E0E" />
          <Path d="M93 150 Q100 156 107 150 Q100 147 93 150 Z" fill="#E8736A" />
        </G>
      );
    case 'worried':
      return <Path d="M90 152 Q100 144 110 152" stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />;
    case 'sleepy':
      return <Ellipse cx={100} cy={148} rx={4} ry={4.5} fill="#3A1E0E" />;
    case 'thinking':
      return <Path d="M92 150 L108 147" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />;
    default:
      return <Path d="M89 143 Q100 154 111 143" stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />;
  }
}

/** The open mouth while talking (the big coach opens and closes it). */
export function KlaMouthOpen({ skin }: { skin?: SkinId } = {}): ReactNode {
  return (
    <G>
      <Ellipse cx={100} cy={149} rx={10} ry={9} fill="#3A1E0E" />
      <Ellipse cx={100} cy={154} rx={6.5} ry={3.6} fill="#E8736A" />
      <Path d="M92 143 Q100 141 108 143" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.85} />
      {skin === 'vampire' ? <Fangs y={141} /> : null}
    </G>
  );
}

/** Little signs around the head: Z's when sleepy, sparkles when cheering, thought bubbles when thinking. */
export function KlaExtras({ mood }: { mood: BuddyMood }): ReactNode {
  if (mood === 'sleepy') {
    return (
      <Path
        d="M152 62 h13 l-13 13 h13 M172 40 h9 l-9 9 h9"
        stroke="#2E9A68"
        strokeWidth={3.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    );
  }
  if (mood === 'cheer') {
    return (
      <G fill="#F2C94C">
        <Path d="M24 92 l4.5 10.5 10.5 4.5 -10.5 4.5 -4.5 10.5 -4.5 -10.5 -10.5 -4.5 10.5 -4.5 z" />
        <Path d="M176 104 l3 7.5 7.5 3 -7.5 3 -3 7.5 -3 -7.5 -7.5 -3 7.5 -3 z" />
        <Path d="M166 58 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" />
      </G>
    );
  }
  if (mood === 'thinking') {
    return (
      <G fill="#2E9A68">
        <Circle cx={160} cy={84} r={4.5} />
        <Circle cx={172} cy={66} r={7} />
      </G>
    );
  }
  return null;
}
