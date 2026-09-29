/**
 * The big น้องกล้า that talks (the coach) and poses (the skin collection).
 *
 * Each part of the drawing (body, arms, head, eyes, mouth) is its own layer,
 * turned around its own joint by the native animation driver, so the motion
 * stays smooth without redrawing the picture: it breathes and sways, blinks,
 * tilts its head, and while it talks the mouth opens and closes and the arms
 * and head make small gestures. Tapping makes it hop.
 *
 * Idle motion only runs while `active` (the screen is showing), and all of it
 * except the talking mouth is off when the phone's "Reduce motion" is on.
 */
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import Svg from 'react-native-svg';
import type { BuddyMood } from '../../domain/buddy';
import type { SkinId } from '../../domain/skins';
import { useReduceMotion } from '../motion';
import { KlaArm, KlaBack, KlaDefs, KlaExtras, KlaEyes, KlaGlasses, KlaGround, KlaHead, KlaMouth, KlaMouthOpen, KLA_H, KLA_W, PIVOT } from './art';

const useNative = Platform.OS !== 'web';
const ease = Easing.inOut(Easing.sin);

/** Mouth shapes while talking: [how open 0..1, milliseconds]. Uneven on purpose, like real syllables. */
const SYLLABLES: [number, number][] = [
  [0.85, 110], [0.25, 90], [0.7, 120], [0.1, 80], [1, 130], [0.35, 100], [0.8, 110], [0.2, 90],
  [0.6, 100], [0.05, 120], [0.9, 120], [0.3, 90], [0.75, 110], [0.15, 140],
];

const deg = (v: Animated.AnimatedInterpolation<number> | Animated.AnimatedAddition<number>) =>
  v.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });

