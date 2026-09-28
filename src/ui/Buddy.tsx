/**
 * "น้องกล้า": a money-tree sapling with a face, drawn in code so it can change
 * mood with the user's money (happy, calm, worried, sleepy, thinking, cheer).
 * Idea from MeowJot's cat and Hugging Face's Huggy: one friendly character
 * that makes the app feel alive. It bobs a few times when it appears and
 * blinks now and then; both are off when the phone's "Reduce motion" is on.
 */
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import type { BuddyMood } from '../domain/buddy';
import { T } from './components';
import { useReduceMotion } from './motion';
import { palette, radius, space, useTheme } from './theme';

const useNative = Platform.OS !== 'web';
const INK = '#0E3B2C';
const CANOPY: Record<BuddyMood, string> = {
  happy: palette.goldBright,
  cheer: palette.goldBright,
  calm: '#D9B75A',
  thinking: '#D9B75A',
  worried: '#C9A55A',
  sleepy: '#C9B98A',
};

function Eyes({ mood, blink }: { mood: BuddyMood; blink: boolean }) {
  if (mood === 'happy' || mood === 'cheer') {
    return (
      <G stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none">
        <Path d="M44 53 Q49 47 54 53" />
        <Path d="M66 53 Q71 47 76 53" />
      </G>
    );
  }
  if (mood === 'sleepy' || blink) {
    return (
      <G stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none">
        <Path d="M44 52 Q49 56 54 52" />
        <Path d="M66 52 Q71 56 76 52" />
      </G>
    );
  }
  const dx = mood === 'thinking' ? 2 : 0;
  const dy = mood === 'thinking' ? -2 : 0;
  return (
    <G>
      <Circle cx={49 + dx} cy={52 + dy} r={4.2} fill={INK} />
      <Circle cx={71 + dx} cy={52 + dy} r={4.2} fill={INK} />
      <Circle cx={50.4 + dx} cy={50.6 + dy} r={1.3} fill="#FFFFFF" />
      <Circle cx={72.4 + dx} cy={50.6 + dy} r={1.3} fill="#FFFFFF" />
      {mood === 'worried' ? (
        <G stroke={INK} strokeWidth={2.4} strokeLinecap="round">
          <Path d="M43 44 L53 41" />
          <Path d="M77 44 L67 41" />
        </G>
      ) : null}
    </G>
  );
}

function Mouth({ mood }: { mood: BuddyMood }) {
  switch (mood) {
    case 'happy':
    case 'cheer':
      return <Path d="M51 61 Q60 72 69 61 Z" fill={INK} />;
    case 'worried':
      return <Path d="M53 67 Q60 61 67 67" stroke={INK} strokeWidth={2.8} strokeLinecap="round" fill="none" />;
    case 'sleepy':
      return <Ellipse cx={60} cy={64} rx={2.6} ry={3} fill={INK} />;
    case 'thinking':
      return <Path d="M55 65 L65 63" stroke={INK} strokeWidth={2.8} strokeLinecap="round" />;
    default:
      return <Path d="M53 62 Q60 68 67 62" stroke={INK} strokeWidth={2.8} strokeLinecap="round" fill="none" />;
  }
}

