/**
 * Home (FR-2 Overview Dashboard + FR-6 at a glance).
 * Order of information: how much I have -> how long it lasts -> what to do today
 * -> where the money went.
 */
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, RefreshControl, View } from 'react-native';
import { useApp, useMoney } from '../../data/AppProvider';
import { buddyLine, buddyPoke, spentOnDay, treeLine, type BuddyLine } from '../../domain/buddy';
import { addDays, formatRangeSpan, formatThaiDay, formatThaiDayLong, formatThaiMonth, RANGE_LABEL, RANGE_ORDER } from '../../domain/dates';
import { formatBaht } from '../../domain/money';
import { goalLine, goalProgress } from '../../domain/goals';
import { recapToOffer } from '../../domain/recap';
import { skinById } from '../../domain/skins';
import { HALLOWEEN_LINES, halloweenOn } from '../../domain/halloween';
import { HalloweenBunting, HalloweenCard, HalloweenInvite, SpookyHeroDecor, useHalloween } from '../../ui/halloween';
import { endOfMonthDay, safeDailySpend } from '../../domain/runway';
import { dailyTotals, monthExpense, summarizeRange } from '../../domain/summary';
import type { RangeKey } from '../../domain/types';
import { ContourLines, MoneyTree, treeHealth } from '../../ui/art';
import { CategoryBars, DayBars } from '../../ui/charts';
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  IconButton,
  Ionicons,
  Money,
  ProgressBar,
  Row,
  Screen,
  SectionTitle,
  Segmented,
  T,
} from '../../ui/components';
import { useKla } from '../../services/kla';
import { useAchievements } from '../../services/useAchievements';
import { markWhatsNewSeen, useWhatsNewPending } from '../../services/whatsNew';
import { AutoScanBanner } from '../../ui/AutoScanBanner';
import { Buddy, BuddySays } from '../../ui/Buddy';
import { Aurora, PulseRing, Reveal, Shine, Sparkles, useCelebrate, usePressSpring } from '../../ui/effects';
import { Jar } from '../../ui/Jar';
import { KlaPicture } from '../../ui/kla/KlaPicture';
import { Medal } from '../../ui/Medal';
import { useCountUp, useReduceMotion } from '../../ui/motion';
import { TxRow } from '../../ui/TxRow';
import { alpha, fonts, radius, readableOn, space, useTheme } from '../../ui/theme';

const RUNWAY_BADGE = {
  healthy: { label: 'สบาย ๆ', tone: 'good' },
  watch: { label: 'เริ่มต้องระวัง', tone: 'watch' },
  critical: { label: 'ใกล้เส้นสำรอง', tone: 'critical' },
  below_floor: { label: 'ต่ำกว่าเงินสำรอง', tone: 'critical' },
  no_spending: { label: 'ยังไม่มีรายจ่าย 7 วัน', tone: 'neutral' },
} as const;

type TileTone = 'primary' | 'gold' | 'plain' | 'income';

/**
 * One of the four quick actions on home: scan slips, speak, write an expense,
 * add money in (money that arrives without a slip has to be added by hand).
 */
