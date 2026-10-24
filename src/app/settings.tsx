/**
 * Settings, most used first: the account, the numbers behind FR-6 (balance
 * start, reserve line, budget), how the app looks, น้องกล้า (voice, skins), slip
 * reading on the phone, then the rest; privacy notes fold open; sign out sits
 * at the very bottom, away from everyday taps.
 * Privacy starts with this account's answer about sending slip photos to the AI
 * (PDPA, domain/consent.ts): what it covers, when it was given, and a way to
 * withdraw it (or give it) that works at once.
 */
import { router } from 'expo-router';
import appConfig from '../../app.json';
import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { KeyboardAvoid } from '../ui/KeyboardAvoid';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../data/AppProvider';
import { supabase } from '../data/supabase';
import { useAutoScan } from '../services/AutoScanProvider';
import { pinQuickWidget, widgetAvailable } from '../services/quickWidget';
import { deleteAllSlipCopies, slipCopyStats } from '../services/slipCopies';
import { forgetScanned } from '../services/slips';
import { amountToInput, formatSatang, parseBahtToSatang } from '../domain/money';
import { bkkDayKey, bkkTime, formatThaiDay } from '../domain/dates';
import { Badge, Button, Divider, Ionicons, Row, Segmented, T, Toggle, type IconName } from '../ui/components';
import { ConsentPoints } from '../ui/SlipConsent';
import { setKlaSound, useKlaSound } from '../ui/kla/useKlaTalk';
import { ThemePicker } from '../ui/ThemePicker';
import { setThemeMode, useThemeMode, type ThemeMode } from '../ui/themeMode';
import { ConfirmSheet, useToast } from '../ui/feedback';
import { inputBox, inputText } from '../ui/inputs';
import { alpha, fonts, radius, space, useTheme } from '../ui/theme';
import { StackHeader } from '../ui/StackHeader';
import { useConfirmLeave } from '../ui/nav';
import type { Profile } from '../domain/types';

/** A titled group of rows in one card (the grouped-list look of the settings). */
function Group({ title, children }: { title?: string; children: ReactNode }) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={{ gap: space.sm, marginTop: space.md }}>
      {title ? (
        <T v="h3" accessibilityRole="header">
          {title}
        </T>
      ) : null}
      <View style={{ backgroundColor: theme.surface, borderRadius: radius.lg, paddingHorizontal: space.lg }}>
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
    <View style={{ width: 36, height: 36, borderRadius: radius.tile, backgroundColor: alpha(color, theme.dark ? 0.2 : 0.12), alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={19} color={color} />
    </View>
  );
}

function LinkRow({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  const theme = useTheme();
  const color = danger ? theme.critical : theme.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 56, opacity: pressed ? 0.6 : 1 })}
    >
      <RowIcon icon={icon} color={color} />
      <T v="body" color={danger ? theme.critical : theme.ink} style={{ flex: 1 }}>
        {label}
      </T>
      <Ionicons name="chevron-forward" size={18} color={theme.inkSoft} />
    </Pressable>
  );
}

