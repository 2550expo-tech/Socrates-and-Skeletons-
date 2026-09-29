/**
 * Phone app only: installed apps download new versions in the background
 * (EAS Update) but only switch to them after a full restart, so testers often
 * run an old version without knowing. When a new version is ready, offer a
 * one-tap restart. Also checks again when the app comes back to the screen
 * (at most every 30 minutes), not only at launch.
 */
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BUDDY_NAME } from '../domain/buddy';
import { Buddy } from './Buddy';
import { IconButton, T } from './components';
import { radius, space, useTheme } from './theme';

const CHECK_EVERY_MS = 30 * 60 * 1000;

/** Rendered only where over-the-air updates exist (not on the web, not in development). */
export function UpdateBanner() {
  if (Platform.OS === 'web' || __DEV__ || !Updates.isEnabled) return null;
  return <UpdateBannerInner />;
}

function UpdateBannerInner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isUpdatePending } = Updates.useUpdates();
  const [hidden, setHidden] = useState(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    lastCheck.current = Date.now(); // the launch check just happened (checkAutomatically: ON_LOAD)
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
      lastCheck.current = Date.now();
      try {
        const found = await Updates.checkForUpdateAsync();
        if (found.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Offline or the update server is busy: try again next time.
      }
    });
    return () => sub.remove();
  }, []);

  if (!isUpdatePending || hidden) return null;
  return (
    <View
      style={{ position: 'absolute', left: space.lg, right: space.lg, top: insets.top + space.sm, zIndex: 900 }}
      accessibilityLiveRegion="polite"
    >
      <Pressable
        onPress={() => Updates.reloadAsync().catch(() => setHidden(true))}
        accessibilityRole="button"
        accessibilityLabel="มี MindPay เวอร์ชันใหม่ แตะเพื่อเปิดใหม่"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          backgroundColor: theme.hero,
          borderRadius: radius.lg,
          paddingVertical: space.sm,
          paddingLeft: space.sm,
          paddingRight: 4,
          opacity: pressed ? 0.9 : 1,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        })}
      >
        <Buddy mood="cheer" size={40} still onDark />
        <View style={{ flex: 1 }}>
          <T v="small" color="#F4F1E6">{BUDDY_NAME}มีเวอร์ชันใหม่มาแล้ว</T>
          <T v="micro" color={theme.heroAccent}>แตะเพื่อเปิดใหม่ (ใช้เวลา 2–3 วินาที)</T>
        </View>
        <IconButton icon="close" label="ไว้ทีหลัง" color={theme.heroInkSoft} onPress={() => setHidden(true)} />
      </Pressable>
    </View>
  );
}
