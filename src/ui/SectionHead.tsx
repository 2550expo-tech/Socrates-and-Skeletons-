/**
 * Section heading of the redesign: a small English kicker in the theme colour
 * over a Thai title, with an optional link on the right ("ดูทั้งหมด →").
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons, Row, T } from './components';
import { fonts, space, useTheme } from './theme';

export function SectionHead({ kicker, title, action, onAction, right }: { kicker: string; title: string; action?: string; onAction?: () => void; right?: ReactNode }) {
  const theme = useTheme();
  return (
    <Row justify="space-between" align="flex-end" style={{ marginTop: space.sm, marginBottom: -space.xs }}>
      <View style={{ gap: 2, flex: 1 }}>
        <T v="label" color={theme.primary}>{kicker}</T>
        <T v="h2">{title}</T>
      </View>
      {right}
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" accessibilityLabel={action}>
          <Row gap={4}>
            <T v="small" color={theme.primary} style={{ fontFamily: fonts.sansSemi }}>
              {action}
            </T>
            <Ionicons name="arrow-forward" size={16} color={theme.primary} />
          </Row>
        </Pressable>
      ) : null}
    </Row>
  );
}