/** A setting that is on or off: the whole row is the switch (an easy target, also on the web). */
function ToggleRow({ icon, label, hint, value, onValueChange }: { icon: IconName; label: string; hint?: string; value: boolean; onValueChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      aria-checked={value}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, opacity: pressed ? 0.7 : 1 })}
    >
      <RowIcon icon={icon} color={theme.primary} />
      <View style={{ flex: 1 }}>
        <T v="body">{label}</T>
        {hint ? <T v="micro">{hint}</T> : null}
      </View>
      {/* The row speaks for the switch; the switch itself is just the picture of it. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        <Toggle value={value} onValueChange={onValueChange} label={label} />
      </View>
    </Pressable>
  );
}

/** "10000" -> "10,000", "85.5" -> "85.50"; anything that is not an amount is left as typed. */
function grouped(value: string): string {
  const satang = parseBahtToSatang(value, { allowZero: true });
  if (satang === null) return value;
  return formatSatang(satang, { decimals: satang % 100 !== 0 });
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
  const input = useRef<TextInput>(null);
  return (
    <View style={{ paddingVertical: space.md, gap: 6 }}>
      <Row gap={space.md}>
        <RowIcon icon={icon} color={theme.primary} />
        <T v="body" style={{ flex: 1 }}>
          {label}
        </T>
        <Pressable onPress={() => input.current?.focus()} accessible={false} style={[inputBox(theme, { focused, error: !!error }), { width: 132, minHeight: 46, paddingHorizontal: 10 }]}>
          <TextInput
            ref={input}
            nativeID={id}
            accessibilityLabel={label}
            // The text never changes when the box gets focus (that would move the caret and add to the
            // old number). Money is tidied into "10,000" when leaving the box.
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              if (money) onChangeText(grouped(value));
            }}
            placeholder={placeholder}
            placeholderTextColor={theme.inkSoft}
            keyboardType={money ? 'decimal-pad' : 'default'}
            maxLength={maxLength}
            style={[inputText(theme), { minWidth: 0, width: '100%', paddingVertical: 10, textAlign: money ? 'right' : 'left', color: money ? theme.primary : theme.ink, fontFamily: fonts.sansSemi }]}
          />
        </Pressable>
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

/** A big jump in a money setting is checked once more before it is saved (a typo of one extra zero changes every number). */
const BIG_SATANG = 100_000_000; // ฿1,000,000

export default function Settings() {
  const theme = useTheme();
  const { profile, refresh, refreshing } = useApp();
  // The form starts from the account's real numbers, so it opens only once they are loaded
  // (saving defaults over them would erase the opening balance).
  if (!profile) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.bg }}>
        <StackHeader title="ตั้งค่า" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md }}>
          <T v="h3" center>
            ยังโหลดข้อมูลบัญชีไม่ได้
          </T>
          <T v="small" center>
            ตั้งค่าเงินได้เมื่อโหลดข้อมูลของคุณเสร็จ
          </T>
          <Button label="ลองอีกครั้ง" icon="refresh" loading={refreshing} onPress={() => refresh()} />
        </View>
      </SafeAreaView>
    );
  }
  return <SettingsForm key={profile.id} profile={profile} />;
}

