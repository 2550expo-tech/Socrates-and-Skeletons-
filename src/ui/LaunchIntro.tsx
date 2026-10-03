/**
 * Opening animation. When the app icon is tapped, the phone first shows the
 * native splash (forest green + น้องกล้า, from app.json). This view is drawn
 * the same way, takes over on its first frame, and then:
 *   1. น้องกล้า bounces (with a light tap on the phone),
 *   2. gold rings ripple out and leaves sparkle,
 *   3. the MindPay name and tagline rise in,
 *   4. once the app is ready it lifts away and reveals the first screen.
 * It keeps rippling if loading takes longer, and is reduced to a short fade
 * when the phone's "Reduce motion" setting is on.
 */
import * as Haptics from 'expo-haptics';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import { Shine } from './effects';
import { fonts, palette, useTheme } from './theme';

const useNative = Platform.OS !== 'web';
/** Same size as "imageWidth" of expo-splash-screen in app.json, so the hand-over is seamless. */
const TREE = 160;
/** The intro is short: long enough to be seen, short enough not to be in the way. */
const MIN_SHOW_MS = Platform.OS === 'web' ? 900 : 1300;

const LEAVES = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(a) * 96, y: Math.sin(a) * 96 - 10, delay: (i % 4) * 0.08 };
});

export function LaunchIntro({ ready, fontsReady, onDone }: { ready: boolean; fontsReady: boolean; onDone: () => void }) {
  const theme = useTheme();
  const [v] = useState(() => ({
    tree: new Animated.Value(0),
    ripple: new Animated.Value(0),
    leaves: new Animated.Value(0),
    word: new Animated.Value(0),
    exit: new Animated.Value(0),
  }));
  const [laidOut, setLaidOut] = useState(false);
  const [reduce, setReduce] = useState<boolean | null>(null);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [done, setDone] = useState(false);
  const leaving = useRef(false);
  const rippleLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => setReduce(r))
      .catch(() => setReduce(false));
  }, []);

  // 1-3: start once the first frame is on screen and we know the motion setting.
  useEffect(() => {
    if (!laidOut || reduce === null) return;
    const timer = setTimeout(() => setMinTimePassed(true), reduce ? 300 : MIN_SHOW_MS);
    if (reduce) {
      v.tree.setValue(1);
      v.leaves.setValue(1);
      return () => clearTimeout(timer);
    }
    const tap = setTimeout(() => {
      if (useNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, 260);
    Animated.parallel([
      Animated.timing(v.tree, { toValue: 1, duration: 720, easing: Easing.out(Easing.cubic), useNativeDriver: useNative }),
      Animated.timing(v.leaves, { toValue: 1, duration: 1100, delay: 180, easing: Easing.out(Easing.quad), useNativeDriver: useNative }),
    ]).start();
    rippleLoop.current = Animated.loop(
      Animated.timing(v.ripple, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: useNative }),
    );
    rippleLoop.current.start();
    return () => {
      clearTimeout(timer);
      clearTimeout(tap);
      rippleLoop.current?.stop();
    };
  }, [laidOut, reduce, v]);

  // The name waits for the brand font so it does not jump from one font to another.
  useEffect(() => {
    if (!laidOut || !fontsReady || reduce === null) return;
    if (reduce) {
      v.word.setValue(1);
      return;
    }
    Animated.timing(v.word, { toValue: 1, duration: 560, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: useNative }).start();
  }, [laidOut, fontsReady, reduce, v]);

  // 4: lift away when the app is ready and the intro has been seen.
  useEffect(() => {
    if (!ready || !minTimePassed || leaving.current) return;
    leaving.current = true;
    Animated.timing(v.exit, {
      toValue: 1,
      duration: reduce ? 200 : 440,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: useNative,
    }).start(() => {
      rippleLoop.current?.stop();
      setDone(true);
      onDone();
    });
  }, [ready, minTimePassed, reduce, v, onDone]);

  if (done) return null;

  const treeScale = Animated.multiply(
    v.tree.interpolate({ inputRange: [0, 0.35, 0.7, 1], outputRange: [1, 1.12, 0.97, 1] }),
    v.exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }),
  );

  return (
    <Animated.View
      pointerEvents={ready && minTimePassed ? 'none' : 'auto'}
      accessibilityLabel="กำลังเปิด MindPay"
      onLayout={() => {
        if (laidOut) return;
        setLaidOut(true);
        // Hand over from the native splash: this view already looks the same.
        SplashScreen.hideAsync().catch(() => {});
      }}
      style={[
        StyleSheet.absoluteFill,
        {
          zIndex: 2000,
          // Phones hand over from the native splash (forest green); the web has none, so it follows the colour theme.
          backgroundColor: Platform.OS === 'web' ? theme.hero : palette.forest,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: v.exit.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.6, 0] }),
        },
      ]}
    >
      {[0, 0.5].map((offset) => {
        const p = Animated.modulo(Animated.add(v.ripple, offset), 1);
        return (
          <Animated.View
            key={offset}
            style={{
              position: 'absolute',
              width: TREE,
              height: TREE,
              borderRadius: TREE / 2,
              borderWidth: 1.5,
              borderColor: palette.goldBright,
              opacity: p.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.35, 0] }),
              transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2.3] }) }],
            }}
          />
        );
      })}

      {LEAVES.map((leaf, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: 10,
            height: 6,
            borderRadius: 5,
            backgroundColor: i % 3 === 0 ? '#F4F1E6' : palette.goldBright,
            opacity: v.leaves.interpolate({
              inputRange: [0, 0.2 + leaf.delay, 0.75, 1],
              outputRange: [0, 0.9, 0.6, 0],
            }),
            transform: [
              { translateX: v.leaves.interpolate({ inputRange: [0, 1], outputRange: [0, leaf.x] }) },
              { translateY: v.leaves.interpolate({ inputRange: [0, 1], outputRange: [0, leaf.y] }) },
              { rotate: `${(i * 45) % 180}deg` },
            ],
          }}
        />
      ))}

      <Animated.View style={{ transform: [{ scale: treeScale }] }}>
        <Image source={require('../../assets/splash-icon.png')} style={{ width: TREE, height: TREE }} resizeMode="contain" />
      </Animated.View>

      <Animated.View
        style={{
          position: 'absolute',
          top: '50%',
          marginTop: TREE / 2 + 8,
          alignItems: 'center',
          gap: 4,
          opacity: Animated.multiply(v.word, v.exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })),
          transform: [{ translateY: v.word.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        }}
      >
        {fontsReady ? (
          <>
            <View style={{ overflow: 'hidden', paddingHorizontal: 10 }}>
              <Animated.Text style={{ fontFamily: fonts.serifBold, fontSize: 34, lineHeight: 48, color: '#F4F1E6' }}>MindPay</Animated.Text>
              <Shine times={1} delay={620} duration={620} color="rgba(255,226,150,0.6)" />
            </View>
            <Animated.Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 14,
                lineHeight: 22,
                color: Platform.OS === 'web' ? theme.heroInkSoft : '#B9CEC2',
                opacity: v.word.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }),
              }}
            >
              รู้ก่อนจ่าย เห็นว่าเงินจะอยู่ได้อีกกี่วัน
            </Animated.Text>
          </>
        ) : null}
      </Animated.View>
      <View />
    </Animated.View>
  );
}
