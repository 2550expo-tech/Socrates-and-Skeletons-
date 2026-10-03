/**
 * FR-6 Money Runway, in full: the number, how it is calculated, what the next
 * 30 days look like, and two "what if" tools (spend less / check before buying).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useApp, useMoney } from '../../data/AppProvider';
import { addDays, formatThaiDay } from '../../domain/dates';
import { formatBaht, parseBahtToSatang } from '../../domain/money';
import { runwayAfterPurchase, runwayWithReduction, RUNWAY_WINDOW_DAYS, type Runway } from '../../domain/runway';
import { ContourLines, MoneyTree, ProgressRing, treeHealth } from '../../ui/art';
import { Badge, Button, Card, Divider, Ionicons, Money, Row, Screen, T } from '../../ui/components';
import { Aurora, GrowBar, Reveal, Sparkles } from '../../ui/effects';
import { Field } from '../../ui/inputs';
import { useCountUp, useReduceMotion } from '../../ui/motion';
import { Slider } from '../../ui/Slider';
import { fonts, palette, radius, space, useTheme } from '../../ui/theme';
import { TitleDecor } from '../../ui/halloween';

function daysText(r: Runway) {
  if (r.status === 'below_floor') return 'แตะเส้นสำรองแล้ว';
  if (r.days === null) return 'คำนวณไม่ได้';
  return `${r.capped ? 'มากกว่า ' : ''}${r.days} วัน`;
}

export default function RunwayScreen() {
  const theme = useTheme();
  const { balance, runway, average, reserved, floor } = useMoney();
  const { today } = useApp();
  const [reduce, setReduce] = useState(0);
  const [price, setPrice] = useState('');

  const reduced = useMemo(() => runwayWithReduction(runway, reduce), [runway, reduce]);
  const reduceMotion = useReduceMotion();
  const daysShown = useCountUp(runway.days ?? 0, !reduceMotion && runway.days !== null && !runway.capped, 1100);
  const reducedDays = useCountUp(reduced.days ?? 0, !reduceMotion && reduced.days !== null, 500, reduced.days ?? 0);
  /** How full the ring is: 45 days or more is a full, comfortable month and a half. */
  const fullness = runway.status === 'below_floor' ? 0.02 : runway.days === null ? 0 : Math.min(1, runway.days / 45);
  const priceSatang = parseBahtToSatang(price);
  const afterBuy = priceSatang ? runwayAfterPurchase(runway, priceSatang) : null;

  const timeline = [0, 7, 14, 30].map((d) => ({
    d,
    day: addDays(today, d),
    balance: balance - runway.averageSatang * d,
  }));
  const maxBal = Math.max(1, balance);

  return (
    <Screen>
      <Row justify="space-between" align="flex-end" style={{ paddingTop: space.sm }}>
        <View style={{ gap: 2 }}>
          <T v="label">Money Runway</T>
          <T v="h1">เงินพอถึงวันไหน</T>
        </View>
        <TitleDecor />
      </Row>

      <Reveal zoom>
        <View style={{ borderRadius: radius.xl, overflow: 'hidden' }}>
          <LinearGradient
            colors={[theme.heroTop, theme.hero, theme.heroDeep]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: space.xl, alignItems: 'center', gap: space.sm }}
          >
            <Aurora seed={9} />
            <ContourLines width={420} height={340} color={theme.heroAccent} />
            <Sparkles count={12} area={{ top: 4, bottom: 60 }} seed={29} />
            <ProgressRing value={fullness} size={206} color={theme.heroAccent} track="rgba(244,241,230,0.14)" width={5}>
              <MoneyTree
                health={treeHealth(runway.status, runway.days)}
                size={150}
                trunk="#E8E1CC"
                leaf={theme.heroAccent}
                bare={theme.heroBare}
                glow={theme.heroAccent}
                grow
                sway
              />
            </ProgressRing>
            {runway.status === 'no_spending' ? (
              <>
                <T v="h2" color={theme.heroInk} center>ยังคำนวณไม่ได้</T>
                <T v="small" color={theme.heroInkSoft} center>ไม่มีรายจ่ายที่ยืนยันใน {RUNWAY_WINDOW_DAYS} วันล่าสุด จึงยังหาค่าเฉลี่ยไม่ได้</T>
              </>
            ) : runway.status === 'below_floor' ? (
              <>
                <T v="h2" color={theme.heroInk} center>ยอดเงินแตะเส้นสำรองแล้ว</T>
                <T v="small" color={theme.heroInkSoft} center>คงเหลือ {formatBaht(balance)} · เส้นสำรอง {formatBaht(runway.floorSatang, { decimals: false })}</T>
              </>
            ) : (
              <>
                <T v="display" color={theme.heroAccent}>{runway.capped ? '365+' : daysShown}</T>
                <T v="h3" color={theme.heroInk} center>วัน · ถึงประมาณ {formatThaiDay(runway.depletionDay!)}</T>
              </>
            )}
            <Badge
              center
              onDark
              label={{ healthy: 'สบาย ๆ', watch: 'เริ่มต้องระวัง', critical: 'ใกล้เส้นสำรอง', below_floor: 'ต่ำกว่าเงินสำรอง', no_spending: 'รอข้อมูลรายจ่าย' }[runway.status]}
              tone={{ healthy: 'good', watch: 'watch', critical: 'critical', below_floor: 'critical', no_spending: 'neutral' }[runway.status] as 'good'}
            />
          </LinearGradient>
        </View>
      </Reveal>

      <Card>
        <T v="h3">คำนวณยังไง</T>
        <View style={{ gap: space.sm }}>
          <Row justify="space-between">
            <T v="small">ยอดคงเหลือ</T>
            <T v="body" style={{ fontFamily: fonts.sansSemi }}>{formatBaht(balance)}</T>
          </Row>
          <Row justify="space-between">
            <T v="small">หักเงินสำรองที่ตั้งไว้</T>
            <T v="body" style={{ fontFamily: fonts.sansSemi }}>− {formatBaht(floor)}</T>
          </Row>
          {reserved > 0 ? (
            <Row justify="space-between">
              <T v="small">หักเงินที่กันไว้ในกระปุกออม</T>
              <T v="body" style={{ fontFamily: fonts.sansSemi }}>− {formatBaht(reserved)}</T>
            </Row>
          ) : null}
          <Divider />
          <Row justify="space-between">
            <T v="small">ใช้ได้จริง</T>
            <T v="body" style={{ fontFamily: fonts.sansSemi }}>{formatBaht(runway.spendableSatang)}</T>
          </Row>
          <Row justify="space-between">
            <T v="small">÷ ใช้เฉลี่ยต่อวัน ({average.daysCounted} วันล่าสุด)</T>
            <T v="body" style={{ fontFamily: fonts.sansSemi }}>{formatBaht(average.averageSatang)}</T>
          </Row>
          <Divider />
          <Row justify="space-between">
            <T v="h3">เงินพอใช้อีก</T>
            <T v="h3" color={runway.status === 'below_floor' || runway.status === 'critical' ? theme.critical : theme.primary}>{daysText(runway)}</T>
          </Row>
        </View>
        <T v="micro">
          ค่าเฉลี่ยคิดจากรายจ่ายที่ยืนยันแล้ว {RUNWAY_WINDOW_DAYS} วันล่าสุด (รวมวันที่ไม่ได้ใช้เงิน) สลิปที่ยังไม่ยืนยันไม่นับ
        </T>
        <Button label="เปลี่ยนเงินสำรอง" kind="soft" small icon="options-outline" onPress={() => router.push('/settings')} />
      </Card>

      {runway.averageSatang > 0 ? (
        <Card>
          <T v="h3">ถ้ายังใช้เงินแบบนี้ต่อไป</T>
          <View style={{ gap: space.md }}>
            {timeline.map((p) => {
              const below = p.balance <= runway.floorSatang;
              return (
                <View key={p.d} style={{ gap: 4 }}>
                  <Row justify="space-between">
                    <T v="small" color={theme.ink}>{p.d === 0 ? 'วันนี้' : `อีก ${p.d} วัน · ${formatThaiDay(p.day, { year: false })}`}</T>
                    <Money satang={p.balance} size="body" decimals={false} color={below ? theme.critical : theme.ink} />
                  </Row>
                  <GrowBar
                    value={p.balance / maxBal}
                    color={below ? theme.critical : p.d === 0 ? theme.accent : theme.primary}
                    opacity={below || p.d === 0 ? 1 : 0.55}
                    track={theme.surfaceAlt}
                    delay={200 + timeline.indexOf(p) * 120}
                  />
                </View>
              );
            })}
          </View>
          <T v="micro">ประมาณการจากค่าเฉลี่ยรายวัน ยังไม่รวมรายรับที่จะเข้ามา</T>
        </Card>
      ) : null}

      {runway.averageSatang > 0 && runway.status !== 'below_floor' ? (
        <Card>
          <T v="h3">ลองปรับ: ถ้าใช้น้อยลงวันละ</T>
          <Row gap={space.md} align="center">
            <View style={{ flex: 1, gap: 2 }}>
              <T v="display" color={reduce ? theme.primary : theme.inkSoft} style={{ fontVariant: ['tabular-nums'] }}>
                {reduce}%
              </T>
              <T v="small">
                {reduce === 0
                  ? `ตอนนี้ใช้วันละ ${formatBaht(runway.averageSatang, { decimals: false })}`
                  : `ใช้วันละ ${formatBaht(reduced.averageSatang, { decimals: false })} (ประหยัดวันละ ${formatBaht(runway.averageSatang - reduced.averageSatang, { decimals: false })})`}
              </T>
            </View>
            <View style={{ alignItems: 'center' }}>
              <MoneyTree
                health={treeHealth(reduced.status, reduced.days)}
                size={86}
                trunk={theme.dark ? '#E8E1CC' : '#A88F5E'}
                leaf={palette.goldBright}
                bare={theme.dark ? '#3D5A4C' : '#C9D3CC'}
                grow
              />
            </View>
          </Row>
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
                ? `เลื่อนดูว่าถ้าใช้น้อยลง เงินจะพอนานขึ้นกี่วัน (ตอนนี้ ${daysText(runway)})`
                : `เงินจะพอ ${daysText(reduced.days === null ? reduced : { ...reduced, days: reducedDays })}${reduced.days !== null && runway.days !== null ? ` · เพิ่มขึ้น ${reducedDays - runway.days} วัน` : ''}`}
            </T>
          </Row>
        </Card>
      ) : null}

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
              onPress={() => router.navigate({ pathname: '/coach', params: { ask: `ถ้าฉันซื้อของราคา ${formatBaht(priceSatang!, { decimals: false })} วันนี้ จะเป็นยังไง` , price: String(priceSatang), at: String(Date.now()) } })}
            />
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}
