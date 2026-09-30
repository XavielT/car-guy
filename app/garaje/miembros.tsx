import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Badge, Chip, GhostButton, PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { useSession } from '@/lib/cloud/auth';
import { vehicles as vehicleRepo } from '@/lib/db/repos';
import type { Vehicle, VehicleMember } from '@/lib/db/types';
import { t } from '@/lib/i18n';
import { createInvite, inviteLink, listMembers, removeMember, setMemberRole } from '@/lib/share/members';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Miembros (03-screens.md Block F): who shares this car and as what. The owner
 * invites (a code + link valid 7 days, optionally locked to an email), changes
 * roles and removes; anyone else can leave.
 */
export default function MembersScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { session } = useSession();
  const { refresh } = useStore();
  const me = session?.user.id ?? null;
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [members, setMembers] = useState<VehicleMember[]>([]);
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    void Promise.all([vehicleRepo.getById(vehicleId), listMembers(vehicleId)]).then(([v, m]) => {
      if (cancelled) return;
      setVehicle(v);
      setMembers(m);
    });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);
  useFocusEffect(load);

  if (!vehicle) return null;
  const myRole = vehicle.garageRole ?? (members.find((m) => m.userId === me)?.role ?? 'owner');
  const owner = myRole === 'owner';

  async function invite() {
    setBusy(true);
    setNotice(null);
    const r = await createInvite(vehicleId, role, email.trim() || null);
    setBusy(false);
    if (!r.ok) return setNotice(r.reason === 'signed-out' ? t.members.needAccount : r.reason === 'not-owner' ? t.members.notOwner : t.members.offline);
    setCode(r.code);
  }

  async function sendInvite() {
    if (!code) return;
    const message = t.members.inviteMessage(vehicle!.name, inviteLink(code), code);
    try {
      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(message);
        setNotice(t.members.copied);
      } else await Share.share({ message });
    } catch {
      // Dismissed.
    }
  }

  function remove(m: VehicleMember) {
    const self = m.userId === me;
    Alert.alert(self ? t.members.leave : t.members.remove, self ? t.members.leaveBody(vehicle!.name) : t.members.removeBody(m.displayName ?? '—'), [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: self ? t.members.leave : t.members.remove,
        style: 'destructive',
        onPress: () =>
          void (async () => {
            setBusy(true);
            const ok = await removeMember(vehicleId, m.userId);
            setBusy(false);
            if (!ok) return setNotice(t.members.offline);
            await refresh();
            if (self) router.back();
            else load();
          })(),
      },
    ]);
  }

  async function changeRole(m: VehicleMember, next: 'editor' | 'viewer') {
    setBusy(true);
    const ok = await setMemberRole(vehicleId, m.userId, next);
    setBusy(false);
    if (!ok) return setNotice(t.members.offline);
    load();
  }

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {t.members.eyebrow(vehicle.name.toUpperCase())}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 30, textTransform: 'uppercase', marginBottom: space.sm }}>
        {t.members.title}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginBottom: space.md }}>
        {t.members.intro}
      </T>

      {!members.length ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
          {me ? t.members.syncFirst : t.members.needAccount}
        </T>
      ) : null}
      {members.map((m) => (
        <View key={m.id} style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
          <View style={styles.top}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }} numberOfLines={1}>
              {m.displayName ?? '—'}
              {m.userId === me ? ` ${t.members.you}` : ''}
            </T>
            <Badge label={t.members.roles[m.role]} tone={m.role === 'owner' ? 'amber' : m.role === 'editor' ? 'green' : 'outline'} />
          </View>
          {owner && m.role !== 'owner' ? (
            <View style={styles.chips}>
              <Chip label={t.members.roles.editor} selected={m.role === 'editor'} onPress={() => void changeRole(m, 'editor')} />
              <Chip label={t.members.roles.viewer} selected={m.role === 'viewer'} onPress={() => void changeRole(m, 'viewer')} />
              <GhostButton danger label={t.members.remove} disabled={busy} onPress={() => remove(m)} />
            </View>
          ) : null}
          {!owner && m.userId === me ? <GhostButton danger label={t.members.leave} disabled={busy} onPress={() => remove(m)} /> : null}
        </View>
      ))}

      {owner ? (
        <View style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.accent, marginTop: space.md }]}>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
            {t.members.invite}
          </T>
          <View style={styles.chips}>
            <Chip label={t.members.roles.editor} selected={role === 'editor'} onPress={() => setRole('editor')} />
            <Chip label={t.members.roles.viewer} selected={role === 'viewer'} onPress={() => setRole('viewer')} />
          </View>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.sm }}>
            {t.members.roleHints[role]}
          </T>
          <Field label={t.members.email} placeholder={t.members.emailPlaceholder} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          {code ? (
            <>
              <T face="monoBold" selectable style={{ color: theme.accent, fontSize: 26, letterSpacing: 4, textAlign: 'center', marginVertical: space.sm }}>
                {code.toUpperCase()}
              </T>
              <T face="mono" selectable style={{ color: theme.text.secondary, fontSize: 12, textAlign: 'center' }}>
                {inviteLink(code).replace('https://', '')}
              </T>
              <T face="body" style={{ color: theme.text.muted, fontSize: 12, textAlign: 'center', marginBottom: space.sm }}>
                {t.members.expires}
              </T>
              <PrimaryButton label={t.members.send} onPress={() => void sendInvite()} />
            </>
          ) : (
            <PrimaryButton label={t.members.createInvite} disabled={busy} onPress={() => void invite()} />
          )}
        </View>
      ) : null}
      {notice ? (
        <T face="body" style={{ color: theme.accent, fontSize: 13, marginTop: space.sm }}>
          {notice}
        </T>
      ) : null}
      <GhostButton label={t.members.haveCode} onPress={() => router.push({ pathname: '/invitacion/[code]', params: { code: '-' } })} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  card: { borderWidth: 1, borderRadius: radius.button, padding: space.md, gap: space.sm, marginBottom: space.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
});
