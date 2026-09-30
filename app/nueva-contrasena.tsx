import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { translateAuthError } from '@/lib/cloud/auth';
import { checkMembership } from '@/lib/cloud/membership';
import { parseRecoveryUrl } from '@/lib/cloud/recovery';
import { getSupabase } from '@/lib/cloud/supabase';
import { recordError } from '@/lib/diagnostics';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

type Stage = 'reading' | 'invalid' | 'otherApp' | 'form' | 'done';

const MIN_PASSWORD = 8;

/**
 * Where the password-reset email lands (`carguy://nueva-contrasena` or
 * `<web origin>/nueva-contrasena`, see resetRedirectUrl in lib/cloud/auth.ts).
 *
 * The link carries a recovery session. It is only used to set a new password
 * when the account is a Car Guy one: x-core also holds Music Hub's accounts,
 * and a Music Hub user must not change their password through Car Guy.
 */
export default function NuevaContrasenaScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const linkingUrl = Linking.useLinkingURL();
  const [stage, setStage] = useState<Stage>('reading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    const url = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : linkingUrl;
    if (handled.current || !url) return;
    const link = parseRecoveryUrl(url);
    // Native: the first render may not have the URL yet; wait for it.
    if (link.kind === 'none' && Platform.OS !== 'web') return;
    handled.current = true;

    // The tokens must not stay in the address bar or the browser history. After
    // a tick: the router writes its own URL (fragment included) once it settles.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      setTimeout(() => window.history.replaceState(window.history.state, '', window.location.pathname), 300);
    }

    void (async () => {
      const supabase = getSupabase();
      if (!supabase || link.kind !== 'tokens') {
        if (link.kind === 'error') recordError('auth', `recovery link: ${link.code}`);
        return setStage('invalid');
      }
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: link.accessToken,
        refresh_token: link.refreshToken,
      });
      if (sessionError || !data.user) {
        if (sessionError) recordError('auth', `recovery setSession: ${sessionError.message}`);
        return setStage('invalid');
      }
      const member = await checkMembership(supabase, data.user.id);
      if (member !== true) {
        await supabase.auth.signOut();
        return setStage(member === false ? 'otherApp' : 'invalid');
      }
      setStage('form');
    })();
  }, [linkingUrl]);

  // Opened with no link at all (typed, or a stale tab): say so instead of spinning.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!handled.current) {
        handled.current = true;
        setStage('invalid');
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  async function save() {
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(t.account.errors.weakPassword);
    if (password !== confirm) return setError(t.account.reset.mismatch);
    const supabase = getSupabase();
    if (!supabase) return setStage('invalid');

    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError(translateAuthError(updateError.message));
    setPassword('');
    setConfirm('');
    setStage('done');
  }

  const toAccount = () => router.replace('/cuenta');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {t.account.reset.title}
        </T>

        {stage === 'reading' ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.accent} />
            <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
              {t.account.reset.reading}
            </T>
          </View>
        ) : stage === 'form' ? (
          <>
            <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
              {t.account.reset.body}
            </T>
            <View style={{ height: space.lg }} />
            <Field
              label={t.account.reset.newPassword}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              hint={t.account.passwordHint}
            />
            <Field
              label={t.account.reset.confirm}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
            />
            {error ? (
              <T
                face="body"
                accessibilityRole="alert"
                style={[styles.error, { color: theme.dangerText, backgroundColor: theme.statusBg.vencido }]}>
                {error}
              </T>
            ) : null}
            <PrimaryButton
              label={busy ? t.account.working : t.account.reset.save}
              onPress={save}
              disabled={busy}
            />
          </>
        ) : (
          <>
            <Surface style={styles.card}>
              {stage === 'done' ? (
                <>
                  <T face="title" style={[styles.pitch, { color: theme.text.primary }]}>
                    {t.account.reset.doneTitle}
                  </T>
                  <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
                    {t.account.reset.doneBody}
                  </T>
                </>
              ) : (
                <T face="body" style={[styles.pitch, { color: theme.text.primary }]}>
                  {stage === 'otherApp' ? t.account.errors.otherApp : t.account.reset.invalid}
                </T>
              )}
            </Surface>
            {stage === 'done' ? (
              <PrimaryButton label={t.account.reset.toAccount} onPress={toAccount} />
            ) : (
              <GhostButton label={t.account.reset.toAccount} onPress={toAccount} />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 30, lineHeight: 32, textTransform: 'uppercase', letterSpacing: 0.3 },
  sub: { marginTop: 6, lineHeight: 22 },
  card: { marginTop: space.lg, marginBottom: space.lg },
  pitch: { fontSize: 15, lineHeight: 22 },
  loading: { paddingVertical: space.xxxl, alignItems: 'center', gap: space.md },
  error: {
    fontSize: 13,
    marginBottom: space.md,
    padding: space.md,
    borderRadius: radius.input,
    overflow: 'hidden',
  },
});
