/**
 * Home (MindPay ใหม่): three parts only, so it never feels crowded.
 * 1. The money card (FR-6 + FR-2): how many days the money lasts, compared with
 *    the end of the month (days left over to keep, or days short), the balance,
 *    today's spending, and "ดึงสลิปวันนี้" (FR-4). Tap it for Money Runway.
 * 2. งบเดือนนี้: this month's spending against the monthly budget.
 * 3. รายการล่าสุด: the last five transactions.
 * Cards that need an action (slips waiting, a new medal, a scan running) show
 * above them only while they matter. The breakdowns live in the สถิติ tab.
 */
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Animated, Pressable, RefreshControl, View } from 'react-native';
import { useApp, useMoney } from '../../data/AppProvider';
import { spentOnDay } from '../../domain/buddy';
import { formatThaiDay } from '../../domain/dates';
import { halloweenOn } from '../../domain/halloween';
import { formatBaht } from '../../domain/money';
import { endOfMonthDay, monthEndCheck, safeDailySpend, type MonthEndCheck, type Runway } from '../../domain/runway';
import { skinById } from '../../domain/skins';
import { monthExpense } from '../../domain/summary';
import { useAutoScan } from '../../services/AutoScanProvider';
import { useKla } from '../../services/kla';
import { useAchievements } from '../../services/useAchievements';
import { markWhatsNewSeen, useWhatsNewPending } from '../../services/whatsNew';
import { ContourLines } from '../../ui/art';
import { AutoScanBanner } from '../../ui/AutoScanBanner';
import { Buddy } from '../../ui/Buddy';
import { Badge, Button, Card, Divider, EmptyState, IconButton, Ionicons, Money, ProgressBar, Row, Screen, T } from '../../ui/components';
import { Aurora, Reveal, useCelebrate, usePressSpring } from '../../ui/effects';
import { HalloweenBunting, HalloweenCard, HalloweenInvite, SpookyHeroDecor, useHalloween } from '../../ui/halloween';
import { KlaPicture } from '../../ui/kla/KlaPicture';
import { Medal } from '../../ui/Medal';
import { useCountUp, useReduceMotion } from '../../ui/motion';
import { SectionHead } from '../../ui/SectionHead';
import { TxRow } from '../../ui/TxRow';
import { alpha, fonts, radius, space, useTheme } from '../../ui/theme';

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

/** What the money card says about the month end. */
function monthEndBadge(m: MonthEndCheck): { label: string; tone: 'good' | 'watch' | 'critical' | 'neutral' } {
  switch (m.kind) {
    case 'surplus':
      return { label: `✓ เหลือเก็บได้อีก${m.capped ? 'มากกว่า' : ''} ${m.days} วัน`, tone: 'good' };
    case 'exact':
      return { label: 'พอดีถึงสิ้นเดือน', tone: 'watch' };
    case 'short':
      return { label: `! ขาดอีก ${m.days} วันถึงสิ้นเดือน`, tone: 'critical' };
    case 'below':
      return { label: '! แตะเส้นเงินสำรองแล้ว', tone: 'critical' };
    default:
      return { label: 'ยังไม่มีรายจ่าย 7 วัน', tone: 'neutral' };
  }
}

