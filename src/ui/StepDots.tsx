/**
 * Sign-up progress bar, same idea as MeowJot's guided start:
 * 1 account details -> 2 confirm email -> 3 money setup (onboarding).
 */
import { View } from 'react-native';
import { Row, T } from './components';
import { GrowBar } from './effects';
import { useTheme } from './theme';

const LABELS = ['ข้อมูลบัญชี', 'ยืนยันอีเมล', 'ตั้งค่าเงิน'];

export function StepDots({ step }: { step: 1 | 2 | 3 }) {
  const theme = useTheme();
  return (
    <View accessibilityLabel={`ขั้นที่ ${step} จาก 3 ${LABELS[step - 1]}`} style={{ gap: 6 }}>
      <Row gap={6}>
        {LABELS.map((label, i) => (
          // Steps already done are full; the current step fills up as the screen opens.
          <View key={label} style={{ flex: 1 }}>
            <GrowBar value={i < step ? 1 : 0} color={theme.accent} track={theme.line} height={4} delay={250} animate={i === step - 1} />
          </View>
        ))}
      </Row>
      <T v="micro">
        ขั้นที่ {step} จาก 3 · {LABELS[step - 1]}
      </T>
    </View>
  );
}