function ActionTile({
  icon,
  label,
  sub,
  tone,
  onPress,
  pulse,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  tone: TileTone;
  onPress: () => void;
  pulse?: boolean;
}) {
  const theme = useTheme();
  const press = usePressSpring(0.95);
  // Every colour from the theme; sub-text at full strength so it reads on the fill (AA) in every theme.
  const look = {
    primary: { bg: theme.primary, border: theme.primary, ink: theme.onPrimary, soft: theme.onPrimary, dot: alpha(theme.onPrimary, 0.16), icon: theme.onPrimary },
    gold: { bg: theme.accent, border: theme.accent, ink: theme.onAccent, soft: theme.onAccent, dot: alpha(theme.onAccent, 0.12), icon: theme.onAccent },
    plain: { bg: theme.surface, border: theme.line, ink: theme.ink, soft: theme.inkSoft, dot: theme.surfaceAlt, icon: theme.ink },
    income: {
      bg: alpha(theme.income, theme.dark ? 0.12 : 0.1),
      border: alpha(theme.income, 0.35),
      ink: theme.ink,
      soft: theme.inkSoft,
      dot: theme.income,
      icon: readableOn(theme.income, '#FFFFFF', theme.bg),
    },
  }[tone];
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: press.scale }] }}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          padding: space.md,
          minHeight: 70,
          borderRadius: radius.lg,
          backgroundColor: look.bg,
          borderWidth: 1,
          borderColor: look.border,
          overflow: 'hidden',
        }}
      >
        {tone === 'primary' ? <Shine times={1} delay={900} color="rgba(255,255,255,0.25)" /> : null}
        <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          {pulse ? <PulseRing size={40} times={2} color={tone === 'gold' ? '#FFF4D6' : theme.accent} /> : null}
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: look.dot, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon} size={21} color={look.icon} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <T v="body" color={look.ink} style={{ fontFamily: fonts.sansSemi }} numberOfLines={1}>
            {label}
          </T>
          <T v="micro" color={look.soft} numberOfLines={1}>
            {sub}
          </T>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Badges already celebrated in this session (the home screen can mount again). */
const celebrated = new Set<string>();

/** The recording streak: a flame and the number of days; opens the achievements. */
function StreakPill({ days, today }: { days: number; today: boolean }) {
  const theme = useTheme();
  const press = usePressSpring(0.92);
  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPress={() => router.push('/achievements')}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`จดต่อเนื่อง ${days} วัน ดูความสำเร็จ`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 12,
          height: 36,
          borderRadius: 18,
          backgroundColor: theme.dark ? alpha(theme.accent, 0.14) : theme.accentSoft,
          borderWidth: 1,
          borderColor: today ? theme.accent : 'transparent',
        }}
      >
        <Ionicons name="flame" size={18} color={today ? '#E07B2E' : theme.inkFaint} />
        <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>
          {days}
        </T>
      </Pressable>
    </Animated.View>
  );
}

