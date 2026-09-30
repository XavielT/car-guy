import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AdminFeedbackListSkeleton } from '@/components/skeletons/AdminSkeleton';
import { T } from '@/components/T';
import { STATUS_TONE, kindLabel, shortDate, statusLabel } from '@/components/feedback/present';
import { Chip, EmptyState, StatusPill } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useAdminGate } from '@/lib/cloud/admin';
import { t } from '@/lib/i18n';
import { FEEDBACK_STATUSES, listFeedback, type FeedbackListRow, type FeedbackStatus } from '@/lib/feedback/inbox';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Comentarios recibidos (03-screens.md "Phase 6", ADR-35): the admin's inbox.
 * Only the admin session gets here from Más; anyone else who types the URL
 * gets the notice — and RLS would give them their own rows at most.
 */
export default function ComentariosRecibidos() {
  const router = useRouter();
  const { theme } = useTheme();
  const gate = useAdminGate();
  const admin = gate === 'admin';
  const [rows, setRows] = useState<FeedbackListRow[] | null | undefined>(undefined);
  const [filter, setFilter] = useState<FeedbackStatus | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRows(await listFeedback());
  }, []);

  // Back from a detail that changed a status: reload.
  useFocusEffect(
    useCallback(() => {
      if (admin) void load();
    }, [admin, load]),
  );

  const header = <Stack.Screen options={{ headerShown: true, title: t.feedback.admin.title }} />;
  // The gate and the first inbox read; back from a detail reloads behind the old list.
  const loading = gate === 'loading' || (admin && rows === undefined);
  const showSkeleton = useDelayedLoading(loading);

  if (showSkeleton || loading) {
    // Remote data, so the skeleton is really seen; a fast answer shows nothing but the header.
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg.base }}>
        {header}
        {showSkeleton ? <AdminFeedbackListSkeleton /> : null}
      </View>
    );
  }

  if (!admin) {
    return (
      <View style={[styles.centre, { backgroundColor: theme.bg.base }]}>
        {header}
        <EmptyState icon="lock-closed-outline" message={t.feedback.admin.notAdmin} />
      </View>
    );
  }

  const shown = (rows ?? []).filter((r) => filter === 'all' || r.status === filter);
  const counts = Object.fromEntries(FEEDBACK_STATUSES.map((s) => [s, (rows ?? []).filter((r) => r.status === s).length]));

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg.base }}
      contentContainerStyle={styles.pad}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }>
      {header}
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {t.feedback.admin.count(rows?.length ?? 0)}
      </T>
      <View style={styles.chips}>
        <Chip label={t.feedback.admin.all} selected={filter === 'all'} onPress={() => setFilter('all')} />
        {FEEDBACK_STATUSES.map((s) => (
          <Chip key={s} label={`${statusLabel(s)} ${counts[s]}`} selected={filter === s} onPress={() => setFilter(s)} />
        ))}
      </View>

      {rows === null ? <EmptyState icon="cloud-offline-outline" message={t.feedback.admin.loadFailed} actionLabel={t.common.retry} onAction={load} /> : null}
      {rows && !shown.length ? <EmptyState icon="mail-open-outline" message={t.feedback.admin.empty} /> : null}

      {shown.map((row) => (
        <Pressable
          key={row.id}
          onPress={() => router.push({ pathname: '/admin/comentarios/[id]', params: { id: row.id } })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, { backgroundColor: theme.bg.surface, borderColor: theme.line }, pressed && { opacity: 0.85 }]}>
          <View style={styles.rowTop}>
            <T face="title" style={{ color: theme.text.primary, fontSize: 15, textTransform: 'uppercase' }}>
              {kindLabel(row.kind)}
            </T>
            <StatusPill status={STATUS_TONE[row.status] ?? 'neutral'} label={statusLabel(row.status)} />
          </View>
          <T face="body" numberOfLines={2} style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20, marginTop: 4 }}>
            {row.message}
          </T>
          <T face="mono" numberOfLines={1} style={{ color: theme.text.muted, fontSize: 12, marginTop: 6 }}>
            {[shortDate(row.created_at), row.app_version ? `v${row.app_version}` : null, row.platform, row.device, row.screenshot_path ? t.feedback.admin.screenshot.toLowerCase() : null]
              .filter(Boolean)
              .join(' · ')}
          </T>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.gutter },
  pad: { padding: space.gutter, paddingBottom: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginVertical: space.md },
  row: { borderWidth: 1, borderRadius: radius.card, padding: space.md, marginBottom: space.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
});
