/**
 * FR-1 Transaction Management (MindPay ใหม่): every transaction grouped by day,
 * each day in one card with its total. Search, and chips to filter by money in /
 * out or by category. The spending calendar (FR-2) is one tap away (the
 * calendar icon). Tap a row to edit or delete it; add new ones with (+).
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, SectionList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp, useMoney } from '../../data/AppProvider';
import { getCategory } from '../../domain/categories';
import { bkkDayKey, previousMonth, relativeDayLabel, thaiWeekday } from '../../domain/dates';
import { formatBaht } from '../../domain/money';
import { recapMonths, spendCalendar } from '../../domain/recap';
import { groupByDay } from '../../domain/summary';
import { Button, Card, Chip, Divider, EmptyState, IconButton, Ionicons, Row, T } from '../../ui/components';
import { Buddy } from '../../ui/Buddy';
import { SpendCalendar } from '../../ui/SpendCalendar';
import { TxRow } from '../../ui/TxRow';
import { inputBox, inputText } from '../../ui/inputs';
import { radius, space, useTheme } from '../../ui/theme';
import { TitleDecor } from '../../ui/halloween';

/** all, money in / out, or one category (`cat:food`). */
type Filter = 'all' | 'expense' | 'income' | `cat:${string}`;

export default function Transactions() {
  const theme = useTheme();
  const { txs, refresh, refreshing, today } = useApp();
  const { drafts } = useMoney();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState<string | null>(null);
  const cal = useMemo(() => spendCalendar(txs, month, today), [txs, month, today]);
  // Months that can be shown: back to the oldest with records, never past this month.
  const oldest = useMemo(() => recapMonths(txs).at(-1) ?? today.slice(0, 7), [txs, today]);
  const nextMonth = (m: string) => {
    const [y, mm] = m.split('-').map(Number);
    return mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, '0')}`;
  };
  const canPrev = month > oldest;
  const canNext = month < today.slice(0, 7);

  // Category chips: the categories this person actually uses, most used first.
  const categories = useMemo(() => {
    const count = new Map<string, number>();
    for (const t of txs) if (t.status === 'confirmed') count.set(t.categoryKey, (count.get(t.categoryKey) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => getCategory(k));
  }, [txs]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = txs
      .filter((t) => t.status === 'confirmed')
      .filter((t) => filter === 'all' || t.kind === filter || filter === `cat:${t.categoryKey}`)
      .filter((t) => !day || bkkDayKey(t.occurredAt) === day)
      .filter((t) => !q || t.title.toLowerCase().includes(q) || getCategory(t.categoryKey).label.includes(q) || (t.note ?? '').toLowerCase().includes(q));
    return groupByDay(list).map((g) => ({ title: g.day, net: g.netSatang, data: g.items }));
  }, [txs, filter, query, day]);

  return (
    <SafeAreaView testID="transactions-screen" edges={['top']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ paddingHorizontal: space.lg, gap: space.md, paddingTop: space.sm, paddingBottom: space.sm }}>
        <Row justify="space-between">
          <Row gap={space.sm} align="flex-end">
            <View style={{ gap: 2 }}>
              <T v="label">รายรับ · รายจ่าย</T>
              <T v="h1">รายการ</T>
            </View>
            <TitleDecor />
          </Row>
          <IconButton
            icon={showCalendar ? 'calendar' : 'calendar-outline'}
            label={showCalendar ? 'ซ่อนปฏิทิน' : 'ดูปฏิทินการใช้จ่าย'}
            color={showCalendar ? theme.accentInk : theme.ink}
            onPress={() => {
              setShowCalendar((v) => !v);
              setDay(null);
            }}
          />
        </Row>
        <View style={[inputBox(theme, { focused: searching }), { gap: space.sm, borderRadius: radius.pill, backgroundColor: theme.surfaceAlt, borderColor: searching ? theme.primary : theme.surfaceAlt }]}>
          <Ionicons name="search" size={18} color={theme.inkSoft} />
          <TextInput
            nativeID="tx-search"
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearching(true)}
            onBlur={() => setSearching(false)}
            placeholder="ค้นหารายการ"
            placeholderTextColor={theme.inkFaint}
            accessibilityLabel="ค้นหารายการ"
            // The pill's border shows focus; no extra square browser outline inside it.
            style={[inputText(theme), { paddingVertical: 10, outlineWidth: 0 }]}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }} style={{ marginHorizontal: -space.lg, paddingLeft: space.lg }}>
          <Chip label="ทั้งหมด" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="รายจ่าย" selected={filter === 'expense'} onPress={() => setFilter('expense')} />
          <Chip label="รายรับ" selected={filter === 'income'} onPress={() => setFilter('income')} />
          {categories.map((c) => (
            <Chip key={c.key} glyph={c.glyph} label={c.label} selected={filter === `cat:${c.key}`} onPress={() => setFilter(`cat:${c.key}`)} />
          ))}
        </ScrollView>
        {drafts.length > 0 ? (
          <Card onPress={() => router.push('/drafts')} style={{ paddingVertical: space.md, borderColor: theme.accent, borderWidth: 1.5 }}>
            <Row gap={space.sm}>
              <Ionicons name="receipt-outline" size={20} color={theme.accentInk} />
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
        ListHeaderComponent={
          showCalendar ? (
            <View style={{ gap: space.sm, paddingTop: space.xs }}>
              <SpendCalendar
                cal={cal}
                selected={day}
                onSelect={setDay}
                onPrev={canPrev ? () => { setMonth(previousMonth(month)); setDay(null); } : undefined}
                onNext={canNext ? () => { setMonth(nextMonth(month)); setDay(null); } : undefined}
              />
              {day ? <Button label="ดูทุกวัน" kind="soft" small icon="close" onPress={() => setDay(null)} style={{ alignSelf: 'flex-start' }} /> : null}
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <Row justify="space-between" style={{ backgroundColor: theme.bg, paddingTop: space.lg, paddingBottom: space.sm }}>
            <T v="small" color={theme.inkSoft}>
              {relativeDayLabel(section.title)} • {thaiWeekday(section.title)}
            </T>
            <T v="small" color={theme.ink} style={{ fontVariant: ['tabular-nums'] }}>
              ({formatBaht(section.net, { sign: true, decimals: false })})
            </T>
          </Row>
        )}
        renderItem={({ item, index, section }) => {
          const first = index === 0;
          const last = index === section.data.length - 1;
          return (
            <View
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.line,
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderTopWidth: first ? 1 : 0,
                borderBottomWidth: last ? 1 : 0,
                borderTopLeftRadius: first ? radius.lg : 0,
                borderTopRightRadius: first ? radius.lg : 0,
                borderBottomLeftRadius: last ? radius.lg : 0,
                borderBottomRightRadius: last ? radius.lg : 0,
                paddingHorizontal: space.md,
                paddingTop: first ? space.xs : 0,
                paddingBottom: last ? space.xs : 0,
              }}
            >
              {first ? null : <Divider />}
              <TxRow tx={item} />
            </View>
          );
        }}
        ListEmptyComponent={
          day ? (
            <EmptyState icon="calendar-outline" art={<Buddy mood="calm" size={84} />} title={`${relativeDayLabel(day)} ไม่มีรายการ`} body="แตะวันอื่นในปฏิทิน หรือกด ดูทุกวัน" />
          ) : query || filter !== 'all' ? (
            <EmptyState icon="search" art={<Buddy mood="thinking" size={84} />} title="ไม่พบรายการ" body="ลองเปลี่ยนคำค้นหรือตัวกรองดูนะ" />
          ) : (
            <EmptyState
              icon="wallet-outline"
              art={<Buddy mood="sleepy" size={84} />}
              title="ยังไม่มีรายการที่ยืนยัน"
              body="กดปุ่ม + ด้านล่าง เพื่อเลือกสลิป พูด หรือจดรายการแรก"
              action="เพิ่มรายการแรก"
              onAction={() => router.push('/add')}
            />
          )
        }
      />
    </SafeAreaView>
  );
}
