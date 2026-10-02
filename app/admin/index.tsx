import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AdminPanelSkeleton } from '@/components/skeletons/AdminSkeleton';
import { T } from '@/components/T';
import { EmptyState, NavRow, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchAdminStats, useAdminGate, type AdminStats } from '@/lib/cloud/admin';
import { dateLabel, km } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Panel de administración (2.3): the system at a glance for the admin role —
 * users, activity, community — then Usuarios (roles) and Comentarios recibidos.
 * Every number comes from carguy.admin_stats() (sql/024), which refuses anyone
 * who is not admin; this screen only decides what to show.
 */
export default function AdminPanel() {
  const router = useRouter();
  const { theme } = useTheme();
  const gate = useAdminGate();
  const [stats, setStats] = useState<AdminStats | null | 'error'>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setStats(await fetchAdminStats());
    } catch {
      setStats('error');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (gate === 'admin') void load();
    }, [gate, load]),
  );

  const header = <Stack.Screen options={{ headerShown: true, title: t.admin.title }} />;
  // The gate and the first stats read; a pull-to-refresh or refocus keeps the old numbers up.
  const loading = gate === 'loading' || (gate === 'admin' && stats === null);
  const showSkeleton = useDelayedLoading(loading);

  if (showSkeleton || loading) {
    // Remote data, so the skeleton is really seen; a fast answer shows nothing but the header.
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg.base }}>
        {header}
        {showSkeleton ? <AdminPanelSkeleton /> : null}
      </View>
    );
  }
  if (gate !== 'admin') {
    return (
      <View style={[styles.centre, { backgroundColor: theme.bg.base }]}>
        {header}
        <EmptyState icon="lock-closed-outline" message={gate === 'offline' ? t.admin.offline : t.admin.notAdmin} />
      </View>
    );
  }

  const tile = (value: string | number, label: string, accent = false) => (
    <View key={label} style={[styles.tile, { backgroundColor: theme.bg.raised, borderColor: theme.line }]}>
      <T face="monoBold" style={{ color: accent ? theme.accent : theme.text.primary, fontSize: 22 }} numberOfLines={1} adjustsFontSizeToFit>
        {String(value)}
      </T>
      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10, marginTop: 2 }} numberOfLines={2}>
        {label.toUpperCase()}
      </T>
    </View>
  );
  const section = (title: string, tiles: React.ReactNode[]) => (
    <View style={{ marginBottom: space.lg }}>
      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.sm }}>
        {title.toUpperCase()}
      </T>
      <View style={styles.grid}>{tiles}</View>
    </View>
  );

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
        {t.admin.eyebrow}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase', marginBottom: space.md }}>
        {t.admin.title}
      </T>

      {stats === 'error' ? (
        <Surface padded style={{ marginBottom: space.lg }}>
          <T face="body" style={{ color: theme.statusText.vencido, fontSize: 14 }}>
            {t.admin.loadFailed}
          </T>
        </Surface>
      ) : stats ? (
        <>
          {section(t.admin.sections.users, [
            tile(stats.users, t.admin.tiles.users, true),
            tile(stats.users_new_7d, t.admin.tiles.newWeek),
            tile(stats.users_new_30d, t.admin.tiles.newMonth),
            tile(stats.users_active_7d, t.admin.tiles.active),
          ])}
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: -space.sm, marginBottom: space.lg }}>
            {t.admin.rolesLine(stats.roles.admin ?? 0, stats.roles.member ?? 0, stats.roles.premium ?? 0)}
          </T>
          {section(t.admin.sections.activity, [
            tile(stats.vehicles, t.admin.tiles.vehicles),
            tile(stats.fuel_logs, t.admin.tiles.fuelLogs),
            tile(stats.fuel_logs_30d, t.admin.tiles.fuelLogs30),
            tile(stats.trips, t.admin.tiles.trips),
            tile(km(stats.trip_km), t.admin.tiles.tripKm),
          ])}
          {section(t.admin.sections.community, [
            tile(stats.shares_published, t.admin.tiles.shares),
            tile(stats.feedback_new, t.admin.tiles.feedbackNew, stats.feedback_new > 0),
            tile(stats.feedback_total, t.admin.tiles.feedbackTotal),
          ])}
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.md }}>
            {t.admin.updated(dateLabel(stats.at))}
          </T>
        </>
      ) : null}

      <NavRow label={t.social.reportsLink} caption={t.social.reportsCaption} onPress={() => router.push('/admin/reportes')} />
      <NavRow label={t.usage.link} caption={t.usage.linkCaption} onPress={() => router.push('/admin/uso')} />
      <NavRow label={t.admin.usersLink} caption={t.admin.usersCaption} onPress={() => router.push('/admin/usuarios')} />
      <NavRow label={t.admin.feedbackLink} caption={t.feedback.admin.moreCaption} onPress={() => router.push('/admin/comentarios')} />
      <NavRow label={t.deleteAccount.admin.link} caption={t.deleteAccount.admin.linkCaption} onPress={() => router.push('/admin/eliminar')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.gutter },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 12, padding: space.md },
});
