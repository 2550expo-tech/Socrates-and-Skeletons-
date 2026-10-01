/**
 * Welcome: sign in, sign up, reset a forgotten password, or try the app with
 * sample data. Sign-up follows the MeowJot pattern (details -> one-time code ->
 * money setup), with the code sent by email instead of SMS. Works whether or
 * not Supabase asks new users to confirm their email ("Confirm email"):
 *   - confirmation off: the account is ready at once -> "สมัครบัญชีสำเร็จ" dialog
 *   - confirmation on:  type the 6-digit code from the email here, or tap the
 *     link in the email (handled in AppProvider) -> same dialog.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../data/AppProvider';
import { authRedirectUrl } from '../data/authLinks';
import { cloudAvailable, supabase } from '../data/supabase';
import {
  authErrorMessage,
  cleanOtp,
  EMAIL_PATTERN,
  isExistingAccountSignUp,
  isOtpComplete,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  otpErrorMessage,
  type AuthErrorLike,
} from '../domain/auth';
import { ContourLines } from '../ui/art';
import { KlaStage } from '../ui/kla/KlaStage';
import { SpookyHeroDecor } from '../ui/halloween';
import { Button, Card, Ionicons, Row, Segmented, T } from '../ui/components';
import { Aurora, Reveal, Shine, Sparkles } from '../ui/effects';
import { useToast } from '../ui/feedback';
import { StepDots } from '../ui/StepDots';
import { Field, PasswordField } from '../ui/inputs';
import { fonts, radius, space, useTheme } from '../ui/theme';

type Mode = 'signin' | 'signup' | 'forgot';
type Notice = { text: string; tone: 'error' | 'info'; action?: 'resend' | 'forgot' };
type Sent = { kind: 'confirm' | 'reset'; email: string; name?: string };

const RESEND_WAIT_S = 60;

/** What MindPay does for you, in one glance (MeowJot-style problem -> solution). */
const VALUE_POINTS = [
  { icon: 'receipt-outline', label: 'จดจากสลิปให้เอง' },
  { icon: 'leaf-outline', label: 'รู้ว่าเงินพอถึงวันไหน' },
  { icon: 'chatbubble-ellipses-outline', label: 'น้องกล้าโค้ชส่วนตัว' },
] as const;

