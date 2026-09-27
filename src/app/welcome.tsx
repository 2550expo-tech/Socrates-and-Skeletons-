/**
 * Welcome: sign in / sign up with email, or try the app with sample data.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../data/AppProvider';
import { cloudAvailable, supabase } from '../data/supabase';
import { ContourLines, MoneyTree } from '../ui/art';
import { Button, Card, Segmented, T } from '../ui/components';
import { useToast } from '../ui/feedback';
import { fonts, palette, radius, space, useTheme } from '../ui/theme';

type Mode = 'signin' | 'signup';

export default function Welcome() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { startDemo } = useApp();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const passwordOk = password.length >= 8;

  async function submit() {
    if (!supabase) return;
    setMessage(null);
    if (!emailOk) return setMessage('กรอกอีเมลให้ถูกต้อง เช่น name@example.com');
    if (!passwordOk) return setMessage('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setMessage(error.message.includes('Invalid') ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : error.message);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() } },
        });
        if (error) setMessage(error.message);
        else if (!data.session) setMessage('สมัครสำเร็จ เปิดอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ');
      }
    } catch {
      setMessage('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่');
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    borderWidth: 1.5,
    borderColor: theme.line,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: theme.ink,
    backgroundColor: theme.surface,
  } as const;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View
          style={{
            backgroundColor: palette.forest,
            paddingTop: insets.top + space.xxl,
            paddingBottom: space.xxxl + space.lg,
            paddingHorizontal: space.xl,
            borderBottomLeftRadius: radius.xl,
            borderBottomRightRadius: radius.xl,
            overflow: 'hidden',
            alignItems: 'center',
            gap: space.sm,
          }}
        >
          <ContourLines width={420} height={320} color={palette.goldBright} />
          <MoneyTree health={0.85} size={120} trunk="#E8E1CC" leaf={palette.goldBright} bare="#7FA491" />
          <T v="display" color="#F4F1E6" style={{ marginTop: space.sm }}>MindPay</T>
          <T v="body" color="#B9CEC2" center>รู้ก่อนจ่าย เห็นว่าเงินจะอยู่ได้อีกกี่วัน</T>
        </View>

        <View style={{ padding: space.lg, gap: space.lg, marginTop: -space.xxl }}>
          <Card style={{ gap: space.md }}>
            {cloudAvailable ? (
              <>
                <Segmented<Mode>
                  options={[
                    { key: 'signin', label: 'เข้าสู่ระบบ' },
                    { key: 'signup', label: 'สมัครสมาชิก' },
                  ]}
                  value={mode}
                  onChange={(m) => {
                    setMode(m);
                    setMessage(null);
                  }}
                />
                {mode === 'signup' ? (
                  <TextInput
                    nativeID="name"
                    value={name}
                    onChangeText={setName}
                    placeholder="ชื่อเล่น"
                    placeholderTextColor={theme.inkFaint}
                    style={inputStyle}
                    autoComplete="nickname"
                    accessibilityLabel="ชื่อเล่น"
                  />
                ) : null}
                <TextInput
                  nativeID="email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="อีเมล"
                  placeholderTextColor={theme.inkFaint}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  style={inputStyle}
                  accessibilityLabel="อีเมล"
                />
                <TextInput
                  nativeID="password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="รหัสผ่าน (อย่างน้อย 8 ตัว)"
                  placeholderTextColor={theme.inkFaint}
                  secureTextEntry
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  style={inputStyle}
                  accessibilityLabel="รหัสผ่าน"
                  onSubmitEditing={submit}
                />
                {message ? <T v="small" color={theme.critical}>{message}</T> : null}
                <Button label={mode === 'signin' ? 'เข้าสู่ระบบ' : 'สร้างบัญชี'} onPress={submit} loading={busy} />
              </>
            ) : (
              <>
                <T v="h3">ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์</T>
                <T v="small">
                  แอปนี้ถูกสร้างโดยยังไม่มีค่า Supabase ในไฟล์ .env จึงใช้ได้เฉพาะโหมดทดลองที่เก็บข้อมูลในเครื่อง
                  ดูวิธีตั้งค่าได้ใน README
                </T>
              </>
            )}
          </Card>

          <View style={{ gap: space.sm }}>
            <Button
              label="ลองใช้ด้วยข้อมูลตัวอย่าง"
              kind="ghost"
              icon="sparkles-outline"
              onPress={() => startDemo().catch(() => toast({ message: 'เปิดโหมดทดลองไม่สำเร็จ', tone: 'error' }))}
            />
            <T v="micro" center>
              โหมดทดลองเก็บข้อมูลไว้ในเครื่องนี้เท่านั้น อ่านสลิปและโค้ช AI ต้องใช้บัญชีจริง
            </T>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
