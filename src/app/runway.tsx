/**
 * FR-6 Money Runway, in full (opened from the money card on the home screen):
 *   1. the number, with the money tree and a rail of the next 30 days (7/14/30)
 *   2. where the daily average comes from: the last 7 days as bars, and the
 *      arithmetic (folded away, except the money kept in savings jars)
 *   3. two "what if" tools, both always visible: spend less / check before buying
 *   4. the savings jars (money put aside is not counted as spendable)
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApp, useMoney } from '../data/AppProvider';
import { formatThaiDay } from '../domain/dates';
import { goalLine, goalProgress } from '../domain/goals';
import { formatBaht, parseBahtToSatang } from '../domain/money';
import { monthEndCheck, runwayAfterPurchase, runwayWithReduction, RUNWAY_WINDOW_DAYS, type Runway } from '../domain/runway';
import { spendingTrend } from '../domain/summary';
import { DotGrid, MoneyTree, treeHealth } from '../ui/art';
import { Badge, Button, Card, Divider, Ionicons, Row, Screen, T } from '../ui/components';
import { TrendBars } from '../ui/charts';
import { Field } from '../ui/inputs';
import { Jar } from '../ui/Jar';
import { useCountUp, useReduceMotion } from '../ui/motion';
import { monthEndStatus, Projection, railLabel, RunwayRail } from '../ui/RunwayRail';
import { Slider } from '../ui/Slider';
import { alpha, fonts, radius, space, useTheme } from '../ui/theme';
import { StackHeader } from '../ui/StackHeader';

function daysText(r: Runway) {
  if (r.status === 'below_floor') return 'แตะเส้นสำรองแล้ว';
  if (r.days === null) return 'คำนวณไม่ได้';
  return `${r.capped ? 'มากกว่า ' : ''}${r.days} วัน`;
}

const STATUS_LABEL = { healthy: 'สบาย ๆ', watch: 'เริ่มต้องระวัง', critical: 'ใกล้เส้นสำรอง', below_floor: 'ต่ำกว่าเงินสำรอง', no_spending: 'รอข้อมูลรายจ่าย' } as const;
const STATUS_TONE = { healthy: 'good', watch: 'watch', critical: 'critical', below_floor: 'critical', no_spending: 'neutral' } as const;

/** A label and an amount on one line of the arithmetic. */
function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Row justify="space-between" gap={space.md}>
      <T v={strong ? 'body' : 'small'} style={{ flexShrink: 1, fontFamily: strong ? fonts.sansSemi : undefined }}>
        {label}
      </T>
      <T v="body" style={{ fontFamily: fonts.sansSemi, fontVariant: ['tabular-nums'] }}>
        {value}
      </T>
    </Row>
  );
}

