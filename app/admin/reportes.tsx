import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AdminPanelSkeleton } from '@/components/skeletons/AdminSkeleton';
import { T } from '@/components/T';
import { Chip, EmptyState, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { useAdminGate } from '@/lib/cloud/admin';
import { dateLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { adminReports, setReportStatus, type AdminReport } from '@/lib/social/api';
import { useTheme } from '@/lib/theme/useTheme';

const STATUSES: AdminReport['status'][] = ['new', 'seen', 'done'];

/** Admin → Reportes (IMP 01102026 Phase 5): what people reported, newest "nuevo" first; a tap sets the status. */
export default function ReportesScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const gate = useAdminGate();
  const [rows, setRows] = useState<AdminReport[] | null>(null);
  const load = useCallback(() => void adminReports().then((r) => setRows(r.ok ? r.data : [])), []);
  useFocusEffect(
    useCallback(() => {
      if (gate === 'admin') load();
    }, [gate, load]),
  );

  const header = <Stack.Screen options={{ headerShown: true, title: t.social.reportsLink }} />;
  if (gate !== 'admin' || rows === null) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg.base }}>
        {header}
        {gate === 'admin' || gate === 'loading' ? <AdminPanelSkeleton /> : <EmptyState icon="lock-closed-outline" message={t.admin.notAdmin} />}
      </View>
    );
  }
  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      {header}
      {rows.length === 0 ? <EmptyState icon="flag-outline" message={t.social.reportsEmpty} /> : null}
      {rows.map((r) => (
        <Surface key={r.id} padded style={{ marginBottom: space.sm, gap: 4 }}>
          <Pressable
            disabled={r.target_type !== 'profile'}
            onPress={() => router.push({ pathname: '/u/[handle]', params: { handle: r.target_id } })}
            accessibilityRole={r.target_type === 'profile' ? 'link' : undefined}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
              {r.target_type === 'profile' ? `@${r.target_id}` : `${r.target_type} · ${r.target_id}`}
            </T>
          </Pressable>
          {r.reason ? (
            <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20 }}>
              {r.reason}
            </T>
          ) : null}
          <T face="mono" style={{ color: theme.text.muted, fontSize: 12 }}>
            {[dateLabel(r.created_at), r.reporter ? t.social.reportBy(r.reporter) : null].filter(Boolean).join(' · ')}
          </T>
          <View style={styles.chips}>
            {STATUSES.map((st) => (
              <Chip key={st} label={t.social.reportStatus[st]} selected={r.status === st} onPress={() => void setReportStatus(r.id, st).then(load)} />
            ))}
          </View>
        </Surface>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  chips: { flexDirection: 'row', gap: space.xs, marginTop: 4 },
});
