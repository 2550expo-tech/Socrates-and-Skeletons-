/**
 * One-time messages after an account event, shown over whatever screen the
 * app moved to (the sign-up form is gone by then, so the next screen starts
 * fresh):
 *   - "สมัครบัญชีสำเร็จ" with a small celebration
 *   - an email link that did not work
 *   - "ตั้งรหัสผ่านใหม่" after a password-reset link or code
 */
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useApp } from '../data/AppProvider';
import { supabase } from '../data/supabase';
import { authErrorMessage, MIN_PASSWORD_LENGTH } from '../domain/auth';
import { Buddy } from './Buddy';
import { Button, Ionicons, T } from './components';
import { useCelebrate } from './effects';
import { useToast } from './feedback';
import { PasswordField } from './inputs';
import { useReduceMotion } from './motion';
import { palette, radius, readableOn, space, useTheme } from './theme';

const useNative = Platform.OS !== 'web';

export function AuthNoticeHost() {
  const { authNotice, dismissAuthNotice } = useApp();
  if (!authNotice) return null;
  if (authNotice.kind === 'recovery') return <NewPasswordDialog onClose={dismissAuthNotice} />;
  if (authNotice.kind === 'link_error') {
    return <LinkErrorDialog message={authNotice.message} onClose={dismissAuthNotice} />;
  }
  return <SignedUpDialog name={authNotice.name ?? null} viaEmail={authNotice.kind === 'email_confirmed'} onClose={dismissAuthNotice} />;
}

/** Dimmed background that fades in, with a solid card that springs up into place. */
function DialogShell({ children, label }: { children: ReactNode; label: string }) {
  const theme = useTheme();
  const [fade] = useState(() => new Animated.Value(0));
  const [rise] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: useNative }),
      Animated.spring(rise, { toValue: 1, useNativeDriver: useNative, friction: 8, tension: 80 }),
    ]).start();
  }, [fade, rise]);
  return (
    <View accessibilityViewIsModal accessibilityLabel={label} style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay, opacity: fade }]} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', padding: space.xl }}
      >
        <Animated.View
          style={{
            backgroundColor: theme.surface,
            borderRadius: radius.xl,
            padding: space.xl,
            gap: space.md,
            opacity: fade,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 12 },
            elevation: 12,
            transform: [
              { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
              { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
            ],
          }}
        >
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const SPARKS = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(a) * 64, y: Math.sin(a) * 64, gold: i % 2 === 0 };
});

/** Gold badge with a check that pops, a ring and sparks that burst outward. */
function Celebration() {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const [pop] = useState(() => new Animated.Value(0));
  const [burst] = useState(() => new Animated.Value(0));
  useEffect(() => {
    // The success tap comes with the confetti (useCelebrate), not from here.
    if (reduce) {
      pop.setValue(1);
      burst.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.delay(120),
      Animated.parallel([
        Animated.spring(pop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: useNative }),
        Animated.timing(burst, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: useNative }),
      ]),
    ]).start();
  }, [pop, burst, reduce]);

  return (
    <View style={{ height: 150, alignItems: 'center', justifyContent: 'center' }} importantForAccessibility="no-hide-descendants">
      <Animated.View
        style={{
          position: 'absolute',
          width: 96,
          height: 96,
          borderRadius: 48,
          borderWidth: 2,
          borderColor: palette.goldBright,
          opacity: burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.8, 0] }),
          transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.7] }) }],
        }}
      />
      {SPARKS.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: s.gold ? 9 : 6,
            height: s.gold ? 9 : 6,
            borderRadius: 5,
            // Gold sparks plus the colour theme's own colour.
            backgroundColor: s.gold ? palette.goldBright : theme.primary,
            opacity: burst.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, s.x] }) },
              { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, s.y] }) },
              { scale: burst.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1.1, 0.6] }) },
            ],
          }}
        />
      ))}
      <Animated.View
        style={{
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
          opacity: pop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
        }}
      >
        <Buddy mood="cheer" size={112} />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          right: '30%',
          bottom: 14,
          width: 34,
          height: 34,
          borderRadius: 17,
          // Done = the meaning colour "good", ringed in the dialog's own surface.
          backgroundColor: theme.good,
          borderWidth: 3,
          borderColor: theme.surface,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pop.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] }) }],
        }}
      >
        <Ionicons name="checkmark" size={20} color={readableOn(theme.good, '#FFFFFF', theme.bg)} />
      </Animated.View>
    </View>
  );
}

function SignedUpDialog({ name, viaEmail, onClose }: { name: string | null; viaEmail: boolean; onClose: () => void }) {
  const theme = useTheme();
  const { profile } = useApp();
  const celebrate = useCelebrate();
  const ready = !!profile?.onboarded;
  useEffect(() => {
    const t = setTimeout(() => celebrate(), 260);
    return () => clearTimeout(t);
  }, [celebrate]);
  return (
    <DialogShell label="สมัครบัญชีสำเร็จ">
      <Celebration />
      <T v="h1" center accessibilityRole="header">
        สมัครบัญชีสำเร็จ
      </T>
      <T v="body" center color={theme.inkSoft}>
        {viaEmail ? 'ยืนยันอีเมลเรียบร้อย ' : ''}ยินดีต้อนรับสู่ MindPay{name ? ` คุณ${name}` : ''}
        {ready ? '' : '\nอีกขั้นเดียว ใส่ยอดเงินตอนนี้ แล้ว MindPay จะเริ่มคำนวณให้ทันที'}
      </T>
      <Button label={ready ? 'เริ่มใช้งาน' : 'ไปตั้งค่าเงิน'} kind="gold" icon="arrow-forward" onPress={onClose} />
    </DialogShell>
  );
}

function LinkErrorDialog({ message, onClose }: { message: string; onClose: () => void }) {
  const theme = useTheme();
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, []);
  return (
    <DialogShell label="ลิงก์ใช้ไม่ได้">
      <View style={{ alignItems: 'center' }}>
        <Ionicons name="link-outline" size={40} color={theme.watch} />
      </View>
      <T v="h2" center>
        ลิงก์ใช้ไม่ได้
      </T>
      <T v="body" center color={theme.inkSoft}>
        {message}
      </T>
      <Button label="ตกลง" onPress={onClose} />
    </DialogShell>
  );
}

function NewPasswordDialog({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
      return;
    }
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) {
        setError(authErrorMessage(e));
        return;
      }
      toast({ message: 'ตั้งรหัสผ่านใหม่แล้ว ใช้รหัสนี้ครั้งหน้าที่เข้าสู่ระบบ' });
      onClose();
    } catch (e) {
      setError(authErrorMessage(e as Error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogShell label="ตั้งรหัสผ่านใหม่">
      <View style={{ alignItems: 'center' }}>
        <Ionicons name="key-outline" size={36} color={theme.accent} />
      </View>
      <T v="h2" center>
        ตั้งรหัสผ่านใหม่
      </T>
      <T v="small" center>
        ตอนนี้คุณเข้าสู่ระบบแล้ว ตั้งรหัสผ่านใหม่ไว้ใช้ครั้งหน้า
      </T>
      <PasswordField
        id="new-password"
        label="รหัสผ่านใหม่"
        value={password}
        onChangeText={setPassword}
        placeholder={`อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`}
        error={error}
        isNew
        onSubmit={save}
      />
      <Button label="บันทึกรหัสผ่านใหม่" icon="checkmark" onPress={save} loading={busy} />
      <Button label="ไว้ทีหลัง" kind="ghost" onPress={onClose} disabled={busy} />
    </DialogShell>
  );
}
