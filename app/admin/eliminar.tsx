import * as Clipboard from 'expo-clipboard';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AdminUsersSkeleton } from '@/components/skeletons/AdminSkeleton';
import { T } from '@/components/T';
import { EmptyState, GhostButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchPendingDeletions, supabaseUsersUrl, type PendingDeletion } from '@/lib/account/adminDeletions';
import { deletionConfigured } from '@/lib/account/deleteAccountClient';
import { useAdminGate } from '@/lib/cloud/admin';
import { dateLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Admin → Cuentas por eliminar (sql/028): profiles that asked to be deleted while their login is
 * still there — /api/eliminar-cuenta has no SUPABASE_SERVICE_ROLE_KEY, or the person was offline
 * after the data went. Their Car Guy rows are already gone; the admin removes the login (and any
 * files left in Storage) in Supabase.
 */
export default function AdminDeletions() {
  const { theme } = useTheme();
  const gate = useAdminGate();
  const [list, setList] = useState<PendingDeletion[] | null | 'error'>(null);
  const [configured, setConfigured] = useState<boolean | null | undefined>(undefined);
  const [copied, setCopied] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const usersUrl = supabaseUsersUrl();

  const load = useCallback(async () => {
    const [rows, config] = await Promise.all([fetchPendingDeletions().catch(() => 'error' as const), deletionConfigured()]);
    setList(rows);
    setConfigured(config);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (gate === 'admin') void load();
    }, [gate, load]),
  );

  const header = <Stack.Screen options={{ headerShown: true, title: t.deleteAccount.admin.title }} />;
  const loading = gate === 'loading' || (gate === 'admin' && list === null);
  const showSkeleton = useDelayedLoading(loading);

  if (showSkeleton || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg.base }}>
        {header}
        {showSkeleton ? <AdminUsersSkeleton /> : null}
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

  const rows = list === 'error' || list == null ? [] : list;
  const configLine =
    configured === true ? t.deleteAccount.admin.configured : configured === false ? t.deleteAccount.admin.notConfigured : t.deleteAccount.admin.unknownConfig;

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
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20 }}>
        {t.deleteAccount.admin.intro}
      </T>
      <Surface style={{ marginVertical: space.md }}>
        <T face="body" style={{ color: configured === false ? theme.statusText.proximo : theme.text.secondary, fontSize: 13, lineHeight: 19 }}>
          {configLine}
        </T>
      </Surface>
      {list === 'error' ? (
        <T face="body" style={{ color: theme.statusText.vencido, fontSize: 14 }}>
          {t.deleteAccount.admin.loadFailed}
        </T>
      ) : rows.length === 0 ? (
        <EmptyState icon="checkmark-circle-outline" message={t.deleteAccount.admin.empty} />
      ) : (
        rows.map((p) => (
          <View key={p.user_id} style={[styles.row, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }} numberOfLines={1}>
              {p.email}
            </T>
            <T face="body" style={{ color: theme.text.secondary, fontSize: 12 }}>
              {[t.deleteAccount.admin.requested(dateLabel(p.requested_at)), t.deleteAccount.admin.objects(p.objects)].join(' · ')}
            </T>
            <T face="mono" selectable style={{ color: theme.text.muted, fontSize: 11 }}>
              {p.user_id}
            </T>
            <View style={styles.actions}>
              <GhostButton
                style={{ flex: 1 }}
                label={copied === p.user_id ? t.deleteAccount.admin.copied : t.deleteAccount.admin.copyId}
                onPress={() => void Clipboard.setStringAsync(p.user_id).then(() => setCopied(p.user_id))}
              />
              {/* The manual step when the function cannot remove the login itself. */}
              {configured !== true && usersUrl ? (
                <GhostButton style={{ flex: 1 }} danger label={t.deleteAccount.admin.openSupabase} onPress={() => void Linking.openURL(usersUrl)} />
              ) : null}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.gutter },
  row: { borderWidth: 1, borderRadius: 12, padding: space.md, gap: 4, marginBottom: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
});
