/**
 * FR-5 AI coach: น้องกล้า, big, on a little stage. It talks to the user with
 * subtitles, a moving mouth and small gestures, and with a calm, friendly
 * voice when the phone has a Thai voice and the sound is on. It wears the skin
 * the user chose. Two layers of advice:
 *   1. "สิ่งที่ควรรู้ตอนนี้" — rule-based facts from src/domain/insights.ts
 *      (works offline, every number traceable); tap one and น้องกล้า tells it;
 *   2. questions answered by the AI coach, which receives only a summary of
 *      confirmed totals (see buildCoachContext).
 */
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Keyboard, Platform, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp, useMoney } from '../../data/AppProvider';
import { BUDDY_NAME, buddyPoke, type BuddyMood } from '../../domain/buddy';
import { buildCoachContext, buildInsights } from '../../domain/insights';
import { HALLOWEEN_LINES } from '../../domain/halloween';
import { KLA_AFTER, KLA_GREETING, KLA_GREETING_HALLOWEEN, KLA_THINKING, REPEAT_MAX } from '../../domain/klaTalk';
import { formatBaht } from '../../domain/money';
import { priceInQuestion } from '../../domain/price';
import { runwayAfterPurchase } from '../../domain/runway';
import { SKINS, skinById, type SkinId } from '../../domain/skins';
import { askCoach, CoachError } from '../../services/coach';
import { useEquippedSkin, useKla } from '../../services/kla';
import { Buddy } from '../../ui/Buddy';
import { Card, Chip, Ionicons, Row, T, type IconName } from '../../ui/components';
import { Reveal, TypingDots } from '../../ui/effects';
import { TitleDecor, useHalloween } from '../../ui/halloween';
import { KlaBackdrop } from '../../ui/kla/KlaBackdrop';
import { KlaPicture } from '../../ui/kla/KlaPicture';
import { KlaStage } from '../../ui/kla/KlaStage';
import { setKlaSound, useKlaTalk } from '../../ui/kla/useKlaTalk';
import { alpha, fonts, radius, space, useTheme } from '../../ui/theme';
import { inputBox, inputText } from '../../ui/inputs';

interface Msg {
  id: number;
  from: 'me' | 'coach';
  text: string;
  error?: boolean;
}

const QUICK = ['สรุปสัปดาห์นี้ให้หน่อย', 'หมวดไหนควรลดก่อน', 'ซื้อของ 500 บาทวันนี้ได้ไหม', 'ทำยังไงให้เงินพอถึงสิ้นเดือน'];
const IDLE = `สงสัยอะไรเรื่องเงิน ถาม${BUDDY_NAME}ได้เลยนะ`;

/** น้องกล้า says hello once each time the app is opened, not on every visit to the tab. */
let greeted = false;

