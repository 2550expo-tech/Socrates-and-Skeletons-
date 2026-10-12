/**
 * Android: keeps the home-screen widget in step with the app. The app saves a
 * small snapshot (today's spending, balance, runway, theme colours) whenever it
 * changes and redraws every widget on the home screen; Android redraws from the
 * same snapshot when the app is closed (src/widget/taskHandler.tsx).
 */
import { requestPinWidget, requestWidgetUpdate } from 'react-native-android-widget';
import { Storage } from '../data/storage';
import { DEFAULT_WIDGET_COLORS, WIDGET_NAME, WIDGET_SNAPSHOT_KEY, widgetView, type WidgetSnapshot } from '../domain/widget';
import { QuickWidget } from '../widget/QuickWidget';

export const widgetAvailable = true;

export async function saveWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  await Storage.setItem(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
  await requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: () => <QuickWidget view={widgetView(snapshot)} />,
  });
}

export async function clearWidget(): Promise<void> {
  await saveWidgetSnapshot({
    v: 1,
    day: '',
    spentSatang: 0,
    balanceSatang: 0,
    depletionDay: null,
    runwayCapped: false,
    belowFloor: false,
    signedIn: false,
    colors: DEFAULT_WIDGET_COLORS,
  });
}

export async function pinQuickWidget(): Promise<boolean> {
  try {
    return await requestPinWidget({ widgetName: WIDGET_NAME });
  } catch {
    return false;
  }
}
