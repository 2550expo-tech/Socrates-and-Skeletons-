/**
 * A link or bookmark to a page that does not exist (a typo, an old address, an
 * unknown mindpay-v2:// path): a Thai message from น้องกล้า and one way home,
 * instead of expo-router's English "Unmatched Route" page with its developer sitemap.
 */
import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Buddy } from '../ui/Buddy';
import { Button, T } from '../ui/components';
import { space, useTheme } from '../ui/theme';

export default function NotFound() {
  const theme = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md }}>
        <Buddy mood="thinking" size={104} />
        <T v="h2" center accessibilityRole="header">
          ไม่พบหน้านี้
        </T>
        <T v="body" center color={theme.inkSoft}>
          ลิงก์อาจพิมพ์ผิด หรือหน้านี้ไม่มีแล้ว กลับไปหน้าหลักได้เลย
        </T>
        <Button label="กลับหน้าหลัก" icon="home-outline" onPress={() => router.replace('/')} style={{ alignSelf: 'stretch', marginTop: space.sm }} />
      </View>
    </SafeAreaView>
  );
}
