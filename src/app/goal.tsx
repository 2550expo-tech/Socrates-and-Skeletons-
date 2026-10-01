/**
 * Create or edit a savings goal ("กระปุกออม"): what for, how much, by when.
 * Opened from the goals screen; `id` edits an existing goal.
 */
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../data/AppProvider';
import { formatThaiDay } from '../domain/dates';
import { deadlineDay, GOAL_DEADLINES, GOAL_EMOJIS } from '../domain/goals';
import { parseBahtToSatang, satangToInput } from '../domain/money';
import { Button, Chip, IconButton, Row, T } from '../ui/components';
import { ConfirmSheet, useToast } from '../ui/feedback';
import { AmountField, Field } from '../ui/inputs';
import { goBack, useLeaveWhenDone } from '../ui/nav';
import { fonts, radius, space, useTheme } from '../ui/theme';
import { HeaderDecor } from '../ui/halloween';

export default function GoalForm() {
  const theme = useTheme();
  const toast = useToast();
  const leaveWhenDone = useLeaveWhenDone();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { goals, addGoal, updateGoal, removeGoal, today } = useApp();
  const existing = useMemo(() => goals.find((g) => g.id === id), [goals, id]);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? GOAL_EMOJIS[0]);
  const [amount, setAmount] = useState(existing ? satangToInput(existing.targetSatang) : '');
  const [due, setDue] = useState<string | null>(existing ? existing.dueDay : deadlineDay(today, 91));
  const [errors, setErrors] = useState<{ title?: string; amount?: string }>({});
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  async function save() {
    const target = parseBahtToSatang(amount);
    const e: typeof errors = {};
    if (!title.trim()) e.title = 'ตั้งชื่อเป้าหมาย เช่น หูฟังใหม่';
    if (target === null) e.amount = 'ใส่จำนวนเงินที่อยากเก็บ เช่น 2500';
    setErrors(e);
    if (e.title || e.amount) return;
    setBusy(true);
    try {
      if (existing) {
        await updateGoal(existing.id, { title: title.trim(), emoji, targetSatang: target!, dueDay: due, doneAt: existing.savedSatang >= target! ? existing.doneAt ?? new Date().toISOString() : null });
        toast({ message: 'บันทึกเป้าหมายแล้ว' });
      } else {
        await addGoal({ title: title.trim(), emoji, targetSatang: target!, savedSatang: 0, dueDay: due, doneAt: null });
        toast({ message: `ตั้งกระปุก "${title.trim()}" แล้ว เริ่มหยอดได้เลย` });
      }
      leaveWhenDone();
    } catch {
      toast({ message: 'บันทึกไม่สำเร็จ ลองอีกครั้ง', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Row justify="space-between" style={{ paddingHorizontal: space.sm, paddingTop: space.sm }}>
          <IconButton icon="close" label="ปิด" onPress={() => goBack()} />
          <T v="h3">{existing ? 'แก้กระปุกออม' : 'ตั้งกระปุกออมใหม่'}</T>
          {existing ? <IconButton icon="trash-outline" label="ลบกระปุก" color={theme.critical} onPress={() => setAskDelete(true)} /> : <HeaderDecor />}
        </Row>
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: space.sm }}>
            <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>
              เก็บเงินไว้สำหรับอะไร
            </T>
            <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
              {GOAL_EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setEmoji(e)}
                  accessibilityRole="button"
                  accessibilityLabel={`ไอคอน ${e}`}
                  aria-selected={emoji === e}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: emoji === e ? theme.accentSoft : theme.surface,
                    borderWidth: emoji === e ? 2 : 1,
                    borderColor: emoji === e ? theme.accent : theme.line,
                  }}
                >
                  <T v="h2">{e}</T>
                </Pressable>
              ))}
            </Row>
          </View>
          <Field id="goal-title" label="ชื่อเป้าหมาย" value={title} onChangeText={setTitle} placeholder="เช่น หูฟังใหม่, ทริปเชียงใหม่" maxLength={60} error={errors.title} />
          <View>
            <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>
              อยากเก็บให้ได้
            </T>
            <AmountField id="goal-amount" value={amount} onChangeText={setAmount} error={errors.amount} />
          </View>
          <View style={{ gap: space.sm }}>
            <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>
              ภายใน
            </T>
            <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
              {GOAL_DEADLINES.map((d) => {
                const day = deadlineDay(today, d.days);
                return <Chip key={d.label} label={d.label} selected={due === day} onPress={() => setDue(day)} />;
              })}
            </Row>
            <T v="micro">{due ? `ถึงวันที่ ${formatThaiDay(due)}` : 'ไม่กำหนดวัน ค่อย ๆ เก็บไปเรื่อย ๆ'}</T>
          </View>
          <T v="micro">เงินที่หยอดกระปุกยังอยู่ในบัญชีของคุณ แต่ MindPay จะกันไว้ ไม่นับเป็นเงินที่ใช้ได้ในหน้า “เงินพอถึง”</T>
          <Button label={existing ? 'บันทึก' : 'ตั้งกระปุก'} kind="gold" icon="checkmark" shine onPress={save} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
      <ConfirmSheet
        visible={askDelete}
        title="ลบกระปุกนี้?"
        body={existing && existing.savedSatang > 0 ? 'เงินที่กันไว้จะกลับมานับเป็นเงินที่ใช้ได้ (ในบัญชีจริงไม่มีอะไรเปลี่ยน)' : 'ลบแล้วเอากลับมาไม่ได้'}
        confirmLabel="ลบกระปุก"
        destructive
        onCancel={() => setAskDelete(false)}
        onConfirm={async () => {
          setAskDelete(false);
          if (!existing) return;
          try {
            await removeGoal(existing.id);
            leaveWhenDone();
          } catch {
            toast({ message: 'ลบไม่สำเร็จ ลองอีกครั้ง', tone: 'error' });
          }
        }}
      />
    </SafeAreaView>
  );
}
