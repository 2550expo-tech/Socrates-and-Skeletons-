/**
 * "น้องกล้า": a money-tree sapling with a face, the MindPay mascot. It changes
 * mood with the user's money (happy, calm, worried, sleepy, thinking, cheer)
 * and wears the skin the user chose (src/app/skins.tsx). Drawn in code with
 * soft 3D shading: src/ui/kla/art.tsx.
 *
 * This is the small companion. It bobs a few times when it appears and
 * blinks now and then; both are off when the phone's "Reduce motion" is on.
 * The big talking coach is src/ui/kla/KlaStage.tsx.
 */
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { BuddyMood } from '../domain/buddy';
import type { SkinId } from '../domain/skins';
import { useEquippedSkin } from '../services/kla';
import { T } from './components';
import { KlaPicture } from './kla/KlaPicture';
import { useReduceMotion } from './motion';
import { radius, space, useTheme } from './theme';

const useNative = Platform.OS !== 'web';

/**
 * The character alone. `size` is the width (and the height of the square it
 * stands in; hats may rise a little above it). `onDark`: on the dark hero surfaces.
 */
export function Buddy({
  mood = 'calm',
  size = 64,
  still,
  onDark,
  hop = 0,
  skin,
}: {
  mood?: BuddyMood;
  size?: number;
  still?: boolean;
  onDark?: boolean;
  /** Changes when the user taps it: a happy little jump. */
  hop?: number;
  /** Draw this skin instead of the one the user wears (previews). */
  skin?: SkinId;
}) {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const worn = useEquippedSkin();
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
      {/* The 200 × 240 drawing: its lower square fills this box, hats rise above it. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: -size * 0.2 }}>
        <KlaPicture skin={skin ?? worn} mood={mood} width={size} blink={blink} onDark={!!onDark || theme.dark} />
      </View>
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
            borderWidth: StyleSheet.hairlineWidth,
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
