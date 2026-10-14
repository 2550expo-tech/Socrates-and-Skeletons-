/**
 * Leave the current screen. On the web a screen can be opened directly (a
 * reload, a bookmark, a link from an email) with nothing behind it; then
 * "back" would do nothing, so go to the home screen instead.
 */
import { router, useNavigation } from 'expo-router';
import { usePreventRemove, type NavigationAction } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';

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

type Action = NavigationAction;

/**
 * Ask before throwing away unsaved changes, however the user leaves: the on-screen ✕ or
 * back, Android's back button, the iOS swipe-down of a sheet, or the browser's back.
 *
 * - `requestLeave()` for the on-screen button (asks only when there is something to lose)
 * - `asking` shows the confirm sheet; `stay()` / `leave()` answer it
 * - `release()` before leaving on purpose (after a save or a delete): no question, then
 *   `onReleased` runs once the screen may go
 */
export function useConfirmLeave(dirty: boolean, onReleased?: () => void) {
  const navigation = useNavigation();
  const [asking, setAsking] = useState(false);
  const [released, setReleased] = useState(false);
  /** What the user tried to do: a navigation action (back button, swipe) or the on-screen close (null). */
  const pending = useRef<{ action: Action | null } | null>(null);
  const after = useRef(onReleased);
  useEffect(() => {
    after.current = onReleased;
  });

  usePreventRemove(dirty && !released, ({ data }) => {
    pending.current = { action: data.action };
    setAsking(true);
  });

  // Once nothing blocks leaving any more, carry out what was asked for.
  useEffect(() => {
    if (!released) return;
    const p = pending.current;
    pending.current = null;
    if (p?.action) navigation.dispatch(p.action);
    else if (p) goBack();
    else after.current?.();
  }, [released, navigation]);

  return {
    asking,
    requestLeave() {
      if (!dirty) return goBack();
      pending.current = { action: null };
      setAsking(true);
    },
    stay() {
      pending.current = null;
      setAsking(false);
    },
    leave() {
      setAsking(false);
      setReleased(true);
    },
    release() {
      pending.current = null;
      setReleased(true);
    },
  };
}
