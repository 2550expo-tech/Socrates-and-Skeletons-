/**
 * Home-screen card for the automatic slip scan (FR-4): progress while it runs,
 * then what changed, with a way to review or undo.
 */
import { router } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { formatBaht } from '../domain/money';
import { useAutoScan } from '../services/AutoScanProvider';
import { Button, Card, IconButton, Ionicons, ProgressBar, Row, T } from './components';
import { useToast } from './feedback';
import { space, useTheme } from './theme';

export function AutoScanBanner() {
  const theme = useTheme();
  const toast = useToast();
  const { state, available, grantAndRun, undoLast, dismiss } = useAutoScan();
  if (!available || state.phase === 'idle') return null;

  if (state.phase === 'scanning') {
    return (
      <Card tone="alt" style={{ paddingVertical: space.md }}>
        <Row gap={space.md}>
          <ActivityIndicator color={theme.primary} />
          <View style={{ flex: 1, gap: 6 }}>
            <T v="body">
              {state.total === 0 ? 'กำลังหาสลิปใหม่ในแกลเลอรี…' : `กำลังอ่านสลิปใหม่ ${state.processed}/${state.total}`}
            </T>
            {state.total > 0 ? <ProgressBar value={state.processed / state.total} color={theme.accent} /> : null}
          </View>
        </Row>
      </Card>
    );
  }

  if (state.phase === 'needs_permission') {
    return (
      <Card style={{ borderColor: theme.accent, borderWidth: 1.5 }}>
        <Row gap={space.md} align="flex-start">
          <Ionicons name="images-outline" size={22} color={theme.accent} />
          <View style={{ flex: 1, gap: 4 }}>
            <T v="h3">ให้ MindPay อ่านสลิปให้อัตโนมัติ</T>
            <T v="small">
              {state.message ?? 'ทุกครั้งที่เปิดแอป MindPay จะหาสลิปใหม่ในแกลเลอรี อ่านยอด แล้วคำนวณเงินให้ทันที รูปอื่นไม่ออกจากมือถือ'}
            </T>
          </View>
          <IconButton icon="close" label="ปิด" onPress={dismiss} />
        </Row>
        <Button label="อนุญาตเข้าถึงรูปภาพ" kind="gold" icon="lock-open-outline" onPress={() => grantAndRun()} />
      </Card>
    );
  }

  if (state.phase === 'error') {
    return (
      <Card tone="alt" style={{ paddingVertical: space.md }}>
        <Row gap={space.md}>
          <Ionicons name="alert-circle-outline" size={20} color={theme.watch} />
          <T v="small" style={{ flex: 1 }}>{state.message}</T>
          <IconButton icon="close" label="ปิด" onPress={dismiss} />
        </Row>
      </Card>
    );
  }

  // done
  const total = state.confirmed.reduce((s, t) => s + (t.kind === 'income' ? t.amountSatang : -t.amountSatang), 0);
  return (
    <Card style={{ borderColor: theme.primary, borderWidth: 1.5 }}>
      <Row gap={space.md} align="flex-start">
        <Ionicons name="sparkles" size={22} color={theme.accent} />
        <View style={{ flex: 1, gap: 4 }}>
          {state.confirmed.length > 0 ? (
            <T v="h3">
              เพิ่ม {state.confirmed.length} รายการจากสลิปใหม่ ({formatBaht(total, { sign: true, decimals: false })})
            </T>
          ) : (
            <T v="h3">พบสลิปใหม่ {state.drafts} ใบ</T>
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
  );
}
