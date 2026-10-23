/**
 * ตู้สกินน้องกล้า: every skin, how to get it, and the one น้องกล้า wears.
 * Mission skins show the mission's progress; limited skins show their window.
 * Limited skins whose time has passed (and that were not collected) are folded
 * away at the bottom ("สกินที่หมดเวลาแล้ว"), marked "สกินลิมิเต็ด · หมดเวลาแล้ว".
 * Rules: src/domain/skins.ts and src/domain/missions.ts.
 */
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../data/AppProvider';
import { missionForSkin } from '../domain/missions';
import { isSkinId, SKINS, skinState, skinStatusLine, type Skin, type SkinId, type SkinState } from '../domain/skins';
import { useKla } from '../services/kla';
import { Badge, Button, Ionicons, Row, T } from '../ui/components';
import { GrowBar, Reveal } from '../ui/effects';
import { useToast } from '../ui/feedback';
import { KlaBackdrop } from '../ui/kla/KlaBackdrop';
import { KlaPicture } from '../ui/kla/KlaPicture';
import { KlaStage } from '../ui/kla/KlaStage';
import { fonts, radius, space, useTheme } from '../ui/theme';
import { CandyArt, PumpkinArt, useHalloween } from '../ui/halloween';
import { setColorTheme } from '../ui/themeMode';
import { LinearGradient } from 'expo-linear-gradient';
import { formatThaiDay } from '../domain/dates';
import { HALLOWEEN } from '../domain/halloween';
import { StackHeader } from '../ui/StackHeader';
import { SectionHead } from '../ui/SectionHead';

