/**
 * Keeps inputs and bottom buttons above the on-screen keyboard, on Android as well as iOS.
 *
 * Android: Expo SDK 57 / RN 0.86 draw edge to edge, where the window is no longer resized
 * for the keyboard (adjustResize has no effect), so the screen must make room itself.
 * React Native's KeyboardAvoidingView works out how much of it the keyboard covers; when
 * the window does get resized after all, that overlap is 0 and nothing is added twice.
 *
 * Its measurement is relative to its parent, though, while the keyboard's position is on
 * the screen. Below a header, under the status bar, or inside an iOS page sheet (which starts
 * lower on the screen) it would come out short. This wrapper measures where it really is
 * on the screen and passes that as keyboardVerticalOffset.
 */
import { useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View, type StyleProp, type ViewStyle } from 'react-native';

export function KeyboardAvoid({ children, style, ios = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; ios?: boolean }) {
  const box = useRef<View>(null);
  const [top, setTop] = useState(0);
  // The web resizes the page for the keyboard by itself.
  const enabled = Platform.OS === 'android' || (Platform.OS === 'ios' && ios);
  return (
    <View
      ref={box}
      collapsable={false}
      style={[{ flex: 1 }, style]}
      onLayout={() => box.current?.measureInWindow((_x, y) => setTop((t) => (Math.abs(t - y) > 1 ? y : t)))}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={enabled ? 'padding' : undefined} enabled={enabled} keyboardVerticalOffset={top}>
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}
