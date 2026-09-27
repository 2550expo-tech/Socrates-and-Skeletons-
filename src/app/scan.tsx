/**
 * FR-4 Automatic Gallery Slip Detection.
 *
 * Flow: choose range -> find photos -> check each one (QR on the phone, then the
 * slip reader) -> drafts appear in the review list -> confirm.
 * The range is locked while a scan runs (see scanQueue.ts), and leaving the
 * screen pauses; drafts already saved stay saved.
 */
import { router } from 'expo-router';
import { Linking, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../data/AppProvider';
import { RANGE_LABEL, RANGE_ORDER } from '../domain/dates';
import { formatBaht } from '../domain/money';
import { milestones, scanCounts, type ItemStatus } from '../domain/scanQueue';
import type { RangeKey } from '../domain/types';
import { useSlipScanner } from '../services/useSlipScanner';
import { Badge, Button, Card, Divider, IconButton, Ionicons, ProgressBar, Row, Segmented, T, type IconName } from '../ui/components';
import { useToast } from '../ui/feedback';
import { fonts, radius, space, useTheme } from '../ui/theme';

const STATUS: Record<ItemStatus, { label: string; icon: IconName; tone: 'good' | 'watch' | 'neutral' | 'critical' }> = {
  queued: { label: 'รอตรวจ', icon: 'ellipse-outline', tone: 'neutral' },
  working: { label: 'กำลังอ่าน', icon: 'sync', tone: 'neutral' },
  ready: { label: 'พร้อมยืนยัน', icon: 'checkmark-circle', tone: 'good' },
  needs_review: { label: 'ต้องตรวจ', icon: 'alert-circle', tone: 'watch' },
  duplicate: { label: 'ซ้ำ', icon: 'copy-outline', tone: 'neutral' },
  out_of_range: { label: 'นอกช่วง', icon: 'calendar-outline', tone: 'neutral' },
  not_slip: { label: 'ไม่ใช่สลิป', icon: 'image-outline', tone: 'neutral' },
  failed: { label: 'อ่านไม่ได้', icon: 'close-circle', tone: 'critical' },
};

export default function Scan() {
  const theme = useTheme();
  const toast = useToast();
  const { repo, confirmTxs } = useApp();
  const s = useSlipScanner('7d');
  const { state } = s;
  const counts = scanCounts(state);
  const locked = state.phase === 'running' || state.phase === 'paused';
  const demo = repo?.mode === 'demo';
  const readyIds = state.items.filter((i) => i.status === 'ready' && i.txId).map((i) => i.txId!);
  const shown = state.items.filter((i) => i.status !== 'queued' && i.status !== 'not_slip').slice(0, 60);

  async function confirmReady() {
    try {
      await confirmTxs(readyIds);
      toast({ message: `ยืนยัน ${readyIds.length} รายการแล้ว` });
    } catch {
      toast({ message: 'ยืนยันไม่สำเร็จ ลองอีกครั้ง', tone: 'error' });
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <Row justify="space-between" style={{ paddingHorizontal: space.sm, paddingTop: space.sm }}>
        <IconButton icon="close" label="ปิด" onPress={() => router.back()} />
        <T v="h3">สแกนสลิป</T>
        <View style={{ width: 42 }} />
      </Row>

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}>
        {demo ? (
          <Card tone="alt">
            <T v="body">โหมดทดลองอ่านสลิปไม่ได้ เพราะการอ่านสลิปต้องใช้เซิร์ฟเวอร์ เข้าสู่ระบบด้วยบัญชีจริงเพื่อใช้งาน</T>
          </Card>
        ) : null}

        <View style={{ gap: space.sm }}>
          <T v="h2">ย้อนหลังกี่วัน</T>
          <Segmented<RangeKey>
            options={RANGE_ORDER.map((k) => ({ key: k, label: RANGE_LABEL[k] }))}
            value={state.range}
            onChange={s.setRange}
            disabled={locked}
          />
          <T v="micro">
            {locked ? 'ล็อกช่วงเวลาไว้ระหว่างสแกน กด "ยกเลิก" ก่อนถ้าต้องการเปลี่ยน' : 'ตรวจจากรูปใหม่ไปเก่า: 1 วัน → 7 วัน → 1 เดือน → 6 เดือน → 1 ปี'}
          </T>
        </View>

        {state.items.length === 0 && state.phase === 'idle' ? (
          <Card style={{ gap: space.md }}>
            <Row gap={space.md} align="flex-start">
              <Ionicons name="images-outline" size={26} color={theme.primary} />
              <View style={{ flex: 1, gap: 4 }}>
                <T v="h3">ค้นหาสลิปในแกลเลอรี</T>
                <T v="small">
                  ตรวจทุกรูปในช่วง {RANGE_LABEL[state.range]} บนมือถือก่อน รูปที่มี QR ของสลิปธนาคารเท่านั้นที่จะถูกส่งไปอ่าน รูปอื่นไม่ออกจากเครื่อง
                </T>
              </View>
            </Row>
            <Row justify="space-between" gap={space.md}>
              <View style={{ flex: 1 }}>
                <T v="small" color={theme.ink}>อ่านเฉพาะรูปที่มี QR สลิป</T>
                <T v="micro">ปิดเพื่อส่งรูปแนวตั้งทุกรูปไปอ่าน (ช้าและใช้โควตามากขึ้น)</T>
              </View>
              <Switch
                value={s.requireQr}
                onValueChange={s.setRequireQr}
                trackColor={{ true: theme.primary, false: theme.line }}
                accessibilityLabel="อ่านเฉพาะรูปที่มี QR สลิป"
              />
            </Row>
            <Button label={s.finding ? 'กำลังค้นหารูป…' : 'ค้นหาสลิปในแกลเลอรี'} icon="search" onPress={s.loadFromGallery} loading={s.finding} disabled={demo} />
            <Button label="เลือกรูปเอง (สูงสุด 30 รูป)" kind="soft" icon="hand-left-outline" onPress={s.loadPicked} disabled={demo} />
          </Card>
        ) : null}

        {s.access === 'denied' || s.access === 'blocked' ? (
          <Card tone="alt">
            <T v="h3">ยังไม่ได้อนุญาตให้เข้าถึงรูปภาพ</T>
            <T v="small">
              MindPay ต้องเห็นรูปในแกลเลอรีเพื่อหาสลิป ถ้าไม่อยากให้สิทธิ์ ยังใช้ “เลือกรูปเอง” ได้
            </T>
            {s.access === 'blocked' ? <Button label="เปิดการตั้งค่า" kind="soft" small onPress={() => Linking.openSettings()} /> : <Button label="ขอสิทธิ์อีกครั้ง" kind="soft" small onPress={s.loadFromGallery} />}
          </Card>
        ) : null}
        {s.access === 'limited' ? (
          <T v="small">คุณอนุญาตเฉพาะบางรูป MindPay จะตรวจได้เฉพาะรูปที่เลือกไว้</T>
        ) : null}

        {s.notice ? (
          <Card tone="alt">
            <Row gap={space.sm}>
              <Ionicons name="pause-circle-outline" size={20} color={theme.watch} />
              <T v="body" style={{ flex: 1 }}>{s.notice}</T>
            </Row>
          </Card>
        ) : null}

        {state.items.length > 0 || state.phase === 'done' ? (
          <Card style={{ gap: space.md }}>
            <Row justify="space-between">
              <T v="h3">
                {state.phase === 'done' ? 'ตรวจครบแล้ว' : state.phase === 'running' ? 'กำลังตรวจ…' : state.phase === 'paused' ? 'หยุดชั่วคราว' : `พบ ${counts.total} รูป`}
              </T>
              <T v="small" style={{ fontVariant: ['tabular-nums'] }}>
                {counts.finished} / {counts.total}
              </T>
            </Row>
            <ProgressBar value={counts.total ? counts.finished / counts.total : 0} color={theme.accent} />
            {s.skippedKnown > 0 ? <T v="micro">ข้าม {s.skippedKnown} รูปที่เคยตรวจแล้ว</T> : null}

            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {milestones(state).map((m) => (
                <Badge key={m.range} label={`${m.complete ? '✓ ' : ''}${RANGE_LABEL[m.range]}`} tone={m.complete ? 'good' : 'neutral'} />
              ))}
            </Row>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {([
                ['ready', 'พร้อมยืนยัน'],
                ['needs_review', 'ต้องตรวจ'],
                ['duplicate', 'ซ้ำ'],
                ['out_of_range', 'นอกช่วง'],
                ['not_slip', 'ไม่ใช่สลิป'],
                ['failed', 'อ่านไม่ได้'],
              ] as [ItemStatus, string][]).map(([k, label]) => (
                <View key={k} style={{ width: '31%', flexGrow: 1, backgroundColor: theme.surfaceAlt, borderRadius: radius.md, padding: space.sm }}>
                  <T v="h2" style={{ fontVariant: ['tabular-nums'] }}>{counts[k]}</T>
                  <T v="micro">{label}</T>
                </View>
              ))}
            </View>

            {state.phase === 'idle' && counts.total > 0 ? (
              <Button label={`เริ่มตรวจ ${counts.total} รูป`} kind="gold" icon="play" onPress={s.start} />
            ) : null}
            {state.phase === 'idle' && counts.total === 0 ? (
              <T v="body">ไม่พบรูปใหม่ในช่วง {RANGE_LABEL[state.range]} ลองเลือกช่วงที่ยาวขึ้น</T>
            ) : null}
            {state.phase === 'running' ? <Button label="หยุดชั่วคราว" kind="soft" icon="pause" onPress={s.pause} /> : null}
            {state.phase === 'paused' ? <Button label="ตรวจต่อ" icon="play" onPress={s.resume} /> : null}
            {state.phase === 'done' && readyIds.length > 0 ? (
              <Button label={`ยืนยัน ${readyIds.length} รายการที่พร้อม`} kind="gold" icon="checkmark-done" onPress={confirmReady} />
            ) : null}
            {state.phase === 'done' ? (
              <Button label="ตรวจสอบแบบร่างทั้งหมด" kind="soft" icon="receipt-outline" onPress={() => router.replace('/drafts')} />
            ) : null}
            <Button label={locked ? 'ยกเลิกการสแกน' : 'เริ่มใหม่'} kind="ghost" small onPress={s.reset} />
          </Card>
        ) : null}

        {shown.length > 0 ? (
          <Card style={{ paddingVertical: space.xs, gap: 0 }}>
            {shown.map((i, n) => {
              const st = STATUS[i.status];
              const color = st.tone === 'good' ? theme.good : st.tone === 'watch' ? theme.watch : st.tone === 'critical' ? theme.critical : theme.inkFaint;
              return (
                <View key={i.assetId}>
                  {n > 0 ? <Divider /> : null}
                  <Row gap={space.md} style={{ paddingVertical: space.md }}>
                    <Ionicons name={st.icon} size={20} color={color} />
                    <View style={{ flex: 1 }}>
                      <T v="body" numberOfLines={1} style={{ fontFamily: fonts.sansMedium }}>{i.label ?? st.label}</T>
                      <T v="micro" numberOfLines={2}>{i.message ?? st.label}</T>
                    </View>
                    {i.amountSatang ? <T v="body" style={{ fontVariant: ['tabular-nums'] }}>{formatBaht(i.amountSatang)}</T> : null}
                    {i.txId && (i.status === 'ready' || i.status === 'needs_review') ? (
                      <IconButton icon="create-outline" label="ตรวจรายการ" onPress={() => router.push({ pathname: '/transaction', params: { id: i.txId } })} />
                    ) : null}
                  </Row>
                </View>
              );
            })}
          </Card>
        ) : null}

        <T v="micro" center>
          รูปสลิปใช้อ่านข้อมูลครั้งเดียวและไม่ถูกเก็บบนเซิร์ฟเวอร์ · รายการจากสลิปเป็นแบบร่างจนกว่าคุณจะยืนยัน
        </T>
      </ScrollView>
    </SafeAreaView>
  );
}