export default function Skins() {
  const theme = useTheme();
  const toast = useToast();
  const params = useLocalSearchParams<{ skin?: string }>();
  const { today } = useApp();
  const { missions, owned, equipped, fresh, equip, markSeen, candies } = useKla();
  const halloween = useHalloween();
  const [picked, setPicked] = useState<SkinId>(isSkinId(params.skin) ? params.skin : equipped);
  const [hop, setHop] = useState(0);
  const [cheer, setCheer] = useState(false);
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  // Looking at the collection counts as seeing the new skins.
  useEffect(() => {
    if (fresh.length) markSeen(fresh);
  }, [fresh, markSeen]);

  useEffect(() => {
    if (!cheer) return;
    const t = setTimeout(() => setCheer(false), 1800);
    return () => clearTimeout(t);
  }, [cheer]);

  const states = useMemo(() => new Map(SKINS.map((s) => [s.id, skinState(s, owned, today, candies.total)])), [owned, today, candies.total]);
  const skin = SKINS.find((s) => s.id === picked) ?? SKINS[0];
  const state = states.get(skin.id)!;
  const mission = missionForSkin(missions, skin.id);
  const mine = SKINS.filter((s) => states.get(s.id)!.kind === 'owned');
  const toUnlock = SKINS.filter((s) => s.kind === 'mission' && states.get(s.id)!.kind !== 'owned');
  const spooky = SKINS.filter((s) => s.event === 'halloween2569' && states.get(s.id)!.kind !== 'owned');
  const limited = SKINS.filter((s) => s.kind === 'limited' && !s.event && states.get(s.id)!.kind !== 'owned');
  const limitedOpen = limited.filter((s) => states.get(s.id)!.kind !== 'limited_ended');
  const limitedEnded = limited.filter((s) => states.get(s.id)!.kind === 'limited_ended');
  // Opened on an ended skin (from a link): show that part straight away.
  const [showEnded, setShowEnded] = useState(() => limitedEnded.some((s) => s.id === picked));

  function wear() {
    equip(skin.id);
    setHop((h) => h + 1);
    setCheer(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast({ message: `น้องกล้าใส่ชุด${skin.name}แล้ว` });
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <StackHeader title="ตู้สกินน้องกล้า" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}>
        <Reveal zoom>
          <KlaBackdrop floorAt={0.62}>
            <View style={{ alignItems: 'center', paddingTop: space.lg, paddingBottom: space.xl, paddingHorizontal: space.lg, gap: space.sm }}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setHop((h) => h + 1);
                }}
                accessibilityRole="button"
                accessibilityLabel={`น้องกล้าในชุด${skin.name} แตะเพื่อให้กระโดด`}
              >
                <KlaStage skin={skin.id} mood={cheer ? 'cheer' : state.kind === 'owned' ? 'happy' : 'calm'} width={176} hop={hop} active={focused} onDark />
              </Pressable>
              <T v="h2" color={theme.heroAccent} center>
                {skin.name}
              </T>
              <T v="small" color={theme.heroInkSoft} center>
                {skin.blurb}
              </T>
              <SkinAction skin={skin} state={state} equipped={equipped === skin.id} mission={mission} onWear={wear} />
            </View>
          </KlaBackdrop>
        </Reveal>

        <Section title="ชุดของฉัน" right={`มีแล้ว ${mine.length}/${SKINS.length}`}>
          {mine.map((s, i) => (
            <SkinCard key={s.id} skin={s} state={states.get(s.id)!} index={i} picked={picked === s.id} worn={equipped === s.id} onPress={() => setPicked(s.id)} />
          ))}
        </Section>

        {spooky.length ? (
          <View style={{ gap: space.sm }}>
            <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
              <LinearGradient colors={['#3B1E5C', '#24123D', '#120822']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: space.md, gap: 4 }}>
                <Row justify="space-between">
                  <Row gap={space.sm}>
                    <PumpkinArt size={30} />
                    <T v="h3" color={theme.heroInk}>
                      ฮาโลวีน 2569
                    </T>
                  </Row>
                  <View
                    accessible
                    accessibilityLabel={`ลูกอม ${candies.total} เม็ด`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)' }}
                  >
                    <CandyArt size={18} />
                    <T v="body" color="#FF9A3C">
                      {candies.total}
                    </T>
                  </View>
                </Row>
                <T v="micro" color="#D9C8F0">
                  สกินลิมิเต็ดถึง {formatThaiDay(HALLOWEEN.to)} · ได้ลูกอมจากการจับผีบนหน้าหลัก (ธีมฮาโลวีน วันละ {HALLOWEEN.ghostsPerDay} ตัว) และจดรายการวันไหนได้ {HALLOWEEN.candiesPerRecordDay} เม็ด
                </T>
                {!halloween ? (
                  <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                    <Button label="เปิดธีมฮาโลวีน" small kind="gold" icon="moon" onPress={() => setColorTheme('halloween')} />
                  </View>
                ) : null}
              </LinearGradient>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {spooky.map((s, i) => {
                const st = states.get(s.id)!;
                return (
                  <SkinCard
                    key={s.id}
                    skin={s}
                    state={st}
                    index={i}
                    picked={picked === s.id}
                    progress={st.kind === 'candy' ? { value: st.have, target: st.need } : undefined}
                    onPress={() => setPicked(s.id)}
                  />
                );
              })}
            </View>
          </View>
        ) : null}

        {toUnlock.length ? (
          <Section title="ปลดล็อกด้วยภารกิจการเงิน" hint="ทำภารกิจในหน้าความสำเร็จ แล้วชุดจะเข้าตู้ให้เอง">
            {toUnlock.map((s, i) => {
              const m = missionForSkin(missions, s.id);
              return (
                <SkinCard
                  key={s.id}
                  skin={s}
                  state={states.get(s.id)!}
                  index={i}
                  picked={picked === s.id}
                  progress={m ? m.progress : undefined}
                  onPress={() => setPicked(s.id)}
                />
              );
            })}
          </Section>
        ) : null}

        {limitedOpen.length ? (
          <Section title="สกินลิมิเต็ด" hint="แจกเฉพาะช่วงเวลา เปิดแอปในช่วงนั้นก็ได้เลย พ้นช่วงแล้วหาไม่ได้อีก">
            {limitedOpen.map((s, i) => (
              <SkinCard key={s.id} skin={s} state={states.get(s.id)!} index={i} picked={picked === s.id} onPress={() => setPicked(s.id)} />
            ))}
          </Section>
        ) : null}

        {/* Skins that can no longer be collected: out of the way, one tap to look. */}
        {limitedEnded.length ? (
          <View style={{ gap: space.sm }}>
            <Pressable
              onPress={() => setShowEnded((v) => !v)}
              accessibilityRole="button"
              aria-expanded={showEnded}
              accessibilityLabel={`สกินที่หมดเวลาแล้ว ${limitedEnded.length} ชุด`}
              hitSlop={8}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Row gap={4}>
                <Ionicons name="time-outline" size={16} color={theme.inkSoft} />
                <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>
                  สกินที่หมดเวลาแล้ว ({limitedEnded.length})
                </T>
                <Ionicons name={showEnded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.ink} />
              </Row>
            </Pressable>
            {showEnded ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {limitedEnded.map((s, i) => (
                  <SkinCard key={s.id} skin={s} state={states.get(s.id)!} index={i} picked={picked === s.id} onPress={() => setPicked(s.id)} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, right, hint, children }: { title: string; right?: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <SectionHead title={title} right={right ? <T v="small">{right}</T> : undefined} />
      {hint ? <T v="micro">{hint}</T> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{children}</View>
    </View>
  );
}

/** What can be done with the skin shown on the stage. */
function SkinAction({
  skin,
  state,
  equipped,
  mission,
  onWear,
}: {
  skin: Skin;
  state: SkinState;
  equipped: boolean;
  mission?: { how: string; progress: { value: number; target: number }; note?: string };
  onWear: () => void;
}) {
  const theme = useTheme();
  if (state.kind === 'owned') {
    return equipped ? (
      <View style={{ marginTop: space.xs }}>
        <Badge label="น้องกล้าใส่ชุดนี้อยู่" icon="checkmark" tone="gold" onDark center />
      </View>
    ) : (
      <View style={{ alignSelf: 'stretch', marginTop: space.xs }}>
        <Button label="ใส่ชุดนี้" icon="shirt-outline" onPress={onWear} />
      </View>
    );
  }
  if (state.kind === 'candy') {
    return (
      <View style={{ alignSelf: 'stretch', gap: 6, marginTop: space.xs, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: radius.md, padding: space.md }}>
        <Row gap={6}>
          <CandyArt size={18} />
          <T v="small" color={theme.heroInk} style={{ flex: 1, fontFamily: fonts.sansSemi }}>
            สะสมลูกอม {state.need} เม็ดเพื่อปลดล็อก
          </T>
          <T v="small" color={theme.heroAccent}>
            {state.have}/{state.need}
          </T>
        </Row>
        <GrowBar value={state.have / state.need} color={theme.heroAccent} track="rgba(244,241,230,0.18)" />
        <T v="micro" color={theme.heroInkSoft}>
          สกินลิมิเต็ดฮาโลวีน รับได้ถึง {formatThaiDay(state.until)} จับผีบนหน้าหลัก (ธีมฮาโลวีน) และจดรายการทุกวันเพื่อเก็บลูกอม
        </T>
      </View>
    );
  }
  if (state.kind === 'locked' && mission) {
    const { value, target } = mission.progress;
    return (
      <View style={{ alignSelf: 'stretch', gap: 6, marginTop: space.xs, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: radius.md, padding: space.md }}>
        <Row gap={6}>
          <Ionicons name="lock-closed" size={16} color={theme.heroAccent} />
          <T v="small" color={theme.heroInk} style={{ flex: 1, fontFamily: fonts.sansSemi }}>
            ปลดล็อก: {mission.how}
          </T>
          <T v="small" color={theme.heroAccent}>
            {target === 100 ? `${value}%` : `${value}/${target}`}
          </T>
        </Row>
        <GrowBar value={value / target} color={theme.heroAccent} track="rgba(244,241,230,0.18)" />
        {mission.note ? (
          <T v="micro" color={theme.heroInkSoft}>
            {mission.note}
          </T>
        ) : null}
      </View>
    );
  }
  return (
    <View style={{ alignSelf: 'stretch', gap: 4, marginTop: space.xs, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: radius.md, padding: space.md }}>
      <Row gap={6}>
        <Ionicons name={state.kind === 'limited_ended' ? 'time-outline' : 'sparkles'} size={16} color={theme.heroAccent} />
        <T v="small" color={theme.heroInk} style={{ flex: 1, fontFamily: fonts.sansSemi }}>
          {skinStatusLine(skin, state)}
        </T>
      </Row>
    </View>
  );
}

function SkinCard({
  skin,
  state,
  index,
  picked,
  worn,
  progress,
  onPress,
}: {
  skin: Skin;
  state: SkinState;
  index: number;
  picked: boolean;
  worn?: boolean;
  progress?: { value: number; target: number };
  onPress: () => void;
}) {
  const theme = useTheme();
  const ended = state.kind === 'limited_ended';
  const locked = state.kind !== 'owned';
  const label =
    state.kind === 'owned'
      ? worn
        ? 'ใส่อยู่'
        : 'มีแล้ว'
      : state.kind === 'limited_ended'
        ? 'หมดเวลาแล้ว'
        : state.kind === 'limited_soon'
          ? 'เร็ว ๆ นี้'
          : state.kind === 'limited_open'
            ? 'รับได้ตอนนี้'
            : state.kind === 'candy'
              ? `ลูกอม ${state.have}/${state.need}`
              : progress
              ? progress.target === 100
                ? `${progress.value}%`
                : `${progress.value}/${progress.target}`
              : 'ล็อกอยู่';
  return (
    <Reveal index={index} from={10} zoom style={{ width: '31.6%' }}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`สกิน ${skin.name} ${skin.kind === 'limited' ? 'สกินลิมิเต็ด ' : ''}${label}`}
        aria-selected={picked}
        style={({ pressed }) => ({
          // Cards in one row share the height of the tallest (a two-line name).
          flex: 1,
          borderRadius: radius.lg,
          // Selected like every other choice in the app (primary); no outline otherwise, like Card.
          borderWidth: 2,
          borderColor: picked ? theme.primary : 'transparent',
          backgroundColor: theme.surface,
          paddingTop: 2,
          paddingBottom: space.sm,
          paddingHorizontal: 6,
          alignItems: 'center',
          gap: 4,
          opacity: pressed ? 0.85 : 1,
          overflow: 'hidden',
        })}
      >
        {/* The tint runs under the 2pt selection edge too, so an unselected card shows no frame. */}
        <View style={{ position: 'absolute', left: -2, right: -2, top: -2, height: 94, backgroundColor: skin.tint, opacity: theme.dark ? 0.22 : 0.16 }} />
        <View style={{ opacity: ended ? 0.55 : 1 }}>
          <KlaPicture skin={skin.id} mood={locked ? 'calm' : 'happy'} width={76} onDark={theme.dark} extras={false} />
        </View>
        {skin.kind === 'limited' ? (
          <View style={{ position: 'absolute', top: 6, left: 6 }}>
            <Badge label="ลิมิเต็ด" tone="gold" />
          </View>
        ) : null}
        {locked ? (
          <View style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={ended ? 'time-outline' : 'lock-closed'} size={12} color={theme.inkSoft} />
          </View>
        ) : null}
        <T v="small" color={theme.ink} center numberOfLines={2} style={{ fontFamily: fonts.sansSemi }}>
          {skin.name}
        </T>
        {progress && (state.kind === 'locked' || state.kind === 'candy') ? (
          <View style={{ alignSelf: 'stretch', paddingHorizontal: 4, gap: 2 }}>
            <GrowBar value={progress.value / progress.target} color={theme.primary} track={theme.surfaceAlt} height={5} />
          </View>
        ) : null}
        <Row gap={2} style={{ justifyContent: 'center' }}>
          {worn ? <Ionicons name="checkmark" size={13} color={theme.primary} /> : null}
          <T v="micro" center color={worn ? theme.primary : theme.inkSoft} numberOfLines={1}>
            {label}
          </T>
        </Row>
      </Pressable>
    </Reveal>
  );
}
