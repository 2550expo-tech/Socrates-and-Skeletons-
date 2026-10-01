/**
 * The month as a calendar: each day shaded by how much was spent compared with
 * the month's usual spending day (one hue, light to dark; ramps checked with the
 * data-viz validator for both themes). Tap a day to see only its transactions.
 * Rules: domain/recap.ts spendCalendar.
 */
import { Pressable, View } from 'react-native';
import { formatThaiDay } from '../domain/dates';
import { formatBaht } from '../domain/money';
import type { CalendarDay, SpendCalendar as Calendar } from '../domain/recap';
import { Card, IconButton, Row, T } from './components';
import { Reveal } from './effects';
import { fonts, radius, space, useTheme } from './theme';

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
/** Levels 1..4 (level 0 = no spending uses the neutral surface). */
const RAMP_LIGHT = ['#D9AD4E', '#BF8A1C', '#96640C', '#664306'];
const RAMP_DARK = ['#5C4A16', '#8C6D1C', '#C4972E', '#F0C75A'];

export function SpendCalendar({
  cal,
  selected,
  onSelect,
  onPrev,
  onNext,
}: {
  cal: Calendar;
  selected: string | null;
  onSelect: (day: string | null) => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const theme = useTheme();
  const ramp = theme.dark ? RAMP_DARK : RAMP_LIGHT;
  const fill = (c: CalendarDay) => (c.level ? ramp[c.level - 1] : theme.surfaceAlt);
  // Text inside a fill picks the ink that stays readable on it.
  const ink = (c: CalendarDay) => {
    if (!c.level) return c.future ? theme.inkFaint : theme.inkSoft;
    if (theme.dark) return c.level >= 3 ? '#0A1410' : '#F4F1E6';
    return c.level >= 2 ? '#FFFFFF' : '#11231B';
  };
  const picked = selected ? cal.weeks.flat().find((c) => c?.day === selected) ?? null : null;

  return (
    <Card style={{ gap: space.sm, paddingVertical: space.md }}>
      <Row justify="space-between">
        <IconButton icon="chevron-back" label="เดือนก่อน" onPress={() => onPrev?.()} color={onPrev ? theme.ink : theme.line} />
        <T v="h3">{cal.label}</T>
        <IconButton icon="chevron-forward" label="เดือนถัดไป" onPress={() => onNext?.()} color={onNext ? theme.ink : theme.line} />
      </Row>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((w) => (
          <T key={w} v="micro" center style={{ flex: 1 }}>
            {w}
          </T>
        ))}
      </View>
      {cal.weeks.map((week, wi) => (
        <Reveal key={`${cal.month}-${wi}`} index={wi} from={6}>
          <View style={{ flexDirection: 'row' }}>
            {week.map((c, di) =>
              c ? (
                <View key={c.day} style={{ flex: 1, aspectRatio: 1, padding: 2 }}>
                  <Pressable
                    disabled={c.future}
                    onPress={() => onSelect(selected === c.day ? null : c.day)}
                    accessibilityRole="button"
                    aria-selected={selected === c.day}
                    accessibilityLabel={`${formatThaiDay(c.day)} ${c.expenseSatang ? `ใช้ไป ${formatBaht(c.expenseSatang)}` : 'ไม่มีรายจ่าย'}${c.incomeSatang ? ` เงินเข้า ${formatBaht(c.incomeSatang)}` : ''}`}
                    style={({ pressed }) => ({
                      flex: 1,
                      borderRadius: radius.sm,
                      backgroundColor: c.future ? 'transparent' : fill(c),
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: selected === c.day ? 2 : c.isToday ? 1.5 : 0,
                      borderColor: selected === c.day ? theme.primary : theme.ink,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <T v="small" color={ink(c)} style={{ fontFamily: c.isToday || selected === c.day ? fonts.sansBold : fonts.sans, fontVariant: ['tabular-nums'] }}>
                      {Number(c.day.slice(8, 10))}
                    </T>
                    {c.incomeSatang > 0 ? (
                      <View style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: theme.income }} />
                    ) : null}
                  </Pressable>
                </View>
              ) : (
                <View key={`e${wi}-${di}`} style={{ flex: 1, aspectRatio: 1 }} />
              ),
            )}
          </View>
        </Reveal>
      ))}
      {/* Legend: the ramp from little to a lot, and the income dot. */}
      <Row justify="space-between" style={{ marginTop: space.xs }}>
        <Row gap={4}>
          <T v="micro">น้อย</T>
          {ramp.map((c) => (
            <View key={c} style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: c }} />
          ))}
          <T v="micro">มาก</T>
        </Row>
        <Row gap={4}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.income }} />
          <T v="micro">มีเงินเข้า</T>
        </Row>
      </Row>
      <T v="micro">
        {cal.usualSatang ? `เทียบกับวันที่ใช้ตามปกติของเดือนนี้ (${formatBaht(cal.usualSatang, { decimals: false })})` : 'เดือนนี้ยังไม่มีรายจ่าย'}
      </T>
      {picked ? (
        <Row justify="space-between" style={{ backgroundColor: theme.surfaceAlt, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm }}>
          <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>
            {formatThaiDay(picked.day)}
          </T>
          <T v="small" color={theme.ink}>
            {picked.expenseSatang ? `ใช้ ${formatBaht(picked.expenseSatang, { decimals: false })}` : 'ไม่มีรายจ่าย'} · {picked.count} รายการ
          </T>
        </Row>
      ) : null}
    </Card>
  );
}
