import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ListCardsSkeleton } from '@/components/skeletons/ListCardsSkeleton';
import { T } from '@/components/T';
import { EmptyState, GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { useSession } from '@/lib/cloud/auth';
import { dateTimeLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { joinJunte, junteInviteCard, type JunteInviteCard } from '@/lib/junte/api';
import { useTheme } from '@/lib/theme/useTheme';

/** carguy://junte/<code> and the web /j/<code> "abrir en la app" (IMP 01102026 Phase 6): the invite card, then Unirme. */
export default function JunteInviteScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = (raw ?? '').toLowerCase();
  const [card, setCard] = useState<JunteInviteCard | null | 'missing'>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void junteInviteCard(code).then((r) => setCard(r.ok && r.data ? r.data : 'missing'));
  }, [code]);

  const header = <Stack.Screen options={{ headerShown: true, title: t.juntes.title }} />;
  if (card === null) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg.base }}>
        {header}
        <ListCardsSkeleton n={1} lines={3} style={{ padding: space.gutter }} />
      </View>
    );
  }
  if (card === 'missing') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg.base, justifyContent: 'center' }}>
        {header}
        <EmptyState icon="people-outline" message={t.juntes.joinFailed.not_found} />
      </View>
    );
  }

  const join = async () => {
    setError(null);
    const r = await joinJunte(code);
    if (r.ok) router.replace({ pathname: '/juntes/[id]', params: { id: r.data } });
    else setError(t.juntes.joinFailed[r.reason as keyof typeof t.juntes.joinFailed] ?? t.juntes.joinFailed.error);
  };

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      {header}
      <Surface padded style={{ gap: 4, marginBottom: space.md }}>
        <T face="display" style={{ color: theme.text.primary, fontSize: 24, textTransform: 'uppercase' }}>
          {card.title}
        </T>
        <T face="mono" style={{ color: theme.text.secondary, fontSize: 13 }}>
          {card.status === 'ended' ? t.juntes.ended : t.juntes.starts(dateTimeLabel(card.starts_at))}
          {card.meet_label ? ` · ${card.meet_label}` : ''}
        </T>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 14 }}>
          {[card.owner_handle ? `@${card.owner_handle}` : null, t.juntes.members(card.going)].filter(Boolean).join(' · ')}
        </T>
      </Surface>
      {error ? (
        <T face="body" style={{ color: theme.dangerText, fontSize: 13, marginBottom: space.sm }}>
          {error}
        </T>
      ) : null}
      {card.status === 'ended' ? null : session ? (
        <PrimaryButton label={t.juntes.join} onPress={() => void join()} />
      ) : (
        <>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginBottom: space.sm }}>
            {t.juntes.signedOut}
          </T>
          <GhostButton label={t.account.signIn} onPress={() => router.push('/cuenta')} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48, width: '100%', maxWidth: 640, alignSelf: 'center' },
});
