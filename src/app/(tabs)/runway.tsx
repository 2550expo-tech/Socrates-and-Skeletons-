/**
 * FR-6 Money Runway, in full: the number, how it is calculated, what the next
 * 30 days look like, and two "what if" tools (spend less / check before buying).
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useMoney } from '../../data/AppProvider';
import { addDays, bkkDayKey, formatThaiDay } from '../../domain/dates';
import { formatBaht, parseBahtToSatang } from '../../domain/money';
import { runwayAfterPurchase, runwayWithReduction, RUNWAY_WINDOW_DAYS, type Runway } from '../../domain/runway';
import { ContourLines, MoneyTree, treeHealth } from '../../ui/art';
import { Badge, Button, Card, Chip, Divider, Ionicons, Money, Row, Screen, T } from '../../ui/components';
import { Field } from '../../ui/inputs';
import { fonts, palette, radius, space, useTheme } from '../../ui/theme';

function daysText(r: Runway) {
  if (r.status === 'below_floor') return 'แตะเส้นสำรองแล้ว';
  if (r.days === null) return 'คำนวณไม่ได้';
  return `${r.capped ? 'มากกว่า ' : ''}${r.days} วัน`;
}

export default function RunwayScreen() {
  const theme = useTheme();
  const { balance, runway, average } = useMoney();
  const [reduce, setReduce] = useState(0);
  const [price, setPrice] = useState('');

  const today = bkkDayKey(new Date());
  const reduced = useMemo(() => runwayWithReduction(runway, reduce), [runway, reduce]);
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
      <View style={{ paddingTop: space.sm, gap: 2 }}>
        <T v="label">Money Runway</T>
        <T v="h1">เงินพอถึงวันไหน</T>
      </View>

      <View style={{ backgroundColor: palette.forest, borderRadius: radius.xl, padding: space.xl, overflow: 'hidden', alignItems: 'center', gap: space.sm }}>
        <ContourLines width={420} height={340} color={palette.goldBright} />
        <MoneyTree health={treeHealth(runway.status, runway.days)} size={150} trunk="#E8E1CC" leaf={palette.goldBright} bare="#6F9483" />
        {runway.status === 'no_spending' ? (
          <>
            <T v="h2" color="#F4F1E6" center>ยังคำนวณไม่ได้</T>
            <T v="small" color="#B9CEC2" center>ไม่มีรายจ่ายที่ยืนยันใน {RUNWAY_WINDOW_DAYS} วันล่าสุด จึงยังหาค่าเฉลี่ยไม่ได้</T>
          </>
        ) : runway.status === 'below_floor' ? (
          <>
            <T v="h2" color="#F4F1E6" center>ยอดเงินแตะเส้นสำรองแล้ว</T>
            <T v="small" color="#B9CEC2" center>คงเหลือ {formatBaht(balance)} · เส้นสำรอง {formatBaht(runway.floorSatang, { decimals: false })}</T>
          </>
        ) : (
          <>
            <T v="display" color={palette.goldBright}>{runway.capped ? '365+' : runway.days}</T>
            <T v="h3" color="#F4F1E6" center>วัน · ถึงประมาณ {formatThaiDay(runway.depletionDay!)}</T>
          </>
        )}
        <Badge
          center
          label={{ healthy: 'สบาย ๆ', watch: 'เริ่มต้องระวัง', critical: 'ใกล้เส้นสำรอง', below_floor: 'ต่ำกว่าเงินสำรอง', no_spending: 'รอข้อมูลรายจ่าย' }[runway.status]}
          tone={{ healthy: 'good', watch: 'watch', critical: 'critical', below_floor: 'critical', no_spending: 'neutral' }[runway.status] as 'good'}
        />
      </View>

      <Card>
        <T v="h3">คำนวณยังไง</T>
        <View style={{ gap: space.sm }}>
          <Row justify="space-between">
            <T v="small">ยอดคงเหลือ</T>
            <T v="body" style={{ fontFamily: fonts.sansSemi }}>{formatBaht(balance)}</T>
          </Row>
          <Row justify="space-between">
            <T v="small">หักเงินสำรองที่ตั้งไว้</T>
            <T v="body" style={{ fontFamily: fonts.sansSemi }}>− {formatBaht(runway.floorSatang)}</T>
          </Row>
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
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.surfaceAlt, overflow: 'hidden' }}>
                    <View
                      style={{
                        width: `${Math.max(0, Math.min(1, p.balance / maxBal)) * 100}%`,
                        height: '100%',
                        backgroundColor: below ? theme.critical : p.d === 0 ? theme.accent : theme.primary,
                        borderRadius: 4,
                      }}
                    />
                  </View>
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
          <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
            {[0, 10, 20, 30].map((p) => (
              <Chip key={p} label={p === 0 ? 'เท่าเดิม' : `${p}%`} selected={reduce === p} onPress={() => setReduce(p)} />
            ))}
          </Row>
          <Row gap={space.md}>
            <Ionicons name="leaf" size={20} color={theme.primary} />
            <T v="body" style={{ flex: 1 }}>
              {reduce === 0
                ? `ตอนนี้ใช้วันละ ${formatBaht(runway.averageSatang, { decimals: false })} เงินพอ ${daysText(runway)}`
                : `ใช้วันละ ${formatBaht(reduced.averageSatang, { decimals: false })} เงินจะพอ ${daysText(reduced)}${reduced.days !== null && runway.days !== null ? ` (เพิ่มขึ้น ${reduced.days - runway.days} วัน)` : ''}`}
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
              onPress={() => router.navigate({ pathname: '/coach', params: { ask: `ถ้าฉันซื้อของราคา ${formatBaht(priceSatang!, { decimals: false })} วันนี้ จะเป็นยังไง` , price: String(priceSatang) } })}
            />
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}
