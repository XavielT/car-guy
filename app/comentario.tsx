import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip, GhostButton, KeyValueRow, PrimaryButton, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { useSession } from '@/lib/cloud/auth';
import { recordError } from '@/lib/diagnostics';
import { useDiagnosticsMode } from '@/lib/diagnosticsMode';
import { lastVisitedRoute, sendFeedback, type SendOutcome } from '@/lib/feedback';
import { collectContext } from '@/lib/feedback/context';
import { FEEDBACK_KINDS, validateDraft, type FeedbackKind } from '@/lib/feedback/payload';
import { redactText } from '@/lib/feedback/redact';
import { es } from '@/lib/i18n/es';
import { pickCandidates } from '@/lib/media';
import { compressPhoto } from '@/lib/media/compress';
import { useStore } from '@/lib/store';
import { useSync } from '@/lib/sync/useSync';
import { useTheme } from '@/lib/theme/useTheme';

/** 03-screens.md "Phase 6": 1200 px is enough to read a screen and stays far below the bucket's 2 MB. */
const SCREENSHOT = { width: 1200, quality: 0.7 };

/**
 * Enviar comentario (03-screens.md "Phase 6", ADR-35). Works signed out: the
 * row goes in through carguy.submit_feedback as anon. Offline, it waits in the
 * outbox and goes on the next launch.
 */