export default function RunwayScreen() {
  const theme = useTheme();
  const { balance, runway, average, reserved, floor } = useMoney();
  const { today, txs, goals } = useApp();
  const [reduce, setReduce] = useState(0);
  const [price, setPrice] = useState('');
  const [showMath, setShowMath] = useState(false);

  const reduced = useMemo(() => runwayWithReduction(runway, reduce), [runway, reduce]);
  const reduceMotion = useReduceMotion();
  const daysShown = useCountUp(runway.days ?? 0, !reduceMotion && runway.days !== null && !runway.capped, 1100);
  const reducedDays = useCountUp(reduced.days ?? 0, !reduceMotion && reduced.days !== null, 500, reduced.days ?? 0);
  const priceSatang = parseBahtToSatang(price);
  const afterBuy = priceSatang ? runwayAfterPurchase(runway, priceSatang) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const week = useMemo(() => spendingTrend(txs, '7d').buckets, [txs, today]);
  const openGoal = [...goals].filter((g) => g.savedSatang < g.targetSatang).sort((a, b) => goalProgress(b) - goalProgress(a))[0] ?? goals[0];
  const counting = runway.status !== 'no_spending' && runway.status !== 'below_floor';
  const check = monthEndCheck(runway);
  const status = monthEndStatus(check);
  const statusColor = status.tone === 'good' ? theme.heroIncome : status.tone === 'bad' ? '#FFB4A8' : theme.heroInkSoft;

  return (
    <Screen header={<StackHeader title="เงินพอถึงวันไหน" />} contentStyle={{ paddingTop: space.sm }}>
      {/* 1. The number on the same green as the home card (tap the card, land here), with the money tree. */}
      <View style={{ borderRadius: radius.xl, overflow: 'hidden', borderWidth: theme.dark ? 1 : 0, borderColor: alpha(theme.heroInk, 0.08) }}>
        <LinearGradient colors={[theme.heroTop, theme.heroDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: space.xl, paddingBottom: space.lg, gap: space.sm }}>
          <DotGrid color={theme.heroInk} />
          <Row gap={space.md} align="center">
            <View style={{ flex: 1, gap: 2 }}>
              {runway.status === 'no_spending' ? (
                <>
                  <T v="h2" color={theme.heroInk}>
                    ยังคำนวณไม่ได้
                  </T>
                  <T v="small" color={theme.heroInkSoft}>
                    ไม่มีรายจ่ายที่ยืนยันใน {RUNWAY_WINDOW_DAYS} วันล่าสุด จึงยังหาค่าเฉลี่ยไม่ได้
                  </T>
                </>
              ) : runway.status === 'below_floor' ? (
                <>
                  <T v="h2" color={theme.heroInk}>
                    ยอดเงินแตะเส้นสำรองแล้ว
                  </T>
                  <T v="small" color={theme.heroInkSoft}>
                    คงเหลือ {formatBaht(balance)} · เส้นสำรอง {formatBaht(runway.floorSatang, { decimals: false })}
                  </T>
                </>
              ) : (
                <>
                  <T v="small" color={theme.heroInkSoft}>
                    เงินพอใช้อีก
                  </T>
                  <Row gap={6} align="flex-end">
                    <T v="display" color={theme.heroAccent} style={{ fontVariant: ['tabular-nums'] }}>
                      {runway.capped ? '365+' : daysShown}
                    </T>
                    <T v="h3" color={theme.heroInk} style={{ marginBottom: 10 }}>
                      วัน
                    </T>
                  </Row>
                  <T v="small" color={theme.heroInkSoft}>
                    ถึงประมาณ {formatThaiDay(runway.depletionDay!)}
                  </T>
                </>
              )}
              <View style={{ alignSelf: 'flex-start', marginTop: space.sm }}>
                <Badge label={STATUS_LABEL[runway.status]} tone={STATUS_TONE[runway.status]} onDark />
              </View>
            </View>
            {/* The tree's leaves follow the status: full when comfortable, bare near the reserve line. */}
            <MoneyTree health={treeHealth(runway.status, runway.days)} size={118} trunk="#E8E1CC" leaf={theme.heroAccent} bare={theme.heroBare} glow={theme.heroAccent} grow sway />
          </Row>
          {check.kind !== 'unknown' ? (
            <>
              <RunwayRail check={check} label={railLabel(check)} />
              <Row gap={6}>
                <Ionicons name={status.icon} size={16} color={statusColor} />
                <T v="small" color={statusColor} style={{ fontFamily: fonts.sansSemi, flex: 1 }}>
                  {status.text}
                </T>
              </Row>
            </>
          ) : null}
        </LinearGradient>
      </View>

      {/* What would be left in 7, 14 and 30 days at this pace. */}
      {counting && runway.averageSatang > 0 ? (
        <Card>
          <T v="h3" accessibilityRole="header">
            ถ้ายังใช้เงินแบบนี้ต่อไป
          </T>
          <Projection balanceSatang={balance} floorSatang={runway.floorSatang} averageSatang={runway.averageSatang} today={today} />
          <T v="micro">ประมาณการจากค่าเฉลี่ยรายวัน ยังไม่รวมรายรับที่จะเข้ามา</T>
        </Card>
      ) : null}

      {/* 2. Where the average comes from, and the arithmetic. */}
      <Card>
        <Row justify="space-between" gap={space.md}>
          <T v="h3" accessibilityRole="header">
            คำนวณยังไง
          </T>
          <T v="small">เฉลี่ย {formatBaht(average.averageSatang, { decimals: false })}/วัน</T>
        </Row>
        <TrendBars buckets={week} averageSatang={average.averageSatang} height={120} label="รายจ่าย 7 วันล่าสุด" />
        <T v="micro">
          ค่าเฉลี่ยคิดจากรายจ่ายที่ยืนยันแล้ว {RUNWAY_WINDOW_DAYS} วันล่าสุด (รวมวันที่ไม่ได้ใช้เงิน) สลิปที่ยังไม่ยืนยันไม่นับ · เส้นประ = ค่าเฉลี่ย
        </T>
        <View style={{ gap: space.sm }}>
          {showMath ? null : (
            <>
              {/* Money in the jars is always shown: it is why "usable" is less than the balance. */}
              {reserved > 0 ? <Line label="หักเงินที่กันไว้ในกระปุกออม" value={`− ${formatBaht(reserved)}`} /> : null}
              <Line label="ใช้ได้จริง (หลังหักเงินสำรอง)" value={formatBaht(runway.spendableSatang, { decimals: false })} />
            </>
          )}
          {showMath ? (
            <>
              <Divider />
              <Line label="ยอดคงเหลือ" value={formatBaht(balance)} />
              <Line label="หักเงินสำรองที่ตั้งไว้" value={`− ${formatBaht(floor)}`} />
              {reserved > 0 ? <Line label="หักเงินที่กันไว้ในกระปุกออม" value={`− ${formatBaht(reserved)}`} /> : null}
              <Line label="ใช้ได้จริง" value={formatBaht(runway.spendableSatang)} />
              <Line label={`÷ ใช้เฉลี่ยต่อวัน (${average.daysCounted} วันล่าสุด)`} value={formatBaht(average.averageSatang)} />
              <Divider />
              <Row justify="space-between">
                <T v="h3">เงินพอใช้อีก</T>
                <T v="h3" color={runway.status === 'below_floor' || runway.status === 'critical' ? theme.critical : theme.primary}>
                  {daysText(runway)}
                </T>
              </Row>
              <Button label="เปลี่ยนเงินสำรอง" kind="soft" small icon="options-outline" onPress={() => router.push('/settings')} />
            </>
          ) : null}
        </View>
        <Pressable
          onPress={() => setShowMath((v) => !v)}
          accessibilityRole="button"
          aria-expanded={showMath}
          accessibilityLabel={showMath ? 'ซ่อนวิธีคิด' : 'ดูวิธีคิดทั้งหมด'}
          hitSlop={8}
          style={{ minHeight: 40, justifyContent: 'center' }}
        >
          <Row gap={4}>
            <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>
              {showMath ? 'ซ่อนวิธีคิด' : 'ดูวิธีคิดทั้งหมด'}
            </T>
            <Ionicons name={showMath ? 'chevron-up' : 'chevron-down'} size={16} color={theme.ink} />
          </Row>
        </Pressable>
      </Card>

      {/* 3a. Spend less: how many more days. */}
      {runway.averageSatang > 0 && runway.status !== 'below_floor' ? (
        <Card>
          <T v="h3">ลองปรับ: ถ้าใช้น้อยลงวันละ</T>
          <Row justify="space-between" align="flex-end" gap={space.md}>
            <T v="display" color={reduce ? theme.primary : theme.inkSoft} style={{ fontVariant: ['tabular-nums'] }}>
              {reduce}%
            </T>
            {reduce > 0 && reduced.days !== null && runway.days !== null ? (
              <View style={{ alignItems: 'flex-end', marginBottom: 8 }}>
                <T v="h3" color={theme.primary} style={{ fontVariant: ['tabular-nums'] }}>
                  +{reducedDays - runway.days} วัน
                </T>
                <T v="micro">จากตอนนี้ {daysText(runway)}</T>
              </View>
            ) : null}
          </Row>
          <T v="small">
            {reduce === 0
              ? `ตอนนี้ใช้วันละ ${formatBaht(runway.averageSatang, { decimals: false })}`
              : `ใช้วันละ ${formatBaht(reduced.averageSatang, { decimals: false })} (ประหยัดวันละ ${formatBaht(runway.averageSatang - reduced.averageSatang, { decimals: false })})`}
          </T>
          <Slider
            value={reduce}
            onChange={setReduce}
            min={0}
            max={50}
            step={5}
            label="ใช้น้อยลงวันละกี่เปอร์เซ็นต์"
            format={(v) => `${v}%`}
            ticks={[0, 10, 20, 30, 40, 50]}
          />
          <Row gap={space.md}>
            <Ionicons name="leaf" size={20} color={theme.primary} />
            <T v="body" style={{ flex: 1 }}>
              {reduce === 0
                ? 'เลื่อนดูว่าถ้าใช้น้อยลง เงินจะพอนานขึ้นกี่วัน'
                : `เงินจะพอ ${daysText(reduced.days === null ? reduced : { ...reduced, days: reducedDays })}${reduced.days !== null && runway.days !== null ? ` · เพิ่มขึ้น ${reducedDays - runway.days} วัน` : ''}`}
            </T>
          </Row>
        </Card>
      ) : null}

      {/* 3b. Check before buying. */}
      <Card>
        <T v="h3">เช็กก่อนจ่าย</T>
        <T v="small">อยากซื้ออะไร ลองใส่ราคาดูว่าเงินจะพอใช้สั้นลงกี่วัน</T>
        <Field id="runway-price" label="ราคา (บาท)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="เช่น 590" />
        {afterBuy ? (
          <View style={{ gap: space.sm }}>
            <Row justify="space-between">
              <T v="small">ตอนนี้</T>
              <T v="body" style={{ fontFamily: fonts.sansSemi }}>{daysText(runway)}</T>
            </Row>
            <Row justify="space-between">
              <T v="small">ถ้าซื้อ {formatBaht(priceSatang!, { decimals: false })}</T>
              <T v="body" style={{ fontFamily: fonts.sansSemi }} color={afterBuy.status === 'below_floor' || afterBuy.status === 'critical' ? theme.critical : theme.ink}>
                {daysText(afterBuy)}
              </T>
            </Row>
            <Button
              label="ถามโค้ชเรื่องนี้"
              kind="soft"
              small
              icon="chatbubble-ellipses-outline"
              onPress={() => router.navigate({ pathname: '/coach', params: { ask: `ถ้าฉันซื้อของราคา ${formatBaht(priceSatang!, { decimals: false })} วันนี้ จะเป็นยังไง`, price: String(priceSatang), at: String(Date.now()) } })}
            />
          </View>
        ) : null}
      </Card>

      {/* 4. Savings jars: money put aside here is not counted as spendable. */}
      <Card onPress={() => router.push(goals.length ? '/goals' : '/goal')} style={{ paddingVertical: space.md }}>
        <Row gap={space.md}>
          {openGoal ? (
            <Jar progress={goalProgress(openGoal)} size={44} />
          ) : (
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="flower-outline" size={22} color={theme.accentInk} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <T v="h3">{openGoal ? `${openGoal.emoji} ${openGoal.title}` : 'กระปุกออม'}</T>
            <T v="small">{openGoal ? goalLine(openGoal, today) : 'อยากได้อะไร ตั้งเป้าแล้วหยอดทีละนิด เงินในกระปุกไม่ถูกนับเป็นเงินใช้ได้'}</T>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.inkFaint} />
        </Row>
      </Card>
    </Screen>
  );
}
