/**
 * The (+) in the middle of the tab bar: one place to add money in or out.
 * A sheet rises from the bottom over the screen you were on (it stays visible,
 * dimmed, behind): pull today's slips (Android app), pick a slip from the
 * gallery (FR-4), speak (FR-3), type an expense or add money in (FR-1).
 * Choosing one replaces this sheet, so closing that screen goes straight back.
 * Close it with ✕, a tap on the dimmed area, Esc (web) or the back button.
 */
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../data/AppProvider';
import { useAutoScan } from '../services/AutoScanProvider';
import { Divider, IconButton, Ionicons, T, type IconName } from '../ui/components';
import { useNative, useReduceMotion } from '../ui/motion';
import { goBack } from '../ui/nav';
import { alpha, fonts, radius, space, useTheme } from '../ui/theme';

/** How far below its resting place the sheet starts (and leaves to). */
const DROP = 480;

function Option({ icon, color, title, sub, onPress }: { icon: IconName; color: string; title: string; sub: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: 68,
        paddingVertical: space.sm,
        paddingHorizontal: space.sm,
        marginHorizontal: -space.sm,
        borderRadius: radius.md,
        backgroundColor: pressed ? theme.surfaceAlt : 'transparent',
      })}
    >
      <View style={{ width: 44, height: 44, borderRadius: radius.tile, backgroundColor: alpha(color, theme.dark ? 0.2 : 0.12), alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <T v="body" style={{ fontFamily: fonts.sansSemi }}>
          {title}
        </T>
        <T v="small" numberOfLines={1}>
          {sub}
        </T>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.inkSoft} />
    </Pressable>
  );
}

export default function AddSheet() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const auto = useAutoScan();
  // The demo cannot read slips (it has no account for the AI); say so before the tap, not after.
  const demo = useApp().repo?.mode === 'demo';
  const reduce = useReduceMotion();
  const [rise] = useState(() => new Animated.Value(reduce ? 1 : 0));
  const leaving = useRef(false);
  const sheet = useRef<View>(null);

  useEffect(() => {
    if (reduce) return;
    Animated.timing(rise, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: useNative }).start();
  }, [reduce, rise]);

  /** Slide away, then leave (once, however many times it is asked). */
  const close = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    if (reduce) return goBack();
    Animated.timing(rise, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: useNative }).start(() => goBack());
  }, [reduce, rise]);

  const choose = useCallback((to: Href) => {
    if (leaving.current) return;
    leaving.current = true;
    router.replace(to);
  }, []);

  // Web: Esc closes, and keyboard focus moves into the sheet.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    (sheet.current as unknown as { focus?: () => void } | null)?.focus?.();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  // Android app: read today's slips in the gallery right now (the automatic scan, on demand).
  // Without consent yet, the scan screen asks first (PDPA, domain/consent.ts), right where the user is going.
  const pullToday = useCallback(() => {
    if (auto.consent !== 'granted') return choose('/scan');
    auto.grantAndRun().catch(() => {});
    close();
  }, [auto, close, choose]);

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      {/* The screen underneath, dimmed; a tap here closes the sheet. */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay, opacity: rise }]}>
        <Pressable style={{ flex: 1 }} onPress={close} accessible={false} importantForAccessibility="no" aria-hidden tabIndex={-1} />
      </Animated.View>
      <Animated.View
        ref={sheet}
        role="dialog"
        aria-modal
        aria-label="เพิ่มรายการ"
        accessibilityViewIsModal
        tabIndex={-1}
        style={{
          backgroundColor: theme.surface,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          paddingHorizontal: space.lg,
          paddingBottom: insets.bottom + space.lg,
          outlineWidth: 0,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [DROP, 0] }) }],
        }}
      >
        <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: theme.lineStrong, marginTop: 10 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: space.md, paddingBottom: space.sm }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h3" accessibilityRole="header">
              เพิ่มรายการ
            </T>
            <T v="small">ทุกทางรวมเข้ายอดเงินเดียวกัน</T>
          </View>
          <View style={{ marginRight: -space.sm }}>
            <IconButton icon="close" label="ปิด" color={theme.inkSoft} onPress={close} />
          </View>
        </View>
        {auto.available ? (
          <>
            <Option icon="flash" color={theme.accentInk} title="ดึงสลิปวันนี้" sub="อ่านสลิปของวันนี้ในแกลเลอรีให้ทันที" onPress={pullToday} />
            <Divider style={{ marginLeft: 44 + space.md }} />
          </>
        ) : null}
        <Option icon="images" color={theme.primary} title="เลือกสลิปจากแกลเลอรี" sub={demo ? 'ต้องใช้บัญชีจริง' : 'แอปอ่านยอดจากสลิปให้เอง'} onPress={() => choose('/scan')} />
        <Divider style={{ marginLeft: 44 + space.md }} />
        <Option icon="mic" color={theme.primary} title="พูดรายการ" sub="พูดครั้งเดียว ได้หลายรายการ" onPress={() => choose('/voice')} />
        <Divider style={{ marginLeft: 44 + space.md }} />
        <Option icon="create" color={theme.primary} title="กรอกรายจ่ายเอง" sub="จดรายจ่ายเงินสด ฯลฯ" onPress={() => choose('/transaction')} />
        <Divider style={{ marginLeft: 44 + space.md }} />
        <Option
          icon="arrow-down-circle"
          color={theme.income}
          title="เพิ่มเงินเข้า"
          sub="เงินโอน เงินสด ค่าขนม"
          onPress={() => choose({ pathname: '/transaction', params: { kind: 'income' } })}
        />
      </Animated.View>
    </View>
  );
}
