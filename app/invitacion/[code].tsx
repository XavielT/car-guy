import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton } from '@/components/ui';
import { space } from '@/constants/theme';
import { useSession } from '@/lib/cloud/auth';
import { t } from '@/lib/i18n';
import { redeemInvite } from '@/lib/share/members';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * carguy://invitacion/<code> and https://car-guy.vercel.app/invitacion/<code>:
 * accept a shared car. Needs an account (the car comes from the cloud); a
 * signed-out visitor is sent to Cuenta and comes back here.
 */
export default function InviteScreen() {
  const { code: param } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { session, ready } = useSession();
  const { refresh, setActiveVehicle } = useStore();
  const [code, setCode] = useState(param && param !== '-' ? param : '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setNotice(t.members.accepting);
    const r = await redeemInvite(code);
    setBusy(false);
    if (!r.ok) return setNotice(t.members.redeemErrors[r.reason]);
    await refresh();
    setActiveVehicle(r.vehicleId);
    router.replace({ pathname: '/vehiculo/[id]', params: { id: r.vehicleId } });
  }

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {t.members.inviteEyebrow}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 30, textTransform: 'uppercase', marginBottom: space.sm }}>
        {t.members.acceptTitle}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginBottom: space.md }}>
        {t.members.acceptIntro}
      </T>
      <Field label={t.members.code} value={code.toUpperCase()} onChangeText={(t) => setCode(t.toLowerCase().replace(/[^a-z0-9]/g, ''))} autoCapitalize="characters" maxLength={8} />
      {ready && !session ? (
        <>
          <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginBottom: space.sm }}>
            {t.members.needAccount}
          </T>
          <PrimaryButton label={t.members.signIn} onPress={() => router.push('/cuenta')} />
        </>
      ) : (
        <PrimaryButton label={t.members.accept} disabled={busy || code.length !== 8} onPress={() => void accept()} />
      )}
      {notice ? (
        <T face="body" style={{ color: theme.accent, fontSize: 13, marginTop: space.sm }}>
          {notice}
        </T>
      ) : null}
      <GhostButton label={t.common.cancel} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
});
