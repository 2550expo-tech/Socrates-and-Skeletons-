/**
 * Settings: the numbers behind FR-6 (balance start, low line, budget), น้องกล้า
 * (voice on/off, skins), how the app looks, privacy notes, the account (email,
 * change password) and sign out.
 */
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { goBack } from '../ui/nav';
import { Children, useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../data/AppProvider';
import { supabase } from '../data/supabase';
import { useAutoScan } from '../services/AutoScanProvider';
import { forgetScanned } from '../services/slips';
import { amountToInput, parseBahtToSatang } from '../domain/money';
import { Button, Divider, IconButton, Ionicons, Row, Segmented, T, Toggle, type IconName } from '../ui/components';
import { setKlaSound, useKlaSound } from '../ui/kla/useKlaTalk';
import { ThemePicker } from '../ui/ThemePicker';
import { setThemeMode, useThemeMode, type ThemeMode } from '../ui/themeMode';
import { ConfirmSheet, useToast } from '../ui/feedback';
import { inputBox, inputText } from '../ui/inputs';
import { alpha, fonts, radius, space, useTheme } from '../ui/theme';
import { HeaderDecor } from '../ui/halloween';

/** A titled group of rows in one card (the grouped-list look of the settings). */
function Group({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={{ gap: space.sm, marginTop: space.md }}>
      <T v="h3">{title}</T>
      <View style={{ backgroundColor: theme.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: theme.line, paddingHorizontal: space.lg }}>
        {rows.map((r, i) => (
          <View key={i}>
            {i > 0 ? <Divider /> : null}
            {r}
          </View>
        ))}
      </View>
    </View>
  );
}

function RowIcon({ icon, color }: { icon: IconName; color: string }) {
  const theme = useTheme();
  return (
    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: alpha(color, theme.dark ? 0.2 : 0.12), alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={19} color={color} />
    </View>
  );
}

function LinkRow({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  const theme = useTheme();
  const color = danger ? theme.critical : theme.primary;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 56 }}>
      <RowIcon icon={icon} color={color} />
      <T v="body" color={danger ? theme.critical : theme.ink} style={{ flex: 1 }}>
        {label}
      </T>
      <Ionicons name="chevron-forward" size={18} color={theme.inkFaint} />
    </Pressable>
  );
}

function ToggleRow({ icon, label, hint, value, onValueChange }: { icon: IconName; label: string; hint?: string; value: boolean; onValueChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <Row gap={space.md} style={{ paddingVertical: space.md }}>
      <RowIcon icon={icon} color={theme.primary} />
      <View style={{ flex: 1 }}>
        <T v="body">{label}</T>
        {hint ? <T v="micro">{hint}</T> : null}
      </View>
      <Toggle value={value} onValueChange={onValueChange} label={label} />
    </Row>
  );
}

