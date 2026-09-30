import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Field } from '@/components/Field';
import { AdminUsersSkeleton } from '@/components/skeletons/AdminSkeleton';
import { T } from '@/components/T';
import { Badge, EmptyState, Segmented, Sheet } from '@/components/ui';
import { space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchAdminUsers, refreshRole, ROLES, setUserRole, useAdminGate, type AdminUser, type Role } from '@/lib/cloud/admin';
import { useSession } from '@/lib/cloud/auth';
import { dateLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

const ROLE_TONE: Record<Role, 'red' | 'amber' | 'outline'> = { admin: 'red', premium: 'amber', member: 'outline' };

/**
 * Admin → Usuarios (2.3): every Car Guy account with its role and how much it
 * uses the app (counts only — never a garage's contents), newest first. Tap a
 * row to change its role (carguy.admin_set_role, sql/024 — the server refuses
 * non-admins and an admin demoting themselves).
 */
export default function AdminUsers() {
  const { theme } = useTheme();
  const gate = useAdminGate();
  const { session } = useSession();
  const [users, setUsers] = useState<AdminUser[] | null | 'error'>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setUsers(await fetchAdminUsers());
    } catch {
      setUsers('error');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (gate === 'admin') void load();
    }, [gate, load]),
  );

  const header = <Stack.Screen options={{ headerShown: true, title: t.admin.usersTitle }} />;
  // The gate and the first list read; a pull-to-refresh or a role change keeps the old list up.
  const loading = gate === 'loading' || (gate === 'admin' && users === null);
  const showSkeleton = useDelayedLoading(loading);

  if (showSkeleton || loading) {
    // Remote data, so the skeleton is really seen; a fast answer shows nothing but the header.
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

  const list = users === 'error' || users == null ? [] : users;
  const q = query.trim().toLowerCase();
  const shown = q ? list.filter((u) => u.email.toLowerCase().includes(q)) : list;

  const change = async (u: AdminUser, role: Role) => {
    if (role === u.role) return;
    const r = await setUserRole(u.user_id, role);
    if (r.ok) {
      setNotice(t.admin.roleSaved);
      setEditing({ ...u, role });
      if (u.user_id === session?.user.id) refreshRole();
      await load();
    } else setNotice(r.reason === 'self_demote' ? t.admin.selfDemote : t.admin.roleFailed);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.base }}>
      {header}
      <ScrollView
        contentContainerStyle={styles.pad}
        keyboardShouldPersistTaps="handled"
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
        <T face="eyebrow" style={{ color: theme.accent, fontSize: 11, marginBottom: space.sm }}>
          {t.admin.usersCount(list.length)}
        </T>
        <Field label={t.admin.search} value={query} onChangeText={setQuery} autoCapitalize="none" keyboardType="email-address" />
        {users === 'error' ? (
          <T face="body" style={{ color: theme.statusText.vencido, fontSize: 14 }}>
            {t.admin.loadFailed}
          </T>
        ) : null}
        {shown.map((u) => {
          const me = u.user_id === session?.user.id;
          return (
            <Pressable
              key={u.user_id}
              onPress={() => {
                setNotice(null);
                setEditing(u);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${u.email}, ${t.admin.roles[u.role]}`}
              style={[styles.row, { backgroundColor: theme.bg.surface, borderColor: me ? theme.accent : theme.lineStrong }]}>
              <View style={styles.rowTop}>
                <T face="semibold" style={{ color: theme.text.primary, fontSize: 14, flex: 1 }} numberOfLines={1}>
                  {u.email}
                </T>
                {me ? <Badge label={t.admin.you} tone="outline" /> : null}
                <Badge label={t.admin.roles[u.role]} tone={ROLE_TONE[u.role]} />
              </View>
              <T face="mono" style={{ color: theme.text.secondary, fontSize: 12 }}>
                {t.admin.counts(u.vehicles, u.fuel_logs, u.trips)}
              </T>
              <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
                {[t.admin.joined(dateLabel(u.created_at)), u.last_sign_in_at ? t.admin.lastSeen(dateLabel(u.last_sign_in_at)) : t.admin.neverSeen].join(' · ')}
              </T>
            </Pressable>
          );
        })}
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.md }}>
          {t.admin.premiumNote}
        </T>
      </ScrollView>

      <Sheet visible={editing != null} onClose={() => setEditing(null)} title={editing ? t.admin.changeRole(editing.email) : ''}>
        {editing ? (
          <View style={{ gap: space.md }}>
            <Segmented<Role>
              options={ROLES.map((key) => ({ key, label: t.admin.roles[key] }))}
              value={editing.role}
              onChange={(r) => void change(editing, r)}
            />
            {notice ? (
              <T face="semibold" style={{ color: notice === t.admin.roleSaved ? theme.statusText.ok : theme.statusText.vencido, fontSize: 13 }}>
                {notice}
              </T>
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.gutter },
  row: { borderWidth: 1, borderRadius: 12, padding: space.md, gap: 4, marginBottom: space.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
