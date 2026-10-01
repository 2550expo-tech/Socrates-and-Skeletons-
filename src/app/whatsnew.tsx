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
import { HeaderDecor } from '../ui/halloween';

type IconName = keyof typeof Ionicons.glyphMap;

/** Tabs already sit under this screen: go back to them (pushing would open a second set of tabs). */
const TAB_ROUTES = new Set(['/', '/coach', '/runway', '/transactions']);
function openFeature(href: Href) {
  if (typeof href === 'string' && TAB_ROUTES.has(href)) router.dismissTo(href);
  else router.push(href);
}

const FEATURES: { icon: IconName; colors: [string, string]; title: string; body: string; action?: { label: string; href: Href } }[] = [
  {
    icon: 'moon',
    colors: ['#3B1E5C', '#120822'],
    title: 'ธีมฮาโลวีน 👻',
    body: 'ธีมหลอน ๆ น่ารัก ๆ สีม่วงมืดกับส้มฟักทอง มีค้างคาวบิน ผีน้อยให้จับรับลูกอม แลกสกินผีหัวฟักทอง แฟรงเกนสไตน์ แม่มดน้อย แวมไพร์ มัมมี่ และผีน้อยผ้าขาว (ถึง 2 พ.ย.)',
    action: { label: 'ลองธีมฮาโลวีน', href: '/settings' },
  },
  {
    icon: 'chatbubbles',
    colors: ['#1F7A52', '#0E3B2C'],
    title: `โค้ชส่วนตัวคือน้อง${BUDDY_NAME}`,
    body: `น้อง${BUDDY_NAME}ตัวใหญ่ ขยับปาก ขยับมือเวลาพูด และพูดออกเสียงด้วยน้ำเสียงสุขุม เป็นมิตร ถามเรื่องเงินได้ทุกเรื่อง (เสียงใช้เสียงอ่านภาษาไทยของมือถือ ปิดเสียงได้)`,
    action: { label: `คุยกับน้อง${BUDDY_NAME}`, href: '/coach' },
  },
  {
    icon: 'shirt',
    colors: ['#C9A227', '#7A5A0E'],
    title: 'ตู้สกินและภารกิจการเงิน',
    body: `ทำภารกิจการเงินในหน้าความสำเร็จเพื่อปลดล็อกชุดให้น้อง${BUDDY_NAME} เช่น เปิดแอปติดต่อกัน 30 วันได้ชุดไทย และมีสกินลิมิเต็ดตามเทศกาล ตอนนี้แจกชุดผู้บุกเบิกถึง 31 ต.ค.`,
    action: { label: 'เปิดตู้สกิน', href: '/skins' },
  },
  {
    icon: 'add-circle',
    colors: ['#2E8B57', '#14502F'],
    title: 'เพิ่มเงินเข้าเอง',
    body: 'เงินเข้าที่ไม่มีสลิป เช่น เงินเดือน เงินจากที่บ้าน กด “เพิ่มเงินเข้า” บนหน้าหลัก เลือกยอดด่วนได้เลย',
    action: { label: 'เพิ่มเงินเข้า', href: '/transaction?kind=income' },
  },
  {
    icon: 'color-palette',
    colors: ['#6B2737', '#3A0F1B'],
    title: 'ธีมสีหรู ครบทุกแม่สี',
    body: 'Red Velvet, ม่วง, น้ำเงิน, ทอง และอีกหลายโทน ทั้งโหมดสว่างและโหมดมืด เลือกได้ในหน้าตั้งค่า',
    action: { label: 'เลือกธีม', href: '/settings' },
  },
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
        <HeaderDecor />
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
                <Button label={f.action.label} kind="soft" small icon="arrow-forward" onPress={() => openFeature(f.action!.href)} style={{ alignSelf: 'flex-end' }} />
              ) : null}
            </Card>
          </Reveal>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
