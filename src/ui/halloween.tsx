/**
 * ฮาโลวีน: the spooky-cute pieces of the Halloween colour theme, all drawn in
 * code — little ghosts, bats, a jack-o'-lantern, candies and a moon — plus the
 * ghosts the user can catch on the home screen for candies. Rules (event days,
 * ghosts per day, candies): src/domain/halloween.ts.
 *
 * Motion follows the app's rules: transform/opacity on the native driver, a
 * limited number of loops, and nothing at all with "Reduce motion" on.
 */
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { Animated, Easing, Platform, Pressable, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { Storage } from '../data/storage';
import { ghostSays, HALLOWEEN } from '../domain/halloween';
import { SKINS, type SkinId } from '../domain/skins';
import { useKla } from '../services/kla';
import { Button, IconButton, Row, T } from './components';
import { GrowBar, useCelebrate } from './effects';
import { useToast } from './feedback';
import { useReduceMotion } from './motion';
import { radius, space, useTheme } from './theme';
import { setColorTheme } from './themeMode';

const useNative = Platform.OS !== 'web';
const ease = Easing.inOut(Easing.sin);

export function useHalloween(): boolean {
  return useTheme().colorTheme === 'halloween';
}

// ---------------------------------------------------------------------------
// Little drawings
// ---------------------------------------------------------------------------

export function GhostArt({ size = 40, boo = false }: { size?: number; boo?: boolean }) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 40 44">
      <Defs>
        <RadialGradient id={`${id}b`} cx="35%" cy="25%" r="80%">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#DCD6EE" />
        </RadialGradient>
      </Defs>
      <Path d="M20 2 C9 2 4 11 4 21 V40 l4 -4 4 4 4 -4 4 4 4 -4 4 4 4 -4 4 4 V21 C36 11 31 2 20 2 Z" fill={`url(#${id}b)`} stroke="#C9C1E3" strokeWidth={1} />
      <Ellipse cx={15} cy={18} rx={2.4} ry={3} fill="#2A1A3C" />
      <Ellipse cx={25} cy={18} rx={2.4} ry={3} fill="#2A1A3C" />
      <Circle cx={15.8} cy={17} r={0.8} fill="#FFFFFF" />
      <Circle cx={25.8} cy={17} r={0.8} fill="#FFFFFF" />
      <Circle cx={11.5} cy={23.5} r={2.4} fill="#F4A6B8" opacity={0.6} />
      <Circle cx={28.5} cy={23.5} r={2.4} fill="#F4A6B8" opacity={0.6} />
      {boo ? <Ellipse cx={20} cy={26} rx={3} ry={3.6} fill="#2A1A3C" /> : <Path d="M17 24 q3 3 6 0" stroke="#2A1A3C" strokeWidth={1.6} strokeLinecap="round" fill="none" />}
    </Svg>
  );
}

export function BatArt({ size = 28, color = '#1B1026' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size / 2} viewBox="0 0 40 20">
      <Path d="M17 10 Q11 1 2 5 Q7 7 5 12 Q10 9 11 14 Q13 10 17 13 Z" fill={color} />
      <Path d="M23 10 Q29 1 38 5 Q33 7 35 12 Q30 9 29 14 Q27 10 23 13 Z" fill={color} />
      <Ellipse cx={20} cy={11} rx={4.2} ry={5.2} fill={color} />
      <Path d="M17 7 l1 -4 2 3 2 -3 1 4 z" fill={color} />
      <Circle cx={18.6} cy={10} r={0.9} fill="#FF9A3C" />
      <Circle cx={21.4} cy={10} r={0.9} fill="#FF9A3C" />
    </Svg>
  );
}

