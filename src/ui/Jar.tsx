/**
 * A glass savings jar that fills with gold as a goal grows. When money goes
 * in (`drop` changes) a coin falls through the lid and the gold rises. Built
 * from Views so the motion runs on the native driver; everything stops by
 * itself and "Reduce motion" shows the level at once.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { T } from './components';
import { useNative, useReduceMotion } from './motion';
import { fonts, palette, useTheme } from './theme';

/** Coins drawn inside the gold, as fractions of the body (x, y from the bottom, size). */
const COINS = [
  [0.18, 0.08, 0.2], [0.44, 0.05, 0.22], [0.7, 0.09, 0.2],
  [0.3, 0.22, 0.2], [0.58, 0.24, 0.21], [0.12, 0.36, 0.18],
  [0.42, 0.4, 0.2], [0.72, 0.38, 0.19], [0.25, 0.55, 0.2],
  [0.55, 0.58, 0.21], [0.78, 0.6, 0.18], [0.38, 0.74, 0.2],
  [0.64, 0.8, 0.19], [0.16, 0.78, 0.18],
] as const;

export function Jar({ progress, size = 96, drop = 0, label }: { progress: number; size?: number; drop?: number; label?: string }) {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const level = Math.max(0, Math.min(1, progress));
  const w = size;
  const bodyH = size * 1.08;
  const lidH = size * 0.13;
  const [fill] = useState(() => new Animated.Value(0));
  const [coin] = useState(() => new Animated.Value(0));
  const [wobble] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduce) {
      fill.setValue(level);
      return;
    }
    const anim = Animated.spring(fill, { toValue: level, friction: 7, tension: 40, useNativeDriver: useNative });
    anim.start();
    return () => anim.stop();
  }, [level, reduce, fill]);

  useEffect(() => {
    if (!drop || reduce) return;
    coin.setValue(0);
    wobble.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(coin, { toValue: 1, duration: 520, easing: Easing.in(Easing.quad), useNativeDriver: useNative }),
      Animated.sequence([
        Animated.timing(wobble, { toValue: 1, duration: 90, useNativeDriver: useNative }),
        Animated.timing(wobble, { toValue: -0.7, duration: 120, useNativeDriver: useNative }),
        Animated.timing(wobble, { toValue: 0.4, duration: 110, useNativeDriver: useNative }),
        Animated.timing(wobble, { toValue: 0, duration: 100, useNativeDriver: useNative }),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [drop, reduce, coin, wobble]);

  const glass = theme.dark ? 'rgba(231,239,233,0.45)' : 'rgba(17,35,27,0.28)';
  const coinSize = w * 0.26;
  return (
    <View style={{ width: w, height: lidH + bodyH + 4, alignItems: 'center' }} accessible accessibilityLabel={label ?? `กระปุก ${Math.round(level * 100)}%`}>
      {/* the coin that drops in */}
      {drop && !reduce ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -coinSize,
            zIndex: 3,
            width: coinSize,
            height: coinSize,
            borderRadius: coinSize / 2,
            backgroundColor: palette.goldBright,
            borderWidth: 2,
            borderColor: '#A87A1E',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: coin.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
            transform: [{ translateY: coin.interpolate({ inputRange: [0, 1], outputRange: [0, lidH + bodyH * (1 - level * 0.9) - coinSize * 0.2] }) }],
          }}
        >
          <T v="micro" color="#5A3E08" style={{ fontFamily: fonts.sansBold }}>
            ฿
          </T>
        </Animated.View>
      ) : null}
      <Animated.View
        style={{
          alignItems: 'center',
          transformOrigin: 'bottom',
          transform: [{ rotate: wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-4deg', '4deg'] }) }],
        }}
      >
        {/* lid */}
        <View style={{ width: w * 0.56, height: lidH, borderRadius: 5, backgroundColor: palette.gold, borderWidth: 1.5, borderColor: '#A87A1E', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: w * 0.2, height: 3, borderRadius: 2, backgroundColor: '#6E4E0E' }} />
        </View>
        {/* glass body */}
        <View
          style={{
            width: w,
            height: bodyH,
            marginTop: 2,
            borderRadius: w * 0.24,
            borderWidth: 2.5,
            borderColor: glass,
            backgroundColor: theme.dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.55)',
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: bodyH,
              transform: [{ translateY: fill.interpolate({ inputRange: [0, 1], outputRange: [bodyH, 0] }) }],
            }}
          >
            <LinearGradient colors={['#F7DC86', palette.goldBright, palette.gold]} style={{ flex: 1 }}>
              {COINS.map(([x, y, s], i) => (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: x * w - (s * w) / 2,
                    bottom: y * bodyH,
                    width: s * w,
                    height: s * w * 0.62,
                    borderRadius: (s * w) / 2,
                    backgroundColor: i % 2 ? 'rgba(168,122,30,0.35)' : 'rgba(255,244,210,0.45)',
                  }}
                />
              ))}
            </LinearGradient>
            {/* the gold's top edge */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,248,220,0.9)' }} />
          </Animated.View>
          {/* glass shine */}
          <View pointerEvents="none" style={{ position: 'absolute', left: w * 0.12, top: bodyH * 0.12, width: w * 0.08, height: bodyH * 0.55, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.45)' }} />
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <T v="h3" color={level > 0.55 ? '#3B2A0B' : theme.ink} style={{ fontFamily: fonts.sansBold }}>
              {Math.round(level * 100)}%
            </T>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
