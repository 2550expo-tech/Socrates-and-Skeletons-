/**
 * FR-5 AI Persona Coach. Explains the user's confirmed numbers in the tone they
 * pick. Two layers:
 *   1. "สิ่งที่ควรรู้ตอนนี้" — rule-based facts from src/domain/insights.ts
 *      (works offline, every number traceable);
 *   2. questions answered by the AI coach, which receives only a summary of
 *      confirmed totals (see buildCoachContext).
 */
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp, useMoney } from '../../data/AppProvider';
import { buildCoachContext, buildInsights, personaFor, PERSONAS } from '../../domain/insights';
import { formatBaht, parseBahtToSatang } from '../../domain/money';
import { runwayAfterPurchase } from '../../domain/runway';
import type { CoachTone } from '../../domain/types';
import { askCoach, CoachError } from '../../services/coach';
import { Card, Chip, Ionicons, Row, T } from '../../ui/components';
import { useToast } from '../../ui/feedback';
import { fonts, radius, space, useTheme } from '../../ui/theme';

interface Msg {
  id: number;
  from: 'me' | 'coach';
  text: string;
  error?: boolean;
}

const QUICK = ['สรุปสัปดาห์นี้ให้หน่อย', 'หมวดไหนควรลดก่อน', 'ซื้อของ 500 บาทวันนี้ได้ไหม', 'ทำยังไงให้เงินพอถึงสิ้นเดือน'];

/** Find a price in a question like "ซื้อของ 500 บาท" or "฿1,290". */
function priceInQuestion(q: string): number | null {
  const m = q.match(/฿?\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?\s*(?:บาท)?/);
  return m ? parseBahtToSatang(m[0]) : null;
}