export function PumpkinArt({ size = 36, glow = true }: { size?: number; glow?: boolean }) {
  const id = `p${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <RadialGradient id={`${id}o`} cx="40%" cy="35%" r="70%">
          <Stop offset="0" stopColor="#FFC27A" />
          <Stop offset="0.6" stopColor="#F28C28" />
          <Stop offset="1" stopColor="#B4530C" />
        </RadialGradient>
      </Defs>
      <Path d="M20 9 C19 6 20 3 23 1" stroke="#5E7A2E" strokeWidth={2.4} strokeLinecap="round" fill="none" />
      {[
        [10, 9, 13],
        [30, 9, 13],
        [15, 10, 14],
        [25, 10, 14],
        [20, 11, 15],
      ].map(([cx, rx, ry]) => (
        <Ellipse key={cx} cx={cx} cy={23} rx={rx} ry={ry} fill={`url(#${id}o)`} stroke="#B4530C" strokeWidth={0.6} strokeOpacity={0.6} />
      ))}
      <Path d="M12 19 l3 -4 3 4 z M22 19 l3 -4 3 4 z" fill={glow ? '#FFE27A' : '#3A1E0E'} />
      <Path d="M11 25 q9 8 18 0 l-2.5 -0.5 -1.5 2 -2 -2 -2 2 -2 -2 -2 2 -1.5 -2 z" fill={glow ? '#FFE27A' : '#3A1E0E'} />
    </Svg>
  );
}

export function CandyArt({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.6} viewBox="0 0 30 18">
      <Path d="M8 9 L1 3 L2 15 Z" fill="#FF9A3C" />
      <Path d="M22 9 L29 3 L28 15 Z" fill="#FF9A3C" />
      <Circle cx={15} cy={9} r={7} fill="#B48CF0" />
      <Path d="M10 6 q5 -3 10 0 M10 12 q5 3 10 0" stroke="#FFFFFF" strokeWidth={1.4} fill="none" opacity={0.8} />
    </Svg>
  );
}

function MoonArt({ size = 34 }: { size?: number }) {
  const id = `m${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <RadialGradient id={`${id}g`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFE9A0" stopOpacity={0.35} />
          <Stop offset="1" stopColor="#FFE9A0" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={20} cy={20} r={20} fill={`url(#${id}g)`} />
      <Path d="M24 8 A12 12 0 1 0 30 28 A10 10 0 1 1 24 8 Z" fill="#FFE9A0" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Moving decorations
// ---------------------------------------------------------------------------

/** A float that goes up and down a few times (or stays still with "Reduce motion"). */
function useFloat(ms: number, times = 8) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: ms, easing: ease, useNativeDriver: useNative }),
        Animated.timing(v, { toValue: 0, duration: ms, easing: ease, useNativeDriver: useNative }),
      ]),
      { iterations: times },
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, v, ms, times]);
  return v;
}

/** Bats that flap across the top of the balance card a few times, then leave. */
export function SpookyHeroDecor() {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const [fly] = useState(() => new Animated.Value(0));
  const [flap] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce || !w) return;
    const across = Animated.loop(
      Animated.sequence([Animated.timing(fly, { toValue: 1, duration: 6500, easing: Easing.linear, useNativeDriver: useNative }), Animated.delay(2500)]),
      { iterations: 3 },
    );
    const wings = Animated.loop(
      Animated.sequence([
        Animated.timing(flap, { toValue: 1, duration: 160, useNativeDriver: useNative }),
        Animated.timing(flap, { toValue: 0, duration: 160, useNativeDriver: useNative }),
      ]),
      { iterations: 90 },
    );
    fly.setValue(0);
    across.start();
    wings.start();
    return () => {
      across.stop();
      wings.stop();
    };
  }, [reduce, w, fly, flap]);
  if (reduce) return null;
  const bat = (dy: number, lag: number, size: number) => (
    <Animated.View
      style={{
        position: 'absolute',
        top: dy,
        left: 0,
        transform: [
          { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [-60 - lag, w + 40 - lag] }) },
          { translateY: fly.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -8, 2, -6, 0] }) },
          { scaleY: flap.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) },
        ],
      }}
    >
      <BatArt size={size} color="#9C7FD0" />
    </Animated.View>
  );
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' }}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
    >
      {w ? (
        <>
          {bat(14, 0, 30)}
          {bat(36, 70, 22)}
        </>
      ) : null}
    </View>
  );
}

