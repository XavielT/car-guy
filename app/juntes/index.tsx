import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { useSession } from '@/lib/cloud/auth';
import { dateTimeLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { joinJunte, type JunteSummary } from '@/lib/junte/api';
import { cachedJuntes, refreshJuntes, sectionOf } from '@/lib/junte/store';
import { useTheme } from '@/lib/theme/useTheme';

/** Más → Juntes (IMP 01102026 Phase 6, note 13): live now, upcoming, past; join with a code; create one. */
export default function JuntesScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const [list, setList] = useState<JunteSummary[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      setNow(Date.now());
      void cachedJuntes().then((c) => setList((cur) => cur ?? c));
      void refreshJuntes().then((r) => {
        setList(r.list);
        setOffline(r.offline);
      });
    }, [session]),
  );

  const header = <Stack.Screen options={{ headerShown: true, title: t.juntes.title }} />;
  if (!session) {
    return (
      <View style={[styles.pad, { flex: 1, backgroundColor: theme.bg.base }]}>
        {header}
        <T face="body" style={{ color: theme.text.secondary, fontSize: 14 }}>
          {t.juntes.signedOut}
        </T>
      </View>
    );
  }

  const join = async () => {
    setError(null);
    const r = await joinJunte(code);
    if (r.ok) router.push({ pathname: '/juntes/[id]', params: { id: r.data } });
    else setError(t.juntes.joinFailed[r.reason as keyof typeof t.juntes.joinFailed] ?? t.juntes.joinFailed.error);
  };
  const sections = (['live', 'upcoming', 'past'] as const).map((k) => [k, (list ?? []).filter((j) => sectionOf(j, now) === k)] as const);

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      {header}
      <PrimaryButton label={t.juntes.create} onPress={() => router.push('/juntes/nuevo')} />
      <View style={styles.joinRow}>
        <View style={{ flex: 1 }}>
          <Field label={t.juntes.joinCode} placeholder={t.juntes.codePlaceholder} value={code} onChangeText={(v) => setCode(v.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8))} autoCapitalize="none" autoCorrect={false} />
        </View>
        <GhostButton label={t.juntes.join} disabled={code.length !== 8} onPress={() => void join()} />
      </View>
      {error ? (
        <T face="body" style={{ color: theme.dangerText, fontSize: 13, marginBottom: space.sm }}>
          {error}
        </T>
      ) : null}
      {offline ? (
        <T face="body" style={{ color: theme.statusText.proximo, fontSize: 12, marginBottom: space.sm }}>
          {t.social.offline}
        </T>
      ) : null}
      {list && list.length === 0 ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 14, marginTop: space.md }}>
          {t.juntes.empty}
        </T>
      ) : null}
      {sections.map(([k, items]) =>
        items.length ? (
          <View key={k} style={{ marginTop: space.md }}>
            <T face="eyebrow" style={{ color: k === 'live' ? theme.dangerText : theme.text.muted, fontSize: 11, marginBottom: space.sm }}>
              {t.juntes.sections[k]}
            </T>
            {items.map((j) => (
              <Pressable key={j.id} onPress={() => router.push({ pathname: '/juntes/[id]', params: { id: j.id } })} accessibilityRole="button">
                <Surface padded style={{ marginBottom: space.sm, borderColor: k === 'live' ? theme.danger : 'transparent', borderWidth: k === 'live' ? 1 : 0 }}>
                  <T face="title" style={{ color: theme.text.primary, fontSize: 17, textTransform: 'uppercase' }}>
                    {j.title}
                  </T>
                  <T face="mono" style={{ color: theme.text.secondary, fontSize: 12 }}>
                    {[dateTimeLabel(j.starts_at), t.juntes.members(j.members), j.is_owner ? t.juntes.owner : null].filter(Boolean).join(' · ')}
                  </T>
                </Surface>
              </Pressable>
            ))}
          </View>
        ) : null,
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48, width: '100%', maxWidth: 640, alignSelf: 'center' },
  joinRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.md },
});
