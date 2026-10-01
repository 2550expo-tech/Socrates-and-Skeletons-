/**
 * "พูดจด" (FR-1 by voice): tap the mic and say "ข้าว 50 บาท"; MindPay turns it
 * into transactions (several in one sentence, income, yesterday), shows them
 * for a quick look, and saves them with one tap. Where the phone or browser
 * cannot listen, the same sentence can be typed (the keyboard's own mic works).
 * Parsing: src/domain/voice.ts. Listening: src/services/speech(.web).ts.
 */
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../data/AppProvider';
import { VOICE_NOTE } from '../domain/achievements';
import { BUDDY_NAME } from '../domain/buddy';
import { getCategory } from '../domain/categories';
import { addDays, bkkDayKey, bkkTime, bkkToIso, relativeDayLabel } from '../domain/dates';
import { formatBaht } from '../domain/money';
import type { TxKind } from '../domain/types';
import { parseSpokenEntry, spokenCategory, type SpokenItem } from '../domain/voice';
import { askMicPermission, listen, speechAvailable } from '../services/speech';
import { BuddySays } from '../ui/Buddy';
import { Button, Card, Chip, IconButton, Ionicons, Money, Row, T } from '../ui/components';
import { inputBox, inputText } from '../ui/inputs';
import { Aurora, PulseRing, Reveal, useCelebrate, usePressSpring } from '../ui/effects';
import { useToast } from '../ui/feedback';
import { useNative, useReduceMotion } from '../ui/motion';
import { goBack, useLeaveWhenDone } from '../ui/nav';
import { fonts, radius, space, useTheme } from '../ui/theme';
import { HeaderDecor } from '../ui/halloween';

const EXAMPLES = ['ข้าว 50 บาท', 'ค่ารถ 25 กาแฟ 65', 'ได้เงินจากแม่ 500', 'เมื่อวาน หมูกระทะ 299'];

const SPEECH_ERRORS: Record<string, string> = {
  'not-allowed': 'ต้องอนุญาตให้ใช้ไมโครโฟนก่อนนะ',
  'no-speech': 'ไม่ได้ยินเสียง ลองแตะไมค์แล้วพูดอีกครั้งนะ',
  'speech-timeout': 'ไม่ได้ยินเสียง ลองแตะไมค์แล้วพูดอีกครั้งนะ',
  network: 'ต้องต่ออินเทอร์เน็ตเพื่อแปลงเสียงเป็นข้อความ',
  'audio-capture': 'ใช้ไมโครโฟนไม่ได้ตอนนี้ ลองใหม่อีกครั้ง',
  'language-not-supported': 'เครื่องนี้ยังฟังภาษาไทยไม่ได้ พิมพ์แทนได้เลย',
  'service-not-allowed': 'เครื่องนี้ยังไม่มีบริการแปลงเสียง พิมพ์แทนได้เลย',
  busy: 'ระบบฟังเสียงกำลังทำงานอยู่ ลองใหม่อีกสักครู่',
};

/** Five bars that dance with the voice while listening. */
function VoiceBars({ level, active }: { level: Animated.Value; active: boolean }) {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const [wave] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active || reduce) return;
    const loop = Animated.loop(Animated.timing(wave, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: useNative }));
    loop.start();
    return () => loop.stop();
  }, [active, reduce, wave]);
  return (
    <Row gap={6} style={{ height: 36 }} align="center">
      {[0, 1, 2, 3, 4].map((i) => {
        const phase = Animated.modulo(Animated.add(wave, i * 0.18), 1);
        const bounce = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 1, 0.35] });
        const loud = level.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.6], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={i}
            style={{
              width: 6,
              height: 30,
              borderRadius: 3,
              backgroundColor: i % 2 ? theme.heroAccent : theme.heroInkSoft,
              opacity: active ? 1 : 0.35,
              transform: [{ scaleY: active && !reduce ? Animated.multiply(bounce, loud) : 0.35 }],
            }}
          />
        );
      })}
    </Row>
  );
}

