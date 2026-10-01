import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { isNewFromSlip } from '../domain/buddy';
import { getCategory } from '../domain/categories';
import { bkkTime } from '../domain/dates';
import { FLAG_LABEL, type ReviewFlag } from '../domain/slip';
import type { Transaction } from '../domain/types';
import { Badge, Money, Row, T } from './components';
import { radius, space, useTheme } from './theme';

/** One transaction in a list. Tapping opens it for editing (FR-1). */
export function TxRow({ tx, showTime = true }: { tx: Transaction; showTime?: boolean }) {
  const theme = useTheme();
  const cat = getCategory(tx.categoryKey);
  const draft = tx.status === 'draft';
  const fresh = isNewFromSlip(tx);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/transaction', params: { id: tx.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${tx.title} ${tx.kind === 'income' ? 'รายรับ' : 'รายจ่าย'} ${tx.amountSatang / 100} บาท${draft ? ' รอยืนยัน' : ''}${fresh ? ' ใหม่วันนี้' : ''}`}
      style={({ pressed }) => ({ paddingVertical: space.md, opacity: pressed ? 0.6 : 1 })}
    >
      <Row gap={space.md}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: radius.md,
            backgroundColor: draft ? theme.accentSoft : theme.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <T v="h3">{cat.glyph}</T>
          {fresh ? (
            <View
              accessibilityLabel="ใหม่วันนี้"
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: theme.accent,
                borderWidth: 2,
                borderColor: theme.surface,
              }}
            />
          ) : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="body" numberOfLines={1}>
            {tx.title || cat.label}
          </T>
          <Row gap={6}>
            <T v="micro" numberOfLines={1}>
              {cat.label}
              {showTime ? ` · ${bkkTime(tx.occurredAt)}` : ''}
              {tx.source === 'slip' ? (fresh ? ' · จดจากสลิปวันนี้' : ' · จากสลิป') : ''}
            </T>
          </Row>
          {draft ? (
            <Row gap={4} style={{ flexWrap: 'wrap', marginTop: 2 }}>
              {tx.reviewFlags.length === 0 ? (
                <Badge label="พร้อมยืนยัน" tone="good" />
              ) : (
                tx.reviewFlags.map((f) => <Badge key={f} label={`ตรวจ${FLAG_LABEL[f as ReviewFlag] ?? f}`} tone="watch" />)
              )}
            </Row>
          ) : null}
        </View>
        <Money
          satang={tx.kind === 'income' ? tx.amountSatang : -tx.amountSatang}
          size="h3"
          sign
          color={draft ? theme.inkSoft : tx.kind === 'income' ? theme.income : theme.expense}
        />
      </Row>
    </Pressable>
  );
}
