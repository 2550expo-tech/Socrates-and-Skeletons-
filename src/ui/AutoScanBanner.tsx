/**
 * Home-screen card for the automatic slip scan (FR-4): progress while it runs,
 * then what changed, with a way to review or undo.
 */
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { BUDDY_NAME } from '../domain/buddy';
import { useAutoScan } from '../services/AutoScanProvider';
import { Buddy } from './Buddy';
import { Button, Card, IconButton, Money, ProgressBar, Row, T } from './components';
import { Reveal, ScanBeam, useCelebrate } from './effects';
import { useToast } from './feedback';
import { space, useTheme } from './theme';
import { WaitNotice } from './WaitNotice';

export function AutoScanBanner() {
  const theme = useTheme();
  const toast = useToast();
  const { state, available, grantAndRun, undoLast, dismiss } = useAutoScan();
  const celebrate = useCelebrate();
  const counted = state.phase === 'done' ? state.confirmed.length : 0;
  useEffect(() => {
    if (counted > 0) celebrate();
  }, [counted, celebrate]);
  if (!available || state.phase === 'idle') return null;

  if (state.phase === 'scanning') {
    return (
      <Reveal from={-10}>
      <Card tone="alt" style={{ paddingVertical: space.md, overflow: 'hidden' }}>
        <Row gap={space.md}>
          <View>
            <Buddy mood="thinking" size={48} />
            <ScanBeam height={48} active />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <T v="body">
              {state.total === 0 ? `${BUDDY_NAME}กำลังหาสลิปใหม่ในแกลเลอรี…` : `${BUDDY_NAME}กำลังอ่านสลิปใหม่ ${state.processed}/${state.total}`}
            </T>
            {state.total > 0 ? <ProgressBar value={state.processed / state.total} color={theme.accent} /> : null}
            {state.waitUntil ? <WaitNotice until={state.waitUntil} micro /> : null}
          </View>
        </Row>
      </Card>
      </Reveal>
    );
  }

  if (state.phase === 'needs_permission') {
    return (
      <Card style={{ borderColor: theme.accent, borderWidth: 1.5 }}>
        <Row gap={space.md} align="flex-start">
          <Buddy mood="happy" size={52} />
          <View style={{ flex: 1, gap: 4 }}>
            <T v="h3">ให้{BUDDY_NAME}จดจากสลิปให้อัตโนมัติไหม</T>
            <T v="small">
              {state.message ?? 'แค่เปิดแอป กล้าจะหาสลิปใหม่ในแกลเลอรี อ่านยอด แล้วคำนวณเงินให้ทันที รูปอื่นไม่ออกจากมือถือ'}
            </T>
          </View>
          <IconButton icon="close" label="ปิด" onPress={dismiss} />
        </Row>
        <Button label="อนุญาตเข้าถึงรูปภาพ" kind="gold" icon="lock-open-outline" onPress={() => grantAndRun()} />
      </Card>
    );
  }

  if (state.phase === 'error') {
    const recorded = state.confirmed.length + state.drafts;
    return (
      <Card tone="alt" style={{ paddingVertical: space.md }}>
        <Row gap={space.md}>
          <Buddy mood="worried" size={44} still />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="small">{state.message}</T>
            {recorded > 0 ? (
              <T v="micro">
                ก่อนหยุด{BUDDY_NAME}จดให้แล้ว {recorded} รายการ
                {state.drafts > 0 ? ` (รอตรวจ ${state.drafts})` : ''}
              </T>
            ) : null}
          </View>
          <IconButton icon="close" label="ปิด" onPress={dismiss} />
        </Row>
      </Card>
    );
  }

  // done
  const total = state.confirmed.reduce((s, t) => s + (t.kind === 'income' ? t.amountSatang : -t.amountSatang), 0);
  return (
    <Reveal zoom>
    <Card style={{ borderColor: theme.primary, borderWidth: 1.5 }}>
      <Row gap={space.md} align="flex-start">
        <Buddy mood={state.confirmed.length > 0 ? 'cheer' : 'thinking'} size={52} />
        <View style={{ flex: 1, gap: 4 }}>
          {state.confirmed.length > 0 ? (
            <>
              <T v="h3">
                {BUDDY_NAME}จดให้แล้ว {state.confirmed.length} รายการ
              </T>
              <Money satang={total} sign decimals={false} size="h2" color={total >= 0 ? theme.income : theme.ink} />
            </>
          ) : (
            <T v="h3">{BUDDY_NAME}เจอสลิปใหม่ {state.drafts} ใบ</T>
          )}
          <T v="small">
            {state.confirmed.length > 0 ? 'ยอดเงินและ Money Runway คำนวณใหม่แล้ว' : ''}
            {state.drafts > 0 ? `${state.confirmed.length > 0 ? ' · ' : ''}ต้องตรวจ ${state.drafts} รายการที่อ่านไม่ชัด` : ''}
          </T>
        </View>
        <IconButton icon="close" label="ปิด" onPress={dismiss} />
      </Row>
      <Row gap={space.sm}>
        {state.drafts > 0 ? (
          <Button label="ตรวจสลิป" small kind="soft" icon="receipt-outline" onPress={() => router.push('/drafts')} style={{ flex: 1 }} />
        ) : (
          <Button label="ดูรายการ" small kind="soft" icon="list-outline" onPress={() => router.navigate('/transactions')} style={{ flex: 1 }} />
        )}
        {state.confirmed.length > 0 ? (
          <Button
            label="ยังไม่รวมยอด"
            small
            kind="ghost"
            icon="arrow-undo-outline"
            onPress={() =>
              undoLast()
                .then(() => toast({ message: 'ย้ายไปที่สลิปรอยืนยันแล้ว' }))
                .catch(() => toast({ message: 'ทำไม่สำเร็จ ลองอีกครั้ง', tone: 'error' }))
            }
            style={{ flex: 1 }}
          />
        ) : null}
      </Row>
    </Card>
    </Reveal>
  );
}