/** A moon and two small ghosts drifting behind น้องกล้า on its stage. */
export function SpookyBackdropDecor() {
  const a = useFloat(1700);
  const b = useFloat(2100);
  const drift = (v: Animated.Value, dx: number) => [
    { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
    { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
    { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] }) },
  ];
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      <View style={{ position: 'absolute', left: 14, top: 12 }}>
        <MoonArt size={40} />
      </View>
      <View style={{ position: 'absolute', left: 52, top: 22, opacity: 0.8 }}>
        <BatArt size={20} />
      </View>
      <Animated.View style={{ position: 'absolute', left: '6%', top: '40%', opacity: 0.8, transform: drift(a, 6) }}>
        <GhostArt size={30} />
      </Animated.View>
      <View style={{ position: 'absolute', right: '6%', top: '40%' }}>
        <PumpkinArt size={28} />
      </View>
      <Animated.View style={{ position: 'absolute', right: '7%', top: '58%', opacity: 0.75, transform: drift(b, -6) }}>
        <GhostArt size={24} boo />
      </Animated.View>
    </View>
  );
}

/** A point on the bunting string (two gentle sags across 360 units). */
function onString(x: number): number {
  const q = (t: number, a: number, c: number, b: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;
  return x <= 180 ? q(x / 180, 4, 30, 8) : q((x - 180) / 180, 8, -10, 12);
}

/** ธงราวฮาโลวีน: a garland of orange, purple and black flags across the top of the home screen. */
export function HalloweenBunting() {
  const f = useFloat(2600, 4);
  const colors = ['#FF9A3C', '#6A35A8', '#1B1026'];
  const flags = Array.from({ length: 11 }, (_, i) => 14 + i * 33);
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ marginHorizontal: -space.lg, height: 38, transformOrigin: 'top', transform: [{ rotate: f.interpolate({ inputRange: [0, 1], outputRange: ['-0.8deg', '0.8deg'] }) }] }}
    >
      <Svg width="100%" height={38} viewBox="0 0 360 38" preserveAspectRatio="xMidYMin slice">
        <Path d="M0 4 Q90 30 180 8 Q270 -10 360 12" stroke="#8C7A9E" strokeWidth={1.4} fill="none" />
        {flags.map((x, i) => {
          const y = onString(x);
          const c = colors[i % 3];
          return (
            <G key={x}>
              <Path d={`M${x - 8} ${y} L${x + 8} ${y + 1} L${x} ${y + 17} Z`} fill={c} />
              {c === '#FF9A3C' ? <Path d={`M${x - 4} ${y + 5} l2 -2.5 2 2.5 z M${x + 1} ${y + 5} l2 -2.5 2 2.5 z M${x - 3} ${y + 9} q3 2.5 6 0`} fill="#3A1E0E" stroke="#3A1E0E" strokeWidth={0.6} /> : null}
              {c === '#6A35A8' ? (
                <G>
                  <Circle cx={x - 2.5} cy={y + 6} r={1.3} fill="#FFFFFF" />
                  <Circle cx={x + 2.5} cy={y + 6} r={1.3} fill="#FFFFFF" />
                </G>
              ) : null}
              {c === '#1B1026' ? <Path d={`M${x - 5} ${y + 7} q2.5 -3 5 0 q2.5 -3 5 0`} stroke="#FF9A3C" strokeWidth={1} fill="none" /> : null}
            </G>
          );
        })}
      </Svg>
    </Animated.View>
  );
}

/**
 * The space on the right of a screen header (balancing the back button).
 * In the Halloween theme a little ghost peeks from it; otherwise it is empty.
 * Seasonal touches stay in the header and hero zones, away from the task.
 */
export function HeaderDecor({ width = 42 }: { width?: number }) {
  const halloween = useHalloween();
  return <View style={{ width, height: 42, alignItems: 'center', justifyContent: 'center' }}>{halloween ? <PeekingGhost size={26} /> : null}</View>;
}

