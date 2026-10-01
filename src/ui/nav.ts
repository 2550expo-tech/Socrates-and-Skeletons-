/**
 * Leave the current screen. On the web a screen can be opened directly (a
 * reload, a bookmark, a link from an email) with nothing behind it; then
 * "back" would do nothing, so go to the home screen instead.
 */
import { router, useNavigation } from 'expo-router';

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * Leave after something async finished (a save): only if this screen is still the one on show.
 * The user may have closed it already while it was saving; going back again would also close
 * the screen under it.
 */
export function useLeaveWhenDone(): () => void {
  const navigation = useNavigation();
  return () => {
    if (navigation.isFocused()) goBack();
  };
}