function MoneyCard({ runway, balance, spentToday, safeToday }: { runway: Runway; balance: number; spentToday: number; safeToday: number }) {
  const theme = useTheme();
  const { today } = useApp();
  const auto = useAutoScan();
  const halloween = useHalloween();
  const reduce = useReduceMotion();
  const press = usePressSpring(0.985);
  const check = monthEndCheck(runway);
  const badge = monthEndBadge(check);
  const daysShown = useCountUp(runway.days ?? 0, !reduce && runway.days !== null && !runway.capped, 900);
  const scanning = auto.state.phase === 'scanning';

  function pullToday() {
    Haptics.selectionAsync().catch(() => {});
    // Phone app: read today's slips in the gallery now. Web and demo: pick slips by hand.
    if (auto.available) auto.grantAndRun().catch(() => {});
    else router.push('/scan');
  }

  const stat = (label: string, satang: number) => (
    <View style={{ flex: 1, gap: 2 }}>
      <T v="micro" color={theme.heroInkSoft} numberOfLines={1}>
        {label}
      </T>
      <Money satang={satang} size="body" decimals={false} color={theme.heroInk} style={{ fontFamily: fonts.sansSemi }} />
    </View>
  );

  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPress={() => router.push('/runway')}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`เงินพอใช้อีก ${runway.days ?? '-'} วัน ${badge.label} ยอดคงเหลือ ${formatBaht(balance)} แตะเพื่อดูรายละเอียด`}
        style={{
          borderRadius: radius.xl,
          overflow: 'hidden',
          shadowColor: theme.heroDeep,
          shadowOpacity: theme.dark ? 0 : 0.25,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        }}
      >
        <LinearGradient
          colors={[theme.heroTop, theme.hero, theme.heroDeep]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: space.xl, gap: space.sm }}
        >
          <Aurora />
          <ContourLines width={420} height={260} color={theme.heroAccent} />
          {halloween ? <SpookyHeroDecor /> : null}
          <Row justify="space-between" align="flex-start">
            <View style={{ gap: 2, flex: 1 }}>
              <T v="label" color={theme.heroAccent}>{formatThaiDay(today)}</T>
              <Row gap={4}>
                <T v="body" color={theme.heroInk}>เงินพอใช้อีก</T>
                <Ionicons name="chevron-forward" size={16} color={theme.heroInkSoft} />
              </Row>
            </View>
            <Button label={scanning ? 'กำลังดึงสลิป…' : 'ดึงสลิปวันนี้'} small kind="onDark" icon="images-outline" onPress={pullToday} disabled={scanning} />
          </Row>

          {runway.status === 'below_floor' ? (
            <T v="h1" color={theme.heroInk}>แตะเส้นเงินสำรองแล้ว</T>
          ) : runway.days === null ? (
            <T v="h1" color={theme.heroInk}>ยังคำนวณไม่ได้</T>
          ) : (
            <T v="display" color={theme.heroAccent} style={{ lineHeight: 64 }}>
              {runway.capped ? '365+' : daysShown}
              <T v="h3" color={theme.heroInk}>
                {'  วัน · ถึง '}
                {formatThaiDay(runway.depletionDay!, { year: false })}
              </T>
            </T>
          )}
          <T v="small" color={theme.heroInkSoft}>
            {check.daysToMonthEnd > 0 ? `อีก ${check.daysToMonthEnd} วันถึงสิ้นเดือน (${formatThaiDay(endOfMonthDay(), { year: false })})` : 'วันนี้วันสุดท้ายของเดือน'}
          </T>
          <Badge label={badge.label} tone={badge.tone} onDark />

          <View style={{ height: 1, backgroundColor: alpha(theme.heroInk, 0.15), marginTop: space.sm }} />
          <Row gap={space.md} align="flex-start">
            {stat('ยอดคงเหลือ', balance)}
            {stat('วันนี้ใช้ไป', spentToday)}
            {stat('ใช้ได้วันละ', safeToday)}
          </Row>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

