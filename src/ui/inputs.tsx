import type { ReactNode } from 'react';
import { TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { T } from './components';
import { fonts, radius, space, useTheme } from './theme';

export function Field({
  id,
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  hint,
  error,
  maxLength,
  right,
}: {
  id: string;
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  hint?: string;
  error?: string | null;
  maxLength?: number;
  right?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>
        {label}
      </T>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: error ? theme.critical : theme.line,
          borderRadius: radius.md,
          backgroundColor: theme.surface,
          paddingHorizontal: 14,
        }}
      >
        <TextInput
          nativeID={id}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.inkFaint}
          keyboardType={keyboardType}
          multiline={multiline}
          maxLength={maxLength}
          style={{
            flex: 1,
            paddingVertical: 12,
            fontFamily: fonts.sans,
            fontSize: 15,
            color: theme.ink,
            minHeight: multiline ? 72 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
        {right}
      </View>
      {error ? (
        <T v="small" color={theme.critical}>{error}</T>
      ) : hint ? (
        <T v="micro">{hint}</T>
      ) : null}
    </View>
  );
}

/** Large amount entry set in the serif face, like the balance on the home screen. */
export function AmountField({
  id,
  value,
  onChangeText,
  color,
  error,
  flagged,
}: {
  id: string;
  value: string;
  onChangeText: (s: string) => void;
  color?: string;
  error?: string | null;
  flagged?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: space.xs, paddingVertical: space.md }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 2,
          borderBottomColor: error ? theme.critical : flagged ? theme.watch : theme.line,
          paddingHorizontal: space.md,
        }}
      >
        <T v="h1" color={color ?? theme.ink}>฿</T>
        <TextInput
          nativeID={id}
          accessibilityLabel="จำนวนเงิน (บาท)"
          value={value}
          onChangeText={(s) => onChangeText(s.replace(/[^0-9.,]/g, ''))}
          placeholder="0.00"
          placeholderTextColor={theme.inkFaint}
          keyboardType="decimal-pad"
          style={{
            fontFamily: fonts.serif,
            fontSize: 40,
            lineHeight: 54,
            minWidth: 140,
            textAlign: 'center',
            color: color ?? theme.ink,
            paddingVertical: 4,
            fontVariant: ['tabular-nums'],
          }}
        />
      </View>
      {error ? <T v="small" color={theme.critical}>{error}</T> : null}
    </View>
  );
}