export default function Home() {
  const theme = useTheme();
  const { profile, txs, goals, repo, refresh, refreshing, loadError, today, newDay } = useApp();
  const { balance, runway, average, drafts } = useMoney();
  const [range, setRange] = useState<RangeKey>('1m');

  // `today` changes at 00:00 Bangkok time, so every "วันนี้" number starts over.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => summarizeRange(txs, range), [txs, range, today]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const week = useMemo(() => dailyTotals(txs, 7), [txs, today]);
  const recent = useMemo(
    () => [...txs].filter((t) => t.status === 'confirmed').sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 5),
    [txs],
  );
  const safeToday = safeDailySpend({ balanceSatang: balance, floorSatang: runway.floorSatang, targetDay: endOfMonthDay() });
  const spentMonth = monthExpense(txs);
  const readyDrafts = drafts.filter((d) => d.reviewFlags.length === 0).length;
  const badge = RUNWAY_BADGE[runway.status];
  const reduce = useReduceMotion();
  const recapMonth = useMemo(() => recapToOffer(txs, today), [txs, today]);
  const ach = useAchievements();
  const kla = useKla();
  const halloween = useHalloween();
  const whatsNew = useWhatsNewPending();
  const celebrate = useCelebrate();
  const freshIds = [...ach.fresh.map((b) => b.id), ...kla.fresh.map((id) => `skin:${id}`)].join(',');
  useEffect(() => {
    const ids = freshIds ? freshIds.split(',') : [];
    if (!ids.some((id) => !celebrated.has(id))) return;
    ids.forEach((id) => celebrated.add(id));
    celebrate();
  }, [freshIds, celebrate]);
  // Parallax: while scrolling, the hero card eases back and the tree drifts up a little.
  const [scrollY] = useState(() => new Animated.Value(0));
  const heroScale = reduce ? 1 : scrollY.interpolate({ inputRange: [-120, 0, 260], outputRange: [1.05, 1, 0.95], extrapolate: 'clamp' });
  const treeLift = reduce ? 0 : scrollY.interpolate({ inputRange: [-120, 0, 260], outputRange: [10, 0, -22], extrapolate: 'clamp' });
  const daysShown = useCountUp(runway.days ?? 0, !reduce && runway.days !== null && !runway.capped, 900);
  // Tapping the companion or the tree: it answers for a few seconds, then goes back to its line.
  const [said, setSaid] = useState<BuddyLine | null>(null);
  const [hop, setHop] = useState(0);
  const [treeTaps, setTreeTaps] = useState(0);
  const pokes = useRef(0);
  useEffect(() => {
    if (!said) return;
    const t = setTimeout(() => setSaid(null), 6000);
    return () => clearTimeout(t);
  }, [said]);
  function pokeBuddy() {
    pokes.current += 1;
    setHop((h) => h + 1);
    // Halloween theme: every other tap is a spooky-cute line.
    const n = pokes.current;
    setSaid(halloween && n % 2 === 1 ? { mood: 'cheer', text: HALLOWEEN_LINES[((n - 1) / 2) % HALLOWEEN_LINES.length] } : buddyPoke(n, runway.status));
  }
  function tapTree() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTreeTaps((n) => n + 1);
    setHop((h) => h + 1);
    setSaid(treeLine({ status: runway.status, days: runway.days, capped: runway.capped }));
  }
  const buddy = buddyLine({
    status: runway.status,
    days: runway.days,
    capped: runway.capped,
    safeTodaySatang: safeToday,
    spentTodaySatang: spentOnDay(txs, today),
    draftsToReview: drafts.length - readyDrafts,
    hasAnyTransaction: txs.length > 0,
    newDay: newDay ? { yesterdaySpentSatang: spentOnDay(txs, addDays(today, -1)) } : null,
  });

  return (
    <Screen scrollY={scrollY} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}>
      {halloween ? <HalloweenBunting /> : null}
      <Row justify="space-between" style={{ paddingTop: halloween ? 0 : space.sm, marginTop: halloween ? -space.md : 0 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="label">{formatThaiDayLong(today)}</T>
          <T v="h1" numberOfLines={1}>
            สวัสดี {profile?.displayName || ''}
          </T>
        </View>
        <Row gap={space.xs}>
          <StreakPill days={ach.streak.days} today={ach.streak.today} />
          <IconButton icon="settings-outline" label="ตั้งค่า" onPress={() => router.push('/settings')} />
        </Row>
      </Row>

      <Reveal>
        <BuddySays mood={(said ?? buddy).mood} onPress={pokeBuddy} hop={hop}>
          {(said ?? buddy).text}
        </BuddySays>
      </Reveal>

      {whatsNew && txs.length > 0 ? (
        <Reveal zoom>
          <Card onPress={() => router.push('/whatsnew')} style={{ paddingVertical: space.md, borderColor: theme.accent, borderWidth: 1.5 }}>
            <Row gap={space.md}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="gift" size={22} color={theme.accentInk} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="h3">มีอะไรใหม่ในอัปเดตนี้</T>
                <T v="small">ธีมฮาโลวีน 👻, โค้ชน้องกล้าพูดได้, ตู้สกิน, ภารกิจการเงิน, ธีมสี และอีกเพียบ</T>
              </View>
              <IconButton icon="close" label="ไม่ต้องแสดงอีก" onPress={() => markWhatsNewSeen()} />
            </Row>
          </Card>
        </Reveal>
      ) : null}

      {ach.fresh.length > 0 ? (
        <Reveal zoom>
          <Card style={{ borderColor: theme.accent, borderWidth: 1.5, paddingVertical: space.md }}>
            <Row gap={space.md}>
              <Medal badge={ach.fresh[0]} size={52} shine />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="h3">{ach.fresh.length > 1 ? `ได้เหรียญใหม่ ${ach.fresh.length} เหรียญ!` : 'ได้เหรียญใหม่!'}</T>
                <T v="small">{ach.fresh.map((b) => b.title).join(' · ')}</T>
                <Row gap={space.sm} style={{ marginTop: space.xs }}>
                  <Button label="ดูเหรียญ" small kind="gold" icon="ribbon" onPress={() => router.push('/achievements')} />
                  <Button label="ไว้ทีหลัง" small kind="ghost" onPress={() => ach.markSeen(ach.fresh.map((b) => b.id))} />
                </Row>
              </View>
            </Row>
          </Card>
        </Reveal>
      ) : null}

      {kla.fresh.length > 0 ? (
        <Reveal zoom>
          <Card style={{ borderColor: theme.accent, borderWidth: 1.5, paddingVertical: space.md }}>
            <Row gap={space.md}>
              <View style={{ width: 60, height: 60 }}>
                <View style={{ position: 'absolute', top: -12 }}>
                  <KlaPicture skin={kla.fresh[0]} mood="cheer" width={60} onDark={theme.dark} extras={false} />
                </View>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="h3">{kla.fresh.length > 1 ? `น้องกล้าได้ชุดใหม่ ${kla.fresh.length} ชุด!` : 'น้องกล้าได้ชุดใหม่!'}</T>
                <T v="small">
                  {kla.fresh
                    .map((id) => {
                      const s = skinById(id);
                      return s.kind === 'limited' ? `${s.name} (สกินลิมิเต็ด)` : s.name;
                    })
                    .join(' · ')}
                </T>
                <Row gap={space.sm} style={{ marginTop: space.xs }}>
                  <Button
                    label="ใส่เลย"
                    small
                    kind="gold"
                    icon="shirt"
                    onPress={() => {
                      kla.equip(kla.fresh[0]);
                      kla.markSeen(kla.fresh);
                      setHop((h) => h + 1);
                      celebrate();
                    }}
                  />
                  <Button label="ดูตู้สกิน" small kind="ghost" onPress={() => router.push({ pathname: '/skins', params: { skin: kla.fresh[0] } })} />
                </Row>
              </View>
            </Row>
          </Card>
        </Reveal>
      ) : null}

      {/* ฮาโลวีน: catch ghosts in the Halloween theme; other themes get an invitation. */}
      {halloweenOn(today) ? <Reveal zoom>{halloween ? <HalloweenCard /> : <HalloweenInvite />}</Reveal> : null}

      {repo?.mode === 'demo' ? (
        <Card tone="alt" style={{ paddingVertical: space.md }}>
          <Row gap={space.sm}>
            <Ionicons name="flask-outline" size={18} color={theme.inkSoft} />
            <T v="small" style={{ flex: 1 }}>โหมดทดลอง ข้อมูลตัวอย่างอยู่ในเครื่องนี้ ลองแก้หรือลบได้ตามสบายเลย</T>
          </Row>
        </Card>
      ) : null}

      {loadError ? (
        <Card tone="alt">
          <T v="body" color={theme.critical}>โหลดข้อมูลล่าสุดไม่สำเร็จ ({loadError})</T>
          <Button label="ลองอีกครั้ง" kind="soft" small onPress={refresh} icon="refresh" />
        </Card>
      ) : null}

      <AutoScanBanner />

      {/* Hero: balance + runway (the one place gold is used for the number that matters) */}
      <Reveal index={1} zoom>
        <Animated.View style={{ transform: [{ scale: heroScale }] }}>
        <View
          style={{
            borderRadius: radius.xl,
            overflow: 'hidden',
            shadowColor: theme.heroDeep,
            shadowOpacity: theme.dark ? 0 : 0.28,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
            elevation: 8,
          }}
          accessible
          accessibilityLabel={`ยอดคงเหลือ ${formatBaht(balance)} ${runway.days !== null ? `เงินพอใช้อีก ${runway.days} วัน` : ''}`}
        >
          <LinearGradient
            colors={[theme.heroTop, theme.hero, theme.heroDeep]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: space.xl, gap: space.md }}
          >
            <Aurora />
            <ContourLines width={420} height={260} color={theme.heroAccent} />
            <Sparkles trigger={balance} count={9} area={{ top: 4, bottom: 55 }} />
            <Shine trigger={balance} />
            {halloween ? <SpookyHeroDecor /> : null}
            <Row align="flex-start" justify="space-between">
              <View style={{ flex: 1, gap: 2 }}>
                <T v="label" color={theme.heroInkSoft}>ยอดคงเหลือ</T>
                <Money satang={balance} size="display" color={theme.heroInk} countUp />
                <View style={{ marginTop: space.sm }}>
                  <Badge label={badge.label} tone={badge.tone} onDark />
                </View>
              </View>
              <Animated.View style={{ transform: [{ translateY: treeLift }] }}>
                <Pressable onPress={tapTree} accessibilityRole="button" accessibilityLabel="ต้นไม้เงิน แตะเพื่อดูความหมาย" hitSlop={6}>
                  <MoneyTree
                    health={treeHealth(runway.status, runway.days)}
                    size={104}
                    trunk="#E8E1CC"
                    leaf={theme.heroAccent}
                    bare={theme.heroBare}
                    glow={theme.heroAccent}
                    grow
                    sway
                    wiggle={treeTaps}
                  />
                  {treeTaps > 0 ? <Sparkles trigger={treeTaps} count={7} cycles={1} seed={treeTaps} area={{ top: 0, bottom: 70 }} /> : null}
                </Pressable>
              </Animated.View>
            </Row>
            <View style={{ height: 1, backgroundColor: alpha(theme.heroInk, 0.15) }} />
            <Row justify="space-between" align="flex-end">
              <View style={{ flex: 1 }}>
                <T v="small" color={theme.heroInkSoft}>เงินพอใช้อีก</T>
                {runway.days !== null && runway.status !== 'below_floor' ? (
                  <T v="h1" color={theme.heroAccent}>
                    {runway.capped ? '365+ ' : `${daysShown} `}
                    <T v="body" color={theme.heroInk}>วัน · ถึง {formatThaiDay(runway.depletionDay!, { year: false })}</T>
                  </T>
                ) : runway.status === 'below_floor' ? (
                  <T v="h3" color={theme.heroInk}>แตะเส้นเงินสำรองแล้ว</T>
                ) : (
                  <T v="h3" color={theme.heroInk}>ยังคำนวณไม่ได้</T>
                )}
              </View>
              <Button label="ดูรายละเอียด" small kind="onDark" icon="chevron-forward" onPress={() => router.navigate('/runway')} />
            </Row>
          </LinearGradient>
        </View>
        </Animated.View>
      </Reveal>

      {/* Today */}
      <Reveal index={2}>
      <Card tone="accent" style={{ paddingVertical: space.md }}>
        <Row gap={space.md}>
          <Ionicons name="sunny-outline" size={22} color={theme.accentInk} />
          <View style={{ flex: 1 }}>
            <T v="small" color={theme.ink}>ถ้าอยากให้เงินพอถึงสิ้นเดือน วันนี้ใช้ได้ประมาณ</T>
            <T v="h3">{formatBaht(safeToday, { decimals: false })} / วัน</T>
          </View>
        </Row>
      </Card>
      </Reveal>

      {drafts.length > 0 ? (
        <Card onPress={() => router.push('/drafts')} style={{ borderColor: theme.accent, borderWidth: 1.5 }}>
          <Row gap={space.md}>
            <Ionicons name="receipt-outline" size={22} color={theme.accentInk} />
            <View style={{ flex: 1 }}>
              <T v="h3">สลิปรอยืนยัน {drafts.length} รายการ</T>
              <T v="small">พร้อมยืนยัน {readyDrafts} · ต้องตรวจ {drafts.length - readyDrafts} · ยังไม่รวมในยอดเงิน</T>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.inkFaint} />
          </Row>
        </Card>
      ) : null}

      <Reveal index={3}>
        <View style={{ gap: space.sm }}>
          <Row gap={space.sm} align="stretch">
            <ActionTile icon="scan-outline" label="สแกนสลิป" sub="อ่านจากรูปในเครื่อง" tone="primary" onPress={() => router.push('/scan')} />
            <ActionTile icon="mic" label="จดด้วยเสียง" sub="พูดว่า “ข้าว 50 บาท”" tone="gold" pulse onPress={() => router.push('/voice')} />
          </Row>
          <Row gap={space.sm} align="stretch">
            <ActionTile icon="remove" label="จดรายการ" sub="รายจ่ายเงินสด ฯลฯ" tone="plain" onPress={() => router.push('/transaction')} />
            <ActionTile icon="add" label="เพิ่มเงินเข้า" sub="เงินโอน เงินสด ค่าขนม" tone="income" onPress={() => router.push({ pathname: '/transaction', params: { kind: 'income' } })} />
          </Row>
        </View>
      </Reveal>

      {recapMonth ? (
        <Reveal index={4}>
          <Pressable
            onPress={() => router.push({ pathname: '/recap', params: { month: recapMonth } })}
            accessibilityRole="button"
            accessibilityLabel={`ดูสรุปเดือน${formatThaiMonth(recapMonth)}`}
            style={{ borderRadius: radius.lg, overflow: 'hidden' }}
          >
            <LinearGradient colors={[theme.heroTop, theme.hero, theme.heroDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: space.lg }}>
              <Shine times={1} delay={1400} color="rgba(255,255,255,0.18)" />
              <Row gap={space.md}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: alpha(theme.heroAccent, 0.16), alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="sparkles" size={22} color={theme.heroAccent} />
                </View>
                <View style={{ flex: 1 }}>
                  <T v="h3" color={theme.heroInk}>{`สรุปเดือน${formatThaiMonth(recapMonth)}`}</T>
                  <T v="small" color={theme.heroInkSoft}>เงินไปไหน วันไหนใช้เยอะ และเก่งขึ้นแค่ไหน</T>
                </View>
                <Ionicons name="play-circle" size={30} color={theme.heroAccent} />
              </Row>
            </LinearGradient>
          </Pressable>
        </Reveal>
      ) : null}

      {/* Savings goals: the one closest to its goal, or an invitation to start one */}
      <Reveal index={5}>
        {(() => {
          const open = goals.filter((g) => g.savedSatang < g.targetSatang).sort((a, b) => goalProgress(b) - goalProgress(a));
          const g = open[0] ?? goals[0];
          return (
            <Card onPress={() => router.push(goals.length ? '/goals' : '/goal')} style={{ paddingVertical: space.md }}>
              <Row gap={space.md}>
                {g ? <Jar progress={goalProgress(g)} size={44} /> : <T v="h1">🐷</T>}
                <View style={{ flex: 1 }}>
                  <T v="h3">{g ? `${g.emoji} ${g.title}` : 'ตั้งกระปุกออม'}</T>
                  <T v="small">{g ? goalLine(g, today) : 'อยากได้อะไร ตั้งเป้าแล้วหยอดทีละนิด'}</T>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.inkFaint} />
              </Row>
            </Card>
          );
        })()}
      </Reveal>

      {/* FR-2 overview by range */}
      <SectionTitle title="ภาพรวม" />
      <Segmented<RangeKey> options={RANGE_ORDER.map((k) => ({ key: k, label: RANGE_LABEL[k] }))} value={range} onChange={setRange} />
      <Row justify="space-between" style={{ marginTop: -space.sm }}>
        <Row gap={4}>
          <Ionicons name="time-outline" size={14} color={theme.inkSoft} />
          <T v="micro">{formatRangeSpan(range)}</T>
        </Row>
        <T v="micro" color={summary.netSatang >= 0 ? theme.good : theme.critical}>
          สุทธิ {formatBaht(summary.netSatang, { sign: true, decimals: false })}
        </T>
      </Row>
      <Row gap={space.sm} align="stretch">
        <Card style={{ flex: 1 }}>
          <Row gap={6}>
            <Ionicons name="arrow-down-circle" size={18} color={theme.income} />
            <T v="small">เงินเข้า</T>
          </Row>
          <Money satang={summary.incomeSatang} size="h3" color={theme.income} decimals={false} countUp />
        </Card>
        <Card style={{ flex: 1 }}>
          <Row gap={6}>
            <Ionicons name="arrow-up-circle" size={18} color={theme.inkSoft} />
            <T v="small">เงินออก</T>
          </Row>
          <Money satang={summary.expenseSatang} size="h3" decimals={false} countUp />
        </Card>
      </Row>
      <Card>
        <Row justify="space-between">
          <T v="h3">รายจ่ายตามหมวด</T>
          <T v="small">
            {formatThaiDay(summary.from, { year: false })} – {formatThaiDay(summary.to, { year: false })}
          </T>
        </Row>
        {summary.byCategory.expense.length > 0 ? (
          <CategoryBars items={summary.byCategory.expense} />
        ) : (
          <EmptyState
            icon="pie-chart-outline"
            art={<Buddy mood="calm" size={84} />}
            title="ยังไม่มีรายจ่ายในช่วงนี้"
            body="ลองเลือกช่วงที่ยาวขึ้น หรือสแกนสลิปเพื่อเพิ่มรายการ"
          />
        )}
        {summary.byCategory.income.length > 0 ? (
          <>
            <Divider />
            <T v="h3">รายรับตามหมวด</T>
            <CategoryBars items={summary.byCategory.income} limit={3} />
          </>
        ) : null}
      </Card>

      <Card>
        <Row justify="space-between">
          <T v="h3">รายจ่าย 7 วันล่าสุด</T>
          <T v="small">เฉลี่ย {formatBaht(average.averageSatang, { decimals: false })}/วัน</T>
        </Row>
        <DayBars days={week} averageSatang={average.averageSatang} />
        <T v="micro">เส้นประ = ค่าเฉลี่ยต่อวันที่ใช้คำนวณ Money Runway</T>
      </Card>

      {profile?.monthlyBudgetSatang ? (
        <Card>
          <Row justify="space-between">
            <T v="h3">งบเดือนนี้</T>
            <T v="small">
              {formatBaht(spentMonth, { decimals: false })} / {formatBaht(profile.monthlyBudgetSatang, { decimals: false })}
            </T>
          </Row>
          <ProgressBar
            value={spentMonth / profile.monthlyBudgetSatang}
            color={spentMonth > profile.monthlyBudgetSatang ? theme.critical : spentMonth > profile.monthlyBudgetSatang * 0.85 ? theme.watch : theme.primary}
          />
        </Card>
      ) : null}

      <SectionTitle title="รายการล่าสุด" action="ดูทั้งหมด" onAction={() => router.navigate('/transactions')} />
      <Card style={{ paddingVertical: space.xs, gap: 0 }}>
        {recent.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            art={<Buddy mood="sleepy" size={84} />}
            title="ยังไม่มีรายการ"
            body="เริ่มจากสแกนสลิปในแกลเลอรี หรือจดรายการแรกด้วยตัวเอง"
            action="สแกนสลิป"
            onAction={() => router.push('/scan')}
          />
        ) : (
          recent.map((t, i) => (
            <Reveal key={t.id} index={i} from={10}>
              {i > 0 ? <Divider /> : null}
              <TxRow tx={t} />
            </Reveal>
          ))
        )}
      </Card>
    </Screen>
  );
}