/** A ghost and a bat beside a big page title (Halloween theme only). */
export function TitleDecor() {
  const halloween = useHalloween();
  if (!halloween) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ marginBottom: 14 }}>
        <BatArt size={24} />
      </View>
      <PeekingGhost size={34} />
    </View>
  );
}

function PeekingGhost({ size }: { size: number }) {
  const f = useFloat(1400, 6);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        transform: [
          { translateY: f.interpolate({ inputRange: [0, 1], outputRange: [2, -4] }) },
          { rotate: f.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '6deg'] }) },
        ],
      }}
    >
      <GhostArt size={size} />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Catching ghosts (home screen, Halloween theme, during the event)
// ---------------------------------------------------------------------------

const SLOTS = [
  { left: '6%', top: 10, ms: 1500 },
  { left: '41%', top: 0, ms: 1850 },
  { left: '74%', top: 14, ms: 1650 },
] as const;

function CatchableGhost({ slot, index, onCatch }: { slot: (typeof SLOTS)[number]; index: number; onCatch: () => void }) {
  const f = useFloat(slot.ms, 10);
  const [pop] = useState(() => new Animated.Value(0));
  const [caught, setCaught] = useState(false);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: slot.left,
        top: slot.top,
        opacity: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [
          { translateY: f.interpolate({ inputRange: [0, 1], outputRange: [0, -9] }) },
          { rotate: f.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] }) },
          { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) },
        ],
      }}
    >
      <Pressable
        hitSlop={10}
        disabled={caught}
        accessibilityRole="button"
        accessibilityLabel={`จับผีตัวที่ ${index + 1}`}
        onPress={() => {
          setCaught(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          Animated.timing(pop, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: useNative }).start(() => onCatch());
        }}
      >
        <GhostArt size={46} boo={caught} />
      </Pressable>
    </Animated.View>
  );
}

