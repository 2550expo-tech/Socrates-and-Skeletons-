/**
 * Runs when Android asks for the home-screen widget (added, every 30 minutes,
 * resized), also while the app is closed: draw it from the last saved snapshot.
 * Buttons open the app with deep links (OPEN_URI), so clicks need nothing here.
 */
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { Storage } from '../data/storage';
import { WIDGET_SNAPSHOT_KEY, widgetView, type WidgetSnapshot } from '../domain/widget';
import { QuickWidget } from './QuickWidget';

export async function readWidgetSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await Storage.getItem(WIDGET_SNAPSHOT_KEY);
    const s = raw ? (JSON.parse(raw) as WidgetSnapshot) : null;
    return s?.v === 1 ? s : null;
  } catch {
    return null;
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  if (props.widgetAction === 'WIDGET_DELETED') return;
  const snapshot = await readWidgetSnapshot();
  props.renderWidget(<QuickWidget view={widgetView(snapshot)} />);
}
