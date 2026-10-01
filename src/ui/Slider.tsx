/**
 * A slider drawn in JS (no native module, so installed apps get it over the
 * air): drag the gold thumb or tap the track; it snaps to `step` and gives a
 * light tick on the phone at each step. Screen readers can adjust it too, and
 * on the web the arrow keys move it.
 */
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { T } from './components';
import { useNative } from './motion';
import { space, useTheme } from './theme';

const THUMB = 30;

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 5,
  label,
  format = (v) => `${v}`,
  ticks,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** What the slider changes, for screen readers. */
  label: string;
  format?: (v: number) => string;
  /** Values labelled under the track. */
  ticks?: number[];
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [pos] = useState(() => new Animated.Value(0));
  const [grab] = useState(() => new Animated.Value(0));
  // Where the track starts on the screen (found when the finger goes down), and the last value sent.
  const originX = useRef(0);
  const sent = useRef(value);
  const travel = Math.max(0, width - THUMB);

  useEffect(() => {
    if (!width) return;
    const x = ((value - min) / (max - min || 1)) * Math.max(0, width - THUMB);
    const anim = Animated.spring(pos, { toValue: x, friction: 9, tension: 120, useNativeDriver: useNative });
    anim.start();
    return () => anim.stop();
  }, [value, width, min, max, pos]);

  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const pick = (pageX: number) => {
    if (!travel) return;
    const v = clamp(min + ((pageX - originX.current - THUMB / 2) / travel) * (max - min));
    if (v !== sent.current) {
      sent.current = v;
      Haptics.selectionAsync().catch(() => {});
      onChange(v);
    }
  };
  const lift = (to: number) => Animated.spring(grab, { toValue: to, friction: 6, useNativeDriver: useNative }).start();

  return (
    <View style={{ gap: space.xs }}>
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: format(value) }}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(clamp(value + (e.nativeEvent.actionName === 'increment' ? step : -step)))}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e: GestureResponderEvent) => {
          originX.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
          sent.current = value;
          lift(1);
          pick(e.nativeEvent.pageX);
        }}
        onResponderMove={(e: GestureResponderEvent) => pick(e.nativeEvent.pageX)}
        onResponderRelease={() => lift(0)}
        onResponderTerminate={() => lift(0)}
        // Web: arrow keys (and Home/End) move it too, like a built-in slider.
        {...(Platform.OS === 'web'
          ? {
              focusable: true,
              onKeyDown: (e: { key?: string; nativeEvent?: { key?: string }; preventDefault?: () => void }) => {
                const key = e.key ?? e.nativeEvent?.key;
                const next =
                  key === 'ArrowRight' || key === 'ArrowUp'
                    ? value + step
                    : key === 'ArrowLeft' || key === 'ArrowDown'
                      ? value - step
                      : key === 'Home'
                        ? min
                        : key === 'End'
                          ? max
                          : null;
                if (next === null) return;
                e.preventDefault?.();
                const v = clamp(next);
                if (v !== value) onChange(v);
              },
            }
          : {})}
        style={{ height: THUMB + 12, justifyContent: 'center' }}
      >
        {/* track and the filled part up to the thumb */}
        <View pointerEvents="none" style={{ height: 8, borderRadius: 4, backgroundColor: theme.surfaceAlt, marginHorizontal: THUMB / 2 }} />
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: THUMB / 2,
            height: 8,
            width: travel,
            borderRadius: 4,
            backgroundColor: theme.accent,
            transformOrigin: 'left',
            transform: [{ scaleX: travel ? pos.interpolate({ inputRange: [0, travel], outputRange: [0.0001, 1], extrapolate: 'clamp' }) : 0.0001 }],
          }}
        />
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            width: THUMB,
            height: THUMB,
            borderRadius: THUMB / 2,
            backgroundColor: theme.heroAccent,
            borderWidth: 3,
            borderColor: theme.surface,
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
            transform: [{ translateX: pos }, { scale: grab.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
          }}
        />
      </View>
      {ticks ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 }}>
          {ticks.map((t) => (
            <T key={t} v="micro" color={t === value ? theme.ink : theme.inkSoft}>
              {format(t)}
            </T>
          ))}
        </View>
      ) : null}
    </View>
  );
}