/** The Halloween card on home: catch today's ghosts, see candies and the next skin. */
export function HalloweenCard() {
  const theme = useTheme();
  const toast = useToast();
  const celebrate = useCelebrate();
  const kla = useKla();
  const [gone, setGone] = useState<number[]>([]);
  const total = kla.candies.total;
  const visible = SLOTS.map((_, i) => i)
    .filter((i) => !gone.includes(i))
    .slice(0, kla.ghostsLeft);
  const next = SKINS.filter((s) => s.event === 'halloween2569' && s.candies && !kla.owned.has(s.id)).sort((a, b) => (a.candies ?? 0) - (b.candies ?? 0))[0];
  const target: SkinId = next?.id ?? 'pumpkin';

  function caught(i: number) {
    setGone((g) => [...g, i]);
    kla.catchGhost();
    toast({ message: ghostSays(total + 1) });
    if (next && total + 1 >= (next.candies ?? 0)) celebrate();
  }

  return (
    <View style={{ borderRadius: radius.xl, overflow: 'hidden' }}>
      <LinearGradient colors={[theme.heroTop, theme.hero, theme.heroDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: space.lg, gap: space.sm }}>
        <Row justify="space-between">
          <T v="h3" color="#F4F1E6">
            จับผีรับลูกอม
          </T>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)' }}
            accessible
            accessibilityLabel={`ลูกอม ${total} เม็ด`}
          >
            <CandyArt size={20} />
            <T v="body" color={theme.heroAccent} style={{ fontVariant: ['tabular-nums'] }}>
              {total}
            </T>
          </View>
        </Row>
        <T v="small" color={theme.heroInkSoft}>
          {kla.ghostsLeft > 0
            ? `วันนี้มีผีน้อย ${kla.ghostsLeft} ตัว แตะเพื่อจับ ได้ตัวละ 1 เม็ด`
            : `วันนี้จับผีครบแล้ว พรุ่งนี้มาใหม่นะ · จดรายการวันไหนได้อีก ${HALLOWEEN.candiesPerRecordDay} เม็ด`}
        </T>
        <View style={{ height: 78 }}>
          {visible.map((i) => (
            <CatchableGhost key={i} slot={SLOTS[i]} index={i} onCatch={() => caught(i)} />
          ))}
          {kla.ghostsLeft === 0 ? (
            <Row gap={space.sm} style={{ position: 'absolute', left: 0, right: 0, top: 10, justifyContent: 'center' }}>
              <PumpkinArt size={46} />
              <T v="h2" color={theme.heroInkSoft}>
                z z
              </T>
            </Row>
          ) : null}
        </View>
        {next ? (
          <View style={{ gap: 4 }}>
            <Row justify="space-between">
              <T v="small" color="#F4F1E6">
                อีก {Math.max(0, (next.candies ?? 0) - total)} เม็ดได้ชุด{next.name}
              </T>
              <T v="micro" color={theme.heroInkSoft}>
                {Math.min(total, next.candies ?? 0)}/{next.candies}
              </T>
            </Row>
            <GrowBar value={Math.min(1, total / (next.candies ?? 1))} color={theme.heroAccent} track="rgba(244,241,230,0.18)" height={6} />
          </View>
        ) : (
          <T v="small" color="#F4F1E6">
            ได้ชุดฮาโลวีนครบทุกชุดแล้ว เก่งมาก!
          </T>
        )}
        <Button label="ดูสกินฮาโลวีน" small kind="gold" icon="shirt" onPress={() => router.push({ pathname: '/skins', params: { skin: target } })} />
      </LinearGradient>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Invite to the Halloween theme (other themes, during the event)
// ---------------------------------------------------------------------------

const INVITE_KEY = 'mindpay.halloweenInvite';
let inviteClosed: boolean | null = null;
const inviteListeners = new Set<() => void>();
const inviteSub = (l: () => void) => {
  inviteListeners.add(l);
  return () => {
    inviteListeners.delete(l);
  };
};
const inviteSnap = () => inviteClosed;

function closeInvite() {
  inviteClosed = true;
  inviteListeners.forEach((l) => l());
  Storage.setItem(INVITE_KEY, 'closed').catch(() => {});
}

export function HalloweenInvite() {
  const celebrate = useCelebrate();
  const closed = useSyncExternalStore(inviteSub, inviteSnap, inviteSnap);
  useEffect(() => {
    if (inviteClosed !== null) return;
    Storage.getItem(INVITE_KEY)
      .then((v) => {
        inviteClosed = v === 'closed';
        inviteListeners.forEach((l) => l());
      })
      .catch(() => {
        inviteClosed = false;
        inviteListeners.forEach((l) => l());
      });
  }, []);
  if (closed !== false) return null;
  return (
    <View style={{ borderRadius: radius.xl, overflow: 'hidden' }}>
      <LinearGradient colors={['#3B1E5C', '#24123D', '#120822']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: space.lg, gap: space.sm }}>
        <Row gap={space.md} align="flex-start">
          <View style={{ alignItems: 'center' }}>
            <GhostArt size={38} />
            <View style={{ marginTop: -8 }}>
              <PumpkinArt size={38} />
            </View>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <T v="h3" color="#F4F1E6">
              ฮาโลวีนมาแล้ว!
            </T>
            <T v="small" color="#D9C8F0">
              ลองธีมฮาโลวีน มีผีน้อยให้จับรับลูกอม แลกชุดผีหัวฟักทอง แฟรงเกนสไตน์ แม่มด แวมไพร์ และอีกเพียบ
            </T>
          </View>
          <IconButton icon="close" label="ปิดการ์ดฮาโลวีน" color="#D9C8F0" onPress={closeInvite} />
        </Row>
        <Button
          label="เปิดธีมฮาโลวีน"
          small
          kind="gold"
          icon="moon"
          onPress={() => {
            setColorTheme('halloween');
            celebrate();
          }}
        />
        <T v="micro" color="#BBA9CF">
          เปลี่ยนกลับได้ทุกเมื่อในหน้าตั้งค่า
        </T>
      </LinearGradient>
    </View>
  );
}