export default function Coach() {
  const theme = useTheme();
  const toast = useToast();
  const params = useLocalSearchParams<{ ask?: string; price?: string }>();
  const { profile, txs, saveProfile, repo } = useApp();
  const { balance, runway } = useMoney();
  const [input, setInput] = useState(params.ask ?? '');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const seq = useRef(0);

  // Prefill the question when opened from "เช็กก่อนจ่าย" (adjust state during render, no effect needed).
  const [lastAsk, setLastAsk] = useState(params.ask);
  if (params.ask !== lastAsk) {
    setLastAsk(params.ask);
    if (params.ask) setInput(params.ask);
  }

  const insights = useMemo(
    () => (profile ? buildInsights({ txs, profile, runway }) : []),
    [txs, profile, runway],
  );
  const persona = personaFor(profile?.coachTone ?? 'friend');

  async function setTone(tone: CoachTone) {
    try {
      await saveProfile({ coachTone: tone });
    } catch {
      toast({ message: 'เปลี่ยนโทนไม่สำเร็จ', tone: 'error' });
    }
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy || !profile) return;
    setInput('');
    const mine: Msg = { id: ++seq.current, from: 'me', text: q };
    setMsgs((m) => [...m, mine]);
    setBusy(true);
    try {
      const price = params.price && q === params.ask ? Number(params.price) : priceInQuestion(q);
      const context = {
        ...buildCoachContext({ txs, profile, balanceSatang: balance, runway }),
        ...(price
          ? {
              purchaseCheck: {
                price: formatBaht(price, { decimals: false }),
                runwayBefore: runway.days === null ? 'คำนวณไม่ได้' : `${runway.days} วัน`,
                runwayAfter: (() => {
                  const r = runwayAfterPurchase(runway, price);
                  return r.status === 'below_floor' ? 'ต่ำกว่าเส้นสำรองทันที' : r.days === null ? 'คำนวณไม่ได้' : `${r.days} วัน`;
                })(),
              },
            }
          : {}),
      };
      if (repo?.mode === 'demo') {
        throw new CoachError('โหมดทดลองยังคุยกับโค้ช AI ไม่ได้ เข้าสู่ระบบด้วยบัญชีจริงเพื่อใช้งาน ระหว่างนี้ดูคำแนะนำด้านบนได้เลย');
      }
      const answer = await askCoach({ tone: profile.coachTone, context, question: q });
      setMsgs((m) => [...m, { id: ++seq.current, from: 'coach', text: answer }]);
    } catch (e) {
      const text = e instanceof CoachError ? e.message : 'ติดต่อโค้ชไม่ได้ตอนนี้ ลองใหม่อีกครั้ง';
      setMsgs((m) => [...m, { id: ++seq.current, from: 'coach', text, error: true }]);
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 2 }}>
            <T v="label">AI Persona Coach</T>
            <T v="h1">โค้ชของคุณ</T>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {PERSONAS.map((p) => {
              const active = p.tone === persona.tone;
              return (
                <Pressable
                  key={p.tone}
                  onPress={() => setTone(p.tone)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={{
                    width: 150,
                    padding: space.md,
                    borderRadius: radius.lg,
                    borderWidth: 1.5,
                    borderColor: active ? theme.accent : theme.line,
                    backgroundColor: active ? theme.accentSoft : theme.surface,
                    gap: 4,
                  }}
                >
                  <T v="h2">{p.glyph}</T>
                  <T v="body" style={{ fontFamily: fonts.sansSemi }}>{p.name}</T>
                  <T v="micro">{p.tagline}</T>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ gap: space.sm }}>
            <T v="h3">สิ่งที่ควรรู้ตอนนี้</T>
            {insights.map((i, n) => (
              <Card key={n} style={{ borderLeftWidth: 0 }}>
                <Row align="flex-start" gap={space.md}>
                  <Ionicons
                    name={i.severity === 'watch' ? 'alert-circle-outline' : i.severity === 'good' ? 'checkmark-circle-outline' : 'information-circle-outline'}
                    size={22}
                    color={i.severity === 'watch' ? theme.watch : i.severity === 'good' ? theme.good : theme.inkSoft}
                  />
                  <View style={{ flex: 1, gap: 4 }}>
                    <T v="body">{i.message}</T>
                    <T v="micro">ข้อมูล: {i.fact}</T>
                  </View>
                </Row>
              </Card>
            ))}
          </View>

          <View style={{ gap: space.sm }}>
            <T v="h3">ถาม{persona.name}</T>
            {msgs.length === 0 ? (
              <T v="small">โค้ชตอบจากตัวเลขที่คุณยืนยันแล้วเท่านั้น ไม่เห็นรูปสลิปหรือชื่อคนที่คุณโอนให้</T>
            ) : null}
            {msgs.map((m) => (
              <View
                key={m.id}
                style={{
                  alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  backgroundColor: m.from === 'me' ? theme.primary : m.error ? theme.surfaceAlt : theme.surface,
                  borderRadius: radius.lg,
                  borderBottomRightRadius: m.from === 'me' ? 6 : radius.lg,
                  borderBottomLeftRadius: m.from === 'coach' ? 6 : radius.lg,
                  borderWidth: m.from === 'coach' ? 1 : 0,
                  borderColor: theme.line,
                  padding: space.md,
                  gap: 4,
                }}
              >
                {m.from === 'coach' && !m.error ? <T v="micro">{persona.glyph} {persona.name} · ตอบโดย AI</T> : null}
                <T v="body" color={m.from === 'me' ? theme.onPrimary : m.error ? theme.inkSoft : theme.ink} selectable>
                  {m.text}
                </T>
              </View>
            ))}
            {busy ? (
              <Row gap={space.sm}>
                <ActivityIndicator color={theme.primary} />
                <T v="small">{persona.name}กำลังดูตัวเลขของคุณ…</T>
              </Row>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {QUICK.map((q) => (
              <Chip key={q} label={q} onPress={() => send(q)} />
            ))}
          </ScrollView>
        </ScrollView>

        <Row
          gap={space.sm}
          style={{ paddingHorizontal: space.lg, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: theme.surface }}
        >
          <TextInput
            nativeID="coach-input"
            value={input}
            onChangeText={setInput}
            placeholder="ถามเรื่องเงินของคุณ เช่น ซื้อรองเท้า 1,290 ได้ไหม"
            placeholderTextColor={theme.inkFaint}
            accessibilityLabel="คำถามถึงโค้ช"
            multiline
            maxLength={400}
            style={{
              flex: 1,
              maxHeight: 100,
              fontFamily: fonts.sans,
              fontSize: 15,
              color: theme.ink,
              backgroundColor: theme.bg,
              borderRadius: radius.lg,
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}
          />
          <Pressable
            onPress={() => send(input)}
            disabled={!input.trim() || busy}
            accessibilityRole="button"
            accessibilityLabel="ส่งคำถาม"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: input.trim() && !busy ? theme.primary : theme.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-up" size={22} color={input.trim() && !busy ? theme.onPrimary : theme.inkFaint} />
          </Pressable>
        </Row>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
