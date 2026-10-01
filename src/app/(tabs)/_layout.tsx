/**
 * Bottom navigation: four places plus a raised gold button in the middle for
 * the most frequent action, scanning slips (FR-4).
 *
 * Motion: a soft pill slides to the chosen tab and its icon pops; the scan
 * button sends out gold ripples a few times when the app opens, and keeps
 * rippling while the automatic scan is reading new slips.
 */
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAutoScan } from '../../services/AutoScanProvider';
import { useKlaSync } from '../../services/kla';
import { Ionicons, type IconName } from '../../ui/components';
import { PulseRing, usePressSpring } from '../../ui/effects';
import { useNative, useReduceMotion } from '../../ui/motion';
import { alpha, fonts, type, useTheme } from '../../ui/theme';

const TABS: Record<string, { label: string; icon: IconName; iconActive: IconName }> = {
  index: { label: 'หน้าหลัก', icon: 'home-outline', iconActive: 'home' },
  transactions: { label: 'รายการ', icon: 'list-outline', iconActive: 'list' },
  runway: { label: 'เงินพอถึง', icon: 'leaf-outline', iconActive: 'leaf' },
  coach: { label: 'โค้ช', icon: 'chatbubble-ellipses-outline', iconActive: 'chatbubble-ellipses' },
};

const PILL_W = 56;

/** The tab icon pops when its tab becomes the chosen one. */
function TabIcon({ name, focused, color }: { name: IconName; focused: boolean; color: string }) {
  const reduce = useReduceMotion();
  const [pop] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!focused || reduce) return;
    pop.setValue(0.6);
    Animated.spring(pop, { toValue: 1, speed: 14, bounciness: 16, useNativeDriver: useNative }).start();
  }, [focused, reduce, pop]);
  return (
    <Animated.View style={{ transform: [{ scale: pop }, { translateY: pop.interpolate({ inputRange: [0.6, 1], outputRange: [3, 0] }) }] }}>
      <Ionicons name={name} size={22} color={color} />
    </Animated.View>
  );
}

function TabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const auto = useAutoScan();
  const press = usePressSpring(0.9);
  const routes = state.routes;
  const half = Math.ceil(routes.length / 2);
  // Centre of each tab, measured after layout, so the pill can slide there.
  const [centers, setCenters] = useState<Record<number, number>>({});
  const [slide] = useState(() => new Animated.Value(0));
  const [shown] = useState(() => new Animated.Value(0));
  const first = useRef(true);
  const target = centers[state.index];
  const measured = target !== undefined;
  useEffect(() => {
    if (target === undefined) return;
    if (reduce || first.current) {
      // The first time, appear on the chosen tab instead of sliding in from the edge.
      first.current = false;
      slide.setValue(target);
      shown.setValue(1);
      return;
    }
    Animated.spring(slide, { toValue: target, speed: 14, bounciness: 9, useNativeDriver: useNative }).start();
  }, [target, reduce, slide, shown]);

  const tab = (route: (typeof routes)[number], index: number) => {
    const meta = TABS[route.name];
    if (!meta) return null;
    const focused = state.index === index;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        aria-selected={focused}
        accessibilityLabel={meta.label}
        onLayout={(e: LayoutChangeEvent) => {
          const { x, width } = e.nativeEvent.layout;
          const c = x + width / 2;
          setCenters((prev) => (prev[index] === c ? prev : { ...prev, [index]: c }));
        }}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
        }}
        style={{ flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 }}
      >
        <TabIcon name={focused ? meta.iconActive : meta.icon} focused={focused} color={focused ? theme.primary : theme.inkSoft} />
        <Text style={[type.micro, { fontFamily: focused ? fonts.sansSemi : fonts.sans, color: focused ? theme.ink : theme.inkSoft }]}>
          {meta.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.surface,
        borderTopWidth: 1,
        borderTopColor: theme.line,
        paddingBottom: insets.bottom,
        paddingHorizontal: 6,
      }}
    >
      {measured ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 5,
            left: 0,
            width: PILL_W,
            height: 30,
            borderRadius: 15,
            // A soft pill in the colour theme's main colour.
            backgroundColor: alpha(theme.primary, theme.dark ? 0.22 : 0.12),
            opacity: shown,
            transform: [{ translateX: Animated.subtract(slide, PILL_W / 2) }],
          }}
        />
      ) : null}
      {routes.slice(0, half).map((r, i) => tab(r, i))}
      <View style={{ width: 76, alignItems: 'center' }}>
        <View style={{ width: 60, height: 60, marginTop: -26, alignItems: 'center', justifyContent: 'center' }}>
          <PulseRing size={60} active times={auto.state.phase === 'scanning' ? 'always' : 3} color={theme.accent} />
          <Animated.View style={{ transform: [{ scale: press.scale }] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="สแกนสลิป"
              onPressIn={press.onPressIn}
              onPressOut={press.onPressOut}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                router.push('/scan');
              }}
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: theme.hero,
                borderWidth: 3,
                borderColor: theme.accent,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: theme.accent,
                shadowOpacity: 0.35,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 8,
              }}
            >
              <Ionicons name="scan" size={26} color={theme.heroAccent} />
            </Pressable>
          </Animated.View>
        </View>
        <Text style={[type.micro, { fontFamily: fonts.sansSemi, color: theme.ink, marginTop: 4 }]}>สแกนสลิป</Text>
      </View>
      {routes.slice(half).map((r, i) => tab(r, i + half))}
    </View>
  );
}

export default function TabsLayout() {
  // Records today's visit and hands out น้องกล้า's skins for finished missions and events.
  useKlaSync();
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="runway" />
      <Tabs.Screen name="coach" />
    </Tabs>
  );
}
