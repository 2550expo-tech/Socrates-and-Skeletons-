/**
 * กระปุกออม: savings goals as glass jars that fill with gold. Put money in
 * (a coin drops in and the jar wobbles) or take it out; reaching a goal is
 * celebrated. Money in jars is kept out of what can be spent (Money Runway).
 * Rules: domain/goals.ts.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../data/AppProvider';
import { BUDDY_NAME } from '../domain/buddy';
import { goalLine, goalProgress, reservedSatang, type SavingsGoal } from '../domain/goals';
import { formatBaht, parseBahtToSatang } from '../domain/money';
import { BuddySays } from '../ui/Buddy';
import { Button, Card, Chip, IconButton, Money, Row, T } from '../ui/components';
import { Reveal, useCelebrate } from '../ui/effects';
import { useToast } from '../ui/feedback';
import { Field } from '../ui/inputs';
import { Jar } from '../ui/Jar';
import { goBack } from '../ui/nav';
import { fonts, space, useTheme } from '../ui/theme';

const QUICK = [2_000, 5_000, 10_000, 50_000];

function GoalCard({ goal, index }: { goal: SavingsGoal; index: number }) {
  const theme = useTheme();
  const toast = useToast();
  const celebrate = useCelebrate();
  const { depositToGoal, today } = useApp();
  const [open, setOpen] = useState<'in' | 'out' | null>(null);
  const [custom, setCustom] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [drop, setDrop] = useState(0);
  const [busy, setBusy] = useState(false);
  const done = goal.savedSatang >= goal.targetSatang;

  async function move(satang: number) {
    if (busy || satang <= 0) return;
    const delta = open === 'out' ? -Math.min(satang, goal.savedSatang) : satang;
    if (!delta) return;
    setBusy(true);
    try {
      const g = await depositToGoal(goal.id, delta);
      setCustom('');
      if (delta > 0) setDrop((n) => n + 1);
      if (!done && g.savedSatang >= g.targetSatang) {
        celebrate();
        toast({ message: `ครบเป้า "${g.title}" แล้ว! เก่งมาก` });
      } else {
        toast({ message: delta > 0 ? `หยอด ${formatBaht(delta, { decimals: false })} แล้ว` : `ถอน ${formatBaht(-delta, { decimals: false })} แล้ว` });
      }
    } catch {
      toast({ message: 'บันทึกไม่สำเร็จ ลองอีกครั้ง', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Reveal index={index} zoom>
      <Card style={[{ gap: space.md }, done && { borderColor: theme.accent, borderWidth: 1.5 }]}>
        <Row gap={space.lg} align="center">
          <Jar progress={goalProgress(goal)} size={84} drop={drop} label={`${goal.title} ${Math.round(goalProgress(goal) * 100)}%`} />
          <View style={{ flex: 1, gap: 2 }}>
            <Row justify="space-between" align="flex-start">
              <T v="h3" style={{ flex: 1 }} numberOfLines={2}>
                {`${goal.emoji} ${goal.title}`}
              </T>
              <IconButton icon="create-outline" label={`แก้ ${goal.title}`} onPress={() => router.push({ pathname: '/goal', params: { id: goal.id } })} />
            </Row>
            <Row gap={space.xs} align="flex-end">
              <Money satang={goal.savedSatang} size="h2" decimals={false} />
              <T v="small" style={{ paddingBottom: 3 }}>{`/ ${formatBaht(goal.targetSatang, { decimals: false })}`}</T>
            </Row>
            <T v="small">{goalLine(goal, today)}</T>
          </View>
        </Row>
        {open ? (
          <View style={{ gap: space.sm }}>
            <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>
              {open === 'in' ? 'หยอดกระปุก' : 'ถอนออกจากกระปุก'}
            </T>
            <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
              {QUICK.map((q) => (
                <Chip key={q} label={formatBaht(q, { decimals: false })} onPress={() => move(q)} />
              ))}
            </Row>
            <Row gap={space.sm} align="flex-end">
              <View style={{ flex: 1 }}>
                <Field
                  id={`goal-custom-${goal.id}`}
                  label="จำนวนอื่น (บาท)"
                  value={custom}
                  onChangeText={(v) => {
                    setCustom(v);
                    setCustomError(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="เช่น 250"
                  error={customError}
                />
              </View>
              <Button label={open === 'in' ? 'หยอด' : 'ถอน'} kind={open === 'in' ? 'gold' : 'ghost'} loading={busy} onPress={() => {
                  const satang = parseBahtToSatang(custom);
                  if (satang === null) setCustomError('ใส่จำนวนเงิน เช่น 250 หรือ 99.50');
                  else move(satang);
                }}
              />
            </Row>
            <Button label="เสร็จ" kind="soft" small onPress={() => setOpen(null)} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : (
          <Row gap={space.sm}>
            <Button label="หยอดกระปุก" kind="gold" icon="add" small onPress={() => setOpen('in')} style={{ flex: 1 }} />
            {goal.savedSatang > 0 ? <Button label="ถอน" kind="ghost" icon="remove" small onPress={() => setOpen('out')} /> : null}
          </Row>
        )}
      </Card>
    </Reveal>
  );
}

export default function Goals() {
  const theme = useTheme();
  const { goals } = useApp();
  const reserved = reservedSatang(goals);
  const doneCount = goals.filter((g) => g.savedSatang >= g.targetSatang).length;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <Row justify="space-between" style={{ paddingHorizontal: space.sm, paddingTop: space.sm }}>
        <IconButton icon="chevron-back" label="กลับ" onPress={() => goBack()} />
        <T v="h3">กระปุกออม</T>
        <IconButton icon="add-circle" label="ตั้งกระปุกใหม่" color={theme.primary} onPress={() => router.push('/goal')} />
      </Row>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
          {goals.length === 0 ? (
            <>
              <BuddySays mood="happy">{`อยากได้อะไร ตั้งเป็นกระปุกไว้เลย แล้วหยอดทีละนิด ${BUDDY_NAME}จะช่วยบอกว่าต้องเก็บวันละเท่าไรถึงจะทัน`}</BuddySays>
              <View style={{ alignItems: 'center', paddingVertical: space.lg }}>
                <Jar progress={0} size={120} />
              </View>
              <Button label="ตั้งกระปุกแรก" kind="gold" icon="add" shine onPress={() => router.push('/goal')} />
            </>
          ) : (
            <>
              <Card tone="accent" style={{ paddingVertical: space.md }}>
                <Row justify="space-between">
                  <T v="small" color={theme.ink}>
                    กันไว้ในกระปุกทั้งหมด
                  </T>
                  <T v="h3">{formatBaht(reserved, { decimals: false })}</T>
                </Row>
                <T v="micro" color={theme.ink}>
                  เงินในกระปุกไม่นับเป็นเงินที่ใช้ได้ในหน้า “เงินพอถึง”{doneCount ? ` · ครบเป้าแล้ว ${doneCount} กระปุก` : ''}
                </T>
              </Card>
              {goals.map((g, i) => (
                <GoalCard key={g.id} goal={g} index={i} />
              ))}
              <Button label="ตั้งกระปุกใหม่" kind="soft" icon="add" onPress={() => router.push('/goal')} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
