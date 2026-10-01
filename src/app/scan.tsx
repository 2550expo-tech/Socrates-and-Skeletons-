/**
 * FR-4 Automatic Gallery Slip Detection.
 *
 * New flow (28 ก.ย. 2569, from user feedback): nothing to choose first.
 *   - Phone app: opening this screen searches the gallery (last 30 days, new
 *     photos only) and starts reading right away.
 *   - Web (iPhone/computer): browsers cannot look through the photo library, so
 *     one tap opens the picker; reading starts as soon as photos are chosen.
 * Every slip is recorded under the date printed on it, and clear ones count
 * in the balance at once (auto-confirm). The results are then shown by period
 * (วันนี้ 00:00–23:59, 7 วัน, 1 เดือน) and by day.
 */
import { router } from 'expo-router';
import { goBack } from '../ui/nav';
import { useEffect, useMemo, useRef } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../data/AppProvider';
import { BUDDY_NAME } from '../domain/buddy';
import { relativeDayLabel } from '../domain/dates';
import { formatBaht } from '../domain/money';
import { scanCounts } from '../domain/scanQueue';
import { groupByDay } from '../domain/summary';
import { useAutoScan } from '../services/AutoScanProvider';
import { galleryAvailable } from '../services/slips';
import { useSlipScanner } from '../services/useSlipScanner';
import { Buddy, BuddySays } from '../ui/Buddy';
import { Button, Card, Divider, IconButton, Ionicons, ProgressBar, Row, T } from '../ui/components';
import { useToast } from '../ui/feedback';
import { useCelebrate, Reveal } from '../ui/effects';
import { PeriodSummary } from '../ui/PeriodSummary';
import { ScannerStage } from '../ui/ScannerStage';
import { TxRow } from '../ui/TxRow';
import { radius, space, useTheme } from '../ui/theme';
import { WaitNotice } from '../ui/WaitNotice';
import { HeaderDecor } from '../ui/halloween';

