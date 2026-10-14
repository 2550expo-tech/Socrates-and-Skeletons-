/**
 * Shown instead of the app when the account's data could not be loaded at all
 * (offline at launch, the server down, a session that expired). The money
 * screens never open with made-up numbers (฿0, "0 วัน"), and the home-screen
 * widget is not overwritten with them.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Buddy } from './Buddy';
import { Button, T } from './components';
import { space, useTheme } from './theme';

export function ConnectionProblem({
  title,
  body,
  onRetry,
  onSignOut,
  signInFirst,
}: {
  title: string;
  body: string;
  onRetry: () => Promise<void>;
  onSignOut: () => Promise<void>;
  /** The session expired: signing in again is the main action. */
  signInFirst?: boolean;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onRetry();
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.xl, gap: space.md }} accessibilityLiveRegion="polite">
        <Buddy mood="worried" size={104} />
        <T v="h2" center accessibilityRole="header">
          {title}
        </T>
        <T v="body" center color={theme.inkSoft}>
          {body}
        </T>
        <View style={{ alignSelf: 'stretch', gap: space.sm, marginTop: space.md }}>
          {signInFirst ? (
            <>
              <Button label="เข้าสู่ระบบใหม่" icon="log-in-outline" onPress={() => onSignOut()} />
              <Button label="ลองอีกครั้ง" kind="ghost" onPress={retry} loading={busy} />
            </>
          ) : (
            <>
              <Button label="ลองอีกครั้ง" icon="refresh" onPress={retry} loading={busy} />
              <Button label="ออกจากระบบ" kind="ghost" onPress={() => onSignOut()} />
            </>
          )}
        </View>
        <T v="micro" center>
          ข้อมูลของคุณยังอยู่ในบัญชี ไม่มีอะไรหายเพราะเหตุนี้
        </T>
      </View>
    </SafeAreaView>
  );
}
