/**
 * The slip picture of an item read from a slip: the copy kept on this phone
 * (or in this browser) only. Tap it to see it full screen. Items read on another
 * device, or before this update, have no copy here and say so quietly.
 */
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, View } from 'react-native';
import { useApp } from '../data/AppProvider';
import { slipCopyUri } from '../services/slipCopies';
import { Ionicons, Row, T } from './components';
import { radius, space, useTheme } from './theme';

export function SlipCopy({ hash }: { hash: string | null | undefined }) {
  const theme = useTheme();
  const { userId } = useApp();
  const key = hash && userId ? `${userId}/${hash}` : null;
  const [found, setFound] = useState<{ key: string; uri: string | null } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!key || !hash || !userId) return;
    slipCopyUri(userId, hash)
      .then((uri) => alive && setFound({ key, uri }))
      .catch(() => alive && setFound({ key, uri: null }));
    return () => {
      alive = false;
    };
  }, [key, hash, userId]);

  // Still looking: show nothing yet (no flash of "no picture").
  const uri = !key ? null : found?.key === key ? found.uri : undefined;
  if (uri === undefined) return null;
  if (!uri) {
    return (
      <Row gap={space.sm}>
        <Ionicons name="image-outline" size={16} color={theme.inkFaint} />
        <T v="micro" style={{ flex: 1 }}>
          ไม่มีรูปสลิปในเครื่องนี้ (สำเนารูปเก็บไว้เฉพาะในเครื่องที่อ่านสลิป)
        </T>
      </Row>
    );
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="ดูรูปสลิปเต็มจอ"
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: pressed ? theme.surfaceAlt : theme.surface })}
      >
        <Image source={{ uri }} accessibilityLabel="รูปสลิป" resizeMode="cover" style={{ width: 64, height: 96, borderRadius: 8, backgroundColor: theme.surfaceAlt }} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="h3">รูปสลิป</T>
          <T v="small">สำเนาเก็บไว้ในเครื่องนี้เท่านั้น ไม่ได้เก็บบน server</T>
          <T v="micro" color={theme.primary}>
            แตะเพื่อดูเต็มจอ
          </T>
        </View>
        <Ionicons name="expand-outline" size={20} color={theme.inkSoft} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ปิดรูปสลิป"
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: space.lg, gap: space.md }}
        >
          <Image source={{ uri }} accessibilityLabel="รูปสลิปเต็มจอ" resizeMode="contain" style={{ width: '100%', height: '86%' }} />
          <T v="small" color="#F4F1E6">
            แตะที่ไหนก็ได้เพื่อปิด
          </T>
        </Pressable>
      </Modal>
    </>
  );
}
