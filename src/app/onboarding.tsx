/**
 * First run: the three numbers MindPay needs to be useful from day one.
 * Balance = money now; the low line drives FR-6; the budget is optional.
 */
import { useState } from 'react';
import { useApp } from '../data/AppProvider';
import { amountToInput, parseBahtToSatang } from '../domain/money';
import { Button, Card, Screen, T } from '../ui/components';
import { useToast } from '../ui/feedback';
import { Field } from '../ui/inputs';
import { BuddySays } from '../ui/Buddy';
import { Reveal, useCelebrate } from '../ui/effects';
import { StepDots } from '../ui/StepDots';
import { space } from '../ui/theme';

export default function Onboarding() {
  const toast = useToast();
  const celebrate = useCelebrate();
  const { profile, saveProfile } = useApp();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [balance, setBalance] = useState('');
  const [floor, setFloor] = useState(amountToInput(profile?.runwayFloorSatang ?? 50_000));
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function finish() {
    const e: Record<string, string> = {};
    const balanceSatang = parseBahtToSatang(balance, { allowZero: true });
    const floorSatang = parseBahtToSatang(floor, { allowZero: true });
    const budgetSatang = budget.trim() ? parseBahtToSatang(budget) : null;
    if (!name.trim()) e.name = 'ใส่ชื่อเล่นสั้น ๆ ให้โค้ชเรียกคุณ';
    if (balanceSatang === null) e.balance = 'ใส่ยอดเงินที่มีตอนนี้ เช่น 3500';
    if (floorSatang === null) e.floor = 'ใส่เป็นตัวเลข เช่น 500 หรือ 0';
    if (budget.trim() && budgetSatang === null) e.budget = 'ใส่เป็นตัวเลข หรือเว้นว่างไว้';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await saveProfile({
        displayName: name.trim(),
        openingBalanceSatang: balanceSatang!,
        runwayFloorSatang: floorSatang!,
        monthlyBudgetSatang: budgetSatang,
        onboarded: true,
      });
      celebrate();
    } catch {
      toast({ message: 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    // Screen keeps the focused field above the keyboard (iOS), so no extra keyboard wrapper here.
    <Screen edges={['top', 'bottom']} contentStyle={{ paddingTop: space.xl }}>
        <StepDots step={3} />
        <Reveal>
          <T v="h1">ตั้งค่า 1 นาที แล้วเริ่มเห็นภาพเงินของคุณ</T>
        </Reveal>
        <BuddySays mood="happy">
          {`ยินดีที่ได้รู้จัก${name.trim() ? ` ${name.trim()}` : ''}! บอกกล้าหน่อยว่าตอนนี้มีเงินเท่าไหร่ แล้วกล้าจะนับให้ว่าเงินพอใช้ถึงวันไหน`}
        </BuddySays>
        <Reveal index={2}>
        <Card style={{ gap: space.lg }}>
          <Field id="ob-name" label="ชื่อเล่น" value={name} onChangeText={setName} placeholder="เช่น มิ้นท์" error={errors.name} maxLength={30} />
          <Field
            id="ob-balance"
            label="ตอนนี้มีเงินอยู่เท่าไหร่ (บาท)"
            value={balance}
            onChangeText={setBalance}
            keyboardType="decimal-pad"
            placeholder="เช่น 3500"
            hint="รวมเงินในบัญชีที่ใช้จ่ายประจำ ใช้เป็นจุดเริ่มต้นของยอดคงเหลือ"
            error={errors.balance}
          />
          <Field
            id="ob-floor"
            label="เงินสำรองที่ไม่อยากให้ต่ำกว่า (บาท)"
            value={floor}
            onChangeText={setFloor}
            keyboardType="decimal-pad"
            hint="Money Runway จะนับวันจนเงินเหลือเท่านี้ ค่าเริ่มต้น ฿500"
            error={errors.floor}
          />
          <Field
            id="ob-budget"
            label="งบใช้จ่ายต่อเดือน (ไม่บังคับ)"
            value={budget}
            onChangeText={setBudget}
            keyboardType="decimal-pad"
            placeholder="เช่น 9000"
            error={errors.budget}
          />
        </Card>
        </Reveal>
        <Button label="เริ่มใช้ MindPay" kind="gold" shine onPress={finish} loading={busy} />
        <T v="micro" center>แก้ไขทุกค่าได้ภายหลังในหน้าตั้งค่า</T>
    </Screen>
  );
}
