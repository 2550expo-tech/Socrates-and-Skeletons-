import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Anuphan_400Regular,
  Anuphan_500Medium,
  Anuphan_600SemiBold,
  Anuphan_700Bold,
} from '@expo-google-fonts/anuphan';
import { NotoSerifThai_600SemiBold, NotoSerifThai_700Bold } from '@expo-google-fonts/noto-serif-thai';
import { AppProvider, useApp } from '../data/AppProvider';
import { AutoScanProvider } from '../services/AutoScanProvider';
import { AuthNoticeHost } from '../ui/AuthNotice';
import { ToastProvider } from '../ui/feedback';
import { LaunchIntro } from '../ui/LaunchIntro';
import { UpdateBanner } from '../ui/UpdateBanner';
import { useTheme } from '../ui/theme';

// The native splash stays until the opening animation (LaunchIntro) takes over.
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
      <WebFrame>
        <AppProvider>
          <ToastProvider>
            <AutoScanProvider>
              <Navigator ready={fontsLoaded || !!fontError} />
            </AutoScanProvider>
          </ToastProvider>
        </AppProvider>
      </WebFrame>
    </SafeAreaProvider>
  );
}

/** On a computer browser, show the app at phone width in the middle of the screen. */
function WebFrame({ children }: { children: ReactNode }) {
  const theme = useTheme();
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: theme.dark ? '#050B08' : '#DDE6DF' }}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 440,
          backgroundColor: theme.bg,
          overflow: 'hidden',
          boxShadow: '0 0 40px rgba(8, 30, 22, 0.18)',
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Navigator({ ready }: { ready: boolean }) {
  const theme = useTheme();
  const { status, repo, profile } = useApp();
  const loading = !ready || status === 'loading';
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);

  const signedIn = status === 'ready' && !!repo;
  const needsOnboarding = signedIn && !!profile && !profile.onboarded;
  const inApp = signedIn && !needsOnboarding;

  return (
    <>
      <StatusBar style={!introDone || theme.dark ? 'light' : 'dark'} />
      {loading ? null : <Screens signedIn={signedIn} needsOnboarding={needsOnboarding} inApp={inApp} />}
      {loading || !introDone ? null : <AuthNoticeHost />}
      {loading || !introDone ? null : <UpdateBanner />}
      <LaunchIntro ready={!loading} fontsReady={ready} onDone={finishIntro} />
    </>
  );
}

function Screens({ signedIn, needsOnboarding, inApp }: { signedIn: boolean; needsOnboarding: boolean; inApp: boolean }) {
  const theme = useTheme();
  return (
    <>
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
