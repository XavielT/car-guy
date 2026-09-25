import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import {
  GhostButton,
  KeyValueRow,
  PrimaryButton,
  SectionHeader,
  Segmented,
  StatusPill,
  Surface,
} from '@/components/ui';
import { space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { resetPassword, signIn, signOut, signUp, useSession } from '@/lib/cloud/auth';
import { FEATURE_SYNC } from '@/lib/flags';
import { dateLabel } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useSync } from '@/lib/sync/useSync';
import { wipeCloudData } from '@/lib/sync/wipeCloud';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

type Mode = 'signIn' | 'signUp';

/**
 * The account screen — and, just as much, the screen that explains why you do
 * not need one.
 *
 * Signed in, it is also where sync reports itself: when it last ran, what is
 * still waiting to go up, and "Sincronizar ahora". `FEATURE_SYNC` can still
 * switch the button off, but sync shipped in Phase 9 and the flag is on.
 */
export default function CuentaScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { resetAll } = useStore();
  const { session, ready, configured } = useSession();
  const { status, pending, lastSyncAt, running, syncNow } = useSync();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!email.trim()) return setError(es.account.errors.emailRequired);
    if (!password) return setError(es.account.errors.passwordRequired);

    setBusy(true);
    const result =
      mode === 'signUp' ? await signUp(email, password, displayName) : await signIn(email, password);
    setBusy(false);

    if (!result.ok) return setError(result.message);

    setPassword('');
    if (mode === 'signUp') Alert.alert(es.account.createdTitle, es.account.createdBody);
  }

  async function handleForgot() {
    if (!email.trim()) return setError(es.account.resetNeedsEmail);
    setBusy(true);
    const result = await resetPassword(email);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    Alert.alert(es.account.resetSentTitle, es.account.resetSentBody(email.trim()));
  }

  /**
   * Two confirmations, not one. The local wipe can be undone by syncing again;
   * this one cannot be undone by anything, so it asks twice.
   */
  function confirmWipeCloud() {
    Alert.alert(es.sync.wipeCloudTitle, es.sync.wipeCloudBody, [
      { text: es.common.cancel, style: 'cancel' },
      {
        text: es.common.delete,
        style: 'destructive',
        onPress: () =>
          Alert.alert(es.sync.wipeCloudTitle, es.sync.wipeCloudConfirm, [
            { text: es.common.cancel, style: 'cancel' },
            {
              text: es.common.delete,
              style: 'destructive',
              onPress: () => {
                void (async () => {
                  const result = await wipeCloudData(es.account.notConfigured);
                  Alert.alert(
                    es.sync.doneTitle,
                    result.ok ? es.sync.wipeCloudDone(result.deleted) : es.sync.wipeCloudFailed,
                  );
                })();
              },
            },
          ]),
      },
    ]);
  }

  async function handleSignOut() {
    setBusy(true);
    const result = await signOut();
    setBusy(false);
    if (!result.ok) setError(result.message);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.account.title}
        </T>
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {es.account.subtitle}
        </T>

        {!configured ? (
          <Surface style={styles.card}>
            <StatusPill status="proximo" label={es.account.notConfigured} />
            <T face="body" style={[styles.cardBody, { color: theme.text.secondary }]}>
              {es.account.notConfiguredCaption}
            </T>
          </Surface>
        ) : !ready ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : session ? (
          <>
            <Surface style={styles.card}>
              <StatusPill status="ok" label={es.account.signedInAs} />
              <T face="monoBold" style={[styles.email, { color: theme.text.primary }]}>
                {session.user.email}
              </T>
              <View style={[styles.rule, { backgroundColor: theme.line }]} />

              <KeyValueRow
                label={es.account.lastSync}
                value={lastSyncAt ? dateLabel(lastSyncAt) : es.sync.never}
              />
              <KeyValueRow
                label={es.sync.pendingLabel}
                value={pending === 0 ? es.sync.upToDate : es.sync.pending(pending)}
              />

              {status.state === 'error' ? (
                <T
                  face="body"
                  accessibilityRole="alert"
                  style={[styles.syncError, { color: theme.danger, backgroundColor: theme.statusBg.vencido }]}>
                  {status.message}
                </T>
              ) : null}

              {FEATURE_SYNC ? (
                <View style={{ marginTop: space.md }}>
                  <PrimaryButton
                    label={running ? es.sync.syncing : es.sync.syncNow}
                    onPress={() => void syncNow('manual')}
                    disabled={running}
                  />
                </View>
              ) : null}
            </Surface>

            <GhostButton label={es.account.signOut} onPress={handleSignOut} />

            <SectionHeader title={es.account.dangerZone} />
            <T face="body" style={[styles.cardBody, { color: theme.text.secondary }]}>
              {es.account.wipeLocalCaption}
            </T>
            <GhostButton
              danger
              label={es.account.wipeLocal}
              onPress={() =>
                Alert.alert(es.account.wipeLocalTitle, es.account.wipeLocalBody, [
                  { text: es.common.cancel, style: 'cancel' },
                  {
                    text: es.common.delete,
                    style: 'destructive',
                    onPress: () => {
                      resetAll();
                      router.replace('/(tabs)');
                    },
                  },
                ])
              }
            />

            {FEATURE_SYNC ? (
              <>
                <T face="body" style={[styles.cardBody, { color: theme.text.secondary }]}>
                  {es.sync.wipeCloudCaption}
                </T>
                <GhostButton danger label={es.sync.wipeCloud} onPress={confirmWipeCloud} />
              </>
            ) : null}
          </>
        ) : (
          <>
            <Surface style={styles.card}>
              <T face="body" style={[styles.pitch, { color: theme.text.primary }]}>
                {es.account.pitch}
              </T>
              <T face="body" style={[styles.cardBody, { color: theme.text.secondary }]}>
                {es.account.pitchMore}
              </T>
            </Surface>

            <Segmented<Mode>
              options={[
                { key: 'signIn', label: es.account.signIn },
                { key: 'signUp', label: es.account.signUp },
              ]}
              value={mode}
              onChange={(next) => {
                setMode(next);
                setError(null);
              }}
              style={styles.modes}
            />

            <Field
              label={es.account.email}
              placeholder={es.account.emailPlaceholder}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />

            <Field
              label={es.account.password}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!reveal}
              autoCapitalize="none"
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              hint={mode === 'signUp' ? es.account.passwordHint : undefined}
            />
            <Pressable
              onPress={() => setReveal((value) => !value)}
              accessibilityRole="switch"
              accessibilityState={{ checked: reveal }}
              style={styles.reveal}>
              <T face="semibold" style={{ color: theme.accent, fontSize: 13 }}>
                {reveal ? es.account.hidePassword : es.account.showPassword}
              </T>
            </Pressable>

            {mode === 'signUp' ? (
              <Field
                label={es.account.displayName}
                value={displayName}
                onChangeText={setDisplayName}
              />
            ) : null}

            {error ? (
              <T
                face="body"
                accessibilityRole="alert"
                style={[styles.error, { color: theme.danger, backgroundColor: theme.statusBg.vencido }]}>
                {error}
              </T>
            ) : null}

            <PrimaryButton
              label={busy ? es.account.working : mode === 'signUp' ? es.account.signUp : es.account.signIn}
              onPress={submit}
              disabled={busy}
            />

            {mode === 'signIn' ? (
              <GhostButton label={es.account.forgot} onPress={handleForgot} />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 30 },
  sub: { marginTop: 6, lineHeight: 22 },
  card: { marginTop: space.lg, marginBottom: space.lg },
  cardBody: { fontSize: 13, marginTop: space.sm, lineHeight: 19 },
  pitch: { fontSize: 15, lineHeight: 22 },
  email: { fontSize: 15, marginTop: space.md },
  rule: { height: 1, marginVertical: space.md },
  modes: { marginBottom: space.lg },
  reveal: { alignSelf: 'flex-start', paddingVertical: space.sm, minHeight: 44, justifyContent: 'center' },
  loading: { paddingVertical: space.xxxl, alignItems: 'center' },
  error: {
    fontSize: 13,
    marginBottom: space.md,
    padding: space.md,
    borderRadius: 14,
    overflow: 'hidden',
  },
  syncError: {
    fontSize: 13,
    marginTop: space.md,
    padding: space.md,
    borderRadius: 14,
    overflow: 'hidden',
  },
});
