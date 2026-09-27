/**
 * Settings: the numbers behind FR-6 (balance start, low line, budget), coach
 * tone (FR-5), privacy notes, and sign out.
 */
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../data/AppProvider';
import { forgetScanned } from '../services/slips';
import { PERSONAS } from '../domain/insights';
import { formatSatang, parseBahtToSatang } from '../domain/money';
import { Button, Card, Chip, IconButton, Row, T } from '../ui/components';
import { ConfirmSheet, useToast } from '../ui/feedback';
import { Field } from '../ui/inputs';
import { space, useTheme } from '../ui/theme';

export default function Settings() {
  const theme = useTheme();
  const toast = useToast();
  const { profile, repo, userId, saveProfile, signOut } = useApp();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [opening, setOpening] = useState(formatSatang(profile?.openingBalanceSatang ?? 0, { decimals: false }).replace(/,/g, ''));
  const [floor, setFloor] = useState(formatSatang(profile?.runwayFloorSatang ?? 50_000, { decimals: false }).replace(/,/g, ''));
  const [budget, setBudget] = useState(profile?.monthlyBudgetSatang ? String(profile.monthlyBudgetSatang / 100) : '');
  const [busy, setBusy] = useState(false);
  const [askOut, setAskOut] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const money = (s: string) => (s.trim() === '0' ? 0 : parseBahtToSatang(s));

  async function save() {
    const e: Record<string, string> = {};
    const o = money(opening);
    const f = money(floor);
    const b = budget.trim() ? parseBahtToSatang(budget) : null;
    if (!name.trim()) e.name = 'ใส่ชื่อเล่น';
    if (o === null) e.opening = 'ใส่เป็นตัวเลข';
    if (f === null) e.floor = 'ใส่เป็นตัวเลข';
    if (budget.trim() && b === null) e.budget = 'ใส่เป็นตัวเลข หรือเว้นว่าง';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await saveProfile({ displayName: name.trim(), openingBalanceSatang: o!, runwayFloorSatang: f!, monthlyBudgetSatang: b });
      toast({ message: 'บันทึกการตั้งค่าแล้ว' });
    } catch {
      toast({ message: 'บันทึกไม่สำเร็จ', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <Row justify="space-between" style={{ paddingHorizontal: space.sm, paddingTop: space.sm }}>
        <IconButton icon="chevron-back" label="กลับ" onPress={() => router.back()} />
        <T v="h3">ตั้งค่า</T>
        <View style={{ width: 42 }} />
      </Row>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
          <Card style={{ gap: space.lg }}>
            <T v="h3">เงินของฉัน</T>
            <Field id="st-name" label="ชื่อเล่น" value={name} onChangeText={setName} error={errors.name} maxLength={30} />
            <Field
              id="st-opening"
              label="ยอดเงินตอนเริ่มใช้ MindPay (บาท)"
              value={opening}
              onChangeText={setOpening}
              keyboardType="decimal-pad"
              hint="ยอดคงเหลือ = ค่านี้ + รายรับ − รายจ่ายที่ยืนยันแล้ว ถ้ายอดในแอปไม่ตรงกับธนาคาร ปรับที่นี่"
              error={errors.opening}
            />
            <Field
              id="st-floor"
              label="เงินสำรองขั้นต่ำ (บาท)"
              value={floor}
              onChangeText={setFloor}
              keyboardType="decimal-pad"
              hint="Money Runway นับวันจนยอดเงินเหลือเท่านี้"
              error={errors.floor}
            />
            <Field id="st-budget" label="งบใช้จ่ายต่อเดือน (บาท)" value={budget} onChangeText={setBudget} keyboardType="decimal-pad" hint="เว้นว่างถ้าไม่ต้องการตั้งงบ" error={errors.budget} />
            <Button label="บันทึก" onPress={save} loading={busy} />
          </Card>

          <Card>
            <T v="h3">โทนของโค้ช</T>
            <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
              {PERSONAS.map((p) => (
                <Chip
                  key={p.tone}
                  label={p.name}
                  glyph={p.glyph}
                  selected={profile?.coachTone === p.tone}
                  onPress={() => saveProfile({ coachTone: p.tone }).catch(() => toast({ message: 'เปลี่ยนไม่สำเร็จ', tone: 'error' }))}
                />
              ))}
            </Row>
          </Card>

          <Card>
            <T v="h3">ความเป็นส่วนตัว</T>
            <T v="small">
              • รูปในแกลเลอรีถูกตรวจบนมือถือก่อน เฉพาะรูปที่มี QR ของสลิปจะถูกส่งไปอ่าน และไม่ถูกเก็บบนเซิร์ฟเวอร์{'\n'}
              • โค้ช AI เห็นเฉพาะยอดรวมตามหมวด ไม่เห็นรูปสลิป เลขบัญชี หรือชื่อคนที่คุณโอนให้{'\n'}
              • ข้อมูลรายการของคุณมองเห็นได้เฉพาะบัญชีของคุณ (Row Level Security)
            </T>
            {userId ? (
              <Button
                label="ล้างประวัติรูปที่เคยสแกน"
                kind="soft"
                small
                onPress={() => forgetScanned(userId).then(() => toast({ message: 'สแกนครั้งหน้าจะตรวจทุกรูปใหม่' }))}
              />
            ) : null}
          </Card>

          <Card>
            <T v="small">
              {repo?.mode === 'demo' ? 'โหมดทดลอง (ข้อมูลในเครื่อง)' : 'เข้าสู่ระบบด้วยบัญชี MindPay'} · เวอร์ชัน {Constants.expoConfig?.version ?? '1.0.0'}
            </T>
            <Button label={repo?.mode === 'demo' ? 'ออกจากโหมดทดลอง' : 'ออกจากระบบ'} kind="danger" icon="log-out-outline" onPress={() => setAskOut(true)} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmSheet
        visible={askOut}
        title={repo?.mode === 'demo' ? 'ออกจากโหมดทดลอง?' : 'ออกจากระบบ?'}
        body={repo?.mode === 'demo' ? 'ข้อมูลตัวอย่างในเครื่องนี้จะถูกล้าง' : 'ข้อมูลของคุณยังอยู่ในบัญชี เข้าสู่ระบบใหม่ได้ทุกเมื่อ'}
        confirmLabel={repo?.mode === 'demo' ? 'ออกและล้างข้อมูลตัวอย่าง' : 'ออกจากระบบ'}
        destructive
        onConfirm={() => {
          setAskOut(false);
          signOut();
        }}
        onCancel={() => setAskOut(false)}
      />
    </SafeAreaView>
  );
}