export default function Coach() {
  const theme = useTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const params = useLocalSearchParams<{ ask?: string; price?: string; at?: string }>();
  const { profile, txs, repo } = useApp();
  const { balance, runway } = useMoney();
  const skin = useEquippedSkin();
  const kla = useKla();
  const halloween = useHalloween();
  const [picking, setPicking] = useState(false);
  const [showAllInsights, setShowAllInsights] = useState(false);
  const { subtitle, talking, said, speak, stop, sound, voice } = useKlaTalk();
  const [input, setInput] = useState(params.ask ?? '');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [rest, setRest] = useState<{ text: string; mood: BuddyMood }>({ text: KLA_GREETING, mood: 'happy' });
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [hop, setHop] = useState(0);
  const [focused, setFocused] = useState(false);
  /** The question box has the keyboard (its border turns to the theme colour). */
  const [typing, setTyping] = useState(false);
  const pokes = useRef(0);
  const scroll = useRef<ScrollView>(null);
  const seq = useRef(0);

  // Prefill the question when opened from "เช็กก่อนจ่าย" (adjust state during render, no effect needed).
  // `at` changes on every tap, so asking about the same price twice fills it in again.
  const askKey = params.ask ? `${params.ask}|${params.at ?? ''}` : undefined;
  const [lastAsk, setLastAsk] = useState(askKey);
  if (askKey !== lastAsk) {
    setLastAsk(askKey);
    if (params.ask) setInput(params.ask);
  }

  const insights = useMemo(() => (profile ? buildInsights({ txs, profile, runway }) : []), [txs, profile, runway]);

  /** Say something on the stage; afterwards the bubble keeps `after` (or the whole line if it is short). */
  const tell = useCallback(
    (text: string, opts: { mood?: BuddyMood; after?: string; msgId?: number } = {}) => {
      setRest({ text: opts.after ?? (text.length <= REPEAT_MAX ? text : KLA_AFTER), mood: opts.mood ?? 'happy' });
      setSpeakingId(opts.msgId ?? null);
      speak(text, () => setSpeakingId(null));
    },
    [speak],
  );

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      if (!greeted) {
        greeted = true;
        tell(halloween ? KLA_GREETING_HALLOWEEN : KLA_GREETING);
      }
      return () => {
        setFocused(false);
        stop();
        setSpeakingId(null);
      };
    }, [tell, stop, halloween]),
  );

  const toTop = () => setTimeout(() => scroll.current?.scrollTo({ y: 0, animated: true }), 30);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy || !profile) return;
    setInput('');
    Keyboard.dismiss();
    stop();
    setMsgs((m) => [...m, { id: ++seq.current, from: 'me', text: q }]);
    setBusy(true);
    toTop();
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
        throw new CoachError(`โหมดทดลองยังถาม AI ไม่ได้นะ เข้าสู่ระบบด้วยบัญชีจริงแล้วถาม${BUDDY_NAME}ได้เลย ระหว่างนี้แตะการ์ด "สิ่งที่ควรรู้ตอนนี้" ให้${BUDDY_NAME}เล่าให้ฟังได้`);
      }
      const answer = await askCoach({ context, question: q });
      const id = ++seq.current;
      setMsgs((m) => [...m, { id, from: 'coach', text: answer }]);
      tell(answer, { msgId: id });
    } catch (e) {
      const text = e instanceof CoachError ? e.message : `ติดต่อ${BUDDY_NAME}ไม่ได้ตอนนี้ ลองใหม่อีกครั้งนะ`;
      setMsgs((m) => [...m, { id: ++seq.current, from: 'coach', text, error: true }]);
      // Problems are shown, not read aloud.
      setRest({ text, mood: 'worried' });
    } finally {
      setBusy(false);
    }
  }

  function poke() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setHop((h) => h + 1);
    pokes.current += 1;
    const n = pokes.current;
    // Halloween theme: every other tap is a spooky-cute line.
    const line = halloween && n % 2 === 0 ? { mood: 'cheer' as const, text: HALLOWEEN_LINES[(n / 2 - 1) % HALLOWEEN_LINES.length] } : buddyPoke(n, runway.status);
    tell(line.text, { mood: line.mood });
  }

  /** Change น้องกล้า's skin right here on the stage. */
  function wear(id: SkinId) {
    Haptics.selectionAsync().catch(() => {});
    if (id === skin) return;
    kla.equip(id);
    setHop((h) => h + 1);
    tell(`ใส่ชุด${skinById(id).name}แล้ว เข้ากับ${BUDDY_NAME}ไหม`, { mood: 'cheer', after: IDLE });
  }
  const mine = SKINS.filter((s) => kla.owned.has(s.id));

  const mood: BuddyMood = busy ? 'thinking' : talking ? (rest.mood === 'worried' ? 'calm' : rest.mood) : rest.mood;
  // The big stage keeps to about 40% of the screen height, so on a small phone the advice still shows.
  const kW = Math.round(Math.max(96, Math.min(214, Math.min(screenW, 440) * 0.52, (screenH * 0.4 - 150) / 1.2)));

  // Chat first: once a question is asked, the stage shrinks to a strip and the conversation leads.
  const compact = msgs.length > 0;
  const shownInsights = showAllInsights ? insights : insights.slice(0, 2);

  const controls = (
    <Row gap={space.sm} style={compact ? undefined : { marginTop: -space.sm }}>
      <StageButton
        icon={sound ? 'volume-high' : 'volume-mute'}
        text={sound ? 'ปิดเสียง' : 'เปิดเสียง'}
        label={sound ? `ปิดเสียงน้อง${BUDDY_NAME}` : `เปิดเสียงน้อง${BUDDY_NAME}`}
        small={compact}
        onPress={() => setKlaSound(!sound)}
      />
      {talking ? (
        <StageButton
          icon="stop"
          text="หยุด"
          label={`ให้น้อง${BUDDY_NAME}หยุดพูด`}
          small={compact}
          onPress={() => {
            stop();
            setSpeakingId(null);
          }}
        />
      ) : said ? (
        <StageButton icon="refresh" text="ฟังอีกครั้ง" label="ฟังอีกครั้ง" small={compact} onPress={() => tell(said, { mood: rest.mood === 'worried' ? 'calm' : rest.mood })} />
      ) : null}
      <StageButton icon="shirt" text="เปลี่ยนชุด" label={`เปลี่ยนชุดน้อง${BUDDY_NAME}`} expanded={picking} small={compact} onPress={() => setPicking((p) => !p)} />
    </Row>
  );

  const bubble = (
    <SpeechBubble tail={!compact}>
      {busy ? (
        <Row gap={space.sm}>
          <TypingDots color={theme.primary} />
          <T v="body" color={theme.inkSoft}>
            {KLA_THINKING}
          </T>
        </Row>
      ) : (
        <T v="body" color={rest.mood === 'worried' && !talking ? theme.inkSoft : theme.ink} style={{ fontFamily: fonts.sansMedium }} numberOfLines={compact ? 3 : undefined}>
          {subtitle ? subtitle.text : rest.text}
        </T>
      )}
      {subtitle && subtitle.total > 1 ? (
        <Row gap={4} style={{ marginTop: 6 }} justify="center">
          {Array.from({ length: subtitle.total }, (_, i) => (
            <View key={i} style={{ width: i === subtitle.index ? 14 : 5, height: 5, borderRadius: 3, backgroundColor: i <= subtitle.index ? theme.primary : theme.line }} />
          ))}
        </Row>
      ) : null}
    </SpeechBubble>
  );

  const character = (
    <Pressable onPress={poke} accessibilityRole="button" accessibilityLabel={`น้อง${BUDDY_NAME}ในชุด${skinById(skin).name} แตะเพื่อฟังเคล็ดลับ`} style={{ marginTop: compact ? 0 : 2 }}>
      <KlaStage skin={skin} mood={mood} width={compact ? 76 : kW} talking={talking} hop={hop} active={focused} onDark />
    </Pressable>
  );

  const skinPicker = picking ? (
    <Reveal from={8} style={{ alignSelf: 'stretch', marginTop: space.md }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: 2 }}>
        {mine.map((s) => {
          const on = s.id === skin;
          return (
            <Pressable
              key={s.id}
              onPress={() => wear(s.id)}
              accessibilityRole="button"
              accessibilityLabel={`ใส่ชุด${s.name}`}
              aria-selected={on}
              style={({ pressed }) => ({
                width: 70,
                alignItems: 'center',
                paddingTop: 2,
                paddingBottom: 6,
                borderRadius: radius.md,
                borderWidth: on ? 2 : 1,
                borderColor: on ? theme.heroAccent : 'rgba(255,255,255,0.18)',
                backgroundColor: pressed ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
              })}
            >
              <KlaPicture skin={s.id} mood="happy" width={50} onDark extras={false} ground={false} />
              <T v="micro" color={theme.heroInk} numberOfLines={1}>
                {s.name}
              </T>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => router.push('/skins')}
          accessibilityRole="button"
          accessibilityLabel="ดูตู้สกินทั้งหมดและวิธีปลดล็อก"
          style={({ pressed }) => ({
            width: 70,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            borderRadius: radius.md,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: 'rgba(255,255,255,0.35)',
            backgroundColor: pressed ? 'rgba(255,255,255,0.2)' : 'transparent',
          })}
        >
          <Ionicons name="grid" size={20} color={theme.heroAccent} />
          <T v="micro" color={theme.heroInk} center>
            ตู้สกิน{'\n'}ทั้งหมด
          </T>
        </Pressable>
      </ScrollView>
    </Reveal>
  ) : null;

  const noVoice =
    sound && voice === null ? (
      <T v="micro" color={theme.heroInkSoft} center style={{ marginTop: space.sm }}>
        เครื่องนี้ยังไม่มีเสียงอ่านภาษาไทย {BUDDY_NAME}จะพูดเป็นตัวหนังสือแทนนะ
      </T>
    ) : null;

  const insightList =
    insights.length > 0 ? (
      <View style={{ gap: space.sm }}>
        <T v="h3" accessibilityRole="header">
          สิ่งที่ควรรู้ตอนนี้
        </T>
        {shownInsights.map((i, n) => (
          <Card
            key={n}
            onPress={() => {
              tell(i.message, { mood: i.severity === 'watch' ? 'calm' : 'happy', after: IDLE });
              toTop();
            }}
          >
            <Row align="flex-start" gap={space.md}>
              <Ionicons
                name={i.severity === 'watch' ? 'alert-circle-outline' : i.severity === 'good' ? 'checkmark-circle-outline' : 'information-circle-outline'}
                size={22}
                color={i.severity === 'watch' ? theme.watch : i.severity === 'good' ? theme.good : theme.inkSoft}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <T v="body">{i.message}</T>
                <T v="micro">ข้อมูล: {i.fact}</T>
                <Row gap={4}>
                  <Ionicons name="volume-medium-outline" size={14} color={theme.primary} />
                  <T v="micro" color={theme.primary}>
                    แตะให้น้อง{BUDDY_NAME}เล่า
                  </T>
                </Row>
              </View>
            </Row>
          </Card>
        ))}
        {insights.length > 2 ? (
          <Pressable
            onPress={() => setShowAllInsights((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showAllInsights ? 'ย่อสิ่งที่ควรรู้' : `ดูสิ่งที่ควรรู้อีก ${insights.length - 2} ข้อ`}
            aria-expanded={showAllInsights}
            hitSlop={8}
            style={{ minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' }}
          >
            <Row gap={4}>
              <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>
                {showAllInsights ? 'ย่อ' : `ดูอีก ${insights.length - 2} ข้อ`}
              </T>
              <Ionicons name={showAllInsights ? 'chevron-up' : 'chevron-down'} size={16} color={theme.ink} />
            </Row>
          </Pressable>
        ) : null}
      </View>
    ) : null;

  const chat = (
    <View style={{ gap: space.sm }}>
      <T v="h3" accessibilityRole="header">
        คุยกับน้อง{BUDDY_NAME}
      </T>
      {msgs.length === 0 ? <T v="micro">{BUDDY_NAME}เห็นแค่ยอดที่ยืนยันแล้ว ไม่เห็นรูปสลิปหรือชื่อคนที่คุณโอนให้</T> : null}
      {msgs.map((m) => {
        const color = m.from === 'me' ? theme.onPrimary : m.error ? theme.inkSoft : theme.ink;
        const live = m.id === speakingId;
        return (
          <Reveal key={m.id} from={12} zoom style={{ alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
            <Row gap={6} align="flex-end">
              {m.from === 'coach' ? <Buddy mood={m.error ? 'worried' : 'happy'} size={34} still /> : null}
              <View
                style={{
                  flexShrink: 1,
                  backgroundColor: m.from === 'me' ? theme.primary : m.error ? theme.surfaceAlt : theme.surface,
                  borderRadius: radius.lg,
                  borderBottomRightRadius: m.from === 'me' ? 6 : radius.lg,
                  borderBottomLeftRadius: m.from === 'coach' ? 6 : radius.lg,
                  borderWidth: live ? 1.5 : 0,
                  borderColor: theme.accent,
                  padding: space.md,
                  gap: 4,
                }}
              >
                {m.from === 'coach' && !m.error ? (
                  <Row justify="space-between" gap={space.sm}>
                    <T v="micro">น้อง{BUDDY_NAME} · ตอบโดย AI</T>
                    <Pressable
                      onPress={() => {
                        tell(m.text, { msgId: m.id });
                        toTop();
                      }}
                      // A 44pt target around the small icon.
                      hitSlop={14}
                      accessibilityRole="button"
                      accessibilityLabel={live ? `น้อง${BUDDY_NAME}กำลังพูดข้อความนี้` : 'ฟังข้อความนี้'}
                    >
                      <Ionicons name={live ? 'volume-high' : 'volume-medium-outline'} size={16} color={live ? theme.accentInk : theme.inkSoft} />
                    </Pressable>
                  </Row>
                ) : null}
                <T v="body" color={color} selectable>
                  {m.text}
                </T>
              </View>
            </Row>
          </Reveal>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroll}
          // Same header spacing as the other tabs (title starts `sm` below the safe area).
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.lg, paddingBottom: space.xl }}
          keyboardShouldPersistTaps="handled"
        >
          <Row justify="space-between" align="flex-end">
            <T v="h1" accessibilityRole="header">
              น้อง{BUDDY_NAME}
            </T>
            <TitleDecor />
          </Row>

          {/* The stage: big before the first question, a strip once the conversation starts. */}
          {compact ? (
            <KlaBackdrop floorAt={0.9}>
              <View style={{ padding: space.md }}>
                <Row gap={space.sm} align="center">
                  {character}
                  <View style={{ flex: 1, gap: space.sm }}>
                    {bubble}
                    {controls}
                  </View>
                </Row>
                {skinPicker}
              </View>
            </KlaBackdrop>
          ) : (
            <KlaBackdrop floorAt={0.8}>
              <View style={{ alignItems: 'center', paddingTop: space.lg, paddingHorizontal: space.lg, paddingBottom: space.md }}>
                {bubble}
                {character}
                {controls}
                {skinPicker}
                {noVoice}
              </View>
            </KlaBackdrop>
          )}

          {compact ? chat : insightList}
          {compact ? insightList : chat}
        </ScrollView>

        {/* The composer: starter questions (only until the first one is asked or typed), then the box. */}
        <View style={{ borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: theme.surface, paddingTop: space.sm, paddingBottom: space.sm + 26, gap: space.sm }}>
          {msgs.length === 0 && !input.trim() ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
              {QUICK.map((q) => (
                <Chip key={q} label={q} onPress={() => send(q)} />
              ))}
            </ScrollView>
          ) : null}
          <Row gap={space.sm} style={{ paddingHorizontal: space.lg }}>
            <TextInput
              nativeID="coach-input"
              value={input}
              onChangeText={setInput}
              placeholder={`ถามน้อง${BUDDY_NAME} เช่น ซื้อของ 500 ได้ไหม`}
              placeholderTextColor={theme.inkSoft}
              accessibilityLabel={`คำถามถึงน้อง${BUDDY_NAME}`}
              multiline
              maxLength={400}
              onFocus={() => setTyping(true)}
              onBlur={() => setTyping(false)}
              style={[inputBox(theme, { focused: typing }), inputText(theme), { maxHeight: 100, paddingVertical: 10 }]}
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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** The white bubble over น้องกล้า, with a tail pointing down at it. */
function SpeechBubble({ children, tail = true }: { children: React.ReactNode; tail?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ alignSelf: 'stretch', alignItems: 'center' }} accessibilityLiveRegion="polite">
      <View
        style={{
          alignSelf: 'stretch',
          minHeight: 54,
          justifyContent: 'center',
          backgroundColor: theme.surface,
          borderRadius: radius.lg,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        {children}
      </View>
      {tail ? (
        <View
          style={{
            width: 16,
            height: 16,
            marginTop: -9,
            backgroundColor: theme.surface,
            transform: [{ rotate: '45deg' }],
            borderBottomRightRadius: 4,
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * A see-through button on the stage: icon and a short word on the big stage, icon only in the
 * compact strip. Its screen-reader name always starts with the visible word ("ปิดเสียง…").
 */
function StageButton({ icon, text, label, onPress, small, expanded }: { icon: IconName; text: string; label: string; onPress: () => void; small?: boolean; expanded?: boolean }) {
  const theme = useTheme();
  const size = small ? 36 : 40;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-expanded={expanded}
      hitSlop={small ? 4 : 2}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minWidth: size,
        height: size,
        paddingHorizontal: small ? 0 : 12,
        borderRadius: size / 2,
        backgroundColor: alpha(theme.heroInk, pressed ? 0.24 : expanded ? 0.2 : 0.12),
        borderWidth: 1,
        borderColor: alpha(theme.heroInk, expanded ? 0.55 : 0.3),
      })}
    >
      <Ionicons name={icon} size={small ? 17 : 18} color={theme.heroAccent} />
      {small ? null : (
        <T v="small" color={theme.heroInk}>
          {text}
        </T>
      )}
    </Pressable>
  );
}
