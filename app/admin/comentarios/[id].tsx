import { Stack, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Field } from '@/components/Field';
import { STATUS_TONE, kindLabel, shortDate, statusLabel } from '@/components/feedback/present';
import { AdminFeedbackDetailSkeleton } from '@/components/skeletons/AdminSkeleton';
import { T } from '@/components/T';
import { EmptyState, GhostButton, KeyValueRow, Segmented, StatusPill, Surface } from '@/components/ui';
import { Skeleton } from '@/components/ui/Skeleton';
import { radius, space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useAdminGate } from '@/lib/cloud/admin';
import { FEEDBACK_STATUSES, getFeedback, screenshotUrl, updateFeedback, type FeedbackRow, type FeedbackStatus } from '@/lib/feedback/inbox';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/** One comment: the message, who and from where, diagnostics, screenshot (signed URL), status, note. */
export default function ComentarioDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const gate = useAdminGate();
  const admin = gate === 'admin';
  const [row, setRow] = useState<FeedbackRow | null | undefined>(undefined);
  const [shot, setShot] = useState<string | null | 'failed'>(null);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!admin || !id) return;
    let cancelled = false;
    void (async () => {
      const found = await getFeedback(id);
      if (cancelled) return;
      setRow(found === undefined ? null : found);
      setNote(found?.admin_note ?? '');
      if (found?.screenshot_path) {
        const url = await screenshotUrl(found.screenshot_path);
        if (!cancelled) setShot(url ?? 'failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [admin, id]);

  const header = <Stack.Screen options={{ headerShown: true, title: t.feedback.admin.detailTitle }} />;
  const a = t.feedback.admin;
  // The gate and the comment's read (remote, so the skeleton is really seen).
  const loading = gate === 'loading' || (admin && row === undefined);
  const showSkeleton = useDelayedLoading(loading);

  if (showSkeleton || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg.base }}>
        {header}
        {showSkeleton ? <AdminFeedbackDetailSkeleton /> : null}
      </View>
    );
  }
  if (!admin || !row) {
    return (
      <View style={[styles.centre, { backgroundColor: theme.bg.base }]}>
        {header}
        <EmptyState icon={admin ? 'help-circle-outline' : 'lock-closed-outline'} message={admin ? a.missing : a.notAdmin} />
      </View>
    );
  }

  async function setStatus(status: FeedbackStatus) {
    if (!row || status === row.status) return;
    const previous = row.status;
    setRow({ ...row, status });
    if (!(await updateFeedback(row.id, { status }))) {
      setRow((r) => (r ? { ...r, status: previous } : r));
      setNotice(a.saveFailed);
    }
  }

  async function saveNote() {
    if (!row) return;
    const ok = await updateFeedback(row.id, { admin_note: note.trim() || null });
    setNotice(ok ? a.saved : a.saveFailed);
    if (ok) setRow({ ...row, admin_note: note.trim() || null });
  }

  const diagnostics = row.diagnostics == null ? null : JSON.stringify(row.diagnostics, null, 2);

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      {header}
      <View style={styles.top}>
        <T face="display" style={{ color: theme.text.primary, fontSize: 26, textTransform: 'uppercase' }}>
          {kindLabel(row.kind)}
        </T>
        <StatusPill status={STATUS_TONE[row.status] ?? 'neutral'} label={statusLabel(row.status)} />
      </View>
      <T face="mono" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.md }}>
        {shortDate(row.created_at)}
      </T>

      <Surface style={styles.block}>
        <T face="body" selectable style={{ color: theme.text.primary, fontSize: 16, lineHeight: 23 }}>
          {row.message}
        </T>
      </Surface>

      <Segmented<FeedbackStatus>
        options={FEEDBACK_STATUSES.map((s) => ({ key: s, label: statusLabel(s) }))}
        value={row.status as FeedbackStatus}
        onChange={setStatus}
        style={styles.block}
      />

      <Surface style={styles.block}>
        <KeyValueRow label={a.from} value={row.user_id ? (row.email ?? row.user_id.slice(0, 8)) : (row.email ?? a.anonymous)} />
        <KeyValueRow label={t.feedback.fields.version} value={[row.app_version, row.build].filter(Boolean).join(' · ') || '—'} />
        <KeyValueRow label={t.feedback.fields.platform} value={[row.platform, row.os_version].filter(Boolean).join(' · ') || '—'} />
        <KeyValueRow label={t.feedback.fields.device} value={row.device ?? '—'} />
        <KeyValueRow label={t.feedback.fields.screen} value={row.screen ?? '—'} />
        {row.email ? (
          <GhostButton label={a.replyTo(row.email)} onPress={() => void Linking.openURL(`mailto:${row.email}?subject=${encodeURIComponent(a.replySubject)}`)} />
        ) : null}
      </Surface>

      <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
        {a.screenshot}
      </T>
      {!row.screenshot_path ? (
        <T face="body" style={{ color: theme.text.muted, marginBottom: space.md }}>
          {a.noScreenshot}
        </T>
      ) : shot === 'failed' ? (
        <T face="body" style={{ color: theme.dangerText, marginBottom: space.md }}>
          {a.screenshotFailed}
        </T>
      ) : shot ? (
        <Pressable onPress={() => void Linking.openURL(shot)} accessibilityRole="imagebutton" accessibilityLabel={a.screenshot}>
          <Image source={{ uri: shot }} style={[styles.shot, { backgroundColor: theme.bg.raised }]} resizeMode="contain" accessibilityIgnoresInvertColors />
        </Pressable>
      ) : (
        // The signed URL is on its way: the screenshot's own outline, not a spinner.
        <Skeleton padded={false} style={{ flex: 0, marginBottom: space.md }}>
          <Skeleton.Rect h={360} r={radius.input} />
        </Skeleton>
      )}

      <Field label={a.note} value={note} onChangeText={setNote} placeholder={a.notePlaceholder} multiline textAlignVertical="top" style={{ minHeight: 80 }} />
      <GhostButton label={a.saveNote} onPress={saveNote} />
      {notice ? (
        <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.accent, fontSize: 13, textAlign: 'center' }}>
          {notice}
        </T>
      ) : null}

      <T face="eyebrow" style={[styles.label, { color: theme.text.secondary, marginTop: space.lg }]}>
        {a.diagnostics}
      </T>
      <Surface>
        <T face="mono" selectable style={{ color: theme.text.secondary, fontSize: 11, lineHeight: 16 }}>
          {diagnostics ?? '—'}
        </T>
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.gutter },
  pad: { padding: space.gutter, paddingBottom: 48 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  block: { marginBottom: space.md },
  label: { fontSize: 12, marginBottom: 6 },
  shot: { width: '100%', height: 360, borderRadius: radius.input, marginBottom: space.md },
});
