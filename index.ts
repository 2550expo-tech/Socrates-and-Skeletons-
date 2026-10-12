// App entry. The Android home-screen widget's task handler is registered first,
// because Android also runs it while the app is closed (src/widget/register.android.ts;
// web and iOS load an empty file). Then Expo Router starts the app as usual.
import './src/widget/register';
import 'expo-router/entry';
