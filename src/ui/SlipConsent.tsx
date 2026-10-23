/**
 * Asks for consent before any slip photo goes to the AI (PDPA, domain/consent.ts).
 * Shown on the home screen before the first automatic scan (phone app) and on the
 * scan screen before anything is read. Three honest choices, none pre-selected:
 * yes + scan by itself (phone only), yes + I pick the photos, no.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { BUDDY_NAME } from '../domain/buddy';
import { SLIP_AI_CONSENT_POINTS } from '../domain/consent';
import { Buddy } from './Buddy';
import { Button, Card, Ionicons, Row, T } from './components';
import { space, useTheme } from './theme';

export function ConsentPoints() {
  const theme = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      {SLIP_AI_CONSENT_POINTS.map((p) => (
        <Row key={p} gap={space.sm} align="flex-start">
          <Ionicons name="ellipse" size={6} color={theme.inkSoft} style={{ marginTop: 9 }} />
          <T v="small" style={{ flex: 1 }}>{p}</T>
        </Row>
      ))}
    </View>
  );
}

export function SlipConsent({
  autoOption,
  declined,
  onAnswer,
}: {
  /** Offer "scan by itself when the app opens" (phone app with gallery access). */
  autoOption: boolean;
  /** The person said no before: say so, and offer to change it. */
  declined?: boolean;
  onAnswer(granted: boolean, autoScan: boolean): Promise<void> | void;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const answer = (key: string, granted: boolean, autoScan: boolean) => async () => {
    setBusy(key);
    try {
      await onAnswer(granted, autoScan);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card style={{ gap: space.md, borderColor: theme.accent, borderWidth: 1.5 }}>
      <Row gap={space.md} align="flex-start">
        <Buddy mood={declined ? 'calm' : 'happy'} size={52} />
        <View style={{ flex: 1, gap: 4 }}>
          <T v="h3">{declined ? 'ตอนนี้ยังไม่ได้ให้อ่านสลิป' : `ขออนุญาตก่อนให้${BUDDY_NAME}อ่านสลิปนะ`}</T>
          <T v="small">
            {declined
              ? 'คุณเลือกไม่ยินยอม แอปจึงไม่ส่งรูปสลิปออกจากเครื่อง ถ้าเปลี่ยนใจ อ่านด้านล่างแล้วกดยินยอมได้เลย'
              : 'การอ่านสลิปต้องส่งรูปออกจากมือถือ อ่านก่อนว่าส่งอะไร ส่งให้ใคร แล้วเลือกเอง'}
          </T>
        </View>
      </Row>
      <ConsentPoints />
      <View style={{ gap: space.sm }}>
        {autoOption ? (
          <Button label="ยินยอม และหาสลิปเองตอนเปิดแอป" kind="gold" icon="checkmark-circle-outline" loading={busy === 'auto'} disabled={!!busy} onPress={answer('auto', true, true)} />
        ) : null}
        <Button
          label={autoOption ? 'ยินยอม แต่ฉันเลือกรูปเอง' : 'ยินยอม ให้อ่านรูปที่ฉันเลือก'}
          kind={autoOption ? 'soft' : 'gold'}
          icon="hand-left-outline"
          loading={busy === 'pick'}
          disabled={!!busy}
          onPress={answer('pick', true, false)}
        />
        {declined ? null : (
          <Button label="ไม่ยินยอม" kind="ghost" loading={busy === 'no'} disabled={!!busy} onPress={answer('no', false, false)} />
        )}
      </View>
    </Card>
  );
}