export default function Welcome() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { startDemo, showAuthNotice } = useApp();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [hop, setHop] = useState(0);
  const [sent, setSent] = useState<Sent | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  function switchMode(m: Mode) {
    setMode(m);
    setNotice(null);
    setFieldErrors({});
  }

  /** Back to a clean form (after the account is ready). */
  function resetForm() {
    setMode('signin');
    setEmail('');
    setPassword('');
    setName('');
    setNotice(null);
    setFieldErrors({});
    setSent(null);
  }

  function validate(): string | null {
    const errors: typeof fieldErrors = {};
    const e = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(e)) errors.email = 'กรอกอีเมลให้ถูกต้อง เช่น name@example.com';
    if (mode !== 'forgot' && password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`;
    }
    if (mode === 'signup' && !name.trim()) errors.name = 'ใส่ชื่อเล่นสั้น ๆ ให้โค้ชเรียกคุณ';
    setFieldErrors(errors);
    return Object.keys(errors).length ? null : e;
  }

  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await task();
    } catch (e) {
      setNotice({ text: authErrorMessage(e as AuthErrorLike), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function signIn(address: string, pass: string, afterSignUp: boolean) {
    const { data, error } = await supabase!.auth.signInWithPassword({ email: address, password: pass });
    if (error) {
      if (error.code === 'email_not_confirmed') {
        setNotice({ text: authErrorMessage(error), tone: 'error', action: 'resend' });
      } else if (error.code === 'invalid_credentials') {
        setNotice({ text: authErrorMessage(error), tone: 'error', action: 'forgot' });
      } else {
        setNotice({ text: authErrorMessage(error), tone: 'error' });
      }
      return;
    }
    const who = (data.user?.user_metadata?.display_name as string | undefined) ?? null;
    if (afterSignUp) showAuthNotice({ kind: 'signed_up', name: who });
    else toast({ message: who ? `ยินดีต้อนรับกลับ ${who}` : 'ยินดีต้อนรับกลับ' });
    resetForm();
  }

  function submit() {
    if (!supabase) return;
    const address = validate();
    if (!address) return;
    run(async () => {
      if (mode === 'signin') return signIn(address, password, false);

      if (mode === 'forgot') {
        const { error } = await supabase!.auth.resetPasswordForEmail(address, { redirectTo: authRedirectUrl() });
        if (error) return setNotice({ text: authErrorMessage(error), tone: 'error' });
        setSent({ kind: 'reset', email: address });
        setResendIn(RESEND_WAIT_S);
        return;
      }

      const displayName = name.trim();
      const { data, error } = await supabase!.auth.signUp({
        email: address,
        password,
        options: { data: { display_name: displayName }, emailRedirectTo: authRedirectUrl() },
      });
      if (error) return setNotice({ text: authErrorMessage(error), tone: 'error' });
      if (isExistingAccountSignUp(data.user)) {
        setMode('signin');
        setPassword('');
        setNotice({
          text: 'อีเมลนี้มีบัญชีอยู่แล้ว เข้าสู่ระบบด้วยรหัสผ่านเดิม หรือกด "ลืมรหัสผ่าน" เพื่อตั้งใหม่',
          tone: 'info',
          action: 'forgot',
        });
        return;
      }
      if (data.session) {
        showAuthNotice({ kind: 'signed_up', name: displayName });
        resetForm();
        return;
      }
      setSent({ kind: 'confirm', email: address, name: displayName });
      setResendIn(RESEND_WAIT_S);
    });
  }

  /** The one-time code from the email (sign-up confirmation or password reset). */
  function verifyCode(code: string) {
    if (!sent || !supabase) return;
    const { email: address, kind } = sent;
    run(async () => {
      if (kind === 'reset') {
        const { data, error } = await supabase!.auth.verifyOtp({ email: address, token: code, type: 'recovery' });
        if (error || !data.session) return setNotice({ text: otpErrorMessage(error), tone: 'error' });
        showAuthNotice({ kind: 'recovery' });
        resetForm();
        return;
      }
      let result = await supabase!.auth.verifyOtp({ email: address, token: code, type: 'email' });
      if (result.error) {
        // Older projects issue sign-up codes under the "signup" type.
        const legacy = await supabase!.auth.verifyOtp({ email: address, token: code, type: 'signup' });
        if (!legacy.error) result = legacy;
      }
      const { data, error } = result;
      if (error || !data.session) return setNotice({ text: otpErrorMessage(error), tone: 'error' });
      const who = (data.user?.user_metadata?.display_name as string | undefined) ?? sent.name ?? null;
      showAuthNotice({ kind: 'signed_up', name: who });
      resetForm();
    });
  }

  function resend(address: string, kind: Sent['kind']) {
    run(async () => {
      const { error } =
        kind === 'confirm'
          ? await supabase!.auth.resend({ type: 'signup', email: address, options: { emailRedirectTo: authRedirectUrl() } })
          : await supabase!.auth.resetPasswordForEmail(address, { redirectTo: authRedirectUrl() });
      if (error) return setNotice({ text: authErrorMessage(error), tone: 'error' });
      setResendIn(RESEND_WAIT_S);
      setNotice({ text: `ส่งอีเมลใหม่ไปที่ ${address} แล้ว`, tone: 'info' });
    });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View
          style={{
            borderBottomLeftRadius: radius.xl,
            borderBottomRightRadius: radius.xl,
            overflow: 'hidden',
          }}
        >
        <LinearGradient
          colors={[theme.heroTop, theme.hero, theme.heroDeep]}
          locations={[0, 0.5, 1]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={{
            paddingTop: insets.top + space.xxl,
            paddingBottom: space.xxxl + space.lg,
            paddingHorizontal: space.xl,
            alignItems: 'center',
            gap: space.sm,
          }}
        >
          <Aurora cycles={2} strength={0.4} seed={17} />
          <ContourLines width={420} height={320} color={theme.heroAccent} />
          <Sparkles count={14} cycles={3} seed={41} area={{ top: 6, bottom: 70 }} />
          {theme.colorTheme === 'halloween' ? <SpookyHeroDecor /> : null}
          {/* The cover: น้องกล้า, the MindPay mascot, says hello (and hops when tapped). */}
          <Reveal zoom from={10}>
            <Pressable onPress={() => setHop((h) => h + 1)} accessibilityRole="button" accessibilityLabel="น้องกล้า มาสคอตของ MindPay แตะเพื่อทักทาย">
              <KlaStage skin="classic" mood="happy" width={136} hop={hop} onDark />
            </Pressable>
          </Reveal>
          <Reveal index={2} from={14}>
            <View style={{ overflow: 'hidden', borderRadius: radius.md, marginTop: space.sm, paddingHorizontal: space.sm }}>
              <T v="display" color={theme.heroInk}>MindPay</T>
              <Shine times={2} delay={700} color="rgba(255,236,170,0.35)" />
            </View>
          </Reveal>
          <Reveal index={3} from={12}>
            <T v="body" color={theme.heroInkSoft} center>รู้ก่อนจ่าย เห็นว่าเงินจะอยู่ได้อีกกี่วัน</T>
          </Reveal>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: space.sm }}>
            {VALUE_POINTS.map((v, i) => (
              <Reveal key={v.label} index={4 + i} from={10} zoom>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: radius.pill,
                  backgroundColor: 'rgba(244,241,230,0.10)',
                  borderWidth: 1,
                  borderColor: 'rgba(244,241,230,0.18)',
                }}
              >
                <Ionicons name={v.icon} size={14} color={theme.heroAccent} />
                <T v="micro" color="#E8E1CC">
                  {v.label}
                </T>
              </View>
              </Reveal>
            ))}
          </View>
        </LinearGradient>
        </View>

        <View style={{ padding: space.lg, gap: space.lg, marginTop: -space.xxl }}>
          <Reveal index={5} from={28}>
          <Card style={{ gap: space.md }}>
            {!cloudAvailable ? (
              <>
                <T v="h3">ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์</T>
                <T v="small">
                  แอปนี้ถูกสร้างโดยยังไม่มีค่า Supabase ในไฟล์ .env จึงใช้ได้เฉพาะโหมดทดลองที่เก็บข้อมูลในเครื่อง ดูวิธีตั้งค่าได้ใน README
                </T>
              </>
            ) : sent ? (
              <SentCard
                sent={sent}
                busy={busy}
                resendIn={resendIn}
                notice={notice}
                onResend={() => resend(sent.email, sent.kind)}
                onVerify={verifyCode}
                onConfirmed={() => run(() => signIn(sent.email, password, true))}
                onBack={() => {
                  setSent(null);
                  setNotice(null);
                  if (sent.kind === 'reset') setMode('signin');
                }}
              />
            ) : (
              <>
                {mode === 'forgot' ? (
                  <View style={{ gap: 4 }}>
                    <T v="h3">ลืมรหัสผ่าน</T>
                    <T v="small">ใส่อีเมลที่ใช้สมัคร เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้</T>
                  </View>
                ) : (
                  <Segmented<Mode>
                    options={[
                      { key: 'signin', label: 'เข้าสู่ระบบ' },
                      { key: 'signup', label: 'สมัครสมาชิก' },
                    ]}
                    value={mode}
                    onChange={switchMode}
                  />
                )}
                {mode === 'signup' ? <StepDots step={1} /> : null}
                {mode === 'signup' ? (
                  <Field
                    id="name"
                    label="ชื่อเล่น"
                    value={name}
                    onChangeText={setName}
                    placeholder="เช่น มิ้นท์"
                    maxLength={30}
                    error={fieldErrors.name}
                    inputProps={{ autoComplete: 'nickname', textContentType: 'nickname', returnKeyType: 'next' }}
                  />
                ) : null}
                <Field
                  id="email"
                  label="อีเมล"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  keyboardType="email-address"
                  error={fieldErrors.email}
                  inputProps={{
                    autoCapitalize: 'none',
                    autoCorrect: false,
                    autoComplete: 'email',
                    textContentType: 'emailAddress',
                    returnKeyType: mode === 'forgot' ? 'send' : 'next',
                    onSubmitEditing: mode === 'forgot' ? submit : undefined,
                  }}
                />
                {mode !== 'forgot' ? (
                  <PasswordField
                    id="password"
                    label="รหัสผ่าน"
                    value={password}
                    onChangeText={setPassword}
                    placeholder={`อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`}
                    hint={mode === 'signup' ? 'กดรูปตาเพื่อดูว่าพิมพ์ถูกไหม และจดรหัสไว้ให้ดี' : undefined}
                    error={fieldErrors.password}
                    isNew={mode === 'signup'}
                    onSubmit={submit}
                  />
                ) : null}

                {notice ? (
                  <NoticeBox
                    notice={notice}
                    resendIn={resendIn}
                    onResend={() => resend(normalizeEmail(email), 'confirm')}
                    onForgot={() => switchMode('forgot')}
                  />
                ) : null}

                <Button
                  label={mode === 'signin' ? 'เข้าสู่ระบบ' : mode === 'signup' ? 'สร้างบัญชี' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'}
                  onPress={submit}
                  loading={busy}
                />
                {mode === 'signin' ? (
                  <TextLink label="ลืมรหัสผ่าน?" onPress={() => switchMode('forgot')} />
                ) : mode === 'forgot' ? (
                  <TextLink label="กลับไปเข้าสู่ระบบ" onPress={() => switchMode('signin')} />
                ) : null}
              </>
            )}
          </Card>
          </Reveal>

          <Reveal index={7} style={{ gap: space.sm }}>
            <Button
              label="ลองใช้ด้วยข้อมูลตัวอย่าง"
              kind="ghost"
              icon="sparkles-outline"
              onPress={() => startDemo().catch(() => toast({ message: 'เปิดโหมดทดลองไม่สำเร็จ', tone: 'error' }))}
            />
            <T v="micro" center>
              โหมดทดลองเก็บข้อมูลไว้ในเครื่องนี้เท่านั้น อ่านสลิปและโค้ช AI ต้องใช้บัญชีจริง
            </T>
          </Reveal>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 4 }}>
      <T v="small" color={theme.primary} style={{ fontFamily: fonts.sansSemi }}>
        {label}
      </T>
    </Pressable>
  );
}

function NoticeBox({
  notice,
  resendIn,
  onResend,
  onForgot,
}: {
  notice: Notice;
  resendIn: number;
  onResend: () => void;
  onForgot: () => void;
}) {
  const theme = useTheme();
  const color = notice.tone === 'error' ? theme.critical : theme.primary;
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: color,
        backgroundColor: notice.tone === 'error' ? theme.criticalSoft : theme.surfaceAlt,
        padding: space.md,
        gap: space.sm,
      }}
    >
      <Row gap={space.sm} align="flex-start">
        <Ionicons name={notice.tone === 'error' ? 'alert-circle' : 'information-circle'} size={18} color={color} style={{ marginTop: 1 }} />
        <T v="small" color={theme.ink} style={{ flex: 1 }}>
          {notice.text}
        </T>
      </Row>
      {notice.action === 'resend' ? (
        <Button
          small
          kind="soft"
          icon="mail-outline"
          label={resendIn > 0 ? `ส่งอีเมลยืนยันอีกครั้ง (${resendIn})` : 'ส่งอีเมลยืนยันอีกครั้ง'}
          disabled={resendIn > 0}
          onPress={onResend}
        />
      ) : notice.action === 'forgot' ? (
        <Button small kind="soft" icon="key-outline" label="ลืมรหัสผ่าน ตั้งใหม่ทางอีเมล" onPress={onForgot} />
      ) : null}
    </View>
  );
}

function SentCard({
  sent,
  busy,
  resendIn,
  notice,
  onResend,
  onVerify,
  onConfirmed,
  onBack,
}: {
  sent: Sent;
  busy: boolean;
  resendIn: number;
  notice: Notice | null;
  onResend: () => void;
  onVerify: (code: string) => void;
  onConfirmed: () => void;
  onBack: () => void;
}) {
  const theme = useTheme();
  const [code, setCode] = useState('');
  const confirm = sent.kind === 'confirm';
  const complete = isOtpComplete(code);

  function change(text: string) {
    const next = cleanOtp(text);
    setCode(next);
    // Send as soon as the usual 6 digits are in, like SMS codes in banking apps.
    if (next.length === 6 && code.length < 6 && !busy) onVerify(next);
  }

  return (
    <View style={{ gap: space.md }}>
      {confirm ? <StepDots step={2} /> : null}
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: theme.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',
        }}
      >
        <Ionicons name={confirm ? 'mail-unread-outline' : 'key-outline'} size={28} color={theme.accent} />
      </View>
      <T v="h3" center>
        {confirm ? 'ยืนยันอีเมล' : 'ตั้งรหัสผ่านใหม่'}
      </T>
      <T v="small" center>
        ใส่รหัส 6 หลักที่ส่งไปที่{'\n'}
        <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>{sent.email}</T>
      </T>
      <TextInput
        nativeID="otp"
        accessibilityLabel="รหัสยืนยันจากอีเมล"
        value={code}
        onChangeText={change}
        placeholder="••••••"
        placeholderTextColor={theme.inkFaint}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoFocus
        maxLength={10}
        onSubmitEditing={() => complete && onVerify(code)}
        style={{
          borderWidth: 1.5,
          borderColor: notice?.tone === 'error' ? theme.critical : complete ? theme.primary : theme.line,
          borderRadius: radius.md,
          backgroundColor: theme.surface,
          paddingVertical: 14,
          fontFamily: fonts.serifBold,
          fontSize: 28,
          letterSpacing: 10,
          textAlign: 'center',
          color: theme.ink,
        }}
      />
      {notice ? <NoticeBox notice={notice} resendIn={resendIn} onResend={onResend} onForgot={onBack} /> : null}
      <Button label="ยืนยันรหัส" icon="shield-checkmark-outline" onPress={() => onVerify(code)} loading={busy} disabled={!complete} />
      <Button
        kind="soft"
        icon="refresh"
        label={resendIn > 0 ? `ขอรหัสใหม่ได้ใน ${resendIn} วินาที` : 'ขอรหัสใหม่'}
        disabled={resendIn > 0 || busy}
        onPress={onResend}
      />
      <View style={{ gap: 4, backgroundColor: theme.surfaceAlt, borderRadius: radius.lg, padding: space.md }}>
        <T v="micro">ไม่เจออีเมล? ดูในจดหมายขยะ/Spam ผู้ส่งคือ Supabase Auth</T>
        <T v="micro">
          {confirm
            ? 'ถ้าในอีเมลมีแต่ลิงก์ กดลิงก์ได้เลย แล้วกลับมากด "ยืนยันผ่านลิงก์แล้ว"'
            : 'ถ้าในอีเมลมีแต่ลิงก์ กดลิงก์ได้เลย MindPay จะเปิดช่องตั้งรหัสผ่านใหม่ให้'}
        </T>
      </View>
      {confirm ? <TextLink label="ยืนยันผ่านลิงก์แล้ว เข้าสู่ระบบ" onPress={onConfirmed} /> : null}
      <TextLink label={confirm ? 'แก้อีเมล / สมัครใหม่' : 'กลับไปเข้าสู่ระบบ'} onPress={onBack} />
    </View>
  );
}
