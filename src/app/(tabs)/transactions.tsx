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
import { bkkDayKey, previousMonth, relativeDayLabel } from '../../domain/dates';
import { formatBaht } from '../../domain/money';
import { recapMonths, spendCalendar } from '../../domain/recap';
import { groupByDay } from '../../domain/summary';
import { Button, Card, Divider, EmptyState, IconButton, Ionicons, Row, Segmented, T } from '../../ui/components';
import { Buddy } from '../../ui/Buddy';
import { Reveal } from '../../ui/effects';
import { SpendCalendar } from '../../ui/SpendCalendar';
import { TxRow } from '../../ui/TxRow';
import { inputBox, inputText } from '../../ui/inputs';
import { space, useTheme } from '../../ui/theme';
import { TitleDecor } from '../../ui/halloween';

type Filter = 'all' | 'expense' | 'income';

export default function Transactions() {
  const theme = useTheme();
  const { txs, refresh, refreshing, today } = useApp();
  const { drafts } = useMoney();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [showCalendar, setShowCalendar] = useState(true);
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

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = txs
      .filter((t) => t.status === 'confirmed')
      .filter((t) => filter === 'all' || t.kind === filter)
      .filter((t) => !day || bkkDayKey(t.occurredAt) === day)
      .filter((t) => !q || t.title.toLowerCase().includes(q) || getCategory(t.categoryKey).label.includes(q) || (t.note ?? '').toLowerCase().includes(q));
    return groupByDay(list).map((g) => ({ title: g.day, net: g.netSatang, data: g.items }));
  }, [txs, filter, query, day]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ paddingHorizontal: space.lg, gap: space.md, paddingTop: space.sm, paddingBottom: space.sm }}>
        <Row justify="space-between">
          <Row gap={space.sm} align="flex-end">
            <View style={{ gap: 2 }}>
              <T v="label">รายรับ · รายจ่าย</T>
              <T v="h1">รายการ</T>
            </View>
            <TitleDecor />
          </Row>
          <Row gap={space.xs}>
            <IconButton
              icon={showCalendar ? 'calendar' : 'calendar-outline'}
              label={showCalendar ? 'ซ่อนปฏิทิน' : 'ดูปฏิทินการใช้จ่าย'}
              color={showCalendar ? theme.accentInk : theme.ink}
              onPress={() => {
                setShowCalendar((v) => !v);
                setDay(null);
              }}
            />
            <IconButton icon="add-circle" label="จดรายการ" color={theme.primary} onPress={() => router.push('/transaction')} />
          </Row>
        </Row>
        <View style={[inputBox(theme, { focused: searching }), { gap: space.sm }]}>
          <Ionicons name="search" size={18} color={theme.inkSoft} />
          <TextInput
            nativeID="tx-search"
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearching(true)}
            onBlur={() => setSearching(false)}
            placeholder="ค้นหาชื่อรายการหรือหมวด"
            placeholderTextColor={theme.inkFaint}
            accessibilityLabel="ค้นหารายการ"
            style={[inputText(theme), { paddingVertical: 10 }]}
          />
        </View>
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
          <Row justify="space-between" style={{ backgroundColor: theme.bg, paddingTop: space.md, paddingBottom: space.xs }}>
            <T v="label" color={theme.inkSoft}>{relativeDayLabel(section.title)}</T>
            <T v="small" style={{ fontVariant: ['tabular-nums'] }}>{formatBaht(section.net, { sign: true, decimals: false })}</T>
          </Row>
        )}
        renderItem={({ item, index }) => (
          <Reveal index={Math.min(index, 6)} from={8}>
            {index > 0 ? <Divider /> : null}
            <TxRow tx={item} />
          </Reveal>
        )}
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
