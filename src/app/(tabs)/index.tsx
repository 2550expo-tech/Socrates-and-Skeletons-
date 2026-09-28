/**
 * Home (FR-2 Overview Dashboard + FR-6 at a glance).
 * Order of information: how much I have -> how long it lasts -> what to do today
 * -> where the money went.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Animated, RefreshControl, View } from 'react-native';
import { useApp, useMoney } from '../../data/AppProvider';
import { buddyLine, spentOnDay } from '../../domain/buddy';
import { addDays, formatRangeSpan, formatThaiDay, formatThaiDayLong, RANGE_LABEL, RANGE_ORDER } from '../../domain/dates';
import { formatBaht } from '../../domain/money';
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
import { AutoScanBanner } from '../../ui/AutoScanBanner';
import { Buddy, BuddySays } from '../../ui/Buddy';
import { Aurora, Reveal, Shine, Sparkles } from '../../ui/effects';
import { useCountUp, useReduceMotion } from '../../ui/motion';
import { TxRow } from '../../ui/TxRow';
import { palette, radius, space, useTheme } from '../../ui/theme';

const RUNWAY_BADGE = {
  healthy: { label: 'สบาย ๆ', tone: 'good' },
  watch: { label: 'เริ่มต้องระวัง', tone: 'watch' },
  critical: { label: 'ใกล้เส้นสำรอง', tone: 'critical' },
  below_floor: { label: 'ต่ำกว่าเงินสำรอง', tone: 'critical' },
  no_spending: { label: 'ยังไม่มีรายจ่าย 7 วัน', tone: 'neutral' },
} as const;

export default function Home() {
  const theme = useTheme();
  const { profile, txs, repo, refresh, refreshing, loadError, today, newDay } = useApp();
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
  // Parallax: while scrolling, the hero card eases back and the tree drifts up a little.
  const [scrollY] = useState(() => new Animated.Value(0));
  const heroScale = reduce ? 1 : scrollY.interpolate({ inputRange: [-120, 0, 260], outputRange: [1.05, 1, 0.95], extrapolate: 'clamp' });
  const treeLift = reduce ? 0 : scrollY.interpolate({ inputRange: [-120, 0, 260], outputRange: [10, 0, -22], extrapolate: 'clamp' });
  const daysShown = useCountUp(runway.days ?? 0, !reduce && runway.days !== null && !runway.capped, 900);
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
      <Row justify="space-between" style={{ paddingTop: space.sm }}>
        <View style={{ flex: 1 }}>
          <T v="small">{formatThaiDayLong(today)}</T>
          <T v="h2">สวัสดี {profile?.displayName || ''}</T>
        </View>
        <IconButton icon="settings-outline" label="ตั้งค่า" onPress={() => router.push('/settings')} />
      </Row>

      <Reveal>
        <BuddySays mood={buddy.mood}>{buddy.text}</BuddySays>
      </Reveal>

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
            shadowColor: palette.forestDeep,
            shadowOpacity: theme.dark ? 0 : 0.28,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
            elevation: 8,
          }}
          accessible
          accessibilityLabel={`ยอดคงเหลือ ${formatBaht(balance)} ${runway.days !== null ? `เงินพอใช้อีก ${runway.days} วัน` : ''}`}
        >
          <LinearGradient
            colors={[theme.dark ? '#124232' : '#135A40', palette.forest, palette.forestDeep]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: space.xl, gap: space.md }}
          >
            <Aurora />
            <ContourLines width={420} height={260} color={palette.goldBright} />
            <Sparkles trigger={balance} count={9} area={{ top: 4, bottom: 55 }} />
            <Shine trigger={balance} />
            <Row align="flex-start" justify="space-between">
              <View style={{ flex: 1, gap: 2 }}>
                <T v="label" color="#B9CEC2">ยอดคงเหลือ</T>
                <Money satang={balance} size="display" color="#F4F1E6" countUp />
                <View style={{ marginTop: space.sm }}>
                  <Badge label={badge.label} tone={badge.tone} onDark />
                </View>
              </View>
              <Animated.View style={{ transform: [{ translateY: treeLift }] }}>
                <MoneyTree
                  health={treeHealth(runway.status, runway.days)}
                  size={104}
                  trunk="#E8E1CC"
                  leaf={palette.goldBright}
                  bare="#6F9483"
                  glow={palette.goldBright}
                  grow
                  sway
                />
              </Animated.View>
            </Row>
            <View style={{ height: 1, backgroundColor: 'rgba(244,241,230,0.15)' }} />
            <Row justify="space-between" align="flex-end">
              <View style={{ flex: 1 }}>
                <T v="small" color="#B9CEC2">เงินพอใช้อีก</T>
                {runway.days !== null && runway.status !== 'below_floor' ? (
                  <T v="h1" color={palette.goldBright}>
                    {runway.capped ? '365+ ' : `${daysShown} `}
                    <T v="body" color="#F4F1E6">วัน · ถึง {formatThaiDay(runway.depletionDay!, { year: false })}</T>
                  </T>
                ) : runway.status === 'below_floor' ? (
                  <T v="h3" color="#F4F1E6">แตะเส้นเงินสำรองแล้ว</T>
                ) : (
                  <T v="h3" color="#F4F1E6">ยังคำนวณไม่ได้</T>
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
          <Ionicons name="sunny-outline" size={22} color={theme.dark ? theme.accent : '#7A5A0E'} />
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
            <Ionicons name="receipt-outline" size={22} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <T v="h3">สลิปรอยืนยัน {drafts.length} รายการ</T>
              <T v="small">พร้อมยืนยัน {readyDrafts} · ต้องตรวจ {drafts.length - readyDrafts} · ยังไม่รวมในยอดเงิน</T>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.inkFaint} />
          </Row>
        </Card>
      ) : null}

      <Reveal index={3}>
        <Row gap={space.sm}>
          <Button label="สแกนสลิป" icon="scan-outline" shine onPress={() => router.push('/scan')} style={{ flex: 1 }} />
          <Button label="จดรายการ" icon="add" kind="soft" onPress={() => router.push('/transaction')} style={{ flex: 1 }} />
        </Row>
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
