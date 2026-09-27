/**
 * Leave the current screen. On the web a screen can be opened directly (a
 * reload, a bookmark, a link from an email) with nothing behind it; then
 * "back" would do nothing, so go to the home screen instead.
 */
import { router } from 'expo-router';

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