export default function ComentarioScreen() {
  const params = useLocalSearchParams<{ kind?: string; from?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { data } = useStore();
  const { session } = useSession();
  const sync = useSync();
  const diagnosticsMode = useDiagnosticsMode();

  const initialKind = FEEDBACK_KINDS.includes(params.kind as FeedbackKind) ? (params.kind as FeedbackKind) : 'bug';
  const [kind, setKind] = useState<FeedbackKind>(initialKind);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [shot, setShot] = useState<string | null>(null);
  const [shotBusy, setShotBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<SendOutcome | null>(null);

  // Read once per render of the panel; cheap, and the errors list is the live ring buffer.
  const context = useMemo(
    () =>
      collectContext({
        screen: params.from || lastVisitedRoute(),
        sync: {
          signedIn: Boolean(session),
          state: session ? sync.status.state : 'signed-out',
          pending: session ? sync.pending : null,
          lastSyncAt: session ? sync.lastSyncAt : null,
          message: sync.status.state === 'error' ? sync.status.message : null,
        },
        diagnosticsMode,
        secrets: [
          session?.user.email,
          ...data.vehicles.flatMap((v) => [v.plate, v.detail?.plate, v.detail?.vin]),
        ],
      }),
    // `open` re-reads it when the panel opens, so a fresh error shows up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, session, sync.status, sync.pending, sync.lastSyncAt, diagnosticsMode, data.vehicles, params.from],
  );

  async function pickShot() {
    try {
      // Straight from the press handler: on web the picker needs the gesture.
      const [candidate] = await pickCandidates({ camera: false });
      if (!candidate) return;
      setShotBusy(true);
      const compressed = await compressPhoto(candidate.uri, candidate.width, SCREENSHOT);
      setShot(compressed.uri);
    } catch (error) {
      recordError('feedback-pick', error);
      setProblem(es.feedback.screenshotError);
    } finally {
      setShotBusy(false);
    }
  }

  async function submit() {
    const invalid = validateDraft({ kind, message, email });
    if (invalid) {
      setProblem(es.feedback.errors[invalid]);
      return;
    }
    setProblem(null);
    setBusy(true);
    try {
      const outcome = await sendFeedback({ kind, message, email }, context, shot);
      if (outcome.status === 'rate_limited') setProblem(es.feedback.rateLimited);
      else if (outcome.status === 'error') setProblem(es.feedback.error);
      else setResult(outcome);
    } catch (error) {
      recordError('feedback-send', error);
      setProblem(es.feedback.error);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setMessage('');
    setShot(null);
    setProblem(null);
  }

  const header = <Stack.Screen options={{ headerShown: true, title: es.feedback.title }} />;

  if (result) {
    const queued = result.status === 'queued';
    return (
      <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
        {header}
        <Surface style={styles.done}>
          <Ionicons name={queued ? 'cloud-offline-outline' : 'checkmark-circle-outline'} size={40} color={theme.accent} />
          <T face="title" accessibilityRole="header" style={[styles.doneTitle, { color: theme.text.primary }]}>
            {queued ? es.feedback.queuedTitle : es.feedback.thanksTitle}
          </T>
          <T face="body" accessibilityLiveRegion="polite" style={[styles.doneBody, { color: theme.text.secondary }]}>
            {queued ? es.feedback.queued : es.feedback.thanks}
          </T>
          {result.status === 'sent' && result.screenshot === 'failed' ? (
            <T face="body" style={[styles.doneBody, { color: theme.text.muted, fontSize: 13 }]}>
              {es.feedback.screenshotFailed}
            </T>
          ) : null}
        </Surface>
        <PrimaryButton label={es.feedback.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/mas'))} />
        <GhostButton label={es.feedback.another} onPress={reset} />
      </ScrollView>
    );
  }

  const f = es.feedback.fields;
  const secrets = context.secrets;

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      {header}
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {es.feedback.eyebrow}
      </T>
      <T face="body" style={[styles.intro, { color: theme.text.secondary }]}>
        {es.feedback.intro}
      </T>

      <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
        {es.feedback.kindLabel}
      </T>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {FEEDBACK_KINDS.map((k) => (
          <Chip key={k} label={es.feedback.kinds[k]} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>

      <Field
        label={es.feedback.message}
        value={message}
        onChangeText={setMessage}
        placeholder={es.feedback.placeholders[kind]}
        multiline
        maxLength={4000}
        textAlignVertical="top"
        style={styles.message}
      />
      <Field
        label={es.feedback.email}
        hint={es.feedback.emailHint}
        value={email}
        onChangeText={setEmail}
        placeholder={session?.user.email ?? 'tu@email.com'}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />

      <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
        {es.feedback.screenshot}
      </T>
      {shotBusy ? (
        <View style={[styles.shotEmpty, { borderColor: theme.line, backgroundColor: theme.bg.raised }]}>
          <ActivityIndicator color={theme.text.muted} />
        </View>
      ) : shot ? (
        <View style={styles.shotWrap}>
          <Image source={{ uri: shot }} style={[styles.shot, { backgroundColor: theme.bg.raised }]} resizeMode="contain" accessibilityIgnoresInvertColors />
          <GhostButton label={es.feedback.screenshotRemove} onPress={() => setShot(null)} />
        </View>
      ) : (
        <Pressable
          onPress={pickShot}
          accessibilityRole="button"
          style={({ pressed }) => [styles.shotEmpty, { borderColor: theme.line, backgroundColor: theme.bg.raised }, pressed && { opacity: 0.85 }]}>
          <Ionicons name="image-outline" size={22} color={theme.text.secondary} />
          <T face="semibold" style={{ color: theme.text.secondary, fontSize: 14 }}>
            {es.feedback.screenshotAdd}
          </T>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
            {es.feedback.screenshotHint}
          </T>
        </Pressable>
      )}

      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        style={styles.disclosure}>
        <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={16} color={theme.text.secondary} />
        <T face="semibold" style={{ color: theme.text.secondary, fontSize: 14 }}>
          {es.feedback.whatIsSent}
        </T>
      </Pressable>
      {open ? (
        <Surface style={styles.sent}>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.sm, lineHeight: 17 }}>
            {es.feedback.whatIsSentHint}
          </T>
          <KeyValueRow label={f.version} value={context.appVersion ?? '—'} />
          <KeyValueRow label={f.build} value={context.build ?? '—'} />
          <KeyValueRow label={f.sha} value={context.gitSha ?? '—'} />
          <KeyValueRow label={f.platform} value={context.platform} />
          <KeyValueRow label={f.os} value={context.osVersion ?? '—'} />
          <KeyValueRow label={f.device} value={context.device ?? '—'} />
          <KeyValueRow label={f.screen} value={context.screen ? redactText(context.screen.split('?')[0], secrets) : '—'} />
          <KeyValueRow label={f.db} value={es.feedback.dbVersion(context.dbVersion)} />
          <KeyValueRow
            label={f.sync}
            value={context.sync.signedIn ? es.feedback.syncLine(context.sync.state, context.sync.pending) : f.signedOut}
          />
          <T face="body" style={[styles.subLabel, { color: theme.text.muted }]}>
            {f.flags}
          </T>
          <T face="mono" style={[styles.mono, { color: theme.text.secondary }]}>
            {Object.entries(context.flags)
              .filter(([, on]) => on)
              .map(([k]) => k.replace(/^FEATURE_/, ''))
              .join(' · ') || f.none}
          </T>
          <T face="body" style={[styles.subLabel, { color: theme.text.muted }]}>
            {f.errors} ({context.errors.length})
          </T>
          {context.errors.length ? (
            context.errors.slice(-20).map((e, i) => (
              <T key={`${e.at}-${i}`} face="mono" style={[styles.mono, { color: theme.text.secondary }]}>
                {`${e.at.slice(11, 19)} ${e.where}: ${redactText(e.message, secrets)}`}
              </T>
            ))
          ) : (
            <T face="mono" style={[styles.mono, { color: theme.text.secondary }]}>
              {f.none}
            </T>
          )}
        </Surface>
      ) : null}

      {problem ? (
        <T face="body" accessibilityLiveRegion="polite" style={[styles.problem, { color: theme.dangerText }]}>
          {problem}
        </T>
      ) : null}
      <PrimaryButton label={busy ? es.feedback.sending : es.feedback.send} onPress={submit} disabled={busy || shotBusy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  intro: { fontSize: 15, lineHeight: 22, marginTop: 4, marginBottom: space.lg },
  label: { fontSize: 12, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  message: { minHeight: 140 },
  shotEmpty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.input,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: space.md,
    marginBottom: space.md,
  },
  shotWrap: { marginBottom: space.sm },
  shot: { width: '100%', height: 220, borderRadius: radius.input },
  disclosure: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  sent: { marginBottom: space.md },
  subLabel: { fontSize: 13, marginTop: space.md, marginBottom: 4 },
  mono: { fontSize: 12, lineHeight: 17 },
  problem: { fontSize: 14, lineHeight: 20, marginVertical: space.sm },
  done: { alignItems: 'center', gap: space.sm, marginBottom: space.lg, paddingVertical: space.xl },
  doneTitle: { fontSize: 22, textTransform: 'uppercase', letterSpacing: 0.6 },
  doneBody: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