export function KlaStage({
  skin,
  mood = 'happy',
  width,
  talking = false,
  active = true,
  hop = 0,
  onDark = false,
}: {
  skin: SkinId;
  mood?: BuddyMood;
  /** Width in points; the height is 1.2 × width. */
  width: number;
  talking?: boolean;
  active?: boolean;
  /** Changes when the user taps it: a hop. */
  hop?: number;
  onDark?: boolean;
}) {
  const reduce = useReduceMotion();
  const id = `s${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const k = width / KLA_W;
  const height = KLA_H * k;
  const [v] = useState(() => ({
    breathe: new Animated.Value(0),
    sway: new Animated.Value(0),
    tilt: new Animated.Value(0),
    arms: new Animated.Value(0),
    blink: new Animated.Value(1),
    mouth: new Animated.Value(0),
    gesture: new Animated.Value(0),
    jump: new Animated.Value(0),
  }));
  const idle = active && !reduce;

  // Breathing, a slow sway, the head tilting and the arms resting, each on its own rhythm.
  useEffect(() => {
    if (!idle) return;
    const wave = (value: Animated.Value, ms: number, from = -1, to = 1) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, { toValue: to, duration: ms, easing: ease, useNativeDriver: useNative }),
          Animated.timing(value, { toValue: from, duration: ms, easing: ease, useNativeDriver: useNative }),
        ]),
      );
    const loops = [wave(v.breathe, 1900, 0, 1), wave(v.sway, 3100), wave(v.tilt, 2600), wave(v.arms, 2300)];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [idle, v]);

  // Blinks: every few seconds, now and then twice.
  useEffect(() => {
    if (!idle || mood === 'happy' || mood === 'cheer' || mood === 'sleepy') {
      v.blink.setValue(1);
      return;
    }
    const shut = (ms = 70) => Animated.timing(v.blink, { toValue: 0.08, duration: ms, easing: Easing.in(Easing.quad), useNativeDriver: useNative });
    const open = (ms = 110) => Animated.timing(v.blink, { toValue: 1, duration: ms, easing: Easing.out(Easing.quad), useNativeDriver: useNative });
    const loop = Animated.loop(
      Animated.sequence([Animated.delay(2600), shut(), open(), Animated.delay(3400), shut(), open(90), Animated.delay(140), shut(60), open()]),
    );
    loop.start();
    return () => loop.stop();
  }, [idle, mood, v]);

  // Talking: the mouth follows syllables, the head nods and a hand explains.
  useEffect(() => {
    if (!talking) {
      Animated.parallel([
        Animated.timing(v.mouth, { toValue: 0, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: useNative }),
        Animated.spring(v.gesture, { toValue: 0, friction: 6, tension: 60, useNativeDriver: useNative }),
      ]).start();
      return;
    }
    const mouth = Animated.loop(
      Animated.sequence(SYLLABLES.map(([to, ms]) => Animated.timing(v.mouth, { toValue: to, duration: ms, easing: Easing.inOut(Easing.quad), useNativeDriver: useNative }))),
    );
    mouth.start();
    if (reduce) return () => mouth.stop();
    const gesture = Animated.loop(
      Animated.sequence([
        Animated.timing(v.gesture, { toValue: 1, duration: 520, easing: ease, useNativeDriver: useNative }),
        Animated.timing(v.gesture, { toValue: 0.35, duration: 480, easing: ease, useNativeDriver: useNative }),
        Animated.timing(v.gesture, { toValue: 0.9, duration: 560, easing: ease, useNativeDriver: useNative }),
        Animated.timing(v.gesture, { toValue: 0, duration: 620, easing: ease, useNativeDriver: useNative }),
        Animated.delay(260),
      ]),
    );
    gesture.start();
    return () => {
      mouth.stop();
      gesture.stop();
    };
  }, [talking, reduce, v]);

  // A hop when tapped: up, then a springy landing.
  useEffect(() => {
    if (!hop || reduce) return;
    v.jump.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(v.jump, { toValue: 1, duration: 190, easing: Easing.out(Easing.quad), useNativeDriver: useNative }),
      Animated.spring(v.jump, { toValue: 0, friction: 4, tension: 110, useNativeDriver: useNative }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [hop, reduce, v]);

  const t = useMemo(() => {
    // Joints in points, as [x, y, z]: phones read a "12.5px" string wrongly (whole numbers only), numbers work everywhere.
    const at = (x: number, y: number): [number, number, number] => [x * k, y * k, 0];
    const cheer = mood === 'cheer';
    return {
      groundOrigin: at(100, 231),
      bodyOrigin: at(100, 228),
      neck: at(PIVOT.neck.x, PIVOT.neck.y),
      shoulderL: at(PIVOT.shoulderL.x, PIVOT.shoulderL.y),
      shoulderR: at(PIVOT.shoulderR.x, PIVOT.shoulderR.y),
      eyesAt: at(PIVOT.eyes.x, PIVOT.eyes.y),
      mouthAt: at(100, 141),
      body: [
        { translateY: Animated.add(v.breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -1.2 * k] }), v.jump.interpolate({ inputRange: [0, 1], outputRange: [0, -26 * k] })) },
        { rotate: deg(v.sway.interpolate({ inputRange: [-1, 1], outputRange: [-1.1, 1.1] })) },
        { scaleY: Animated.add(v.breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] }), v.jump.interpolate({ inputRange: [-0.3, 0, 0.4, 1], outputRange: [-0.1, 0, 0.05, 0], extrapolate: 'clamp' })) },
        { scaleX: Animated.add(v.breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 0.993] }), v.jump.interpolate({ inputRange: [-0.3, 0, 0.4, 1], outputRange: [0.08, 0, -0.03, 0], extrapolate: 'clamp' })) },
      ],
      ground: [{ scale: v.jump.interpolate({ inputRange: [-0.3, 0, 1], outputRange: [1.06, 1, 0.72], extrapolate: 'clamp' }) }],
      groundOpacity: v.jump.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55], extrapolate: 'clamp' }),
      head: [
        { translateY: v.gesture.interpolate({ inputRange: [0, 1], outputRange: [0, 1.6 * k] }) },
        { rotate: deg(Animated.add(v.tilt.interpolate({ inputRange: [-1, 1], outputRange: [-2.2, 2.2] }), v.gesture.interpolate({ inputRange: [0, 1], outputRange: [0, 2.6] }))) },
      ],
      // Left hand rises with a clockwise turn, the right with an anticlockwise one.
      // Raised arms (cheer) wave outwards, away from the leaves, so the hands stay in sight.
      armL: [{ rotate: deg(Animated.add(v.arms.interpolate({ inputRange: [-1, 1], outputRange: [-3, 3] }), v.gesture.interpolate({ inputRange: [0, 1], outputRange: [0, cheer ? -9 : 7] }))) }],
      armR: [{ rotate: deg(Animated.add(v.arms.interpolate({ inputRange: [-1, 1], outputRange: [3, -3] }), v.gesture.interpolate({ inputRange: [0, 1], outputRange: [0, cheer ? 9 : -26] }))) }],
      blink: [{ scaleY: v.blink }],
      closed: v.mouth.interpolate({ inputRange: [0, 0.18], outputRange: [1, 0], extrapolate: 'clamp' }),
      open: v.mouth.interpolate({ inputRange: [0, 0.18], outputRange: [0, 1], extrapolate: 'clamp' }),
      openShape: [{ scaleY: v.mouth.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }, { scaleX: v.mouth.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
    };
  }, [k, mood, v]);

  const layer = (children: ReactNode, defs = true) => (
    <Svg width={width} height={height} viewBox={`0 0 ${KLA_W} ${KLA_H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      {defs ? <KlaDefs id={id} skin={skin} onDark={onDark} /> : null}
      {children}
    </Svg>
  );
  const fill = { position: 'absolute' as const, left: 0, top: 0, width, height };

  return (
    <View style={{ width, height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Animated.View style={[fill, { transformOrigin: t.groundOrigin, transform: t.ground, opacity: t.groundOpacity }]}>{layer(<KlaGround id={id} />)}</Animated.View>
      <Animated.View style={[fill, { transformOrigin: t.bodyOrigin, transform: t.body }]}>
        {layer(<KlaBack id={id} skin={skin} />)}
        <Animated.View style={[fill, { transformOrigin: t.shoulderL, transform: t.armL }]}>{layer(<KlaArm id={id} skin={skin} side="L" mood={mood} />)}</Animated.View>
        <Animated.View style={[fill, { transformOrigin: t.shoulderR, transform: t.armR }]}>{layer(<KlaArm id={id} skin={skin} side="R" mood={mood} />)}</Animated.View>
        <Animated.View style={[fill, { transformOrigin: t.neck, transform: t.head }]}>
          {layer(<KlaHead id={id} skin={skin} mood={mood} />)}
          <Animated.View style={[fill, { transformOrigin: t.eyesAt, transform: t.blink }]}>{layer(<KlaEyes id={id} mood={mood} />)}</Animated.View>
          {layer(<KlaGlasses skin={skin} />, false)}
          <Animated.View style={[fill, { opacity: t.closed }]}>{layer(<KlaMouth mood={mood} skin={skin} />, false)}</Animated.View>
          <Animated.View style={[fill, { opacity: t.open, transformOrigin: t.mouthAt, transform: t.openShape }]}>{layer(<KlaMouthOpen skin={skin} />, false)}</Animated.View>
          {layer(<KlaExtras mood={mood} />, false)}
        </Animated.View>
      </Animated.View>
    </View>
  );
}
