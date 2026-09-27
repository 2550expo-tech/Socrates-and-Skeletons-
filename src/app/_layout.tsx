import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Anuphan_400Regular,
  Anuphan_500Medium,
  Anuphan_600SemiBold,
  Anuphan_700Bold,
} from '@expo-google-fonts/anuphan';
import { NotoSerifThai_600SemiBold, NotoSerifThai_700Bold } from '@expo-google-fonts/noto-serif-thai';
import { AppProvider, useApp } from '../data/AppProvider';
import { ToastProvider } from '../ui/feedback';
import { useTheme } from '../ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Anuphan_400Regular,
    Anuphan_500Medium,
    Anuphan_600SemiBold,
    Anuphan_700Bold,
    NotoSerifThai_600SemiBold,
    NotoSerifThai_700Bold,
  });
  return (
    <SafeAreaProvider>
      <AppProvider>
        <ToastProvider>
          <Navigator ready={fontsLoaded || !!fontError} />
        </ToastProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}

function Navigator({ ready }: { ready: boolean }) {
  const theme = useTheme();
  const { status, repo, profile } = useApp();
  const loading = !ready || status === 'loading';

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) return null;

  const signedIn = status === 'ready' && !!repo;
  const needsOnboarding = signedIn && !!profile && !profile.onboarded;
  const inApp = signedIn && !needsOnboarding;

  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="welcome" />
        </Stack.Protected>
        <Stack.Protected guard={needsOnboarding}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={inApp}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="transaction" options={{ presentation: 'modal' }} />
          <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="drafts" />
          <Stack.Screen name="settings" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
