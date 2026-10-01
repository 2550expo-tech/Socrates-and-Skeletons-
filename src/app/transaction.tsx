/**
 * FR-1 add / edit / categorize / delete one transaction.
 * Also used to review a slip draft: unsure fields are highlighted and the main
 * button confirms the draft so it starts counting in totals.
 */
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useLocalSearchParams } from 'expo-router';
import { goBack, useLeaveWhenDone } from '../ui/nav';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../data/AppProvider';
import { categoriesFor, defaultCategory, suggestCategory } from '../domain/categories';
import { bkkDayKey, bkkTime, bkkToIso, formatThaiDay, parseSlipDate, parseSlipTime } from '../domain/dates';
import { formatBaht, parseBahtToSatang, satangToInput } from '../domain/money';
import { ALT_PREFIX, amountChoices, FLAG_LABEL, type ReviewFlag } from '../domain/slip';
import type { TxKind } from '../domain/types';
import { Button, Card, Chip, IconButton, Ionicons, Row, Segmented, T } from '../ui/components';
import { ConfirmSheet, useToast } from '../ui/feedback';
import { AmountField, Field } from '../ui/inputs';
import { fonts, radius, space, useTheme } from '../ui/theme';
import { HeaderDecor } from '../ui/halloween';

export default function TransactionForm() {
  const theme = useTheme();
  const toast = useToast();
  const leaveWhenDone = useLeaveWhenDone();
  const { id, kind: kindParam } = useLocalSearchParams<{ id?: string; kind?: string }>();
  const { txs, addTx, updateTx, removeTx } = useApp();
  const existing = useMemo(() => txs.find((t) => t.id === id), [txs, id]);
  const isDraft = existing?.status === 'draft';
  const flags = (existing?.reviewFlags ?? []) as ReviewFlag[];

  // "เพิ่มเงินเข้า" opens the form as income (money that comes in without a slip).
  const startKind: TxKind = existing?.kind ?? (kindParam === 'income' ? 'income' : 'expense');
  const [kind, setKind] = useState<TxKind>(startKind);
  const [amount, setAmount] = useState(existing ? satangToInput(existing.amountSatang) : '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [category, setCategory] = useState(existing?.categoryKey ?? defaultCategory(startKind));
  const [categoryTouched, setCategoryTouched] = useState(!!existing);
  const [day, setDay] = useState(existing ? bkkDayKey(existing.occurredAt) : bkkDayKey(new Date()));
  const [time, setTime] = useState(existing ? bkkTime(existing.occurredAt) : bkkTime(new Date()));
  const [note, setNote] = useState(existing?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  // Web only: the browser build has no native date picker, so dates are typed.
  const [dayText, setDayText] = useState(() => { const [y, m, d] = day.split('-'); return `${d}/${m}/${Number(y) + 543}`; });
  const [timeText, setTimeText] = useState(time);
  // What is wrong with the typed date/time (web); saving waits until both are fine.
  const typedDay = parseSlipDate(dayText);
  const dayError =
    Platform.OS !== 'web' ? null : !typedDay ? 'เช่น 27/09/2569' : typedDay > bkkDayKey(new Date()) ? 'วันนี้หรือก่อนหน้าเท่านั้น' : null;
  const timeError = Platform.OS !== 'web' || parseSlipTime(timeText) ? null : 'เช่น 08:30';

  const cats = categoriesFor(kind);
  const pickerDate = new Date(bkkToIso(day, time));
  // The two AI reads disagreed: show both, and offer the amounts as buttons.
  const altLine = isDraft ? (existing?.note ?? '').split('\n').find((l) => l.startsWith(ALT_PREFIX)) : undefined;
  const choices = isDraft && flags.includes('amount') ? amountChoices(existing?.note) : [];

  function changeKind(k: TxKind) {
    setKind(k);
    if (!categoriesFor(k).some((c) => c.key === category)) setCategory(suggestCategory(title, k));
  }

  function changeTitle(s: string) {
    setTitle(s);
    // Suggest a category while the user types, until they pick one themselves.
    if (!categoryTouched) setCategory(suggestCategory(s, kind));
  }

  function openAndroidPicker(mode: 'date' | 'time') {
    DateTimePickerAndroid.open({
      value: pickerDate,
      mode,
      is24Hour: true,
      maximumDate: mode === 'date' ? new Date() : undefined,
      onChange: (e, d) => {
        if (e.type !== 'set' || !d) return;
        if (mode === 'date') setDay(bkkDayKey(d));
        else setTime(bkkTime(d));
      },
    });
  }

  async function save(confirm: boolean) {
    if (busy) return;
    const satang = parseBahtToSatang(amount);
    if (satang === null) {
      setAmountError('ใส่จำนวนเงินมากกว่า 0 เช่น 85 หรือ 85.50');
      return;
    }
    setAmountError(null);
    if (dayError || timeError) return;
    const input = {
      kind,
      amountSatang: satang,
      categoryKey: category,
      title: title.trim(),
      note: note.trim() || null,
      occurredAt: bkkToIso(day, time),
    };
    setBusy(true);
    try {
      if (existing) {
        await updateTx(existing.id, {
          ...input,
          ...(confirm ? { status: 'confirmed' as const, reviewFlags: [] } : {}),
        });
        toast({ message: confirm && isDraft ? 'ยืนยันรายการแล้ว รวมในยอดเงินแล้ว' : 'บันทึกการแก้ไขแล้ว' });
      } else {
        await addTx({
          ...input,
          source: 'manual',
          status: 'confirmed',
          slipRef: null,
          slipImageHash: null,
          ocrConfidence: null,
          reviewFlags: [],
        });
        toast({ message: kind === 'income' ? 'เพิ่มเงินเข้าแล้ว' : 'บันทึกรายการแล้ว' });
      }
      leaveWhenDone();
    } catch (e) {
      toast({ message: e instanceof Error && e.name === 'DuplicateSlipError' ? 'มีรายการจากสลิปนี้อยู่แล้ว' : 'บันทึกไม่สำเร็จ ลองอีกครั้ง', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!existing) return;
    setAskDelete(false);
    setBusy(true);
    try {
      const removed = await removeTx(existing.id);
      leaveWhenDone();
      toast({
        message: 'ลบรายการแล้ว',
        action: removed
          ? {
              label: 'เลิกทำ',
              onPress: () => {
                const { id: _id, createdAt: _c, ...rest } = removed;
                addTx(rest).catch(() => toast({ message: 'กู้คืนไม่สำเร็จ', tone: 'error' }));
              },
            }
          : undefined,
      });
    } catch {
      toast({ message: 'ลบไม่สำเร็จ ลองอีกครั้ง', tone: 'error' });
      setBusy(false);
    }
  }

  const flagged = (f: ReviewFlag) => isDraft && flags.includes(f);
  const pill = (label: string, onPress: () => void, warn: boolean, a11y: string) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1.5,
        borderColor: warn ? theme.watch : theme.line,
        borderRadius: radius.md,
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: theme.surface,
      }}
    >
      <T v="body">{label}</T>
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Row justify="space-between" style={{ paddingHorizontal: space.sm, paddingTop: space.sm }}>
          <IconButton icon="close" label="ปิด" onPress={() => goBack()} />
          <T v="h3">{!existing ? (kind === 'income' ? 'เพิ่มเงินเข้า' : 'จดรายการ') : isDraft ? 'ตรวจสลิป' : 'แก้ไขรายการ'}</T>
          {existing ? (
            <IconButton icon="trash-outline" label="ลบรายการ" color={theme.critical} onPress={() => setAskDelete(true)} />
          ) : (
            <HeaderDecor />
          )}
        </Row>

        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
          {isDraft ? (
            <Card tone="accent">
              <Row gap={space.sm} align="flex-start">
                <Ionicons name="receipt-outline" size={20} color={theme.accentInk} />
                <View style={{ flex: 1, gap: 4 }}>
                  <T v="body" style={{ fontFamily: fonts.sansSemi }}>
                    {flags.length === 0 ? 'อ่านสลิปได้ครบ ตรวจอีกครั้งแล้วกดยืนยัน' : `ช่วยตรวจ: ${flags.map((f) => FLAG_LABEL[f]).join(', ')}`}
                  </T>
                  <T v="small">
                    ยังไม่รวมในยอดเงินจนกว่าจะยืนยัน
                    {existing?.ocrConfidence != null ? ` · ความมั่นใจต่ำสุด ${Math.round(existing.ocrConfidence * 100)}%` : ''}
                  </T>
                  {altLine ? (
                    <T v="small" color={theme.ink}>
                      {altLine}
                    </T>
                  ) : null}
                  {choices.length > 1 ? (
                    <Row gap={space.sm} style={{ flexWrap: 'wrap', marginTop: 4 }}>
                      <T v="small">ดูที่สลิปแล้วเลือก:</T>
                      {choices.map((c) => (
                        <Chip
                          key={c}
                          label={formatBaht(c)}
                          selected={parseBahtToSatang(amount) === c}
                          onPress={() => {
                            setAmount(satangToInput(c));
                            setAmountError(null);
                          }}
                        />
                      ))}
                    </Row>
                  ) : null}
                </View>
              </Row>
            </Card>
          ) : null}

          <Segmented<TxKind>
            options={[
              { key: 'expense', label: 'รายจ่าย' },
              { key: 'income', label: 'รายรับ' },
            ]}
            value={kind}
            onChange={changeKind}
          />

          <AmountField id="tx-amount" value={amount} onChangeText={setAmount} error={amountError} flagged={flagged('amount')} color={kind === 'income' ? theme.income : theme.ink} />
          {!existing && kind === 'income' ? (
            <Row gap={space.sm} style={{ flexWrap: 'wrap', justifyContent: 'center', marginTop: -space.sm }}>
              {[10_000, 50_000, 100_000, 500_000].map((q) => (
                <Chip
                  key={q}
                  label={`+${formatBaht(q, { decimals: false })}`}
                  selected={parseBahtToSatang(amount) === q}
                  onPress={() => {
                    setAmount(satangToInput(q));
                    setAmountError(null);
                  }}
                />
              ))}
            </Row>
          ) : null}

          <Field
            id="tx-title"
            label={kind === 'expense' ? 'จ่ายให้ / ซื้ออะไร' : 'ได้รับจาก'}
            value={title}
            onChangeText={changeTitle}
            placeholder={kind === 'expense' ? 'เช่น ข้าวมันไก่' : 'เช่น ค่าขนมจากที่บ้าน'}
            maxLength={120}
            error={flagged('counterparty') ? 'ตรวจชื่อให้ตรงกับสลิป' : null}
          />

          <View style={{ gap: space.sm }}>
            <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>หมวดหมู่</T>
            <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
              {cats.map((c) => (
                <Chip
                  key={c.key}
                  label={c.label}
                  glyph={c.glyph}
                  selected={category === c.key}
                  onPress={() => {
                    setCategory(c.key);
                    setCategoryTouched(true);
                  }}
                />
              ))}
            </Row>
          </View>

          <View style={{ gap: 6 }}>
            <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>วันและเวลา</T>
            {Platform.OS === 'web' ? (
              <Row gap={space.sm} align="flex-start">
                <View style={{ flex: 1 }}>
                  <Field
                    id="tx-day"
                    label="วันที่ (วว/ดด/ปปปป)"
                    value={dayText}
                    onChangeText={(s) => {
                      setDayText(s);
                      const parsed = parseSlipDate(s);
                      if (parsed && parsed <= bkkDayKey(new Date())) setDay(parsed);
                    }}
                    error={dayError}
                  />
                </View>
                <View style={{ width: 110 }}>
                  <Field
                    id="tx-time"
                    label="เวลา"
                    value={timeText}
                    onChangeText={(s) => {
                      setTimeText(s);
                      const t = parseSlipTime(s);
                      if (t) setTime(t);
                    }}
                    error={timeError}
                  />
                </View>
              </Row>
            ) : Platform.OS === 'android' ? (
              <Row gap={space.sm}>
                {pill(`📅 ${formatThaiDay(day)}`, () => openAndroidPicker('date'), flagged('date'), 'เลือกวันที่')}
                {pill(`🕒 ${time}`, () => openAndroidPicker('time'), false, 'เลือกเวลา')}
              </Row>
            ) : (
              <Row gap={space.sm}>
                <DateTimePicker
                  value={pickerDate}
                  mode="date"
                  display="compact"
                  maximumDate={new Date()}
                  locale="th-TH"
                  onChange={(_, d) => d && setDay(bkkDayKey(d))}
                />
                <DateTimePicker value={pickerDate} mode="time" display="compact" locale="th-TH" onChange={(_, d) => d && setTime(bkkTime(d))} />
              </Row>
            )}
            {flagged('date') ? <T v="small" color={theme.watch}>อ่านวันที่บนสลิปไม่ชัด ตรวจให้ตรงก่อนยืนยัน</T> : null}
          </View>

          <Field id="tx-note" label="บันทึกเพิ่มเติม (ไม่บังคับ)" value={note} onChangeText={setNote} multiline maxLength={500} placeholder="อยากจำอะไรเกี่ยวกับรายการนี้" />
        </ScrollView>

        <View style={{ padding: space.lg, gap: space.sm, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: theme.surface }}>
          {isDraft ? (
            <>
              <Button label="ยืนยันและรวมในยอดเงิน" kind="gold" icon="checkmark-circle" onPress={() => save(true)} loading={busy} />
              <Button label="บันทึกแบบร่างไว้ก่อน" kind="ghost" onPress={() => save(false)} disabled={busy} />
            </>
          ) : (
            <Button label={existing ? 'บันทึกการแก้ไข' : 'บันทึกรายการ'} icon="checkmark" onPress={() => save(true)} loading={busy} />
          )}
        </View>
      </KeyboardAvoidingView>

      <ConfirmSheet
        visible={askDelete}
        title="ลบรายการนี้?"
        body={isDraft ? 'แบบร่างจากสลิปนี้จะถูกลบ ถ้าสแกนรูปเดิมอีกครั้งจะอ่านใหม่ได้' : 'ยอดคงเหลือและ Money Runway จะคำนวณใหม่ทันที กดเลิกทำได้ภายใน 5 วินาที'}
        confirmLabel="ลบรายการ"
        destructive
        onConfirm={doDelete}
        onCancel={() => setAskDelete(false)}
      />
    </SafeAreaView>
  );
}
