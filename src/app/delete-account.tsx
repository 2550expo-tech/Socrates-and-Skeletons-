/**
 * Settings → ลบบัญชี: delete the account and everything in it (PDPA: the right to erasure).
 * Says plainly what goes (on the server and on this phone), that MindPay shares the account,
 * and that it cannot be undone. The password is asked again, then one last confirmation.
 * The work is in services/account.ts; nothing is deleted when a step fails.
 */
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../data/AppProvider';
import { DELETED_FROM_ACCOUNT, DELETED_FROM_PHONE, DeleteAccountError, DELETE_ACCOUNT_MESSAGES, SHARED_ACCOUNT_NOTE } from '../domain/account';
import { deleteMyAccount } from '../services/account';
import { Buddy } from '../ui/Buddy';
import { Button, Card, Ionicons, Row, T } from '../ui/components';
import { ConfirmSheet } from '../ui/feedback';
import { PasswordField } from '../ui/inputs';
import { KeyboardAvoid } from '../ui/KeyboardAvoid';
import { StackHeader } from '../ui/StackHeader';
import { fonts, space, useTheme } from '../ui/theme';

function Points({ items }: { items: readonly string[] }) {
  const theme = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      {items.map((p) => (
        <Row key={p} gap={space.sm} align="flex-start">
          <Ionicons name="close-circle-outline" size={16} color={theme.critical} style={{ marginTop: 3 }} />
          <T v="small" color={theme.ink} style={{ flex: 1 }}>
            {p}
          </T>
        </Row>
      ))}
    </View>
  );
}

export default function DeleteAccount() {
  const theme = useTheme();
  const { userId, repo, finishAccountDeletion } = useApp();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const cloud = repo?.mode === 'cloud' && !!userId;

  function check() {
    if (!password) return setError('ใส่รหัสผ่านของบัญชีนี้ก่อน');
    setError(null);
    setAsking(true);
  }

  async function run() {
    setAsking(false);
    if (!userId) return;
    setBusy(true);
    try {
      await deleteMyAccount(userId, password);
      // The screens change to the welcome screen, which says the account was deleted.
      await finishAccountDeletion();
    } catch (e) {
      setError(e instanceof DeleteAccountError ? e.message : DELETE_ACCOUNT_MESSAGES.failed);
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <StackHeader title="ลบบัญชี" />
      <KeyboardAvoid>
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
          <Row gap={space.md} align="flex-start">
            <Buddy mood="calm" size={64} />
            <View style={{ flex: 1, gap: space.xs }}>
              <T v="h2" accessibilityRole="header">
                ลบบัญชีและข้อมูลทั้งหมด
              </T>
              <T v="small">ลบแล้วกู้คืนไม่ได้ ถ้าแค่อยากพัก ออกจากระบบไว้ก่อนก็ได้ ข้อมูลยังอยู่ครบ</T>
            </View>
          </Row>

          <Card style={{ gap: space.md }}>
            <T v="body" style={{ fontFamily: fonts.sansSemi }}>
              ลบจากเซิร์ฟเวอร์ถาวร
            </T>
            <Points items={DELETED_FROM_ACCOUNT} />
            <T v="body" style={{ fontFamily: fonts.sansSemi }}>
              ลบจากเครื่องนี้ด้วย
            </T>
            <Points items={DELETED_FROM_PHONE} />
          </Card>

          <Card tone="alt" style={{ gap: space.sm }}>
            <Row gap={space.sm} align="flex-start">
              <Ionicons name="warning-outline" size={20} color={theme.watch} />
              <T v="small" color={theme.ink} style={{ flex: 1 }}>
                {SHARED_ACCOUNT_NOTE}
              </T>
            </Row>
          </Card>

          {cloud ? (
            <View style={{ gap: space.md }}>
              <PasswordField
                id="delete-password"
                label="ใส่รหัสผ่านเพื่อยืนยันว่าเป็นเจ้าของบัญชี"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (error) setError(null);
                }}
                error={error}
                hint="ลืมรหัสผ่าน? ออกจากระบบ แล้วกด “ลืมรหัสผ่าน” ที่หน้าเข้าสู่ระบบ"
                onSubmit={check}
              />
              <Button label="ลบบัญชีถาวร" kind="danger" icon="trash-outline" loading={busy} disabled={busy} onPress={check} />
            </View>
          ) : (
            <T v="small">{DELETE_ACCOUNT_MESSAGES.not_signed_in}</T>
          )}
        </ScrollView>
      </KeyboardAvoid>

      <ConfirmSheet
        visible={asking}
        title="ลบบัญชีถาวรเลยไหม?"
        body="รายการ กระปุกออม และข้อมูลทั้งหมดของบัญชีนี้จะหายทันที ทั้งใน MyPay และ MindPay และกู้คืนไม่ได้"
        confirmLabel="ลบถาวร"
        destructive
        onConfirm={run}
        onCancel={() => setAsking(false)}
      />
    </SafeAreaView>
  );
}
