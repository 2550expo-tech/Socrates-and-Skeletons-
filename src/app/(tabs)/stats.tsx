/**
 * สถิติ (MindPay ใหม่, FR-2): where the money went in a chosen range.
 * Range (วันนี้ / 7 วัน / 30 วัน / 6 เดือน / 1 ปี) -> one summary card (total
 * spending, money in, net, items, average per day of the range) -> spending by
 * category (donut with its legend) -> money in by category -> the trend over the
 * same range (days or months) -> the monthly story. Everything counts confirmed
 * items only. Savings jars live on the Money Runway screen.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useApp, useMoney } from '../../data/AppProvider';
import { formatRangeSpan, formatThaiDay, formatThaiMonth, RANGE_DAYS, RANGE_LABEL, RANGE_ORDER } from '../../domain/dates';
import { formatBaht } from '../../domain/money';
import { recapMonths, recapToOffer } from '../../domain/recap';
import { rangeDailyAverage, spendingTrend, summarizeRange } from '../../domain/summary';
import type { RangeKey } from '../../domain/types';
import { Buddy } from '../../ui/Buddy';
import { CategoryBars, CategoryDonut, TrendBars } from '../../ui/charts';
import { Card, Divider, EmptyState, Ionicons, Money, Row, Screen, Segmented, T } from '../../ui/components';
import { TitleDecor } from '../../ui/halloween';
import { SectionHead } from '../../ui/SectionHead';
import { fonts, space, useTheme } from '../../ui/theme';

const TREND_TITLE: Record<RangeKey, string> = {
  today: 'รายจ่าย 7 วันล่าสุด',
  '7d': 'รายจ่าย 7 วันล่าสุด',
  '1m': 'รายจ่ายรายวัน 30 วัน',
  '6m': 'รายจ่ายรายเดือน 6 เดือน',
  '1y': 'รายจ่ายรายเดือน 1 ปี',
};

export default function Stats() {
  const theme = useTheme();
  const { txs, refresh, refreshing, today } = useApp();
  const { average } = useMoney();
  const [range, setRange] = useState<RangeKey>('1m');
  // `today` changes at 00:00 Bangkok time, so every range moves with it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => summarizeRange(txs, range), [txs, range, today]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const perDay = useMemo(() => rangeDailyAverage(txs, range), [txs, range, today]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const trend = useMemo(() => spendingTrend(txs, range), [txs, range, today]);
  const recapMonth = useMemo(() => recapToOffer(txs, today) ?? recapMonths(txs)[0] ?? null, [txs, today]);
  // Daily bars carry a dashed line at the daily average they explain.
  const trendAverage = trend.unit === 'day' ? (trend.buckets.length === 7 ? average.averageSatang : perDay) : undefined;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}>
      <Row justify="space-between" align="flex-end" style={{ paddingTop: space.sm }}>
        <T v="h1" accessibilityRole="header">
          สถิติ
        </T>
        <TitleDecor />
      </Row>

      <Segmented<RangeKey> options={RANGE_ORDER.map((k) => ({ key: k, label: RANGE_LABEL[k] }))} value={range} onChange={setRange} />
      <Row gap={4} style={{ marginTop: -space.sm }}>
        <Ionicons name="time-outline" size={14} color={theme.inkSoft} />
        <T v="micro">{formatRangeSpan(range)}</T>
      </Row>

      {/* The range in one card: total spending, money in and net, items and the average per day. */}
      <Card style={{ gap: space.sm }}>
        <T v="small">ใช้จ่ายรวม</T>
        <Money satang={summary.expenseSatang} size="display" countUp />
        <Row gap={space.lg} style={{ flexWrap: 'wrap' }}>
          <T v="small">
            เงินเข้า{' '}
            <T v="small" color={theme.income} style={{ fontFamily: fonts.sansSemi }}>
              {formatBaht(summary.incomeSatang, { decimals: false })}
            </T>
          </T>
          <T v="small">
            สุทธิ{' '}
            <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>
              {formatBaht(summary.netSatang, { sign: true, decimals: false })}
            </T>
          </T>
        </Row>
        <Divider style={{ marginVertical: space.xs }} />
        <Row align="stretch">
          <View style={{ flex: 1, gap: 2 }}>
            <T v="small">รายการ</T>
            <T v="h2" style={{ fontVariant: ['tabular-nums'] }}>
              {summary.count}
            </T>
          </View>
          <View style={{ width: 1, backgroundColor: theme.line, marginHorizontal: space.md }} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="small">{range === 'today' ? 'เฉลี่ยต่อวัน (วันนี้)' : `เฉลี่ยต่อวัน (${RANGE_DAYS[range]} วัน)`}</T>
            <Money satang={perDay} size="h2" decimals={false} />
          </View>
        </Row>
      </Card>

      {/* Spending by category: the donut and its legend (each category keeps its own colour). */}
      <View style={{ gap: space.md }}>
        <SectionHead title="ภาพรวมการใช้จ่าย" />
        <Card>
          {summary.byCategory.expense.length === 0 ? (
            <EmptyState icon="pie-chart-outline" art={<Buddy mood="calm" size={84} />} title="ยังไม่มีรายจ่ายในช่วงนี้" body="ลองเลือกช่วงที่ยาวขึ้น หรือกด + เพื่อเพิ่มรายการ" />
          ) : (
            <CategoryDonut items={summary.byCategory.expense} />
          )}
        </Card>
        {summary.byCategory.income.length > 0 ? (
          <Card>
            <T v="h3">เงินเข้าตามหมวด</T>
            <CategoryBars items={summary.byCategory.income} limit={4} />
          </Card>
        ) : null}
      </View>

      {/* The trend over the same range: days (7 / 30) or months (6 months / 1 year). */}
      <Card>
        <Row justify="space-between" gap={space.md}>
          <T v="h3" style={{ flexShrink: 1 }}>
            {TREND_TITLE[range]}
          </T>
          {trendAverage ? <T v="small">เฉลี่ย {formatBaht(trendAverage, { decimals: false })}/วัน</T> : null}
        </Row>
        <TrendBars buckets={trend.buckets} averageSatang={trendAverage} label={TREND_TITLE[range]} />
        <T v="micro">
          {trend.unit === 'month'
            ? `${trend.partialFrom ? `เดือนแรกนับตั้งแต่ ${formatThaiDay(trend.partialFrom)} · ` : ''}เดือนนี้นับถึงวันนี้`
            : trend.buckets.length === 7
              ? 'เส้นประ = ค่าเฉลี่ยต่อวันที่ใช้คำนวณ Money Runway'
              : 'เส้นประ = ค่าเฉลี่ยต่อวันของ 30 วันนี้'}
        </T>
      </Card>

      {/* The monthly story. */}
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
    </Screen>
  );
}
