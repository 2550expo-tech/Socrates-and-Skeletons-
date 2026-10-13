/**
 * FR-1 Transaction Management (MindPay ใหม่): every transaction grouped by day,
 * each day in one card; its header says what went out and what came in that day
 * ("ใช้ ฿261 · รับ ฿500"). Search; one switch for all / money out / money in, and
 * "หมวด ▾" opens the categories (kept out of sight until wanted). The spending
 * calendar (FR-2) is one tap away (the calendar icon). Tap a row to edit or
 * delete it; add new ones with (+).
 */
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, SectionList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp, useMoney } from '../../data/AppProvider';
import { getCategory } from '../../domain/categories';
import { bkkDayKey, formatThaiDay, previousMonth, relativeDayLabel, thaiWeekday } from '../../domain/dates';
import { formatBaht } from '../../domain/money';
import { recapMonths, spendCalendar } from '../../domain/recap';
import { groupByDay } from '../../domain/summary';
import type { Transaction, TxKind } from '../../domain/types';
import { Button, Card, Chip, Divider, EmptyState, IconButton, Ionicons, Row, Segmented, T } from '../../ui/components';
import { Buddy } from '../../ui/Buddy';
import { SpendCalendar } from '../../ui/SpendCalendar';
import { TxRow } from '../../ui/TxRow';
import { categoryLook } from '../../ui/category';
import { inputBox, inputText } from '../../ui/inputs';
import { alpha, fonts, radius, space, useTheme } from '../../ui/theme';
import { TitleDecor } from '../../ui/halloween';

type KindFilter = 'all' | TxKind;

const KINDS: { key: KindFilter; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'expense', label: 'รายจ่าย' },
  { key: 'income', label: 'รายรับ' },
];

type Section = { title: string; spent: number; got: number; data: Transaction[] };

