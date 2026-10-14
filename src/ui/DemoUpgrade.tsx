/**
 * The way out of demo mode into a real account, wherever the demo stops short
 * (reading slips, the AI coach, the "ทดลอง" badge on home). It asks first,
 * because leaving the demo clears its sample data, then opens the welcome
 * screen on "สมัครสมาชิก".
 */
import { useState } from 'react';
import { Pressable } from 'react-native';
import { useApp } from '../data/AppProvider';
import { Button, Ionicons, Row, T } from './components';
import { ConfirmSheet } from './feedback';
import { fonts, radius, useTheme } from './theme';

/** The welcome screen opens on this tab once (set just before leaving the demo). */
let welcomeStart: 'signin' | 'signup' = 'signin';
export function takeWelcomeStart(): 'signin' | 'signup' {
  const start = welcomeStart;
  welcomeStart = 'signin';
  return start;
}

export function DemoUpgrade({ variant = 'button' }: { variant?: 'button' | 'badge' }) {
  const theme = useTheme();
  const { repo, signOut } = useApp();
  const [asking, setAsking] = useState(false);
  if (repo?.mode !== 'demo') return null;
  return (
    <>
      {variant === 'badge' ? (
        <Pressable
          onPress={() => setAsking(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="โหมดทดลอง แตะเพื่อสมัครบัญชีจริง"
          style={({ pressed }) => ({ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: theme.accentSoft, opacity: pressed ? 0.7 : 1 })}
        >
          <Row gap={2}>
            <T v="micro" color={theme.accentInk} style={{ fontFamily: fonts.sansSemi }}>
              ทดลอง
            </T>
            <Ionicons name="chevron-forward" size={12} color={theme.accentInk} />
          </Row>
        </Pressable>
      ) : (
        <Button label="สมัครบัญชีจริง" icon="person-add-outline" kind="soft" onPress={() => setAsking(true)} />
      )}
      <ConfirmSheet
        visible={asking}
        title="สมัครบัญชีจริง?"
        body="บัญชีจริงอ่านสลิปและคุยกับโค้ช AI ได้ และเก็บข้อมูลไว้ในบัญชีของคุณ การออกจากโหมดทดลองจะล้างข้อมูลตัวอย่างในเครื่องนี้"
        confirmLabel="ไปหน้าสมัครสมาชิก"
        onConfirm={() => {
          setAsking(false);
          welcomeStart = 'signup';
          signOut().catch(() => {});
        }}
        onCancel={() => setAsking(false)}
      />
    </>
  );
}
