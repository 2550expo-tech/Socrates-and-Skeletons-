/**
 * "มีอะไรใหม่": the features added lately, each with a button to try it. The
 * latest three are open; older ones are a list of titles that open on a tap.
 * Opened from settings, or once per update from the home screen's slot.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BUDDY_NAME } from '../domain/buddy';
import { bkkDayKey, formatThaiDay } from '../domain/dates';
import { HALLOWEEN, halloweenOn } from '../domain/halloween';
import { skinById } from '../domain/skins';
import { markWhatsNewSeen } from '../services/whatsNew';
import { BuddySays } from '../ui/Buddy';
import { Button, Card, Divider, Ionicons, Row, T } from '../ui/components';
import { Reveal } from '../ui/effects';
import { fonts, palette, radius, space, useTheme } from '../ui/theme';
import { StackHeader } from '../ui/StackHeader';

type IconName = keyof typeof Ionicons.glyphMap;

/** Tabs already sit under this screen: go back to them (pushing would open a second set of tabs). */
const TAB_ROUTES = new Set(['/', '/coach', '/stats', '/transactions']);
function openFeature(href: Href) {
  if (typeof href === 'string' && TAB_ROUTES.has(href)) router.dismissTo(href);
  else router.push(href);
}

type Feature = { icon: IconName; colors: [string, string]; title: string; body: string; action?: { label: string; href: Href } };

/** A dated offer, worded from its real window so it never promises something that has ended. */
function halloweenNews(today: string): string {
  const intro = 'ธีมหลอน ๆ น่ารัก ๆ สีม่วงมืดกับส้มฟักทอง มีค้างคาวบิน';
  if (today > HALLOWEEN.to) return `${intro} ยังเลือกธีมนี้ได้ในหน้าตั้งค่า ส่วนกิจกรรมจับผีแลกชุดจบไปแล้ว`;
  return `${intro} ผีน้อยให้จับรับลูกอม แลกสกินผีหัวฟักทอง แฟรงเกนสไตน์ แม่มดน้อย แวมไพร์ มัมมี่ และผีน้อยผ้าขาว (ถึง ${formatThaiDay(HALLOWEEN.to, { year: false })})`;
}
function pioneerNews(today: string): string {
  const w = skinById('pioneer').window!;
  return today >= w.from && today <= w.to ? ` ตอนนี้แจกชุดผู้บุกเบิกถึง ${formatThaiDay(w.to, { year: false })}` : '';
}

