/**
 * Links in Supabase emails (confirm sign-up, reset password) and where they
 * bring the user back to. Reading the result is in src/domain/auth.ts.
 *
 * The return addresses must be allowed in Supabase Dashboard →
 * Authentication → URL Configuration → Redirect URLs:
 *   https://2550expo-tech.github.io/Socrates-and-Skeletons-/**   (web)
 *   mindpay://**                                                (Android / iOS app)
 * Anything else falls back to the Site URL.
 */
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

// Keep the address the web page was opened with, before the router touches it.
const openedWebUrl = isWeb ? window.location.href : null;

/** Where Supabase sends the user after they tap the link in an email. */
export function authRedirectUrl(): string {
  if (isWeb) {
    const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
    return `${window.location.origin}${base}/`;
  }
  return Linking.createURL('/');
}

/** The link that opened the app (or web page), if any. */
export async function openingLink(): Promise<string | null> {
  if (isWeb) return openedWebUrl;
  return Linking.getInitialURL().catch(() => null);
}

/** Links that arrive while the app is already open (phone only). */
export function onIncomingLink(handler: (url: string) => void): () => void {
  if (Platform.OS === 'web') return () => {};
  const sub = Linking.addEventListener('url', ({ url }) => handler(url));
  return () => sub.remove();
}

/** Remove tokens from the address bar so a reload or a shared screenshot does not expose them. */
export function clearLinkFromAddressBar() {
  if (!isWeb) return;
  window.history.replaceState(window.history.state, '', window.location.pathname);
}