/** A setting typed in place: label on the left, a short box on the right, the hint under it. */
function InputRow({
  id,
  icon,
  label,
  value,
  onChangeText,
  money,
  hint,
  error,
  placeholder,
  maxLength,
}: {
  id: string;
  icon: IconName;
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  money?: boolean;
  hint?: string;
  error?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ paddingVertical: space.md, gap: 6 }}>
      <Row gap={space.md}>
        <RowIcon icon={icon} color={theme.primary} />
        <T v="body" style={{ flex: 1 }}>
          {label}
        </T>
        <View style={[inputBox(theme, { focused, error: !!error }), { width: 132, paddingHorizontal: 10 }]}>
          <TextInput
            nativeID={id}
            accessibilityLabel={label}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            placeholderTextColor={theme.inkFaint}
            keyboardType={money ? 'decimal-pad' : 'default'}
            maxLength={maxLength}
            style={[inputText(theme), { minWidth: 0, width: '100%', paddingVertical: 8, textAlign: money ? 'right' : 'left', color: money ? theme.primary : theme.ink, fontFamily: fonts.sansSemi }]}
          />
        </View>
      </Row>
      {error ? (
        <T v="small" color={theme.critical} style={{ marginLeft: 48 }}>
          {error}
        </T>
      ) : hint ? (
        <T v="micro" style={{ marginLeft: 48 }}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

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

  const initial = (profile?.displayName || email || 'M').trim().charAt(0).toUpperCase();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <Row justify="space-between" style={{ paddingHorizontal: space.sm, paddingTop: space.sm }}>
        <IconButton icon="chevron-back" label="กลับ" onPress={() => goBack()} />
        <HeaderDecor />
      </Row>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
          <T v="h1" style={{ marginBottom: space.sm }}>ตั้งค่า</T>

          <Group title="บัญชี">
            <Row gap={space.md} style={{ paddingVertical: space.md }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                {repo?.mode === 'demo' ? (
                  <Ionicons name="flask-outline" size={24} color={theme.accentInk} />
                ) : (
                  <T v="h2" color={theme.accentInk}>{initial}</T>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <T v="h3" numberOfLines={1}>{profile?.displayName || 'ผู้ใช้ MindPay'}</T>
                <T v="small" numberOfLines={1}>{repo?.mode === 'demo' ? 'โหมดทดลอง (ข้อมูลในเครื่อง)' : (email ?? 'บัญชี MindPay')}</T>
              </View>
            </Row>
            {repo?.mode === 'cloud' ? <LinkRow icon="key-outline" label="เปลี่ยนรหัสผ่าน" onPress={() => showAuthNotice({ kind: 'recovery' })} /> : null}
            <LinkRow icon="log-out-outline" label={repo?.mode === 'demo' ? 'ออกจากโหมดทดลอง' : 'ออกจากระบบ'} danger onPress={() => setAskOut(true)} />
          </Group>

          <Group title="เงินและงบประมาณ">
            <InputRow id="st-name" icon="person-outline" label="ชื่อเล่น" value={name} onChangeText={setName} error={errors.name} maxLength={30} />
            <InputRow
              id="st-opening"
              icon="wallet-outline"
              label="ยอดเงินตอนเริ่มใช้ MindPay (บาท)"
              value={opening}
              onChangeText={setOpening}
              money
              hint="ยอดคงเหลือ = ค่านี้ + รายรับ − รายจ่ายที่ยืนยันแล้ว ถ้ายอดในแอปไม่ตรงกับธนาคาร ปรับที่นี่"
              error={errors.opening}
            />
            <InputRow
              id="st-floor"
              icon="shield-checkmark-outline"
              label="เงินสำรองขั้นต่ำ (บาท)"
              value={floor}
              onChangeText={setFloor}
              money
              hint="Money Runway นับวันจนยอดเงินเหลือเท่านี้"
              error={errors.floor}
            />
            <InputRow
              id="st-budget"
              icon="cash-outline"
              label="งบใช้จ่ายต่อเดือน (บาท)"
              value={budget}
              onChangeText={setBudget}
              money
              placeholder="ไม่ตั้ง"
              hint="เว้นว่างถ้าไม่ต้องการตั้งงบ"
              error={errors.budget}
            />
            <View style={{ paddingVertical: space.md }}>
              <Button label="บันทึก" onPress={save} loading={busy} />
            </View>
          </Group>

          {auto.available ? (
            <Group title="อ่านสลิปอัตโนมัติ">
              <ToggleRow
                icon="images-outline"
                label="หาสลิปใหม่ทุกครั้งที่เปิดแอป"
                hint="ตรวจเฉพาะสลิปที่มี QR ซึ่งบันทึกลงเครื่องวันนี้ สลิปของวันก่อนหน้าเลือกเองได้ที่ปุ่ม +"
                value={auto.prefs.autoScan}
                onValueChange={(v) => auto.setPrefs({ autoScan: v })}
              />
              <ToggleRow
                icon="checkmark-done-outline"
                label="รวมยอดทันทีเมื่ออ่านชัด"
                hint="สลิปที่อ่านได้มั่นใจ 80% ขึ้นไปทุกช่องจะเข้ายอดเงินเลย ส่วนที่ไม่ชัดรอให้ตรวจก่อน"
                value={auto.prefs.autoConfirm}
                onValueChange={(v) => auto.setPrefs({ autoConfirm: v })}
              />
            </Group>
          ) : null}

          <Group title="น้องกล้า">
            <ToggleRow
              icon="volume-medium-outline"
              label="เสียงน้องกล้า"
              hint="น้องกล้าพูดคำแนะนำออกเสียงในหน้าโค้ช ปิดไว้ก็ยังมีตัวหนังสือขึ้นให้อ่าน"
              value={klaSound}
              onValueChange={setKlaSound}
            />
            <LinkRow icon="shirt-outline" label="ตู้สกินน้องกล้า" onPress={() => router.push('/skins')} />
          </Group>

          <Group title="หน้าตาแอป">
            <View style={{ paddingVertical: space.md, gap: space.sm }}>
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
            </View>
          </Group>

          <Group title="อื่น ๆ">
            <LinkRow icon="ribbon-outline" label="ความสำเร็จและภารกิจ" onPress={() => router.push('/achievements')} />
            <LinkRow icon="gift-outline" label="มีอะไรใหม่" onPress={() => router.push('/whatsnew')} />
            {userId ? (
              <LinkRow
                icon="refresh-outline"
                label="ล้างประวัติรูปที่เคยสแกน"
                onPress={() => forgetScanned(userId).then(() => toast({ message: 'สแกนครั้งหน้าจะตรวจทุกรูปใหม่' }))}
              />
            ) : null}
          </Group>

          <Group title="ความเป็นส่วนตัว">
            <T v="small" style={{ paddingVertical: space.md }}>
              • รูปในแกลเลอรีถูกตรวจบนมือถือก่อน เฉพาะรูปที่มี QR ของสลิปจะถูกส่งให้ AI (Google Gemini) อ่าน และไม่ถูกเก็บบนเซิร์ฟเวอร์ MindPay{'\n'}
              • ช่วงทดลองใช้ Gemini แบบฟรี ซึ่ง Google อาจเก็บข้อมูลที่ส่งไปเพื่อปรับปรุง AI ตามเงื่อนไขของ Google{'\n'}
              • น้องกล้า (โค้ช AI) เห็นเฉพาะยอดรวมตามหมวด ไม่เห็นรูปสลิป เลขบัญชี หรือชื่อคนที่คุณโอนให้{'\n'}
              • เสียงของน้องกล้าใช้เสียงอ่านภาษาไทยที่มากับมือถือหรือเบราว์เซอร์ของคุณ (ข้อความที่อ่านเป็นคำตอบของโค้ชเท่านั้น){'\n'}
              • ข้อมูลรายการของคุณมองเห็นได้เฉพาะบัญชีของคุณ (Row Level Security)
            </T>
          </Group>
          <T v="micro" center style={{ marginTop: space.md }}>
            {Constants.expoConfig?.name ?? 'MindPay'} เวอร์ชัน {Constants.expoConfig?.version ?? '1.0.0'}
          </T>
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
