import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Field } from '@/components/Field';
import { SignupConsent } from '@/components/legal/SignupConsent';
import { T } from '@/components/T';
import {
  Badge,
  GhostButton,
  KeyValueRow,
  NavRow,
  PrimaryButton,
  SectionHeader,
  Segmented,
  StatusPill,
  Surface,
} from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { appVersion, gitSha } from '@/lib/appVersion';
import { useRole } from '@/lib/cloud/admin';
import { resetPassword, signIn, signOut, signUp, useSession } from '@/lib/cloud/auth';
import { recentErrors } from '@/lib/diagnostics';
import { useDiagnosticsMode } from '@/lib/diagnosticsMode';
import { FEATURE_ALBUM, FEATURE_SYNC } from '@/lib/flags';
import { StorageMeter } from '@/components/album/StorageMeter';
import { dateLabel, dateTimeLabel } from '@/lib/format';
import { recordAcceptance } from '@/lib/legal/acceptance';
import { t } from '@/lib/i18n';
import { newerSchemaCount } from '@/lib/sync/engine';
import { useSync } from '@/lib/sync/useSync';
import { wipeCloudData } from '@/lib/sync/wipeCloud';
import { useProfile } from '@/lib/profile';
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
  const { session, ready, configured, otherApp } = useSession();
  const profile = useProfile();
  const role = useRole();
  const { status, pending, lastSyncAt, running, syncNow } = useSync();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  // Creating an account is the one thing that needs the terms accepted (ADR-47).
  const [consent, setConsent] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const diagnostics = useDiagnosticsMode();
  // Rows a newer Car Guy wrote, skipped by the schema gate (lib/sync/engine.ts).
  const [newer, setNewer] = useState(0);
  useEffect(() => {
    void newerSchemaCount().then(setNewer);
  }, [lastSyncAt]);

  async function submit() {
    setError(null);
    if (!email.trim()) return setError(t.account.errors.emailRequired);
    if (!password) return setError(t.account.errors.passwordRequired);
    if (mode === 'signUp' && !consent) return setError(t.legalUi.signupNeedsConsent);

    setBusy(true);
    const result =
      mode === 'signUp' ? await signUp(email, password, displayName) : await signIn(email, password);
    setBusy(false);

    if (!result.ok) return setError(result.message);

    setPassword('');
    if (mode === 'signUp') void recordAcceptance();
    if (mode === 'signUp') Alert.alert(t.account.createdTitle, t.account.createdBody);
  }

  async function handleForgot() {
    if (!email.trim()) return setError(t.account.resetNeedsEmail);
    setBusy(true);
    const result = await resetPassword(email);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    Alert.alert(t.account.resetSentTitle, t.account.resetSentBody(email.trim()));
  }

  /**
   * Two confirmations, not one. The local wipe can be undone by syncing again;
   * this one cannot be undone by anything, so it asks twice.
   */
  function confirmWipeCloud() {
    Alert.alert(t.sync.wipeCloudTitle, t.sync.wipeCloudBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: () =>
          Alert.alert(t.sync.wipeCloudTitle, t.sync.wipeCloudConfirm, [
            { text: t.common.cancel, style: 'cancel' },
            {
              text: t.common.delete,
              style: 'destructive',
              onPress: () => {
                void (async () => {
                  const result = await wipeCloudData(t.account.notConfigured);
                  Alert.alert(
                    t.sync.doneTitle,
                    result.ok ? t.sync.wipeCloudDone(result.deleted) : t.sync.wipeCloudFailed,
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
          {t.account.title}
        </T>
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {t.account.subtitle}
        </T>

        {/* Perfil works with or without an account (local first; uploads once signed in). */}
        <View style={{ marginTop: space.lg }}>
          <NavRow label={t.profileUi.open} caption={profile.displayName ?? t.profileUi.openCaption} onPress={() => router.push('/perfil')} />
        </View>

        {!configured ? (
          <Surface style={styles.card}>
            <StatusPill status="proximo" label={t.account.notConfiguredPill} />
            <T face="mono" style={[styles.version, { color: theme.text.muted }]}>
              {t.account.versionLine(appVersion, gitSha)}
            </T>
            <T face="body" style={[styles.cardBody, { color: theme.text.secondary }]}>
              {t.account.notConfiguredCaption}
            </T>
            {diagnostics ? (
              <T face="mono" style={[styles.version, { color: theme.text.muted }]}>
                {t.dev.notConfigured}
              </T>
            ) : null}
          </Surface>
        ) : !ready ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : session ? (
          <>
            <Surface style={styles.card}>
              <View style={styles.identity}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <StatusPill status="ok" label={t.account.signedInAs} />
                    {role && role !== 'member' ? <Badge label={t.admin.roles[role]} tone={role === 'admin' ? 'red' : 'amber'} /> : null}
                  </View>
                  <T face="mono" style={[styles.version, { color: theme.text.muted }]}>
                    {t.account.versionLine(appVersion, gitSha)}
                  </T>
                  <T face="monoBold" style={[styles.email, { color: theme.text.primary }]}>
                    {session.user.email}
                  </T>
                </View>
                {/* The profile avatar (photo → drawing → initials); tapping it opens Perfil. */}
                <Pressable onPress={() => router.push('/perfil')} accessibilityRole="button" accessibilityLabel={t.profileUi.headerA11y} hitSlop={8}>
                  <Avatar size={48} photoUri={profile.photoUri} avatarId={profile.avatarId} name={profile.displayName ?? session.user.email} decorative />
                </Pressable>
              </View>
              <View style={[styles.rule, { backgroundColor: theme.line }]} />

              <KeyValueRow
                label={t.account.lastSync}
                value={lastSyncAt ? dateTimeLabel(lastSyncAt) : t.sync.never}
              />
              <KeyValueRow
                label={t.sync.pendingLabel}
                value={pending === 0 ? t.sync.upToDate : t.sync.pending(pending)}
              />

              {newer > 0 ? (
                <T face="body" accessibilityRole="alert" style={[styles.cardBody, { color: theme.statusText.proximo, marginTop: space.sm }]}>
                  {t.account.newerChanges(newer)}
                </T>
              ) : null}

              {status.state === 'error' ? (
                <T
                  face="body"
                  accessibilityRole="alert"
                  style={[styles.syncError, { color: theme.dangerText, backgroundColor: theme.statusBg.vencido }]}>
                  {status.message}
                </T>
              ) : null}
              {/* Modo diagnóstico: the raw causes behind the sentence above. */}
              {diagnostics && status.state === 'error'
                ? recentErrors()
                    .slice(-3)
                    .map((entry) => (
                      <T key={entry.at + entry.where} face="mono" style={[styles.version, { color: theme.text.muted }]}>
                        {`${entry.at.slice(11, 19)} ${entry.where}: ${entry.message}`}
                      </T>
                    ))
                : null}

              {FEATURE_SYNC ? (
                <View style={{ marginTop: space.md }}>
                  <PrimaryButton
                    label={running ? t.sync.syncing : t.sync.syncNow}
                    onPress={() => void syncNow('manual')}
                    disabled={running}
                  />
                </View>
              ) : null}
            </Surface>

            {/* The photo quota (IMP 28092026 Phase 3): used / 300 MB, warns at 90 %. */}
            {FEATURE_ALBUM ? <StorageMeter style={{ marginBottom: space.md }} /> : null}

            <GhostButton label={t.account.signOut} onPress={handleSignOut} />

            <SectionHeader title={t.account.dangerZone} />
            <T face="body" style={[styles.cardBody, { color: theme.text.secondary }]}>
              {t.account.wipeLocalCaption}
            </T>
            <GhostButton
              danger
              label={t.account.wipeLocal}
              onPress={() =>
                Alert.alert(t.account.wipeLocalTitle, t.account.wipeLocalBody, [
                  { text: t.common.cancel, style: 'cancel' },
                  {
                    text: t.common.delete,
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
                  {t.sync.wipeCloudCaption}
                </T>
                <GhostButton danger label={t.sync.wipeCloud} onPress={confirmWipeCloud} />
              </>
            ) : null}
            <NavRow danger label={t.deleteAccount.entry} caption={t.deleteAccount.entryCaption} onPress={() => router.push('/borrar-cuenta')} />
          </>
        ) : (
          <>
            <Surface style={styles.card}>
              <T face="body" style={[styles.pitch, { color: theme.text.primary }]}>
                {t.account.pitch}
              </T>
              <T face="body" style={[styles.cardBody, { color: theme.text.secondary }]}>
                {t.account.pitchMore}
              </T>
              <T face="mono" style={[styles.version, { color: theme.text.muted }]}>
                {t.account.versionLine(appVersion, gitSha)}
              </T>
            </Surface>

            <Segmented<Mode>
              options={[
                { key: 'signIn', label: t.account.signIn },
                { key: 'signUp', label: t.account.signUp },
              ]}
              value={mode}
              onChange={(next) => {
                setMode(next);
                setError(null);
              }}
              style={styles.modes}
            />

            <Field
              label={t.account.email}
              placeholder={t.account.emailPlaceholder}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />

            <Field
              label={t.account.password}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!reveal}
              autoCapitalize="none"
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              hint={mode === 'signUp' ? t.account.passwordHint : undefined}
            />
            <Pressable
              onPress={() => setReveal((value) => !value)}
              accessibilityRole="switch"
              accessibilityState={{ checked: reveal }}
              style={styles.reveal}>
              <T face="semibold" style={{ color: theme.accent, fontSize: 14 }}>
                {reveal ? t.account.hidePassword : t.account.showPassword}
              </T>
            </Pressable>

            {mode === 'signUp' ? (
              <Field
                label={t.account.displayName}
                value={displayName}
                onChangeText={setDisplayName}
              />
            ) : null}
            {mode === 'signUp' ? <SignupConsent checked={consent} onChange={setConsent} /> : null}

            {error || otherApp ? (
              <T
                face="body"
                accessibilityRole="alert"
                style={[styles.error, { color: theme.dangerText, backgroundColor: theme.statusBg.vencido }]}>
                {/* A session from another x-core app was signed out: say why. */}
                {error ?? t.account.errors.otherApp}
              </T>
            ) : null}

            <PrimaryButton
              label={busy ? t.account.working : mode === 'signUp' ? t.account.signUp : t.account.signIn}
              onPress={submit}
              disabled={busy}
            />

            {mode === 'signIn' ? (
              <GhostButton label={t.account.forgot} onPress={handleForgot} />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  version: { fontSize: 12, marginTop: 4 },
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 30, lineHeight: 32, textTransform: 'uppercase', letterSpacing: 0.3 },
  sub: { marginTop: 6, lineHeight: 22 },
  card: { marginTop: space.lg, marginBottom: space.lg },
  cardBody: { fontSize: 13, marginTop: space.sm, lineHeight: 19 },
  pitch: { fontSize: 15, lineHeight: 22 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  email: { fontSize: 15, marginTop: space.md },
  rule: { height: 1, marginVertical: space.md },
  modes: { marginBottom: space.lg },
  reveal: { alignSelf: 'flex-start', paddingVertical: space.sm, minHeight: 44, justifyContent: 'center' },
  loading: { paddingVertical: space.xxxl, alignItems: 'center' },
  error: {
    fontSize: 13,
    marginBottom: space.md,
    padding: space.md,
    borderRadius: radius.input,
    overflow: 'hidden',
  },
  syncError: {
    fontSize: 13,
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.input,
    overflow: 'hidden',
  },
});
