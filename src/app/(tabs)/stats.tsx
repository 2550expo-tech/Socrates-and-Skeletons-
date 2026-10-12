/**
 * สถิติ (MindPay ใหม่, FR-2): where the money went in a chosen range.
 * Range (วันนี้ / 7 วัน / 1 เดือน / 6 เดือน / 1 ปี) -> total spending, money in and
 * net -> number of items and average per day -> spending by category (donut or
 * bars) -> money in by category -> the last 7 days -> the monthly story and
 * savings jars. Everything counts confirmed items only.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';
import { useApp, useMoney } from '../../data/AppProvider';
import { formatRangeSpan, formatThaiMonth, RANGE_LABEL, RANGE_ORDER } from '../../domain/dates';
import { goalLine, goalProgress } from '../../domain/goals';
import { formatBaht } from '../../domain/money';
import { recapMonths, recapToOffer } from '../../domain/recap';
import { dailyTotals, rangeDailyAverage, summarizeRange } from '../../domain/summary';
import type { RangeKey } from '../../domain/types';
import { Buddy } from '../../ui/Buddy';
import { CategoryBars, CategoryDonut, DayBars } from '../../ui/charts';
import { Card, EmptyState, Ionicons, Money, Row, Screen, Segmented, T, type IconName } from '../../ui/components';
import { Aurora, Reveal } from '../../ui/effects';
import { TitleDecor } from '../../ui/halloween';
import { Jar } from '../../ui/Jar';
import { SectionHead } from '../../ui/SectionHead';
import { alpha, fonts, radius, space, useTheme } from '../../ui/theme';

type View2 = 'donut' | 'bars';

function SmallStat({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <Card style={{ flex: 1, gap: space.sm }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: alpha(theme.primary, theme.dark ? 0.2 : 0.1), alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={theme.primary} />
      </View>
      <T v="small">{label}</T>
      {children}
    </Card>
  );
}

export default function Stats() {
  const theme = useTheme();
  const { txs, goals, refresh, refreshing, today } = useApp();
  const { average } = useMoney();
  const [range, setRange] = useState<RangeKey>('1m');
  const [view, setView] = useState<View2>('donut');
  // `today` changes at 00:00 Bangkok time, so every range moves with it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => summarizeRange(txs, range), [txs, range, today]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const perDay = useMemo(() => rangeDailyAverage(txs, range), [txs, range, today]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const week = useMemo(() => dailyTotals(txs, 7), [txs, today]);
  const recapMonth = useMemo(() => recapToOffer(txs, today) ?? recapMonths(txs)[0] ?? null, [txs, today]);
  const openGoal = [...goals].filter((g) => g.savedSatang < g.targetSatang).sort((a, b) => goalProgress(b) - goalProgress(a))[0] ?? goals[0];

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}>
      <Row justify="space-between" align="flex-end" style={{ paddingTop: space.sm }}>
        <View style={{ gap: 2 }}>
          <T v="label">ภาพรวมเงิน</T>
          <T v="h1">สถิติ</T>
        </View>
        <TitleDecor />
      </Row>

      <Segmented<RangeKey> options={RANGE_ORDER.map((k) => ({ key: k, label: RANGE_LABEL[k] }))} value={range} onChange={setRange} />
      <Row gap={4} style={{ marginTop: -space.sm }}>
        <Ionicons name="time-outline" size={14} color={theme.inkSoft} />
        <T v="micro">{formatRangeSpan(range)}</T>
      </Row>

      {/* Total spending in the range */}
      <Reveal index={0} zoom>
        <View style={{ borderRadius: radius.xl, overflow: 'hidden' }}>
          <LinearGradient colors={[theme.heroTop, theme.hero, theme.heroDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: space.xl, gap: space.sm }}>
            <Aurora seed={4} />
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: alpha(theme.heroAccent, 0.16), alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trending-down" size={22} color={theme.heroAccent} />
            </View>
            <T v="small" color={theme.heroInkSoft} style={{ marginTop: space.md }}>
              ใช้จ่ายรวม
            </T>
            <Money satang={summary.expenseSatang} size="display" color={theme.heroInk} countUp />
            <Row gap={space.lg}>
              <T v="small" color={theme.heroInkSoft}>
                เงินเข้า <T v="small" color={theme.heroInk} style={{ fontFamily: fonts.sansSemi }}>{formatBaht(summary.incomeSatang, { decimals: false })}</T>
              </T>
              <T v="small" color={theme.heroInkSoft}>
                สุทธิ <T v="small" color={theme.heroInk} style={{ fontFamily: fonts.sansSemi }}>{formatBaht(summary.netSatang, { sign: true, decimals: false })}</T>
              </T>
            </Row>
          </LinearGradient>
        </View>
      </Reveal>

      <Reveal index={1}>
        <Row gap={space.md} align="stretch">
          <SmallStat icon="list" label="รายการ">
            <T v="h1" style={{ fontVariant: ['tabular-nums'] }}>{summary.count}</T>
          </SmallStat>
          <SmallStat icon="analytics" label="เฉลี่ยต่อวัน">
            <Money satang={perDay} size="h1" />
          </SmallStat>
        </Row>
      </Reveal>

      {/* Spending by category */}
      <Reveal index={2}>
        <View style={{ gap: space.md }}>
          <SectionHead
            kicker="BREAKDOWN"
            title="ภาพรวมการใช้จ่าย"
            right={
              <View style={{ width: 132 }}>
                <Segmented<View2>
                  options={[
                    { key: 'donut', label: 'วงกลม' },
                    { key: 'bars', label: 'แท่ง' },
                  ]}
                  value={view}
                  onChange={setView}
                />
              </View>
            }
          />
          <Card>
            {summary.byCategory.expense.length === 0 ? (
              <EmptyState icon="pie-chart-outline" art={<Buddy mood="calm" size={84} />} title="ยังไม่มีรายจ่ายในช่วงนี้" body="ลองเลือกช่วงที่ยาวขึ้น หรือกด + เพื่อเพิ่มรายการ" />
            ) : view === 'donut' ? (
              <CategoryDonut items={summary.byCategory.expense} />
            ) : (
              <CategoryBars items={summary.byCategory.expense} limit={8} />
            )}
          </Card>
          {summary.byCategory.income.length > 0 ? (
            <Card>
              <T v="h3">เงินเข้าตามหมวด</T>
              <CategoryBars items={summary.byCategory.income} limit={4} />
            </Card>
          ) : null}
        </View>
      </Reveal>

      {/* The last 7 days */}
      <Reveal index={3}>
        <Card>
          <Row justify="space-between">
            <T v="h3">รายจ่าย 7 วันล่าสุด</T>
            <T v="small">เฉลี่ย {formatBaht(average.averageSatang, { decimals: false })}/วัน</T>
          </Row>
          <DayBars days={week} averageSatang={average.averageSatang} />
          <T v="micro">เส้นประ = ค่าเฉลี่ยต่อวันที่ใช้คำนวณ Money Runway</T>
        </Card>
      </Reveal>

      {/* More: the monthly story and savings jars */}
      <Reveal index={4}>
        <View style={{ gap: space.md }}>
          <SectionHead kicker="MORE" title="ดูเพิ่มเติม" />
          {recapMonth ? (
            <Card onPress={() => router.push({ pathname: '/recap', params: { month: recapMonth } })} style={{ paddingVertical: space.md }}>
              <Row gap={space.md}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="sparkles" size={22} color={theme.accentInk} />
                </View>
                <View style={{ flex: 1 }}>
                  <T v="h3">{`สรุปเดือน${formatThaiMonth(recapMonth)}`}</T>
                  <T v="small">เงินไปไหน วันไหนใช้เยอะ และเก่งขึ้นแค่ไหน</T>
                </View>
                <Ionicons name="play-circle" size={28} color={theme.accentInk} />
              </Row>
            </Card>
          ) : null}
          <Card onPress={() => router.push(goals.length ? '/goals' : '/goal')} style={{ paddingVertical: space.md }}>
            <Row gap={space.md}>
              {openGoal ? <Jar progress={goalProgress(openGoal)} size={44} /> : <T v="h1">🐷</T>}
              <View style={{ flex: 1 }}>
                <T v="h3">{openGoal ? `${openGoal.emoji} ${openGoal.title}` : 'ตั้งกระปุกออม'}</T>
                <T v="small">{openGoal ? goalLine(openGoal, today) : 'อยากได้อะไร ตั้งเป้าแล้วหยอดทีละนิด'}</T>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.inkFaint} />
            </Row>
          </Card>
        </View>
      </Reveal>
    </Screen>
  );
}
