/**
 * "มีอะไรใหม่": the features added in this update, each with a button to try
 * it. Opened from the card on the home screen (shown once per update).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BUDDY_NAME } from '../domain/buddy';
import { markWhatsNewSeen } from '../services/whatsNew';
import { BuddySays } from '../ui/Buddy';
import { Button, Card, IconButton, Ionicons, Row, T } from '../ui/components';
import { Reveal } from '../ui/effects';
import { goBack } from '../ui/nav';
import { palette, radius, space, useTheme } from '../ui/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const FEATURES: { icon: IconName; colors: [string, string]; title: string; body: string; action?: { label: string; href: Href } }[] = [
  {
    icon: 'mic',
    colors: ['#C8992A', '#8F600C'],
    title: 'พูดจด',
    body: 'แตะไมค์ทองบนหน้าหลัก แล้วพูดว่า “ข้าว 50 บาท” พูดหลายรายการในประโยคเดียวก็ได้ (แอป Android ต้องลงเวอร์ชันใหม่)',
    action: { label: 'ลองพูดจด', href: '/voice' },
  },
  {
    icon: 'shield-checkmark',
    colors: ['#1F7A52', '#0E3B2C'],
    title: 'อ่านสลิปแม่นขึ้น ทุกธนาคาร',
    body: 'ทุกสลิปอ่าน 2 รอบด้วย AI 2 ตัว ถ้าไม่ตรงกันจะรอให้ตรวจพร้อมให้เลือกยอดที่ถูก ธนาคารดูจาก QR และสลิปที่เพื่อนโอนมาให้นับเป็นรายรับ',
  },
  {
    icon: 'wallet',
    colors: ['#B7791F', '#6B4A0E'],
    title: 'กระปุกออม',
    body: 'ตั้งเป้าของที่อยากได้ หยอดทีละนิด ดูโหลแก้วเติมทอง และรู้ว่าต้องเก็บวันละเท่าไรถึงทัน',
    action: { label: 'ตั้งกระปุก', href: '/goals' },
  },
  {
    icon: 'sparkles',
    colors: ['#4A1F3D', '#2E1327'],
    title: 'สรุปเดือนแบบเรื่องเล่า',
    body: 'เงินไปไหน วันไหนใช้เยอะ และเก่งขึ้นแค่ไหนเมื่อเทียบเดือนก่อน เลื่อนเองเหมือนดูสตอรี่',
    action: { label: 'ดูสรุปเดือนนี้', href: '/recap' },
  },
  {
    icon: 'flame',
    colors: ['#E07B2E', '#8F3E0C'],
    title: 'สถิติจดต่อเนื่องและเหรียญ',
    body: 'จดทุกวันให้เปลวไฟลุกต่อ และสะสมเหรียญ 13 แบบ',
    action: { label: 'ดูเหรียญ', href: '/achievements' },
  },
  {
    icon: 'calendar',
    colors: ['#0F3D4A', '#061A20'],
    title: 'ปฏิทินการใช้จ่าย',
    body: 'แท็บรายการมีปฏิทิน วันไหนใช้เยอะสีเข้ม แตะวันเพื่อดูเฉพาะวันนั้น',
    action: { label: 'เปิดปฏิทิน', href: '/transactions' },
  },
  {
    icon: 'options',
    colors: ['#1F5A3A', '#08201A'],
    title: 'เลื่อนดู “ถ้าใช้น้อยลง”',
    body: 'หน้าเงินพอถึงมีแถบเลื่อน ลากดูว่าใช้น้อยลงกี่เปอร์เซ็นต์ เงินจะพอเพิ่มกี่วัน',
    action: { label: 'ลองเลื่อน', href: '/runway' },
  },
  {
    icon: 'happy',
    colors: ['#E2B64A', '#B7791F'],
    title: `แตะ${BUDDY_NAME}และต้นไม้เงิน`,
    body: `${BUDDY_NAME}กระโดดและให้เคล็ดลับ ต้นไม้เงินสั่นใบและบอกว่าใบทองหมายถึงอะไร`,
  },
];

export default function WhatsNew() {
  const theme = useTheme();
  useEffect(() => {
    markWhatsNewSeen();
  }, []);
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <Row justify="space-between" style={{ paddingHorizontal: space.sm, paddingTop: space.sm }}>
        <IconButton icon="close" label="ปิด" onPress={() => goBack()} />
        <T v="h3">มีอะไรใหม่</T>
        <View style={{ width: 42 }} />
      </Row>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxxl }}>
        <BuddySays mood="cheer">{`อัปเดตใหม่มาแล้ว! ${BUDDY_NAME}เตรียมของเล่นใหม่ไว้หลายอย่างเลย`}</BuddySays>
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} index={i} from={14}>
            <Card style={{ gap: space.sm }}>
              <Row gap={space.md} align="flex-start">
                <LinearGradient colors={f.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={f.icon} size={24} color={palette.goldSoft} />
                </LinearGradient>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="h3">{f.title}</T>
                  <T v="small">{f.body}</T>
                </View>
              </Row>
              {f.action ? (
                <Button label={f.action.label} kind="soft" small icon="arrow-forward" onPress={() => router.push(f.action!.href)} style={{ alignSelf: 'flex-end' }} />
              ) : null}
            </Card>
          </Reveal>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
