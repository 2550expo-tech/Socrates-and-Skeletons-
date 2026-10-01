import { useState, type ReactNode } from 'react';
import { Platform, TextInput, View, type KeyboardTypeOptions, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { IconButton, T } from './components';
import { fonts, radius, space, useTheme, type Theme } from './theme';

/**
 * The one look of every text box in the app (design system): surface fill, 1.5pt border in
 * `line`, `primary` while typing, `critical` when something is wrong; radius md.
 */
export function inputBox(theme: Theme, state: { focused?: boolean; error?: boolean } = {}): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: state.error ? theme.critical : state.focused ? theme.primary : theme.line,
    borderRadius: radius.md,
    backgroundColor: theme.surface,
    paddingHorizontal: 14,
  };
}

/**
 * The text inside an input box: body size, and 16 on the web, where iPhone Safari zooms the whole
 * page into any field with smaller text.
 */
export function inputText(theme: Theme): TextStyle {
  return { flex: 1, paddingVertical: 12, fontFamily: fonts.sans, fontSize: Platform.OS === 'web' ? 16 : 15, color: theme.ink };
}

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
  inputProps,
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
  /** Extra TextInput settings: autoComplete, secureTextEntry, onSubmitEditing, ... */
  inputProps?: Omit<TextInputProps, 'value' | 'onChangeText' | 'style'>;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>
        {label}
      </T>
      <View style={inputBox(theme, { focused, error: !!error })}>
        <TextInput
          {...inputProps}
          onFocus={(e) => {
            setFocused(true);
            inputProps?.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps?.onBlur?.(e);
          }}
          nativeID={id}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.inkFaint}
          keyboardType={keyboardType}
          multiline={multiline}
          maxLength={maxLength}
          style={[inputText(theme), { minHeight: multiline ? 72 : undefined, textAlignVertical: multiline ? 'top' : 'center' }]}
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

/** Password with a show / hide button, so people can check what they typed. */
export function PasswordField({
  id,
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  isNew,
  onSubmit,
}: {
  id: string;
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  /** true when creating a password (sign up, reset) so password managers offer to save it */
  isNew?: boolean;
  onSubmit?: () => void;
}) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <Field
      id={id}
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      hint={hint}
      error={error}
      maxLength={72}
      inputProps={{
        secureTextEntry: !visible,
        autoCapitalize: 'none',
        autoCorrect: false,
        autoComplete: isNew ? 'new-password' : 'current-password',
        textContentType: isNew ? 'newPassword' : 'password',
        returnKeyType: 'go',
        onSubmitEditing: onSubmit,
      }}
      right={
        <View style={{ marginRight: -8 }}>
          <IconButton
            icon={visible ? 'eye-off-outline' : 'eye-outline'}
            label={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
            color={theme.inkSoft}
            onPress={() => setVisible((v) => !v)}
          />
        </View>
      }
    />
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
            width: 220,
            maxWidth: '100%',
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
