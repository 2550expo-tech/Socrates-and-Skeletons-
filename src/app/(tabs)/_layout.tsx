/**
 * Bottom navigation: four places plus a raised gold button in the middle for
 * the most frequent action, scanning slips (FR-4).
 */
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, type IconName } from '../../ui/components';
import { fonts, palette, useTheme } from '../../ui/theme';

const TABS: Record<string, { label: string; icon: IconName; iconActive: IconName }> = {
  index: { label: 'หน้าหลัก', icon: 'home-outline', iconActive: 'home' },
  transactions: { label: 'รายการ', icon: 'list-outline', iconActive: 'list' },
  runway: { label: 'เงินพอถึง', icon: 'leaf-outline', iconActive: 'leaf' },
  coach: { label: 'โค้ช', icon: 'chatbubble-ellipses-outline', iconActive: 'chatbubble-ellipses' },
};

function TabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const routes = state.routes;
  const half = Math.ceil(routes.length / 2);

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
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
        }}
        style={{ flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 }}
      >
        <Ionicons name={focused ? meta.iconActive : meta.icon} size={22} color={focused ? theme.primary : theme.inkFaint} />
        <Text style={{ fontFamily: focused ? fonts.sansSemi : fonts.sans, fontSize: 11, color: focused ? theme.ink : theme.inkFaint }}>
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
      {routes.slice(0, half).map((r, i) => tab(r, i))}
      <View style={{ width: 76, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="สแกนสลิป"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push('/scan');
          }}
          style={({ pressed }) => ({
            width: 60,
            height: 60,
            borderRadius: 30,
            marginTop: -26,
            backgroundColor: palette.forest,
            borderWidth: 3,
            borderColor: theme.accent,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.94 : 1 }],
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          })}
        >
          <Ionicons name="scan" size={26} color={palette.goldBright} />
        </Pressable>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 11, color: theme.ink, marginTop: 4 }}>สแกนสลิป</Text>
      </View>
      {routes.slice(half).map((r, i) => tab(r, i + half))}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="runway" />
      <Tabs.Screen name="coach" />
    </Tabs>
  );
}