export default function Home() {
  const theme = useTheme();
  const { profile, txs, repo, refresh, refreshing, loadError, today } = useApp();
  const { balance, runway, drafts } = useMoney();
  const recent = useMemo(
    () => [...txs].filter((t) => t.status === 'confirmed').sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 5),
    [txs],
  );
  // `today` changes at 00:00 Bangkok time, so "วันนี้" and "เดือนนี้" start over.
  const spentToday = useMemo(() => spentOnDay(txs, today), [txs, today]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const spentMonth = useMemo(() => monthExpense(txs), [txs, today]);
  const safeToday = safeDailySpend({ balanceSatang: balance, floorSatang: runway.floorSatang, targetDay: endOfMonthDay() });
  const readyDrafts = drafts.filter((d) => d.reviewFlags.length === 0).length;
  const budget = profile?.monthlyBudgetSatang ?? null;
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

  const used = budget ? spentMonth / budget : 0;
  const budgetColor = used > 1 ? theme.critical : used >= 0.85 ? theme.watch : theme.primary;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}>
      {halloween ? <HalloweenBunting /> : null}
      <Row justify="space-between" style={{ paddingTop: halloween ? 0 : space.sm, marginTop: halloween ? -space.md : 0 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="label" numberOfLines={1}>
            สวัสดี {profile?.displayName || ''}
          </T>
          <T v="h1">หน้าหลัก</T>
        </View>
        <Row gap={space.xs}>
          <StreakPill days={ach.streak.days} today={ach.streak.today} />
          <IconButton icon="settings-outline" label="ตั้งค่า" onPress={() => router.push('/settings')} />
        </Row>
      </Row>

      {/* Only while they matter */}
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

      {whatsNew && txs.length > 0 ? (
        <Card style={{ paddingVertical: space.xs }}>
          <Row gap={space.sm}>
            <Ionicons name="gift" size={20} color={theme.accentInk} />
            <Pressable onPress={() => router.push('/whatsnew')} accessibilityRole="button" accessibilityLabel="ดูมีอะไรใหม่" style={{ flex: 1, paddingVertical: space.sm }}>
              <T v="small" color={theme.ink}>
                มีอะไรใหม่ในอัปเดตนี้ <T v="small" color={theme.primary} style={{ fontFamily: fonts.sansSemi }}>ดู →</T>
              </T>
            </Pressable>
            <IconButton icon="close" label="ไม่ต้องแสดงอีก" onPress={() => markWhatsNewSeen()} />
          </Row>
        </Card>
      ) : null}

      {/* ฮาโลวีน: catch ghosts in the Halloween theme; other themes get an invitation (closable). */}
      {halloweenOn(today) ? <Reveal zoom>{halloween ? <HalloweenCard /> : <HalloweenInvite />}</Reveal> : null}

      {repo?.mode === 'demo' ? (
        <Row gap={space.sm} style={{ marginTop: -space.sm }}>
          <Ionicons name="flask-outline" size={16} color={theme.inkSoft} />
          <T v="micro" style={{ flex: 1 }}>
            โหมดทดลอง ข้อมูลตัวอย่างอยู่ในเครื่องนี้ ลองแก้หรือลบได้ตามสบาย
          </T>
        </Row>
      ) : null}

      {loadError ? (
        <Card tone="alt">
          <T v="body" color={theme.critical}>โหลดข้อมูลล่าสุดไม่สำเร็จ ({loadError})</T>
          <Button label="ลองอีกครั้ง" kind="soft" small onPress={refresh} icon="refresh" />
        </Card>
      ) : null}

      <AutoScanBanner />

      {drafts.length > 0 ? (
        <Card onPress={() => router.push('/drafts')} style={{ borderColor: theme.accent, borderWidth: 1.5, paddingVertical: space.md }}>
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

      {/* 1. The money card */}
      <Reveal index={1} zoom>
        <MoneyCard runway={runway} balance={balance} spentToday={spentToday} safeToday={safeToday} />
      </Reveal>

      {/* 2. This month's budget */}
      <Reveal index={2}>
        <View style={{ gap: space.md }}>
          <SectionHead kicker="BUDGET" title="งบเดือนนี้" />
          {budget ? (
            <Card onPress={() => router.push('/settings')}>
              <Row justify="space-between">
                <T v="small">ใช้ไปแล้ว</T>
                <Badge label={`${Math.round(used * 100)}%`} tone={used > 1 ? 'critical' : used >= 0.85 ? 'watch' : 'good'} />
              </Row>
              <Row gap={6} align="flex-end">
                <Money satang={spentMonth} size="h1" />
                <T v="body" color={theme.inkSoft} style={{ marginBottom: 6 }}>
                  / {formatBaht(budget)}
                </T>
              </Row>
              <ProgressBar value={Math.min(1, used)} color={budgetColor} />
              <Row justify="space-between">
                <T v="small">ใช้ไป {Math.round(used * 100)}%</T>
                {spentMonth > budget ? (
                  <T v="small" color={theme.critical} style={{ fontFamily: fonts.sansSemi }}>
                    เกินงบ {formatBaht(spentMonth - budget)}
                  </T>
                ) : (
                  <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>
                    เหลือ {formatBaht(budget - spentMonth)}
                  </T>
                )}
              </Row>
            </Card>
          ) : (
            <Card>
              <Row justify="space-between">
                <View style={{ gap: 2 }}>
                  <T v="small">เดือนนี้ใช้ไปแล้ว</T>
                  <Money satang={spentMonth} size="h2" />
                </View>
                <Button label="ตั้งงบรายเดือน" small kind="soft" icon="wallet-outline" onPress={() => router.push('/settings')} />
              </Row>
            </Card>
          )}
        </View>
      </Reveal>

      {/* 3. Latest transactions */}
      <Reveal index={3}>
        <View style={{ gap: space.md }}>
          <SectionHead kicker="ACTIVITY" title="รายการล่าสุด" action="ดูทั้งหมด" onAction={() => router.navigate('/transactions')} />
          <Card style={{ paddingVertical: space.xs, gap: 0 }}>
            {recent.length === 0 ? (
              <EmptyState
                icon="wallet-outline"
                art={<Buddy mood="sleepy" size={84} />}
                title="ยังไม่มีรายการ"
                body="กดปุ่ม + ด้านล่าง เพื่อเลือกสลิป พูด หรือจดรายการแรก"
                action="เพิ่มรายการแรก"
                onAction={() => router.push('/add')}
              />
            ) : (
              recent.map((t, i) => (
                <View key={t.id}>
                  {i > 0 ? <Divider /> : null}
                  <TxRow tx={t} />
                </View>
              ))
            )}
          </Card>
        </View>
      </Reveal>
    </Screen>
  );
}