export default function Transactions() {
  const theme = useTheme();
  const { txs, refresh, refreshing, today } = useApp();
  const { drafts } = useMoney();
  const list = useRef<SectionList<Transaction, Section>>(null);
  const [kind, setKind] = useState<KindFilter>('all');
  const [cat, setCat] = useState<string | null>(null);
  const [showCats, setShowCats] = useState(false);
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

  // Category chips: the categories this person actually uses (of the chosen kind), most used first.
  const categories = useMemo(() => {
    const count = new Map<string, number>();
    for (const t of txs) if (t.status === 'confirmed') count.set(t.categoryKey, (count.get(t.categoryKey) ?? 0) + 1);
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => getCategory(k))
      .filter((c) => kind === 'all' || c.kind === kind);
  }, [txs, kind]);
  const chosen = cat ? getCategory(cat) : null;

  const sections = useMemo<Section[]>(() => {
    const q = query.trim().toLowerCase();
    const shown = txs
      .filter((t) => t.status === 'confirmed')
      .filter((t) => kind === 'all' || t.kind === kind)
      .filter((t) => !cat || t.categoryKey === cat)
      .filter((t) => !day || bkkDayKey(t.occurredAt) === day)
      .filter((t) => !q || t.title.toLowerCase().includes(q) || getCategory(t.categoryKey).label.includes(q) || (t.note ?? '').toLowerCase().includes(q));
    return groupByDay(shown).map((g) => ({ title: g.day, spent: g.spentSatang, got: g.inSatang, data: g.items }));
  }, [txs, kind, cat, query, day]);

  const toTop = () => list.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true });

  return (
    <SafeAreaView testID="transactions-screen" edges={['top']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ paddingHorizontal: space.lg, gap: space.md, paddingTop: space.md, paddingBottom: space.xs }}>
        <Row justify="space-between">
          <Row gap={space.sm} align="flex-end">
            <T v="h1" accessibilityRole="header">
              รายการ
            </T>
            <TitleDecor />
          </Row>
          <IconButton
            icon={showCalendar ? 'calendar' : 'calendar-outline'}
            label={showCalendar ? 'ซ่อนปฏิทิน' : 'ดูปฏิทินการใช้จ่าย'}
            color={showCalendar ? theme.primary : theme.ink}
            onPress={() => {
              setShowCalendar((v) => !v);
              setDay(null);
              toTop();
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
            placeholderTextColor={theme.inkSoft}
            accessibilityLabel="ค้นหารายการ"
            // The pill's border shows focus; no extra square browser outline inside it.
            style={[inputText(theme), { paddingVertical: 10, outlineWidth: 0 }]}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="ล้างคำค้น">
              <Ionicons name="close-circle" size={18} color={theme.inkSoft} />
            </Pressable>
          ) : null}
        </View>
        <Row gap={space.sm}>
          <View style={{ flex: 1 }}>
            <Segmented
              options={KINDS}
              value={kind}
              onChange={(k) => {
                setKind(k);
                // A category of the other kind would leave nothing to show.
                if (chosen && k !== 'all' && chosen.kind !== k) setCat(null);
              }}
            />
          </View>
          <Pressable
            onPress={() => setShowCats((v) => !v)}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="button"
            aria-expanded={showCats}
            accessibilityLabel={chosen ? `หมวด ${chosen.label} เปลี่ยนหมวด` : 'เลือกหมวด'}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              maxWidth: 150,
              height: 42,
              paddingHorizontal: 12,
              borderRadius: radius.pill,
              borderWidth: 1.5,
              borderColor: chosen ? theme.primary : 'transparent',
              backgroundColor: chosen ? alpha(theme.primary, theme.dark ? 0.24 : 0.12) : theme.surfaceAlt,
            }}
          >
            {chosen ? <Ionicons name={categoryLook(chosen.key, theme).icon} size={15} color={categoryLook(chosen.key, theme).ink} /> : null}
            <T v="small" numberOfLines={1} color={theme.ink} style={{ fontFamily: fonts.sansSemi, flexShrink: 1 }}>
              {chosen ? chosen.label : 'หมวด'}
            </T>
            <Ionicons name={showCats ? 'chevron-up' : 'chevron-down'} size={15} color={theme.inkSoft} />
          </Pressable>
        </Row>
        {showCats ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }} style={{ marginHorizontal: -space.lg, paddingLeft: space.lg }}>
            <Chip
              label="ทุกหมวด"
              selected={!cat}
              onPress={() => {
                setCat(null);
                setShowCats(false);
              }}
            />
            {categories.map((c) => (
              <Chip
                key={c.key}
                icon={categoryLook(c.key, theme).icon}
                iconColor={categoryLook(c.key, theme).ink}
                label={c.label}
                selected={cat === c.key}
                onPress={() => {
                  setCat(cat === c.key ? null : c.key);
                  setShowCats(false);
                }}
              />
            ))}
          </ScrollView>
        ) : null}
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
        ref={list}
        extraData={today}
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 120 }}
        ListHeaderComponent={
          showCalendar ? (
            <View style={{ gap: space.sm, paddingTop: space.sm }}>
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
        renderSectionHeader={({ section }) => {
          const rel = relativeDayLabel(section.title);
          // "วันนี้ • อังคาร 13 ต.ค." for the last two days; "3 ต.ค. • เสาร์" before that.
          const label = rel === 'วันนี้' || rel === 'เมื่อวาน' ? `${rel} • ${thaiWeekday(section.title)} ${formatThaiDay(section.title, { year: false })}` : `${rel} • ${thaiWeekday(section.title)}`;
          return (
            <Row justify="space-between" gap={space.sm} style={{ backgroundColor: theme.bg, paddingTop: space.lg, paddingBottom: space.sm }}>
              <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi, flexShrink: 1 }} numberOfLines={1}>
                {label}
              </T>
              <Row gap={space.sm}>
                {section.spent > 0 ? (
                  <T v="small" color={theme.inkSoft} style={{ fontVariant: ['tabular-nums'] }}>
                    ใช้ {formatBaht(section.spent, { decimals: false })}
                  </T>
                ) : null}
                {section.got > 0 ? (
                  <T v="small" color={theme.income} style={{ fontVariant: ['tabular-nums'], fontFamily: fonts.sansMedium }}>
                    รับ {formatBaht(section.got, { decimals: false })}
                  </T>
                ) : null}
              </Row>
            </Row>
          );
        }}
        renderItem={({ item, index, section }) => {
          const first = index === 0;
          const last = index === section.data.length - 1;
          return (
            <View
              style={{
                backgroundColor: theme.surface,
                borderTopLeftRadius: first ? radius.lg : 0,
                borderTopRightRadius: first ? radius.lg : 0,
                borderBottomLeftRadius: last ? radius.lg : 0,
                borderBottomRightRadius: last ? radius.lg : 0,
                paddingHorizontal: space.md,
                paddingTop: first ? space.xs : 0,
                paddingBottom: last ? space.xs : 0,
              }}
            >
              {first ? null : <Divider style={{ marginLeft: 52 }} />}
              <TxRow tx={item} />
            </View>
          );
        }}
        ListEmptyComponent={
          day ? (
            <EmptyState icon="calendar-outline" art={<Buddy mood="calm" size={84} />} title={`${relativeDayLabel(day)} ไม่มีรายการ`} body="แตะวันอื่นในปฏิทิน หรือกด ดูทุกวัน" />
          ) : query || kind !== 'all' || cat ? (
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
