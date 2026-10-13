/**
 * Section heading: a Thai title (a screen-reader heading), with an optional link
 * or control on the right ("ดูทั้งหมด ›"). Links are ink with a chevron (green
 * is kept for "selected" and money in). The English kickers of the first
 * redesign are gone: Thai screens read cleaner without them.
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons, Row, T } from './components';
import { fonts, space, useTheme } from './theme';

export function SectionHead({ title, action, onAction, right }: { kicker?: string; title: string; action?: string; onAction?: () => void; right?: ReactNode }) {
  const theme = useTheme();
  return (
    <Row justify="space-between" align="center" style={{ marginTop: space.sm, marginBottom: -space.xs }}>
      <View style={{ flex: 1 }}>
        <T v="h3" accessibilityRole="header">
          {title}
        </T>
      </View>
      {right}
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" accessibilityLabel={action} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Row gap={2}>
            <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>
              {action}
            </T>
            <Ionicons name="chevron-forward" size={16} color={theme.ink} />
          </Row>
        </Pressable>
      ) : null}
    </Row>
  );
}
