/**
 * The one header every pushed screen uses: back (or ✕ for sheets) on the left,
 * the title in the middle (a screen-reader heading), an optional action on the
 * right. It sits on the page colour and does not scroll away.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { IconButton, T } from './components';
import { HeaderDecor } from './halloween';
import { goBack } from './nav';
import { space, useTheme } from './theme';

const SLOT = 44;

export function StackHeader({ title, close, onBack, right }: { title: string; close?: boolean; onBack?: () => void; right?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs, backgroundColor: theme.bg }}>
      <View style={{ width: SLOT, alignItems: 'flex-start' }}>
        <IconButton icon={close ? 'close' : 'chevron-back'} label={close ? 'ปิด' : 'กลับ'} onPress={onBack ?? (() => goBack())} />
      </View>
      <T v="h3" center numberOfLines={1} accessibilityRole="header" style={{ flex: 1, paddingHorizontal: space.xs }}>
        {title}
      </T>
      <View style={{ minWidth: SLOT, alignItems: 'flex-end' }}>{right ?? <HeaderDecor />}</View>
    </View>
  );
}