export default function VoiceEntry() {
  const theme = useTheme();
  const toast = useToast();
  const leaveWhenDone = useLeaveWhenDone();
  const celebrate = useCelebrate();
  const { addTx, today } = useApp();
  const [canListen] = useState(() => speechAvailable());
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [kinds, setKinds] = useState<Record<string, TxKind>>({});
  const [busy, setBusy] = useState(false);
  const [level] = useState(() => new Animated.Value(0));
  const stop = useRef<(() => void) | null>(null);
  const mic = usePressSpring(0.92);

  useEffect(() => () => stop.current?.(), []);

  const parsed = useMemo(() => parseSpokenEntry(text), [text]);
  const keyOf = (item: SpokenItem, i: number) => `${i}:${item.title}:${item.amountSatang}`;
  const items = parsed.items
    .map((item, i) => {
      const key = keyOf(item, i);
      const kind = kinds[key] ?? item.kind;
      // Switched between income and expense: pick a category of the new kind.
      return { key, item: kind === item.kind ? item : { ...item, kind, categoryKey: spokenCategory(item.title, kind) } };
    })
    .filter(({ key }) => !removed.has(key));

  function changeText(t: string) {
    setText(t);
    setRemoved(new Set());
    setKinds({});
  }

  async function toggleListening() {
    if (listening) {
      stop.current?.();
      return;
    }
    const perm = await askMicPermission();
    if (perm !== 'granted') {
      setNotice(perm === 'blocked' ? 'ปิดสิทธิ์ไมโครโฟนไว้ เปิดได้ในการตั้งค่าของมือถือ' : SPEECH_ERRORS['not-allowed']);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setNotice(null);
    setListening(true);
    stop.current = listen({
      onText: (t) => changeText(t),
      onError: (code) => {
        setListening(false);
        if (code !== 'aborted') setNotice(SPEECH_ERRORS[code] ?? 'ฟังเสียงไม่สำเร็จ ลองอีกครั้ง หรือพิมพ์แทนได้เลย');
      },
      onEnd: () => {
        setListening(false);
        level.setValue(0);
      },
      onVolume: (v) => level.setValue(v),
    });
  }

  async function saveAll() {
    if (!items.length || busy) return;
    setBusy(true);
    try {
      const time = bkkTime(new Date());
      let saved = 0;
      for (const { item, key } of items) {
        await addTx({
          kind: item.kind,
          amountSatang: item.amountSatang,
          categoryKey: item.categoryKey,
          title: item.title,
          note: VOICE_NOTE,
          occurredAt: bkkToIso(addDays(today || bkkDayKey(new Date()), item.dayOffset), time),
          source: 'manual',
          status: 'confirmed',
          slipRef: null,
          slipImageHash: null,
          ocrConfidence: null,
          reviewFlags: [],
        });
        // Saved: take it off the list, so trying again after a failure never saves it twice.
        saved += 1;
        setRemoved((r) => new Set(r).add(key));
      }
      celebrate();
      toast({ message: `บันทึก ${saved} รายการแล้ว` });
      leaveWhenDone();
    } catch {
      toast({ message: 'บันทึกบางรายการไม่สำเร็จ รายการที่เหลือยังอยู่ในรายการ ลองอีกครั้งได้', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const total = items.reduce((s, { item }) => s + (item.kind === 'income' ? item.amountSatang : -item.amountSatang), 0);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <Row justify="space-between" style={{ paddingHorizontal: space.sm, paddingTop: space.sm }}>
        <IconButton icon="close" label="ปิด" onPress={() => goBack()} />
        <T v="h3">พูดจดรายการ</T>
        <HeaderDecor />
      </Row>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
          {/* The mic */}
          <Reveal zoom>
            <View style={{ borderRadius: radius.xl, overflow: 'hidden' }}>
              <LinearGradient
                colors={[theme.heroTop, theme.hero, theme.heroDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingVertical: space.xl, paddingHorizontal: space.lg, alignItems: 'center', gap: space.md }}
              >
                <Aurora cycles={listening ? 2 : 0} strength={0.3} seed={31} />
                {canListen ? (
                  <>
                    <View style={{ width: 104, height: 104, alignItems: 'center', justifyContent: 'center' }}>
                      <PulseRing size={104} active={listening} times="always" color={theme.heroAccent} />
                      <Animated.View style={{ transform: [{ scale: mic.scale }] }}>
                        <Pressable
                          onPress={toggleListening}
                          onPressIn={mic.onPressIn}
                          onPressOut={mic.onPressOut}
                          accessibilityRole="button"
                          accessibilityLabel={listening ? 'หยุดฟัง' : 'แตะแล้วพูด'}
                          style={{
                            width: 96,
                            height: 96,
                            borderRadius: 48,
                            backgroundColor: listening ? theme.accent : theme.heroDeep,
                            borderWidth: 3,
                            borderColor: theme.heroAccent,
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: theme.accent,
                            shadowOpacity: 0.5,
                            shadowRadius: 16,
                            shadowOffset: { width: 0, height: 4 },
                            elevation: 10,
                          }}
                        >
                          <Ionicons name={listening ? 'stop' : 'mic'} size={42} color={listening ? theme.heroDeep : theme.heroAccent} />
                        </Pressable>
                      </Animated.View>
                    </View>
                    <VoiceBars level={level} active={listening} />
                    <T v="body" color={theme.heroInk} center>
                      {listening ? 'กำลังฟัง… พูดได้เลย แล้วแตะอีกครั้งเมื่อพูดจบ' : 'แตะไมค์แล้วพูด เช่น “ข้าว 50 บาท”'}
                    </T>
                  </>
                ) : (
                  <>
                    <Ionicons name="mic-outline" size={40} color={theme.heroAccent} />
                    <T v="body" color={theme.heroInk} center>
                      เครื่องนี้ยังฟังเสียงในแอปไม่ได้ พิมพ์แบบที่พูดด้านล่างได้เลย หรือกดไมค์บนคีย์บอร์ดแล้วพูด
                    </T>
                  </>
                )}
                {text ? (
                  <T v="h3" color={theme.heroAccent} center accessibilityRole="text">
                    “{parsed.heard || text}”
                  </T>
                ) : null}
              </LinearGradient>
            </View>
          </Reveal>

          {notice ? (
            <Card tone="alt" style={{ paddingVertical: space.md }}>
              <T v="small" color={theme.ink}>
                {notice}
              </T>
              {notice.includes('การตั้งค่า') ? <Button label="เปิดการตั้งค่า" kind="soft" small onPress={() => Linking.openSettings()} /> : null}
            </Card>
          ) : null}

          {/* Type instead */}
          <View style={{ gap: space.sm }}>
            <T v="small">หรือพิมพ์แบบที่พูด</T>
            <View style={[inputBox(theme), { paddingHorizontal: 0 }]}>
              <TextInput
                nativeID="voice-text"
                value={text}
                onChangeText={changeText}
                placeholder="เช่น ข้าว 50 น้ำ 15"
                placeholderTextColor={theme.inkFaint}
                accessibilityLabel="พิมพ์รายการแบบที่พูด"
                multiline
                style={[inputText(theme), { paddingHorizontal: 14, minHeight: 52, textAlignVertical: 'top' }]}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} keyboardShouldPersistTaps="handled">
              {EXAMPLES.map((e) => (
                <Chip key={e} label={e} onPress={() => changeText(e)} />
              ))}
            </ScrollView>
          </View>

          {/* What will be saved */}
          {items.length > 0 ? (
            <View style={{ gap: space.sm }}>
              <Row justify="space-between">
                <T v="h3">จะบันทึก {items.length} รายการ</T>
                <T v="small" color={total >= 0 ? theme.income : theme.ink}>
                  รวม {formatBaht(total, { sign: true, decimals: false })}
                </T>
              </Row>
              {items.map(({ item, key }, i) => {
                const cat = getCategory(item.categoryKey);
                return (
                  <Reveal key={key} index={i} from={10} zoom>
                    <Card style={{ paddingVertical: space.md }}>
                      <Row gap={space.md}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                          <T v="h3">{cat.glyph}</T>
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <T v="body" numberOfLines={1} style={{ fontFamily: fonts.sansSemi }}>
                            {item.title}
                          </T>
                          <T v="micro">
                            {cat.label} · {relativeDayLabel(addDays(today || bkkDayKey(new Date()), item.dayOffset))}
                          </T>
                        </View>
                        <Pressable
                          onPress={() => setKinds((k) => ({ ...k, [key]: item.kind === 'income' ? 'expense' : 'income' }))}
                          accessibilityRole="button"
                          accessibilityLabel={`${item.kind === 'income' ? 'รายรับ' : 'รายจ่าย'} แตะเพื่อสลับ`}
                          hitSlop={6}
                        >
                          <Money
                            satang={item.kind === 'income' ? item.amountSatang : -item.amountSatang}
                            sign
                            size="h3"
                            color={item.kind === 'income' ? theme.income : theme.ink}
                          />
                          <T v="micro" style={{ textAlign: 'right' }}>
                            {item.kind === 'income' ? 'รายรับ' : 'รายจ่าย'} ⇄
                          </T>
                        </Pressable>
                        <IconButton icon="close" label={`ไม่บันทึก ${item.title}`} onPress={() => setRemoved((r) => new Set(r).add(key))} />
                      </Row>
                    </Card>
                  </Reveal>
                );
              })}
              <Button label={`บันทึก ${items.length} รายการ`} kind="gold" icon="checkmark-done" shine onPress={saveAll} loading={busy} />
            </View>
          ) : text.trim() ? (
            <BuddySays mood="thinking">{`${BUDDY_NAME}ยังไม่เจอจำนวนเงินในประโยคนี้ ลองพูดชื่อรายการตามด้วยราคา เช่น “ข้าว 50 บาท”`}</BuddySays>
          ) : (
            <BuddySays mood="happy">{`พูดได้หลายรายการในทีเดียว เช่น “ข้าว 50 น้ำ 15” หรือ “ได้เงินจากแม่ 500” ${BUDDY_NAME}จะแยกให้เอง`}</BuddySays>
          )}

          <T v="micro" center>
            เสียงถูกแปลงเป็นข้อความโดยระบบของมือถือหรือเบราว์เซอร์ MindPay เก็บเฉพาะรายการที่คุณกดบันทึก
          </T>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
