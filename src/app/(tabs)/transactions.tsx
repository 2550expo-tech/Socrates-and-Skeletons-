/**
 * FR-1 Transaction Management: every transaction, grouped by day, with search
 * and a filter. Tap a row to edit or delete it.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, SectionList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp, useMoney } from '../../data/AppProvider';
import { getCategory } from '../../domain/categories';
import { relativeDayLabel } from '../../domain/dates';
import { formatBaht } from '../../domain/money';
import { groupByDay } from '../../domain/summary';
import { Button, Card, Divider, EmptyState, IconButton, Ionicons, Row, Segmented, T } from '../../ui/components';
import { Buddy } from '../../ui/Buddy';
import { TxRow } from '../../ui/TxRow';
import { fonts, radius, space, useTheme } from '../../ui/theme';

type Filter = 'all' | 'expense' | 'income';

export default function Transactions() {
  const theme = useTheme();
  const { txs, refresh, refreshing, today } = useApp();
  const { drafts } = useMoney();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = txs
      .filter((t) => t.status === 'confirmed')
      .filter((t) => filter === 'all' || t.kind === filter)
      .filter((t) => !q || t.title.toLowerCase().includes(q) || getCategory(t.categoryKey).label.includes(q) || (t.note ?? '').toLowerCase().includes(q));
    return groupByDay(list).map((g) => ({ title: g.day, net: g.netSatang, data: g.items }));
  }, [txs, filter, query]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ paddingHorizontal: space.lg, gap: space.md, paddingTop: space.sm, paddingBottom: space.sm }}>
        <Row justify="space-between">
          <T v="h1">รายการ</T>
          <IconButton icon="add-circle" label="จดรายการ" color={theme.primary} onPress={() => router.push('/transaction')} />
        </Row>
        <Row
          gap={space.sm}
          style={{ backgroundColor: theme.surface, borderRadius: radius.pill, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.line }}
        >
          <Ionicons name="search" size={18} color={theme.inkFaint} />
          <TextInput
            nativeID="tx-search"
            value={query}
            onChangeText={setQuery}
            placeholder="ค้นหาชื่อรายการหรือหมวด"
            placeholderTextColor={theme.inkFaint}
            accessibilityLabel="ค้นหารายการ"
            style={{ flex: 1, paddingVertical: 10, fontFamily: fonts.sans, fontSize: 15, color: theme.ink }}
          />
        </Row>
        <Segmented<Filter>
          options={[
            { key: 'all', label: 'ทั้งหมด' },
            { key: 'expense', label: 'รายจ่าย' },
            { key: 'income', label: 'รายรับ' },
          ]}
          value={filter}
          onChange={setFilter}
        />
        {drafts.length > 0 ? (
          <Card onPress={() => router.push('/drafts')} style={{ paddingVertical: space.md, borderColor: theme.accent }}>
            <Row gap={space.sm}>
              <Ionicons name="receipt-outline" size={20} color={theme.accent} />
              <T v="body" style={{ flex: 1 }}>สลิปรอยืนยัน {drafts.length} รายการ</T>
              <Ionicons name="chevron-forward" size={18} color={theme.inkFaint} />
            </Row>
          </Card>
        ) : null}
      </View>

      <SectionList
        extraData={today}
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 120 }}
        renderSectionHeader={({ section }) => (
          <Row justify="space-between" style={{ backgroundColor: theme.bg, paddingTop: space.md, paddingBottom: space.xs }}>
            <T v="label" color={theme.inkSoft}>{relativeDayLabel(section.title)}</T>
            <T v="small" style={{ fontVariant: ['tabular-nums'] }}>{formatBaht(section.net, { sign: true, decimals: false })}</T>
          </Row>
        )}
        renderItem={({ item, index }) => (
          <View>
            {index > 0 ? <Divider /> : null}
            <TxRow tx={item} />
          </View>
        )}
        ListEmptyComponent={
          query || filter !== 'all' ? (
            <EmptyState icon="search" art={<Buddy mood="thinking" size={84} />} title="ไม่พบรายการ" body="ลองเปลี่ยนคำค้นหรือตัวกรองดูนะ" />
          ) : (
            <EmptyState
              icon="wallet-outline"
              art={<Buddy mood="sleepy" size={84} />}
              title="ยังไม่มีรายการที่ยืนยัน"
              body="สแกนสลิปจากแกลเลอรี หรือจดรายจ่ายเงินสดด้วยตัวเอง"
              action="จดรายการแรก"
              onAction={() => router.push('/transaction')}
            />
          )
        }
        ListFooterComponent={sections.length > 0 ? <Button label="จดรายการใหม่" kind="soft" icon="add" onPress={() => router.push('/transaction')} style={{ marginTop: space.xl }} /> : null}
      />
    </SafeAreaView>
  );
}
