/**
 * The (+) in the middle of the tab bar: one place to add money in or out.
 * Slip from the gallery (FR-4), speak (FR-3), type an expense or add money in (FR-1).
 * Choosing one replaces this sheet, so closing that screen goes straight back.
 */
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { Animated, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAutoScan } from '../services/AutoScanProvider';
import { Ionicons, Row, T, type IconName } from '../ui/components';
import { Reveal, usePressSpring } from '../ui/effects';
import { goBack } from '../ui/nav';
import { alpha, fonts, radius, space, useTheme } from '../ui/theme';

function Option({ icon, color, title, sub, to, onPress, index }: { icon: IconName; color: string; title: string; sub: string; to?: Href; onPress?: () => void; index: number }) {
  const theme = useTheme();
  const press = usePressSpring(0.97);
  return (
    <Reveal index={index} from={14}>
      <Animated.View style={{ transform: [{ scale: press.scale }] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            if (onPress) onPress();
            else if (to) router.replace(to);
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.md,
            padding: space.lg,
            borderRadius: radius.xl,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.line,
          }}
        >
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: alpha(color, theme.dark ? 0.2 : 0.13), alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon} size={26} color={color} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h3">{title}</T>
            <T v="small">{sub}</T>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.inkFaint} />
        </Pressable>
      </Animated.View>
    </Reveal>
  );
}

export default function AddSheet() {
  const theme = useTheme();
  const auto = useAutoScan();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <Row justify="space-between" style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
        <Pressable
          onPress={() => goBack()}
          accessibilityRole="button"
          accessibilityLabel="ยกเลิก"
          hitSlop={8}
          style={{ paddingHorizontal: space.lg, height: 44, borderRadius: radius.pill, backgroundColor: theme.surfaceAlt, justifyContent: 'center' }}
        >
          <T v="body" color={theme.inkSoft} style={{ fontFamily: fonts.sansMedium }}>
            ยกเลิก
          </T>
        </Pressable>
        <T v="h3" accessibilityRole="header">
          เพิ่มรายการ
        </T>
        <View style={{ width: 84 }} />
      </Row>
      <View style={{ flex: 1, justifyContent: 'flex-end', padding: space.lg, paddingBottom: space.xxl, gap: space.md }}>
        <T v="small" center style={{ marginBottom: space.sm }}>
          เลือกวิธีที่สะดวก ทุกทางรวมเข้ายอดเงินเดียวกัน
        </T>
        {auto.available ? (
          // Phone app: read today's slips in the gallery right now (the automatic scan, on demand).
          <Option
            index={0}
            icon="flash"
            color={theme.accentInk}
            title="ดึงสลิปวันนี้"
            sub="อ่านสลิปของวันนี้ในแกลเลอรีให้ทันที"
            onPress={() => {
              auto.grantAndRun().catch(() => {});
              goBack();
            }}
          />
        ) : null}
        <Option index={0} icon="images" color={theme.primary} title="เลือกสลิปจากแกลเลอรี" sub="แอปอ่านยอดจากสลิปให้เอง" to="/scan" />
        <Option index={1} icon="mic" color={theme.accentInk} title="พูดรายการ" sub="พูดครั้งเดียว ได้หลายรายการ" to="/voice" />
        <Option index={2} icon="create" color={theme.watch} title="กรอกรายจ่ายเอง" sub="จดรายจ่ายเงินสด ฯลฯ" to="/transaction" />
        <Option index={3} icon="arrow-down-circle" color={theme.income} title="เพิ่มเงินเข้า" sub="เงินโอน เงินสด ค่าขนม" to={{ pathname: '/transaction', params: { kind: 'income' } }} />
      </View>
    </SafeAreaView>
  );
}