function SettingsForm({ profile }: { profile: Profile }) {
  const theme = useTheme();
  const toast = useToast();
  const { repo, userId, saveProfile, signOut, showAuthNotice } = useApp();
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
  const [name, setName] = useState(profile.displayName);
  const [opening, setOpening] = useState(grouped(amountToInput(profile.openingBalanceSatang)));
  const [floor, setFloor] = useState(grouped(amountToInput(profile.runwayFloorSatang)));
  const [budget, setBudget] = useState(grouped(amountToInput(profile.monthlyBudgetSatang)));
  const [busy, setBusy] = useState(false);
  /** A save waiting for "these numbers are right" (a very big amount). */
  const [checkBig, setCheckBig] = useState<{ patch: Partial<Profile>; lines: string[] } | null>(null);
  const [askOut, setAskOut] = useState(false);
  const [askCopies, setAskCopies] = useState(false);
  const [askForget, setAskForget] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  /** Slip pictures kept on this phone (or in this browser) for this account. */
  const [copies, setCopies] = useState<{ count: number; bytes: number } | null>(null);
  useEffect(() => {
    let alive = true;
    if (!userId || repo?.mode !== 'cloud') return;
    slipCopyStats(userId)
      .then((c) => alive && setCopies(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, repo?.mode]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Satang are kept (the fields show them), and ฿0 is a fine balance or reserve.
  const money = (s: string) => parseBahtToSatang(s, { allowZero: true });
  const o = money(opening);
  const f = money(floor);
  const b = budget.trim() ? parseBahtToSatang(budget) : null;
  const dirty =
    name.trim() !== profile.displayName ||
    o !== profile.openingBalanceSatang ||
    f !== profile.runwayFloorSatang ||
    (budget.trim() ? b : null) !== (profile.monthlyBudgetSatang ?? null);
  // Leaving with typed numbers that were not saved asks first (also Android back / browser back).
  const leaveGuard = useConfirmLeave(dirty && !busy);

  async function store(patch: Partial<Profile>) {
    setBusy(true);
    try {
      await saveProfile(patch);
      toast({ message: 'บันทึกการตั้งค่าแล้ว' });
    } catch {
      toast({ message: 'บันทึกไม่สำเร็จ', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'ใส่ชื่อเล่น';
    if (o === null) e.opening = 'ใส่เป็นตัวเลข';
    if (f === null) e.floor = 'ใส่เป็นตัวเลข';
    if (budget.trim() && b === null) e.budget = 'ใส่เป็นตัวเลข หรือเว้นว่าง';
    setErrors(e);
    if (Object.keys(e).length) return;
    // Only what was changed is sent (nothing else is overwritten).
    const patch: Partial<Profile> = {};
    if (name.trim() !== profile.displayName) patch.displayName = name.trim();
    if (o !== profile.openingBalanceSatang) patch.openingBalanceSatang = o!;
    if (f !== profile.runwayFloorSatang) patch.runwayFloorSatang = f!;
    if (b !== (profile.monthlyBudgetSatang ?? null)) patch.monthlyBudgetSatang = b;
    if (!Object.keys(patch).length) {
      toast({ message: 'ไม่มีอะไรเปลี่ยน' });
      return;
    }
    const big = (label: string, value: number | null | undefined, before: number | null) =>
      value != null && value !== before && (value >= BIG_SATANG || (before != null && before > 0 && value > before * 10)) ? `${label} ${formatSatang(value, { decimals: value % 100 !== 0 })} บาท` : null;
    const lines = [
      big('ยอดเงินตอนเริ่ม', patch.openingBalanceSatang, profile.openingBalanceSatang),
      big('เงินสำรองขั้นต่ำ', patch.runwayFloorSatang, profile.runwayFloorSatang),
      big('งบต่อเดือน', patch.monthlyBudgetSatang, profile.monthlyBudgetSatang),
    ].filter((x): x is string => !!x);
    if (lines.length) {
      setCheckBig({ patch, lines });
      return;
    }
    await store(patch);
  }

  const initial = (profile.displayName || email || 'M').trim().charAt(0).toUpperCase();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <StackHeader title="ตั้งค่า" onBack={leaveGuard.requestLeave} />
      <KeyboardAvoid>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
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
                <T v="h3" numberOfLines={1}>{profile.displayName || 'ผู้ใช้ MyPay'}</T>
                <T v="small" numberOfLines={1}>{repo?.mode === 'demo' ? 'โหมดทดลอง (ข้อมูลในเครื่อง)' : (email ?? 'บัญชี MyPay')}</T>
              </View>
            </Row>
            {repo?.mode === 'cloud' ? <LinkRow icon="key-outline" label="เปลี่ยนรหัสผ่าน" onPress={() => showAuthNotice({ kind: 'recovery' })} /> : null}
          </Group>
          <Group title="เงินและงบประมาณ">
            <InputRow id="st-name" icon="person-outline" label="ชื่อเล่น" value={name} onChangeText={setName} error={errors.name} maxLength={30} />
            <InputRow
              id="st-opening"
              icon="wallet-outline"
              label="ยอดเงินตอนเริ่มใช้ MyPay (บาท)"
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
              hint="แอปนับว่าเงินพอใช้กี่วัน จนยอดเหลือเท่านี้"
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
          {auto.available && auto.consent === 'granted' ? (
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
          {copies ? (
            <Group title="รูปสลิปในเครื่องนี้">
              <T v="small" style={{ paddingTop: space.md }}>
                {copies.count > 0
                  ? `เก็บไว้ ${copies.count} รูป (${(copies.bytes / 1_048_576).toFixed(1)} MB) แตะรายการที่จดจากสลิปเพื่อดูรูป`
                  : 'สลิปที่อ่านแล้วจะเก็บสำเนารูปไว้ในเครื่องนี้ แตะรายการเพื่อดูรูปได้'}
                {'\n'}สำเนาอยู่ในเครื่องนี้เท่านั้น ไม่ได้เก็บบน server และไม่หายแม้ลบรูปในแกลเลอรี
              </T>
              {copies.count > 0 ? <LinkRow icon="trash-outline" label="ลบรูปสลิปที่เก็บไว้" danger onPress={() => setAskCopies(true)} /> : null}
            </Group>
          ) : null}
          {widgetAvailable ? (
            <Group title="วิดเจ็ตหน้าจอโฮม">
              <LinkRow
                icon="apps-outline"
                label="เพิ่มวิดเจ็ต: ยอดใช้วันนี้ + ปุ่มลัด"
                onPress={() =>
                  pinQuickWidget().then((ok) => {
                    if (!ok) toast({ message: 'กดค้างที่หน้าจอโฮม → วิดเจ็ต → MyPay' });
                  })
                }
              />
            </Group>
          ) : null}
          <Group title="อื่น ๆ">
            <LinkRow icon="ribbon-outline" label="ความสำเร็จและภารกิจ" onPress={() => router.push('/achievements')} />
            <LinkRow icon="gift-outline" label="มีอะไรใหม่" onPress={() => router.push('/whatsnew')} />
            {userId ? (
              <LinkRow
                icon="refresh-outline"
                label="ล้างประวัติรูปที่เคยสแกน"
                onPress={() => setAskForget(true)}
              />
            ) : null}
          </Group>
          <Group title="ความเป็นส่วนตัว">
            {repo?.mode === 'cloud' && auto.consent ? (
              <View style={{ paddingVertical: space.md, gap: space.md }}>
                <Row gap={space.md}>
                  <RowIcon icon="shield-checkmark-outline" color={auto.consent === 'granted' ? theme.good : theme.inkSoft} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <T v="body" color={theme.ink}>
                      ส่งรูปสลิปให้ AI อ่าน
                    </T>
                    {auto.prefs.aiConsent ? (
                      <T v="micro">
                        ตอบเมื่อ {formatThaiDay(bkkDayKey(auto.prefs.aiConsent.at))} {bkkTime(new Date(auto.prefs.aiConsent.at))} น.
                      </T>
                    ) : null}
                  </View>
                  <Badge
                    label={auto.consent === 'granted' ? 'ยินยอมแล้ว' : auto.consent === 'declined' ? 'ไม่ยินยอม' : 'ยังไม่ได้ตอบ'}
                    tone={auto.consent === 'granted' ? 'good' : 'neutral'}
                  />
                </Row>
                <ConsentPoints />
                {auto.consent === 'granted' ? (
                  <Button
                    label="ถอนความยินยอม"
                    kind="soft"
                    small
                    icon="close-circle-outline"
                    style={{ alignSelf: 'flex-start' }}
                    onPress={() => auto.setConsent(false).then(() => toast({ message: 'ถอนความยินยอมแล้ว แอปจะไม่ส่งรูปสลิปออกจากเครื่อง' }))}
                  />
                ) : (
                  <Button
                    label="ยินยอมให้อ่านสลิป"
                    kind="soft"
                    small
                    icon="checkmark-circle-outline"
                    style={{ alignSelf: 'flex-start' }}
                    onPress={() => auto.setConsent(true).then(() => toast({ message: 'ยินยอมแล้ว อ่านสลิปได้ที่ปุ่ม +' }))}
                  />
                )}
                <T v="micro">ถอนแล้วแอปหยุดส่งรูปทันที รายการที่บันทึกไว้แล้วยังอยู่ในบัญชีของคุณ ลบเองได้ในแท็บรายการ</T>
              </View>
            ) : null}
            <View style={{ paddingVertical: space.md, gap: space.sm }}>
              <T v="small">
                • ข้อมูลรายการของคุณเปิดดูได้เฉพาะบัญชีของคุณ (ฐานข้อมูลล็อกสิทธิ์ทีละรายการ){'\n'}
                • รูปสลิปที่อ่านแล้วเก็บเป็นสำเนาในเครื่องนี้เท่านั้น ไม่ได้อัปโหลดเก็บบน server
                {showPrivacy ? (
                  <>
                    {'\n'}• คำตอบเรื่องความยินยอม (ยินยอมหรือไม่ และเวลาที่ตอบ) เก็บไว้กับบัญชี จึงใช้ได้ทุกเครื่องที่เข้าสู่ระบบ{'\n'}
                    • ลบบัญชีและข้อมูลทั้งหมดได้ที่ปุ่ม “ลบบัญชี” ด้านล่างสุด{'\n'}
                    • น้องกล้า (โค้ช AI) เห็นเฉพาะยอดรวมตามหมวด ไม่เห็นรูปสลิป เลขบัญชี หรือชื่อคนที่คุณโอนให้{'\n'}
                    • เสียงของน้องกล้าใช้เสียงอ่านภาษาไทยที่มากับมือถือหรือเบราว์เซอร์ของคุณ (ข้อความที่อ่านเป็นคำตอบของโค้ชเท่านั้น)
                  </>
                ) : null}
              </T>
              <Pressable
                onPress={() => setShowPrivacy((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={showPrivacy ? 'ย่อความเป็นส่วนตัว' : 'อ่านความเป็นส่วนตัวทั้งหมด 6 ข้อ'}
                aria-expanded={showPrivacy}
                hitSlop={8}
                style={{ minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' }}
              >
                <Row gap={4}>
                  <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>
                    {showPrivacy ? 'ย่อ' : 'อ่านทั้งหมด (6 ข้อ)'}
                  </T>
                  <Ionicons name={showPrivacy ? 'chevron-up' : 'chevron-down'} size={16} color={theme.ink} />
                </Row>
              </Pressable>
            </View>
          </Group>
          <Group>
            <LinkRow icon="log-out-outline" label={repo?.mode === 'demo' ? 'ออกจากโหมดทดลอง' : 'ออกจากระบบ'} danger onPress={() => setAskOut(true)} />
            {repo?.mode === 'cloud' ? <LinkRow icon="trash-outline" label="ลบบัญชี" danger onPress={() => router.push('/delete-account')} /> : null}
          </Group>
          <T v="micro" center style={{ marginTop: space.md }}>
            {appConfig.expo.name} เวอร์ชัน {appConfig.expo.version}
          </T>
        </ScrollView>
      </KeyboardAvoid>

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
      <ConfirmSheet
        visible={leaveGuard.asking}
        title="ทิ้งสิ่งที่แก้ไว้?"
        body="ตัวเลขที่แก้ในหน้านี้ยังไม่ได้บันทึก ถ้าออกตอนนี้จะกลับเป็นค่าเดิม"
        confirmLabel="ทิ้งและออก"
        destructive
        onConfirm={leaveGuard.leave}
        onCancel={leaveGuard.stay}
      />
      <ConfirmSheet
        visible={!!checkBig}
        title="ตัวเลขนี้ถูกไหม?"
        body={`${checkBig?.lines.join(' · ') ?? ''} ซึ่งสูงกว่าปกติมาก ตรวจว่าไม่ได้พิมพ์ศูนย์เกิน`}
        confirmLabel="ถูกแล้ว บันทึก"
        onConfirm={() => {
          const patch = checkBig?.patch;
          setCheckBig(null);
          if (patch) store(patch);
        }}
        onCancel={() => setCheckBig(null)}
      />
      <ConfirmSheet
        visible={askForget}
        title="ล้างประวัติรูปที่เคยสแกน?"
        body="ครั้งหน้าแอปจะตรวจทุกรูปในช่วงที่เลือกใหม่ทั้งหมด รายการที่จดไว้แล้วยังอยู่ครบ (สลิปซ้ำจะถูกจับได้เหมือนเดิม)"
        confirmLabel="ล้างประวัติ"
        onConfirm={() => {
          setAskForget(false);
          if (!userId) return;
          forgetScanned(userId)
            .then(() => toast({ message: 'สแกนครั้งหน้าจะตรวจทุกรูปใหม่' }))
            .catch(() => toast({ message: 'ล้างไม่สำเร็จ', tone: 'error' }));
        }}
        onCancel={() => setAskForget(false)}
      />
      <ConfirmSheet
        visible={askCopies}
        title="ลบรูปสลิปที่เก็บไว้?"
        body="ลบเฉพาะสำเนารูปในเครื่องนี้ รายการและยอดเงินยังอยู่ครบ รูปในแกลเลอรีไม่ถูกลบ"
        confirmLabel="ลบรูปสลิป"
        destructive
        onConfirm={() => {
          setAskCopies(false);
          if (!userId) return;
          deleteAllSlipCopies(userId)
            .then(() => {
              setCopies({ count: 0, bytes: 0 });
              toast({ message: 'ลบรูปสลิปในเครื่องแล้ว' });
            })
            .catch(() => toast({ message: 'ลบไม่สำเร็จ', tone: 'error' }));
        }}
        onCancel={() => setAskCopies(false)}
      />
    </SafeAreaView>
  );
}
