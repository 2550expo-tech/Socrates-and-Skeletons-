/** Android: the home-screen widget's task handler, registered before the app starts (see index.ts). */
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './taskHandler';

registerWidgetTaskHandler(widgetTaskHandler);