/** The character alone. `size` is the width in points. `onDark`: drawn on the green hero surfaces. */
export function Buddy({
  mood = 'calm',
  size = 64,
  still,
  onDark,
  hop = 0,
}: {
  mood?: BuddyMood;
  size?: number;
  still?: boolean;
  onDark?: boolean;
  /** Changes when the user taps it: a happy little jump. */
  hop?: number;
}) {
  const theme = useTheme();
  const reduce = useReduceMotion();
  // Cream trunk on dark surfaces, warm brown on light ones so it stays visible.
  const TRUNK = onDark || theme.dark ? '#E8E1CC' : '#A88F5E';
  const [bob] = useState(() => new Animated.Value(0));
  const [jump] = useState(() => new Animated.Value(0));
  const [blink, setBlink] = useState(false);
  const animate = !still && !reduce;

  useEffect(() => {
    if (!hop || reduce) return;
    jump.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(jump, { toValue: 1, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: useNative }),
      Animated.spring(jump, { toValue: 0, friction: 4, tension: 120, useNativeDriver: useNative }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [hop, reduce, jump]);

  useEffect(() => {
    if (!animate) return;
    // A few bobs when it appears or changes mood, then it rests (saves battery, less distracting).
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: mood === 'cheer' ? 520 : 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
        Animated.timing(bob, { toValue: 0, duration: mood === 'cheer' ? 520 : 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
      ]),
      { iterations: mood === 'cheer' ? 4 : 3 },
    );
    loop.start();
    return () => loop.stop();
  }, [animate, bob, mood]);

  useEffect(() => {
    if (!animate || mood === 'sleepy' || mood === 'happy' || mood === 'cheer') return;
    let open: ReturnType<typeof setTimeout>;
    const tick = setInterval(() => {
      setBlink(true);
      open = setTimeout(() => setBlink(false), 150);
    }, 3800);
    return () => {
      clearInterval(tick);
      clearTimeout(open);
    };
  }, [animate, mood]);

  const lift = mood === 'cheer' ? 5 : 2.5;
  const leaf = CANOPY[mood];
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        transformOrigin: 'bottom',
        transform: [
          { translateY: Animated.add(bob.interpolate({ inputRange: [0, 1], outputRange: [0, -lift] }), jump.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.22] })) },
          // Squashes a little as it takes off and lands.
          { scaleY: jump.interpolate({ inputRange: [-0.3, 0, 0.3, 1], outputRange: [0.9, 1, 1.05, 1], extrapolate: 'clamp' }) },
          { scaleX: jump.interpolate({ inputRange: [-0.3, 0, 0.3, 1], outputRange: [1.08, 1, 0.97, 1], extrapolate: 'clamp' }) },
        ],
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Ellipse cx={60} cy={112} rx={24} ry={4} fill="#000" opacity={0.12} />
        {/* trunk, arms and roots */}
        <G stroke={TRUNK} strokeLinecap="round" fill="none">
          <Path d="M60 110 C58 98 58 90 60 76" strokeWidth={8} />
          {mood === 'cheer' ? (
            <>
              <Path d="M58 92 C49 86 44 78 42 68" strokeWidth={4.5} />
              <Path d="M62 92 C71 86 76 78 78 68" strokeWidth={4.5} />
            </>
          ) : (
            <>
              <Path d="M58 94 C50 93 44 90 40 85" strokeWidth={4.5} />
              <Path d="M62 94 C70 93 76 90 80 85" strokeWidth={4.5} />
            </>
          )}
          <Path d="M46 110 Q60 106 74 110" strokeWidth={3} />
        </G>
        {/* leafy head */}
        <G fill={leaf}>
          <Circle cx={60} cy={54} r={29} />
          <Circle cx={38} cy={60} r={15} />
          <Circle cx={82} cy={60} r={15} />
          <Circle cx={45} cy={34} r={15} />
          <Circle cx={75} cy={34} r={15} />
        </G>
        {/* sprout on top */}
        <Path d="M60 22 C60 16 60 12 60 8" stroke={palette.leaf} strokeWidth={3} strokeLinecap="round" />
        <Ellipse cx={53} cy={10} rx={7} ry={4} fill={palette.leaf} rotation={-25} origin="53, 10" />
        <Ellipse cx={67} cy={9} rx={7} ry={4} fill="#2E9A68" rotation={25} origin="67, 9" />
        {/* cheeks and face */}
        <Circle cx={40} cy={62} r={5} fill="#F29E6B" opacity={0.5} />
        <Circle cx={80} cy={62} r={5} fill="#F29E6B" opacity={0.5} />
        <Eyes mood={mood} blink={blink} />
        <Mouth mood={mood} />
        {mood === 'sleepy' ? (
          <Path d="M92 18 h9 l-9 9 h9 M104 6 h6 l-6 6 h6" stroke={palette.leaf} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ) : null}
        {mood === 'cheer' ? (
          <G fill={palette.gold}>
            <Path d="M16 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" />
            <Path d="M104 40 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" />
          </G>
        ) : null}
        {mood === 'thinking' ? (
          <G fill={palette.leaf}>
            <Circle cx={96} cy={30} r={3} />
            <Circle cx={104} cy={20} r={4.5} />
          </G>
        ) : null}
      </Svg>
    </Animated.View>
  );
}

/** The companion with a speech bubble. Fades in again whenever the message changes. */
export function BuddySays({
  mood,
  children,
  action,
  size = 60,
  style,
  onPress,
  hop,
}: {
  mood: BuddyMood;
  children: ReactNode;
  action?: ReactNode;
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Makes the companion tappable (it jumps; the screen decides what it says). */
  onPress?: () => void;
  hop?: number;
}) {
  const theme = useTheme();
  const [enter] = useState(() => new Animated.Value(0));
  const key = typeof children === 'string' ? children : mood;
  useEffect(() => {
    enter.setValue(0);
    Animated.spring(enter, { toValue: 1, friction: 7, tension: 60, useNativeDriver: useNative }).start();
  }, [enter, key]);
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }, style]}>
      {onPress ? (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onPress();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="แตะน้องกล้าเพื่อฟังเคล็ดลับ"
        >
          <Buddy mood={mood} size={size} hop={hop} />
        </Pressable>
      ) : (
        <Buddy mood={mood} size={size} />
      )}
      <Animated.View
        accessibilityLiveRegion="polite"
        style={{
          flex: 1,
          marginBottom: size * 0.28,
          opacity: enter,
          transform: [
            { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        }}
      >
        <View
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.line,
            borderWidth: 1,
            borderRadius: radius.lg,
            borderBottomLeftRadius: 6,
            paddingHorizontal: space.md,
            paddingVertical: space.sm + 2,
            gap: space.sm,
          }}
        >
          {typeof children === 'string' ? <T v="small" color={theme.ink}>{children}</T> : children}
          {action}
        </View>
      </Animated.View>
    </View>
  );
}
