/**
 * ความสำเร็จ: the recording streak (last 14 days), the money missions that
 * unlock skins for น้องกล้า, and the badge collection.
 * Rules: src/domain/achievements.ts and src/domain/missions.ts.
 * Opened from the flame on the home screen.
 */
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BUDDY_NAME } from '../domain/buddy';
import type { Mission } from '../domain/missions';
import { skinById } from '../domain/skins';
import { useKla } from '../services/kla';
import { useAchievements } from '../services/useAchievements';
import { BuddySays } from '../ui/Buddy';
import { Button, IconButton, Ionicons, Row, T, type IconName } from '../ui/components';
import { Aurora, GrowBar, PulseRing, Reveal, Sparkles } from '../ui/effects';
import { KlaPicture } from '../ui/kla/KlaPicture';
import { Medal } from '../ui/Medal';
import { useCountUp, useReduceMotion } from '../ui/motion';
import { goBack } from '../ui/nav';
import { alpha, fonts, radius, space, useTheme } from '../ui/theme';
import { HeaderDecor } from '../ui/halloween';

const WEEKDAY = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export default function Achievements() {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const { streak, badges, fresh, markSeen } = useAchievements();
  const { missions } = useKla();
  const shown = useCountUp(streak.days, !reduce, 900);
  const earned = badges.filter((b) => b.earned).length;

  // Opening this screen counts as seeing every badge earned so far.
  useEffect(() => {
    if (fresh.length) markSeen(fresh.map((b) => b.id));
  }, [fresh, markSeen]);

  const line =
    streak.days === 0
      ? `จดวันนี้สักรายการ แล้วสถิติจะเริ่มนับ ${BUDDY_NAME}เชียร์อยู่นะ`
      : streak.today
        ? `วันนี้จดแล้ว เก่งมาก! ต่อเนื่อง ${streak.days} วัน พรุ่งนี้มาต่อกันนะ`
        : `อีกนิดเดียว จดวันนี้สักรายการ สถิติ ${streak.days} วันจะไม่หลุด`;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <Row justify="space-between" style={{ paddingHorizontal: space.sm, paddingTop: space.sm }}>
        <IconButton icon="chevron-back" label="กลับ" onPress={() => goBack()} />
        <T v="h3">ความสำเร็จ</T>
        <HeaderDecor />
      </Row>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}>
        {/* Streak */}
        <Reveal zoom>
          <View style={{ borderRadius: radius.xl, overflow: 'hidden' }}>
            <LinearGradient
              colors={[theme.heroTop, theme.hero, theme.heroDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: space.xl, gap: space.md }}
            >
              <Aurora cycles={1} strength={0.35} seed={7} />
              {streak.today ? <Sparkles count={8} cycles={1} area={{ top: 6, bottom: 50 }} /> : null}
              <Row gap={space.lg}>
                <View style={{ width: 76, height: 76, alignItems: 'center', justifyContent: 'center' }}>
                  <PulseRing size={76} active={streak.today} times={2} color={theme.heroAccent} />
                  <View
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 34,
                      backgroundColor: alpha(theme.heroAccent, 0.14),
                      borderWidth: 2,
                      borderColor: streak.today ? theme.heroAccent : alpha(theme.heroInk, 0.35),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="flame" size={38} color={streak.today ? '#F29E4C' : theme.heroInkSoft} />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <T v="small" color={theme.heroInkSoft}>จดต่อเนื่อง</T>
                  <T v="h1" color={theme.heroAccent}>
                    {shown} <T v="body" color={theme.heroInk}>วัน</T>
                  </T>
                  <T v="small" color={theme.heroInkSoft}>สถิติสูงสุด {streak.best} วัน</T>
                </View>
              </Row>
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                accessible
                accessibilityLabel={`14 วันล่าสุด จด ${streak.recent.filter((d) => d.active).length} วัน`}
              >
                {streak.recent.map((d, i) => {
                  const isToday = i === streak.recent.length - 1;
                  const weekday = new Date(`${d.day}T12:00:00Z`).getUTCDay();
                  return (
                    <View key={d.day} style={{ alignItems: 'center', gap: 4 }}>
                      <View
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          backgroundColor: d.active ? theme.heroAccent : 'transparent',
                          borderWidth: isToday ? 2 : 1.5,
                          borderColor: d.active ? theme.heroAccent : isToday ? theme.heroInk : alpha(theme.heroInk, 0.3),
                        }}
                      />
                      <T v="micro" color={isToday ? theme.heroInk : theme.heroInkSoft}>
                        {WEEKDAY[weekday]}
                      </T>
                    </View>
                  );
                })}
              </View>
            </LinearGradient>
          </View>
        </Reveal>

        <BuddySays mood={streak.today ? 'cheer' : streak.days ? 'calm' : 'thinking'}>{line}</BuddySays>

        {/* Money missions: each one unlocks a skin for น้องกล้า */}
        <View style={{ gap: space.sm }}>
          <Row justify="space-between">
            <T v="h3">ภารกิจการเงิน</T>
            <T v="small">
              สำเร็จ {missions.filter((m) => m.done).length}/{missions.length}
            </T>
          </Row>
          <T v="micro">ทำภารกิจสำเร็จ แล้วน้องกล้าจะได้ชุดใหม่ใส่</T>
          {missions.map((m, i) => (
            <Reveal key={m.id} index={i} from={10}>
              <MissionCard mission={m} onPress={() => router.push({ pathname: '/skins', params: { skin: m.skin } })} />
            </Reveal>
          ))}
          <Button label="ตู้สกินน้องกล้า" kind="soft" icon="shirt-outline" onPress={() => router.push('/skins')} />
        </View>

        {/* Badges */}
        <Row justify="space-between">
          <T v="h3">เหรียญของฉัน</T>
          <T v="small">
            ได้แล้ว {earned}/{badges.length}
          </T>
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg }}>
          {badges.map((b, i) => (
            <Reveal key={b.id} index={i} from={12} zoom style={{ width: '33.33%', alignItems: 'center' }}>
              <View style={{ alignItems: 'center', width: 100, gap: 2 }}>
                <Medal badge={b} shine={b.earned} />
                {!b.earned ? (
                  <T v="micro" center numberOfLines={2}>
                    {b.progress ? `${b.progress.value}/${b.progress.target} · ` : ''}
                    {b.how}
                  </T>
                ) : null}
              </View>
            </Reveal>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** One money mission: what to do, progress with the user's own numbers, and the skin it gives. */
function MissionCard({ mission: m, onPress }: { mission: Mission; onPress: () => void }) {
  const theme = useTheme();
  const skin = skinById(m.skin);
  const { value, target } = m.progress;
  const count = target === 100 ? `${value}%` : target === 1 ? '' : `${value}/${target}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`ภารกิจ ${m.title}: ${m.how} ${m.done ? 'สำเร็จแล้ว' : count} รางวัล สกิน${skin.name}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        backgroundColor: theme.surface,
        borderRadius: radius.lg,
        // Like Card: a hairline, and the accent at 1.5pt for what is done.
        borderWidth: m.done ? 1.5 : StyleSheet.hairlineWidth,
        borderColor: m.done ? theme.accent : theme.line,
        padding: space.md,
        opacity: pressed ? 0.88 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: m.done ? theme.accentSoft : theme.surfaceAlt,
        }}
      >
        <Ionicons name={(m.done ? 'checkmark' : m.icon) as IconName} size={20} color={m.done ? theme.accentInk : theme.inkSoft} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Row justify="space-between" gap={space.sm}>
          <T v="body" color={theme.ink} style={{ flex: 1, fontFamily: fonts.sansSemi }} numberOfLines={1}>
            {m.title}
          </T>
          {m.done ? (
            <T v="micro" color={theme.primary}>
              สำเร็จแล้ว
            </T>
          ) : count ? (
            <T v="micro">{count}</T>
          ) : null}
        </Row>
        <T v="small">{m.how}</T>
        {!m.done ? <GrowBar value={value / target} color={theme.primary} track={theme.surfaceAlt} height={6} /> : null}
        {m.note && !m.done ? <T v="micro">{m.note}</T> : null}
      </View>
      <View style={{ alignItems: 'center', width: 58 }}>
        <View style={{ width: 50, height: 50, opacity: m.done ? 1 : 0.9 }}>
          <View style={{ position: 'absolute', top: -10 }}>
            <KlaPicture skin={m.skin} mood={m.done ? 'happy' : 'calm'} width={50} onDark={theme.dark} extras={false} />
          </View>
          {!m.done ? (
            <View
              style={{
                position: 'absolute',
                right: -4,
                bottom: 0,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: theme.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="lock-closed" size={10} color={theme.inkSoft} />
            </View>
          ) : null}
        </View>
        <T v="micro" center numberOfLines={1} color={theme.inkSoft}>
          {skin.name}
        </T>
      </View>
    </Pressable>
  );
}
