import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { EmptyState, NavRow, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { fetchAdminStats, useAdminGate, type AdminStats } from '@/lib/cloud/admin';
import { dateLabel, km } from '@/lib/format';
import { es } from '@/lib/i18n/es';
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

  const header = <Stack.Screen options={{ headerShown: true, title: es.admin.title }} />;

  if (gate === 'loading' || (gate === 'admin' && stats === null)) {
    return (
      <View style={[styles.centre, { backgroundColor: theme.bg.base }]}>
        {header}
        <ActivityIndicator color={theme.text.muted} />
      </View>
    );
  }
  if (gate !== 'admin') {
    return (
      <View style={[styles.centre, { backgroundColor: theme.bg.base }]}>
        {header}
        <EmptyState icon="lock-closed-outline" message={gate === 'offline' ? es.admin.offline : es.admin.notAdmin} />
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
        {es.admin.eyebrow}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase', marginBottom: space.md }}>
        {es.admin.title}
      </T>

      {stats === 'error' ? (
        <Surface padded style={{ marginBottom: space.lg }}>
          <T face="body" style={{ color: theme.statusText.vencido, fontSize: 14 }}>
            {es.admin.loadFailed}
          </T>
        </Surface>
      ) : stats ? (
        <>
          {section(es.admin.sections.users, [
            tile(stats.users, es.admin.tiles.users, true),
            tile(stats.users_new_7d, es.admin.tiles.newWeek),
            tile(stats.users_new_30d, es.admin.tiles.newMonth),
            tile(stats.users_active_7d, es.admin.tiles.active),
          ])}
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: -space.sm, marginBottom: space.lg }}>
            {es.admin.rolesLine(stats.roles.admin ?? 0, stats.roles.member ?? 0, stats.roles.premium ?? 0)}
          </T>
          {section(es.admin.sections.activity, [
            tile(stats.vehicles, es.admin.tiles.vehicles),
            tile(stats.fuel_logs, es.admin.tiles.fuelLogs),
            tile(stats.fuel_logs_30d, es.admin.tiles.fuelLogs30),
            tile(stats.trips, es.admin.tiles.trips),
            tile(km(stats.trip_km), es.admin.tiles.tripKm),
          ])}
          {section(es.admin.sections.community, [
            tile(stats.shares_published, es.admin.tiles.shares),
            tile(stats.feedback_new, es.admin.tiles.feedbackNew, stats.feedback_new > 0),
            tile(stats.feedback_total, es.admin.tiles.feedbackTotal),
          ])}
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.md }}>
            {es.admin.updated(dateLabel(stats.at))}
          </T>
        </>
      ) : null}

      <NavRow label={es.admin.usersLink} caption={es.admin.usersCaption} onPress={() => router.push('/admin/usuarios')} />
      <NavRow label={es.admin.feedbackLink} caption={es.feedback.admin.moreCaption} onPress={() => router.push('/admin/comentarios')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.gutter },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 12, padding: space.md },
});
