/**
 * Review all slip drafts. "Ready" drafts can be confirmed together;
 * drafts with unsure fields open the form with those fields highlighted.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp, useMoney } from '../data/AppProvider';
import { formatBaht } from '../domain/money';
import { Buddy } from '../ui/Buddy';
import { Button, Card, Divider, EmptyState, IconButton, T } from '../ui/components';
import { Reveal } from '../ui/effects';
import { useToast } from '../ui/feedback';
import { TX_DIVIDER_INSET, TxRow } from '../ui/TxRow';
import { space, useTheme } from '../ui/theme';
import { StackHeader } from '../ui/StackHeader';
import { SectionHead } from '../ui/SectionHead';

export default function Drafts() {
  const theme = useTheme();
  const toast = useToast();
  const { confirmTxs } = useApp();
  const { drafts } = useMoney();
  const [busy, setBusy] = useState(false);
  const sorted = [...drafts].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const ready = sorted.filter((d) => d.reviewFlags.length === 0);
  const review = sorted.filter((d) => d.reviewFlags.length > 0);
  const readyTotal = ready.reduce((s, d) => s + (d.kind === 'expense' ? -d.amountSatang : d.amountSatang), 0);

  async function confirmAll() {
    setBusy(true);
    try {
      await confirmTxs(ready.map((d) => d.id));
      toast({ message: `ยืนยัน ${ready.length} รายการแล้ว` });
    } catch {
      toast({ message: 'ยืนยันไม่สำเร็จ ลองอีกครั้ง', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <StackHeader title="สลิปรอยืนยัน" right={<IconButton icon="scan-outline" label="สแกนเพิ่ม" onPress={() => router.push('/scan')} />} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}>
        {sorted.length === 0 ? (
          <EmptyState
            icon="checkmark-done-circle-outline"
            art={<Buddy mood="cheer" size={96} />}
            title="เคลียร์หมดแล้ว"
            body="ทุกรายการจากสลิปยืนยันเรียบร้อย เก่งมาก"
            action="สแกนสลิปเพิ่ม"
            onAction={() => router.push('/scan')}
          />
        ) : null}

        {ready.length > 0 ? (
          <View style={{ gap: space.sm }}>
            <SectionHead title={`พร้อมยืนยัน (${ready.length})`} />
            <T v="small">อ่านได้ครบทุกช่องด้วยความมั่นใจ 80% ขึ้นไป รวมแล้ว {formatBaht(readyTotal, { sign: true })}</T>
            <Card style={{ paddingVertical: space.xs, gap: 0 }}>
              {ready.map((t, i) => (
                <Reveal key={t.id} index={i} from={10}>
                  {i > 0 ? <Divider style={{ marginLeft: TX_DIVIDER_INSET }} /> : null}
                  <TxRow tx={t} />
                </Reveal>
              ))}
            </Card>
            <Button label={`ยืนยันทั้ง ${ready.length} รายการ`} kind="gold" icon="checkmark-done" shine onPress={confirmAll} loading={busy} />
          </View>
        ) : null}

        {review.length > 0 ? (
          <View style={{ gap: space.sm }}>
            <SectionHead title={`ต้องตรวจก่อน (${review.length})`} />
            <T v="small">มีบางช่องที่อ่านไม่ชัด แตะเพื่อแก้แล้วยืนยันทีละรายการ</T>
            <Card style={{ paddingVertical: space.xs, gap: 0 }}>
              {review.map((t, i) => (
                <Reveal key={t.id} index={i} from={10}>
                  {i > 0 ? <Divider style={{ marginLeft: TX_DIVIDER_INSET }} /> : null}
                  <TxRow tx={t} />
                </Reveal>
              ))}
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
