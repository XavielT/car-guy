import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { GhostButton, Hanko, PrimaryButton, SectionHeader, StatusPill, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { isConfirmWord, type DeletionResult } from '@/lib/account/deleteAccount';
import { deleteMyAccount } from '@/lib/account/deleteAccountClient';
import { Alert } from '@/lib/alert';
import { useSession } from '@/lib/cloud/auth';
import { t } from '@/lib/i18n';
import { legalRoute } from '@/lib/legal';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Cuenta → Eliminar cuenta (03-screens.md Phase 6, ADR-47): what goes and what stays, type the word
 * (ELIMINAR / DELETE), confirm → cloud data (sql/028) → login (api/eliminar-cuenta.ts) → sign out →
 * this phone's data (lib/db/reset.ts) → the success screen. lib/account/deleteAccount.ts has the
 * order and why the cloud goes first.
 */
export default function BorrarCuenta() {
  const router = useRouter();
  const { theme } = useTheme();
  const { session, ready } = useSession();
  const { refresh } = useStore();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<DeletionResult, { ok: true }> | null>(null);
  const word = t.deleteAccount.word;

  const header = <Stack.Screen options={{ headerShown: true, title: t.deleteAccount.title, headerBackVisible: !busy && !done }} />;

  if (done) {
    return (
      <SafeAreaView style={[styles.centre, { backgroundColor: theme.bg.base }]} edges={['bottom']}>
        {header}
        <Hanko char="車" size={72} />
        <T face="display" accessibilityRole="header" style={[styles.doneTitle, { color: theme.text.primary }]}>
          {t.deleteAccount.doneTitle}
        </T>
        <T face="body" accessibilityLiveRegion="polite" style={[styles.doneBody, { color: theme.text.secondary }]}>
          {done.login === 'deleted' ? t.deleteAccount.doneBody : t.deleteAccount.doneManual}
        </T>
        <T face="body" style={[styles.doneBody, { color: theme.text.muted, fontSize: 13 }]}>
          {t.deleteAccount.doneLocalNote}
        </T>
        <View style={{ alignSelf: 'stretch', marginTop: space.xl }}>
          <PrimaryButton label={t.deleteAccount.doneButton} onPress={() => router.replace('/(tabs)')} />
        </View>
      </SafeAreaView>
    );
  }

  if (!ready) {
    return (
      <View style={[styles.centre, { backgroundColor: theme.bg.base }]}>
        {header}
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const run = async () => {
    setBusy(true);
    setError(null);
    const result = await deleteMyAccount(refresh);
    setBusy(false);
    if (result.ok) return setDone(result);
    setError(
      result.reason === 'not-carguy'
        ? t.deleteAccount.errors.notCarGuy
        : result.reason === 'network'
          ? t.deleteAccount.errors.network
          : result.reason === 'not-signed-in'
            ? t.deleteAccount.signedOut
            : t.deleteAccount.errors.generic,
    );
  };

  const confirm = () => {
    if (!isConfirmWord(typed, word)) return setError(t.deleteAccount.errors.wordMismatch(word));
    Alert.alert(t.deleteAccount.confirmTitle, t.deleteAccount.confirmBody, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.deleteAccount.confirm, style: 'destructive', onPress: () => void run() },
    ]);
  };

  const list = (items: readonly string[], tone: string) =>
    items.map((item) => (
      <View key={item} style={styles.item}>
        <View style={[styles.dot, { backgroundColor: tone }]} />
        <T face="body" style={[styles.itemText, { color: theme.text.secondary }]}>
          {item}
        </T>
      </View>
    ));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      {header}
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="body" style={[styles.intro, { color: theme.text.primary }]}>
          {t.deleteAccount.intro}
        </T>

        {!session && !busy ? (
          <Surface style={{ marginTop: space.lg }}>
            <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20 }}>
              {t.deleteAccount.signedOut}
            </T>
            <View style={{ marginTop: space.md }}>
              <PrimaryButton label={t.deleteAccount.goToAccount} onPress={() => router.replace('/cuenta')} />
            </View>
            <GhostButton label={t.deleteAccount.readPage} onPress={() => router.push(legalRoute('eliminar-cuenta') as never)} />
          </Surface>
        ) : (
          <>
            <Surface style={{ marginTop: space.lg }}>
              <StatusPill status="ok" label={session?.user.email ?? ''} />
            </Surface>
            <SectionHeader title={t.deleteAccount.goesTitle} />
            {list(t.deleteAccount.goes, theme.redline)}
            <SectionHeader title={t.deleteAccount.staysTitle} />
            {list(t.deleteAccount.stays, theme.text.muted)}
            <T face="body" style={[styles.hint, { color: theme.text.muted }]}>
              {t.deleteAccount.exportHint}
            </T>

            <View style={{ marginTop: space.lg }}>
              <Field
                label={t.deleteAccount.inputLabel}
                hint={t.deleteAccount.typePrompt(word)}
                placeholder={word}
                value={typed}
                onChangeText={(v) => {
                  setTyped(v);
                  setError(null);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!busy}
              />
            </View>
            {error ? (
              <T face="body" accessibilityRole="alert" style={[styles.error, { color: theme.dangerText, backgroundColor: theme.statusBg.vencido }]}>
                {error}
              </T>
            ) : null}
            {busy ? (
              <View style={styles.working}>
                <ActivityIndicator color={theme.accent} />
                <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.text.secondary }}>
                  {t.deleteAccount.working}
                </T>
              </View>
            ) : (
              <GhostButton danger label={t.deleteAccount.confirm} onPress={confirm} disabled={!isConfirmWord(typed, word)} />
            )}
            <GhostButton label={t.deleteAccount.readPage} onPress={() => router.push(legalRoute('eliminar-cuenta') as never)} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.gutter },
  intro: { fontSize: 16, lineHeight: 23 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginBottom: space.sm },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  itemText: { flex: 1, fontSize: 14, lineHeight: 20 },
  hint: { fontSize: 13, marginTop: space.sm, lineHeight: 18 },
  error: { fontSize: 13, marginBottom: space.md, padding: space.md, borderRadius: radius.input, overflow: 'hidden' },
  working: { flexDirection: 'row', alignItems: 'center', gap: space.sm, justifyContent: 'center', paddingVertical: space.lg },
  doneTitle: { fontSize: 28, textTransform: 'uppercase', marginTop: space.lg, textAlign: 'center' },
  doneBody: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: space.sm },
});
