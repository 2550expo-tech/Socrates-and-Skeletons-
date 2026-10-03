/**
 * Settings: the numbers behind FR-6 (balance start, low line, budget), น้องกล้า
 * (voice on/off, skins), how the app looks, privacy notes, the account (email,
 * change password) and sign out.
 */
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { goBack } from '../ui/nav';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../data/AppProvider';
import { supabase } from '../data/supabase';
import { useAutoScan } from '../services/AutoScanProvider';
import { forgetScanned } from '../services/slips';
import { amountToInput, parseBahtToSatang } from '../domain/money';
import { Button, Card, IconButton, Ionicons, Row, Segmented, T, Toggle } from '../ui/components';
import { setKlaSound, useKlaSound } from '../ui/kla/useKlaTalk';
import { ThemePicker } from '../ui/ThemePicker';
import { setThemeMode, useThemeMode, type ThemeMode } from '../ui/themeMode';
import { ConfirmSheet, useToast } from '../ui/feedback';
import { Field } from '../ui/inputs';
import { space, useTheme } from '../ui/theme';
import { HeaderDecor } from '../ui/halloween';

export default function Settings() {
  const theme = useTheme();
  const toast = useToast();
  const { profile, repo, userId, saveProfile, signOut, showAuthNotice } = useApp();
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    if (repo?.mode !== 'cloud' || !supabase) return;
    supabase.auth
      .getSession()
      .then(({ data }) => setEmail(data.session?.user.email ?? null))
      .catch(() => {});
  }, [repo]);
  const auto = useAutoScan();
  const themeMode = useThemeMode();
  const klaSound = useKlaSound();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [opening, setOpening] = useState(amountToInput(profile?.openingBalanceSatang ?? 0));
  const [floor, setFloor] = useState(amountToInput(profile?.runwayFloorSatang ?? 50_000));
  const [budget, setBudget] = useState(amountToInput(profile?.monthlyBudgetSatang));
  const [busy, setBusy] = useState(false);
  const [askOut, setAskOut] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Satang are kept (the fields show them), and ฿0 is a fine balance or reserve.
  const money = (s: string) => parseBahtToSatang(s, { allowZero: true });

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
        <IconButton icon="chevron-back" label="กลับ" onPress={() => goBack()} />
        <T v="h3">ตั้งค่า</T>
        <HeaderDecor />
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

          {auto.available ? (
            <Card>
              <T v="h3">อ่านสลิปอัตโนมัติ</T>
              <Row justify="space-between" gap={space.md}>
                <View style={{ flex: 1 }}>
                  <T v="body">หาสลิปใหม่ทุกครั้งที่เปิดแอป</T>
                  <T v="micro">ตรวจเฉพาะรูปที่มี QR ของสลิปธนาคาร ย้อนหลังตั้งแต่ครั้งล่าสุดที่เปิดแอป</T>
                </View>
                <Toggle value={auto.prefs.autoScan} onValueChange={(v) => auto.setPrefs({ autoScan: v })} label="หาสลิปใหม่ทุกครั้งที่เปิดแอป" />
              </Row>
              <Row justify="space-between" gap={space.md}>
                <View style={{ flex: 1 }}>
                  <T v="body">รวมยอดทันทีเมื่ออ่านชัด</T>
                  <T v="micro">สลิปที่อ่านได้มั่นใจ 80% ขึ้นไปทุกช่องจะเข้ายอดเงินเลย ส่วนที่ไม่ชัดรอให้ตรวจก่อน</T>
                </View>
                <Toggle value={auto.prefs.autoConfirm} onValueChange={(v) => auto.setPrefs({ autoConfirm: v })} label="รวมยอดทันทีเมื่ออ่านชัด" />
              </Row>
            </Card>
          ) : null}

          <Card>
            <T v="h3">น้องกล้า</T>
            <Row justify="space-between" gap={space.md}>
              <View style={{ flex: 1 }}>
                <T v="body">เสียงน้องกล้า</T>
                <T v="micro">น้องกล้าพูดคำแนะนำออกเสียงในหน้าโค้ช ปิดไว้ก็ยังมีตัวหนังสือขึ้นให้อ่าน</T>
              </View>
              <Toggle value={klaSound} onValueChange={setKlaSound} label="เสียงน้องกล้า" />
            </Row>
            <Button label="ตู้สกินน้องกล้า" kind="soft" small icon="shirt-outline" onPress={() => router.push('/skins')} />
          </Card>

          <Card>
            <T v="h3">หน้าตาแอป</T>
            <Segmented<ThemeMode>
              options={[
                { key: 'system', label: 'ตามมือถือ' },
                { key: 'light', label: 'สว่าง' },
                { key: 'dark', label: 'มืด' },
              ]}
              value={themeMode}
              onChange={setThemeMode}
            />
            <T v="micro">โหมดมืดช่วยถนอมสายตาตอนกลางคืน และประหยัดแบตบนจอ OLED</T>
            <T v="small" color={theme.ink} style={{ marginTop: space.sm }}>
              ธีมสี
            </T>
            <ThemePicker />
          </Card>

          <Card>
            <T v="h3">ความเป็นส่วนตัว</T>
            <T v="small">
              • รูปในแกลเลอรีถูกตรวจบนมือถือก่อน เฉพาะรูปที่มี QR ของสลิปจะถูกส่งให้ AI (Google Gemini) อ่าน และไม่ถูกเก็บบนเซิร์ฟเวอร์ MindPay{'\n'}
              • ช่วงทดลองใช้ Gemini แบบฟรี ซึ่ง Google อาจเก็บข้อมูลที่ส่งไปเพื่อปรับปรุง AI ตามเงื่อนไขของ Google{'\n'}
              • น้องกล้า (โค้ช AI) เห็นเฉพาะยอดรวมตามหมวด ไม่เห็นรูปสลิป เลขบัญชี หรือชื่อคนที่คุณโอนให้{'\n'}
              • เสียงของน้องกล้าใช้เสียงอ่านภาษาไทยที่มากับมือถือหรือเบราว์เซอร์ของคุณ (ข้อความที่อ่านเป็นคำตอบของโค้ชเท่านั้น){'\n'}
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
            <T v="h3">บัญชี</T>
            <Row gap={space.sm}>
              <Ionicons name={repo?.mode === 'demo' ? 'flask-outline' : 'person-circle-outline'} size={22} color={theme.inkSoft} />
              <T v="body" style={{ flex: 1 }} numberOfLines={1}>
                {repo?.mode === 'demo' ? 'โหมดทดลอง (ข้อมูลในเครื่อง)' : (email ?? 'บัญชี MindPay')}
              </T>
            </Row>
            {repo?.mode === 'cloud' ? (
              <Button label="เปลี่ยนรหัสผ่าน" kind="soft" icon="key-outline" onPress={() => showAuthNotice({ kind: 'recovery' })} />
            ) : null}
            <T v="micro">MindPay เวอร์ชัน {Constants.expoConfig?.version ?? '1.0.0'}</T>
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