export default function Scan() {
  const theme = useTheme();
  const toast = useToast();
  const { repo, txs, confirmTxs } = useApp();
  const s = useSlipScanner('1m');
  const auto = useAutoScan();
  // The automatic scan (on app open) may still be reading: wait for it, then skip what it read.
  const autoBusy = auto.state.phase === 'scanning';
  const { state } = s;
  const counts = scanCounts(state);
  const running = state.phase === 'running';
  const paused = state.phase === 'paused';
  const done = state.phase === 'done';
  const demo = repo?.mode === 'demo';
  const started = useRef(false);

  // Phone app: start searching as soon as the screen opens (after the first frame).
  useEffect(() => {
    if (started.current || demo || !galleryAvailable || !repo || autoBusy) return;
    started.current = true;
    const t = setTimeout(() => s.loadFromGallery('1m'), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, repo, autoBusy]);

  const recorded = useMemo(() => {
    const ids = new Set(s.runTxIds);
    return txs.filter((t) => ids.has(t.id));
  }, [txs, s.runTxIds]);
  const byDay = useMemo(() => groupByDay(recorded), [recorded]);
  const drafts = recorded.filter((t) => t.status === 'draft');
  const readyIds = drafts.filter((t) => t.reviewFlags.length === 0).map((t) => t.id);
  const counted = recorded.filter((t) => t.status === 'confirmed').length;
  const latest = recorded.length > 0 ? recorded.find((t) => t.id === s.runTxIds[s.runTxIds.length - 1]) ?? null : null;

  // Confetti once per scan that found slips.
  const celebrate = useCelebrate();
  const foundSlips = done && recorded.length > 0;
  useEffect(() => {
    if (foundSlips) celebrate();
  }, [foundSlips, state.runId, celebrate]);

  async function confirmReady() {
    try {
      await confirmTxs(readyIds);
      toast({ message: `ยืนยัน ${readyIds.length} รายการแล้ว` });
    } catch {
      toast({ message: 'ยืนยันไม่สำเร็จ ลองอีกครั้ง', tone: 'error' });
    }
  }

  const idle = state.phase === 'idle' && state.items.length === 0;
  const nothingNew = (state.phase === 'idle' || done) && state.items.length === 0 && !s.finding && s.searched;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <Row justify="space-between" style={{ paddingHorizontal: space.sm, paddingTop: space.sm }}>
        <IconButton icon="close" label="ปิด" onPress={() => goBack()} />
        <T v="h3">สแกนสลิป</T>
        <HeaderDecor />
      </Row>

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}>
        {demo ? (
          <BuddySays mood="calm">โหมดทดลองยังอ่านสลิปไม่ได้นะ เพราะต้องใช้เซิร์ฟเวอร์ เข้าสู่ระบบด้วยบัญชีจริง แล้ว{BUDDY_NAME}จะอ่านให้เลย</BuddySays>
        ) : null}

        {/* Web: one tap to choose photos, then everything else is automatic */}
        {!galleryAvailable && idle && !demo ? (
          <Card style={{ gap: space.md, alignItems: 'center' }}>
            <Buddy mood="happy" size={92} />
            <T v="h2" center>เลือกรูปสลิป แล้ว{BUDDY_NAME}จัดการที่เหลือให้</T>
            <T v="small" center>
              เลือกได้ครั้งละหลายรูป (สูงสุด 30) {BUDDY_NAME}จะอ่านยอด แยกตามวันที่บนสลิป และรวมเข้ายอดเงินให้ทันที
            </T>
            <Button label="เลือกรูปสลิป" kind="gold" icon="images-outline" onPress={s.loadPicked} style={{ alignSelf: 'stretch' }} />
            <T v="micro" center>
              เว็บเบราว์เซอร์ทุกตัวไม่อนุญาตให้เว็บเปิดดูรูปในเครื่องเอง จึงต้องกดเลือก 1 ครั้ง ในแอป Android {BUDDY_NAME}หาสลิปให้เองตั้งแต่เปิดแอป
            </T>
          </Card>
        ) : null}

        {/* Phone: the automatic scan from opening the app is still running */}
        {galleryAvailable && autoBusy && !s.searched && !s.finding ? (
          <BuddySays mood="thinking">
            {`${BUDDY_NAME}กำลังอ่านสลิปใหม่ที่เจอตอนเปิดแอปอยู่${auto.state.total ? ` (${auto.state.processed}/${auto.state.total})` : ''} เสร็จแล้วจะค้นต่อให้เลย`}
          </BuddySays>
        ) : null}

        {/* Phone: searching the gallery */}
        {galleryAvailable && s.finding ? (
          <BuddySays mood="thinking">{BUDDY_NAME}กำลังหาสลิปใหม่ในแกลเลอรี 30 วันล่าสุด…</BuddySays>
        ) : null}

        {s.access === 'denied' || s.access === 'blocked' ? (
          <Card tone="alt">
            <T v="h3">ยังไม่ได้อนุญาตให้เข้าถึงรูปภาพ</T>
            <T v="small">MindPay ต้องเห็นรูปในแกลเลอรีเพื่อหาสลิปเอง ถ้าไม่อยากให้สิทธิ์ ยังกด “เลือกรูปเอง” ได้</T>
            {s.access === 'blocked' ? (
              <Button label="เปิดการตั้งค่า" kind="soft" small onPress={() => Linking.openSettings()} />
            ) : (
              <Button label="ขอสิทธิ์อีกครั้ง" kind="soft" small onPress={() => s.loadFromGallery('1m')} />
            )}
            <Button label="เลือกรูปเอง" kind="soft" small icon="hand-left-outline" onPress={s.loadPicked} />
          </Card>
        ) : null}
        {s.access === 'limited' ? <T v="small">คุณอนุญาตเฉพาะบางรูป MindPay จะตรวจได้เฉพาะรูปที่เลือกไว้</T> : null}

        {galleryAvailable && nothingNew && s.access !== 'denied' && s.access !== 'blocked' && !demo ? (
          <Card style={{ gap: space.md, alignItems: 'center' }}>
            <Buddy mood="calm" size={84} />
            <T v="h3" center>ไม่มีรูปใหม่ใน 30 วันล่าสุด</T>
            <T v="small" center>
              {s.skippedKnown > 0 ? `ทุกรูปเคยตรวจแล้ว (${s.skippedKnown} รูป) ` : ''}ถ้ามีสลิปเก่ากว่านั้น ค้นหาย้อนหลังได้ถึง 1 ปี
            </T>
            <Button label="ค้นหาย้อนหลัง 1 ปี" kind="soft" icon="time-outline" onPress={() => s.loadFromGallery('1y')} style={{ alignSelf: 'stretch' }} />
            <Button label="เลือกรูปเอง" kind="ghost" small icon="hand-left-outline" onPress={s.loadPicked} />
          </Card>
        ) : null}

        {s.notice ? (
          <Card tone="alt">
            <Row gap={space.sm}>
              <Buddy mood="worried" size={40} still />
              <T v="body" style={{ flex: 1 }}>{s.notice}</T>
            </Row>
            {paused ? <Button label="อ่านต่อ" icon="play" small onPress={s.resume} /> : null}
          </Card>
        ) : null}

        {/* Progress */}
        {state.items.length > 0 ? (
          <Card style={{ gap: space.md }}>
            {running || (paused && recorded.length > 0) ? <ScannerStage active={running} latest={latest} /> : null}
            <Row gap={space.md}>
              <Buddy mood={done ? (counted > 0 ? 'cheer' : 'calm') : 'thinking'} size={52} />
              <View style={{ flex: 1, gap: 4 }}>
                <T v="h3">
                  {done
                    ? recorded.length > 0
                      ? `อ่านเสร็จแล้ว ได้ ${recorded.length} รายการ`
                      : 'อ่านเสร็จแล้ว ไม่พบสลิปใหม่'
                    : paused
                      ? 'หยุดไว้ชั่วคราว'
                      : `${BUDDY_NAME}กำลังอ่านสลิป ${counts.finished}/${counts.total}`}
                </T>
                <T v="micro">
                  {counted > 0 ? `รวมในยอดเงินแล้ว ${counted} รายการ` : ''}
                  {counts.duplicate > 0 ? `${counted > 0 ? ' · ' : ''}ซ้ำ ${counts.duplicate}` : ''}
                  {counts.not_slip > 0 ? ` · รูปอื่น (ไม่มี QR สลิป) ${counts.not_slip}` : ''}
                  {counts.failed > 0 ? ` · อ่านไม่ได้ ${counts.failed}` : ''}
                  {counts.out_of_range > 0 ? ` · เก่ากว่า 1 ปี ${counts.out_of_range}` : ''}
                </T>
              </View>
            </Row>
            {!done ? <ProgressBar value={counts.total ? counts.finished / counts.total : 0} color={theme.accent} /> : null}
            {done && recorded.length === 0 && counts.not_slip > 0 && galleryAvailable ? (
              <View style={{ backgroundColor: theme.surfaceAlt, borderRadius: radius.lg, padding: space.md, gap: space.sm }}>
                <T v="small">
                  มีสลิปในเครื่องแต่{BUDDY_NAME}ไม่เจอ? {BUDDY_NAME}หาสลิปจาก QR ตรวจสอบสลิปที่แอปธนาคารพิมพ์ไว้ ถ้าเป็นรูปถ่ายสลิปกระดาษ หรือรูปที่ตัด QR ออก ให้เลือกรูปนั้นเอง
                </T>
                <Button label="เลือกรูปเอง" kind="soft" small icon="hand-left-outline" onPress={s.loadPicked} />
              </View>
            ) : null}
            {running && s.waiting ? <WaitNotice until={s.waiting} /> : null}
            {running ? <Button label="หยุดชั่วคราว" kind="soft" small icon="pause" onPress={s.pause} /> : null}
            {paused && !s.notice ? <Button label="อ่านต่อ" small icon="play" onPress={s.resume} /> : null}
            {done && readyIds.length > 0 ? (
              <Button label={`ยืนยัน ${readyIds.length} รายการที่อ่านชัด`} kind="gold" icon="checkmark-done" onPress={confirmReady} />
            ) : null}
            {done && drafts.length - readyIds.length > 0 ? (
              <Button label={`ตรวจ ${drafts.length - readyIds.length} รายการที่อ่านไม่ชัด`} kind="soft" icon="receipt-outline" onPress={() => router.dismissTo('/drafts')} />
            ) : null}
            {done ? (
              <Row gap={space.sm}>
                <Button label="สแกนอีกครั้ง" kind="ghost" small icon="refresh" onPress={() => (galleryAvailable ? s.loadFromGallery('1m') : s.loadPicked())} style={{ flex: 1 }} />
                <Button label="เสร็จ" small onPress={() => goBack()} style={{ flex: 1 }} />
              </Row>
            ) : null}
          </Card>
        ) : null}

        {/* Results by period, then by day */}
        {recorded.length > 0 ? (
          <>
            <PeriodSummary txs={txs} title="ยอดเงินเข้า–ออกตามช่วงเวลา" />
            <View style={{ gap: space.sm }}>
              <T v="h3">สลิปที่อ่านรอบนี้ แยกตามวันที่</T>
              {byDay.map((g, i) => (
                <Reveal key={g.day} index={i}>
                <Card style={{ paddingVertical: space.sm, gap: 0 }}>
                  <Row justify="space-between" style={{ paddingVertical: space.xs }}>
                    <T v="body">{relativeDayLabel(g.day)}</T>
                    <T v="small" color={g.netSatang >= 0 ? theme.income : theme.expense}>
                      สุทธิ {formatBaht(g.netSatang, { sign: true, decimals: false })}
                    </T>
                  </Row>
                  {g.items.map((t) => (
                    <View key={t.id}>
                      <Divider />
                      <TxRow tx={t} />
                    </View>
                  ))}
                </Card>
                </Reveal>
              ))}
            </View>
          </>
        ) : null}

        <View style={{ backgroundColor: theme.surfaceAlt, borderRadius: radius.lg, padding: space.md, gap: 4 }}>
          <Row gap={6}>
            <Ionicons name="shield-checkmark-outline" size={16} color={theme.inkSoft} />
            <T v="micro" style={{ flex: 1 }}>
              รูปสลิปส่งให้ AI (Google Gemini) อ่านครั้งเดียว ไม่ถูกเก็บบนเซิร์ฟเวอร์ MindPay (รายละเอียดในตั้งค่า) · สลิปที่อ่านชัดทุกช่องรวมในยอดทันที ส่วนที่ไม่ชัดรอให้ตรวจ (ปิดได้ในตั้งค่า)
            </T>
          </Row>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
