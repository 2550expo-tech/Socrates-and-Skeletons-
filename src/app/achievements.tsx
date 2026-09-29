/**
 * ความสำเร็จ: the recording streak (last 14 days) and the badge collection.
 * Rules: src/domain/achievements.ts. Opened from the flame on the home screen.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BUDDY_NAME } from '../domain/buddy';
import { useAchievements } from '../services/useAchievements';
import { BuddySays } from '../ui/Buddy';
import { IconButton, Ionicons, Row, T } from '../ui/components';
import { Aurora, PulseRing, Reveal, Sparkles } from '../ui/effects';
import { Medal } from '../ui/Medal';
import { useCountUp, useReduceMotion } from '../ui/motion';
import { goBack } from '../ui/nav';
import { radius, space, useTheme } from '../ui/theme';

const WEEKDAY = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export default function Achievements() {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const { streak, badges, fresh, markSeen } = useAchievements();
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
        <View style={{ width: 42 }} />
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
                      backgroundColor: 'rgba(226,182,74,0.14)',
                      borderWidth: 2,
                      borderColor: streak.today ? theme.heroAccent : 'rgba(244,241,230,0.35)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="flame" size={38} color={streak.today ? '#F29E4C' : 'rgba(244,241,230,0.55)'} />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <T v="small" color={theme.heroInkSoft}>จดต่อเนื่อง</T>
                  <T v="h1" color={theme.heroAccent}>
                    {shown} <T v="body" color="#F4F1E6">วัน</T>
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
                          borderColor: d.active ? theme.heroAccent : isToday ? '#F4F1E6' : 'rgba(244,241,230,0.3)',
                        }}
                      />
                      <T v="micro" color={isToday ? '#F4F1E6' : 'rgba(244,241,230,0.55)'}>
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
                  <T v="micro" center color={theme.inkFaint} numberOfLines={2}>
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
