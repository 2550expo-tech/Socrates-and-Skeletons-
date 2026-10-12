/**
 * The Android home-screen widget, seen from the app (see quickWidget.android.tsx).
 * Web and iOS: there is no widget, so these do nothing.
 */
import type { WidgetSnapshot } from '../domain/widget';

/** True only in the Android app. */
export const widgetAvailable = false;

/** Save what the widget shows and redraw it. */
export async function saveWidgetSnapshot(_snapshot: WidgetSnapshot): Promise<void> {}

/** After signing out: the widget asks to open the app instead of showing the last account's numbers. */
export async function clearWidget(): Promise<void> {}

/** Ask the launcher to put the widget on the home screen. False when it cannot. */
export async function pinQuickWidget(): Promise<boolean> {
  return false;
}