const features = (today: string): Feature[] => [
  {
    icon: 'sparkles-outline',
    colors: ['#1F7A52', '#0E3B2C'],
    title: 'หน้าตาใหม่ โล่งตาขึ้น',
    body: 'ทุกหน้าโล่งและอ่านง่ายขึ้น: ปุ่ม + เปิดเป็นแผ่นเลือกวิธีจดโดยไม่ทิ้งหน้าเดิม รายการบอกว่าแต่ละวันใช้และรับเท่าไร สถิติมีกราฟตามช่วงที่เลือก และหน้าเงินพอถึงวันไหนบอกยอดที่จะเหลืออีก 7, 14 และ 30 วัน',
    action: { label: 'ดูหน้าหลัก', href: '/' },
  },
  {
    icon: 'flash',
    colors: ['#C9A227', '#7A5A0E'],
    title: 'Quick Access: ยอดวันนี้ข้างปุ่ม +',
    body: 'ยอดที่ใช้ไปวันนี้อยู่ติดปุ่ม + ทุกหน้า แตะดูรายการได้เลย บนแอป Android เพิ่มเป็นวิดเจ็ตบนหน้าจอโฮมได้ด้วย: เห็นยอดวันนี้ เงินพอใช้กี่วัน และปุ่มลัดเลือกสลิป พูด และ + (ตั้งค่า → วิดเจ็ตหน้าจอโฮม)',
    action: { label: 'ดูรายการวันนี้', href: '/transactions' },
  },
  {
    icon: 'image',
    colors: ['#1F7A52', '#0E3B2C'],
    title: 'ดูรูปสลิปย้อนหลังได้',
    body: 'สลิปที่อ่านแล้วเก็บสำเนารูปไว้ในเครื่องนี้เท่านั้น ไม่ได้อัปโหลดเก็บบน server แตะรายการที่จดจากสลิปเพื่อดูรูป ลบรูปในแกลเลอรีไปแล้วก็ยังดูได้',
  },
  {
    icon: 'moon',
    colors: ['#3B1E5C', '#120822'],
    title: 'ธีมฮาโลวีน 👻',
    body: halloweenNews(today),
    action: { label: halloweenOn(today) ? 'ลองธีมฮาโลวีน' : 'เลือกธีม', href: '/settings' },
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
    body: `ทำภารกิจการเงินในหน้าความสำเร็จเพื่อปลดล็อกชุดให้น้อง${BUDDY_NAME} เช่น เปิดแอปติดต่อกัน 30 วันได้ชุดไทย และมีสกินลิมิเต็ดตามเทศกาล${pioneerNews(today)}`,
    action: { label: 'เปิดตู้สกิน', href: '/skins' },
  },
  {
    icon: 'add-circle',
    colors: ['#2E8B57', '#14502F'],
    title: 'เพิ่มเงินเข้าเอง',
    body: 'เงินเข้าที่ไม่มีสลิป เช่น เงินเดือน เงินจากที่บ้าน กดปุ่ม + แล้วเลือก “เพิ่มเงินเข้า” เลือกยอดด่วนได้เลย',
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
    body: 'กดปุ่ม + แล้วเลือก “พูดรายการ” แล้วพูดว่า “ข้าว 50 บาท” พูดหลายรายการในประโยคเดียวก็ได้',
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

/** How many of the newest stay open at the top. */
const LATEST = 3;

function FeatureIcon({ f, size }: { f: Feature; size: number }) {
  return (
    <LinearGradient colors={f.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size > 40 ? radius.md : radius.sm, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={f.icon} size={Math.round(size * 0.52)} color={palette.goldSoft} />
    </LinearGradient>
  );
}

export default function WhatsNew() {
  const theme = useTheme();
  const [open, setOpen] = useState<string | null>(null);
  const [news] = useState(() => features(bkkDayKey(Date.now())));
  useEffect(() => {
    markWhatsNewSeen();
  }, []);
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <StackHeader title="มีอะไรใหม่" close />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxxl }}>
        <BuddySays mood="cheer">{`อัปเดตใหม่มาแล้ว! ${BUDDY_NAME}เตรียมของเล่นใหม่ไว้หลายอย่างเลย`}</BuddySays>
        {news.slice(0, LATEST).map((f, i) => (
          <Reveal key={f.title} index={i} from={14}>
            <Card style={{ gap: space.sm }}>
              <Row gap={space.md} align="flex-start">
                <FeatureIcon f={f} size={46} />
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

        {/* Older news: titles only; a tap opens one. */}
        <T v="h3" accessibilityRole="header" style={{ marginTop: space.sm }}>
          ก่อนหน้านี้
        </T>
        <Card style={{ gap: 0, paddingVertical: space.xs }}>
          {news.slice(LATEST).map((f, i) => {
            const isOpen = open === f.title;
            return (
              <View key={f.title}>
                {i > 0 ? <Divider /> : null}
                <Pressable
                  onPress={() => setOpen(isOpen ? null : f.title)}
                  accessibilityRole="button"
                  accessibilityLabel={f.title}
                  aria-expanded={isOpen}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingVertical: space.sm, opacity: pressed ? 0.7 : 1 })}
                >
                  <FeatureIcon f={f} size={32} />
                  <T v="body" style={{ flex: 1, fontFamily: fonts.sansMedium }}>
                    {f.title}
                  </T>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.inkSoft} />
                </Pressable>
                {isOpen ? (
                  <View style={{ gap: space.sm, paddingBottom: space.md, paddingLeft: 32 + space.md }}>
                    <T v="small">{f.body}</T>
                    {f.action ? (
                      <Button label={f.action.label} kind="soft" small icon="arrow-forward" onPress={() => openFeature(f.action!.href)} style={{ alignSelf: 'flex-start' }} />
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
