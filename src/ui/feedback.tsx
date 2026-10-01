/**
 * Toasts (short confirmations with optional Undo) and a confirmation sheet
 * for irreversible actions such as deleting a transaction.
 */
import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, T } from './components';
import { buildTheme, fonts, radius, readableOn, space, useTheme } from './theme';

interface ToastOptions {
  message: string;
  tone?: 'info' | 'error';
  action?: { label: string; onPress: () => void };
}

const ToastContext = createContext<(t: ToastOptions) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  // The message sits on the theme's ink; its button uses the theme's accent (light mode) or the
  // light-mode main colour (dark mode), falling back to plain text colour if that would be faint.
  const light = buildTheme(theme.colorTheme, false);
  const actionColor = readableOn(theme.ink, theme.dark ? light.primary : theme.accent, theme.bg);
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (t: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      setToast(t);
      // iOS VoiceOver ignores live regions: say the message out loud (Android and the web use the live region).
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(t.message);
      if (t.tone === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Animated.spring(anim, { toValue: 1, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
      }, t.action ? 5000 : 2800);
    },
    [anim],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          accessibilityLiveRegion={toast.tone === 'error' ? 'assertive' : 'polite'}
          style={{
            position: 'absolute',
            left: space.lg,
            right: space.lg,
            bottom: insets.bottom + 96,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          }}
        >
          <View
            style={{
              // The colour theme's own ink, so the message matches every theme (not only the green one).
              backgroundColor: toast.tone === 'error' ? theme.critical : theme.ink,
              borderRadius: radius.md,
              paddingVertical: 12,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: toast.tone === 'error' ? readableOn(theme.critical, '#FFFFFF', theme.bg) : theme.bg }}>
              {toast.message}
            </Text>
            {toast.action ? (
              <Pressable
                onPress={() => {
                  toast.action?.onPress();
                  setToast(null);
                }}
                hitSlop={10}
                accessibilityRole="button"
              >
                <Text style={{ fontFamily: fonts.sansBold, fontSize: 14, color: actionColor }}>{toast.action.label}</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={{ flex: 1, backgroundColor: theme.overlay }} onPress={onCancel} accessibilityRole="button" accessibilityLabel="ปิด" />
      <View
        style={{
          backgroundColor: theme.surface,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          padding: space.xl,
          paddingBottom: insets.bottom + space.xl,
          gap: space.md,
        }}
      >
        <T v="h2">{title}</T>
        <T v="body" color={theme.inkSoft}>{body}</T>
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Button label={confirmLabel} kind={destructive ? 'danger' : 'primary'} onPress={onConfirm} />
          <Button label="ยกเลิก" kind="ghost" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}
