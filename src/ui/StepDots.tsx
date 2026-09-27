/**
 * Sign-up progress bar, same idea as MeowJot's guided start:
 * 1 account details -> 2 confirm email -> 3 money setup (onboarding).
 */
import { View } from 'react-native';
import { Row, T } from './components';
import { useTheme } from './theme';

const LABELS = ['ข้อมูลบัญชี', 'ยืนยันอีเมล', 'ตั้งค่าเงิน'];

export function StepDots({ step }: { step: 1 | 2 | 3 }) {
  const theme = useTheme();
  return (
    <View accessibilityLabel={`ขั้นที่ ${step} จาก 3 ${LABELS[step - 1]}`} style={{ gap: 6 }}>
      <Row gap={6}>
        {LABELS.map((label, i) => (
          <View key={label} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? theme.accent : theme.line }} />
        ))}
      </Row>
      <T v="micro">
        ขั้นที่ {step} จาก 3 · {LABELS[step - 1]}
      </T>
    </View>
  );
}
