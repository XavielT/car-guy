import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { RouteThumb } from '@/components/social/RouteThumb';
import { ListCardsSkeleton } from '@/components/skeletons/ListCardsSkeleton';
import { T } from '@/components/T';
import { EmptyState, GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { useSession } from '@/lib/cloud/auth';
import { dateLabel, km as fmtKm } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getPublicProfile, listTripShares, reportTarget, type PublicProfile, type SharedTrip } from '@/lib/social/api';
import { socialActions } from '@/lib/social/store';
import { followButton } from '@/lib/social/visibility';
import { useTheme } from '@/lib/theme/useTheme';

const SITE = 'https://car-guy.vercel.app';

/**
 * Perfil público (IMP 01102026 Phase 5, notes 11, 12, 14): built only from get_public_profile and
 * list_trip_shares — never a profiles select, never a user id. Follow / Solicitar / Siguiendo / Amigos with
 * counts; the blocks the owner switched on; "…" → Reportar · Bloquear. Deep link carguy://u/<handle>.
 */
export default function PublicProfileScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const { handle: raw } = useLocalSearchParams<{ handle: string }>();
  const handle = (raw ?? '').replace(/^@/, '').toLowerCase();
  const [profile, setProfile] = useState<PublicProfile | null | 'missing'>(null);
  const [shares, setShares] = useState<SharedTrip[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([getPublicProfile(handle), listTripShares(handle)]);
    setProfile(p.ok && p.data ? p.data : 'missing');
    setShares(s.ok ? s.data : []);
  }, [handle]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const header = <Stack.Screen options={{ headerShown: true, title: `@${handle}` }} />;
  if (profile === null) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg.base }}>
        {header}
        <ListCardsSkeleton n={3} lines={2} style={{ padding: space.gutter }} />
      </View>
    );
  }
  if (profile === 'missing') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg.base, justifyContent: 'center' }}>
        {header}
        <EmptyState icon="person-outline" message={t.social.notFound(handle)} />
      </View>
    );
  }

  const p = profile;
  const button = followButton(p);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    await fn();
    await load();
    setBusy(false);
  };
  const onFollow = () => {
    if (button === 'me') return router.push('/perfil');
    if (!session) return setNote(t.social.signedOut);
    if (button === 'follow' || button === 'request' || button === 'follow_back') {
      return void run(() => socialActions.follow({ handle: p.handle, display_name: p.display_name, avatar_id: p.avatar_id }));
    }
    Alert.alert(t.social.unfollowTitle(p.handle), undefined, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.social.unfollow, style: 'destructive', onPress: () => void run(() => socialActions.unfollow(p.handle)) },
    ]);
  };
  const menu = () =>
    Alert.alert(`@${p.handle}`, undefined, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.social.report,
        onPress: () =>
          Alert.alert(t.social.reportTitle(p.handle), t.social.reportBody, [
            { text: t.common.cancel, style: 'cancel' },
            { text: t.social.report, onPress: () => void reportTarget('profile', p.handle).then((r) => r.ok && setNote(t.social.reported)) },
          ]),
      },
      {
        text: t.social.block,
        style: 'destructive',
        onPress: () =>
          Alert.alert(t.social.blockTitle(p.handle), t.social.blockBody, [
            { text: t.common.cancel, style: 'cancel' },
            { text: t.social.block, style: 'destructive', onPress: () => void socialActions.block(p.handle).then(() => router.back()) },
          ]),
      },
    ]);

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      {header}
      <View style={styles.head}>
        <Avatar size={84} photoUri={p.photo} avatarId={p.avatar_id} name={p.display_name ?? p.handle} />
        <View style={{ flex: 1 }}>
          <T face="display" style={{ color: theme.text.primary, fontSize: 24, textTransform: 'uppercase' }} numberOfLines={2}>
            {p.display_name ?? p.handle}
          </T>
          <T face="mono" style={{ color: theme.accent, fontSize: 14 }}>
            @{p.handle}
          </T>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 2 }}>
            {t.social.counts(p.followers, p.following)}
          </T>
          {p.premium ? (
            <T face="eyebrow" style={{ color: theme.accent, fontSize: 10, marginTop: 4 }}>
              {t.social.premium}
            </T>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          {button === 'following' || button === 'friends' || button === 'requested' || button === 'me' ? (
            <GhostButton label={t.social.follow[button]} disabled={busy} onPress={onFollow} />
          ) : (
            <PrimaryButton label={t.social.follow[button]} disabled={busy} onPress={onFollow} />
          )}
        </View>
        {!p.is_me && session ? (
          <Pressable onPress={menu} accessibilityRole="button" accessibilityLabel={t.social.menu} hitSlop={8} style={[styles.more, { borderColor: theme.lineStrong }]}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 18 }}>
              …
            </T>
          </Pressable>
        ) : null}
      </View>
      {note ? (
        <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.accent, fontSize: 13, marginBottom: space.sm }}>
          {note}
        </T>
      ) : null}

      {!p.can_see ? (
        <Surface padded>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20 }}>
            {t.social.privateCard}
          </T>
        </Surface>
      ) : (
        <>
          {p.bio ? (
            <T face="body" style={{ color: theme.text.primary, fontSize: 15, lineHeight: 22, marginBottom: space.sm }}>
              {p.bio}
            </T>
          ) : null}
          {p.instagram ? (
            <Pressable onPress={() => void Linking.openURL(`https://instagram.com/${p.instagram}`)} accessibilityRole="link">
              <T face="semibold" style={{ color: theme.accent, fontSize: 14, marginBottom: space.md }}>
                IG @{p.instagram}
              </T>
            </Pressable>
          ) : null}

          {p.cars?.length ? (
            <>
              <T face="eyebrow" style={[styles.h, { color: theme.text.muted }]}>
                {t.social.cars}
              </T>
              {p.cars.map((c, i) => (
                <Surface key={`${c.name}-${i}`} padded style={{ marginBottom: space.sm }}>
                  <Pressable disabled={!c.slug} onPress={() => c.slug && void Linking.openURL(`${SITE}/c/${c.slug}`)} accessibilityRole={c.slug ? 'link' : undefined}>
                    <T face="title" style={{ color: theme.text.primary, fontSize: 17, textTransform: 'uppercase' }}>
                      {c.nickname || c.name}
                    </T>
                    <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
                      {[c.make, c.model, c.year].filter(Boolean).join(' ')}
                    </T>
                  </Pressable>
                </Surface>
              ))}
            </>
          ) : null}

          {p.stats ? (
            <>
              <T face="eyebrow" style={[styles.h, { color: theme.text.muted }]}>
                {t.social.stats}
              </T>
              <T face="mono" style={{ color: theme.text.primary, fontSize: 13, marginBottom: space.md }}>
                {t.social.statsLine(p.stats.km_trips, p.stats.mods, p.stats.tires_burned)}
              </T>
            </>
          ) : null}

          <T face="eyebrow" style={[styles.h, { color: theme.text.muted }]}>
            {t.social.shares}
          </T>
          {shares.length === 0 ? (
            <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
              {t.social.sharesEmpty}
            </T>
          ) : (
            shares.map((s) => (
              <Surface key={s.id} padded style={styles.share}>
                <RouteThumb route={s.polyline} width={96} height={72} />
                <View style={{ flex: 1 }}>
                  <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }} numberOfLines={2}>
                    {s.title || (s.day ? dateLabel(`${s.day}T12:00:00`) : '—')}
                  </T>
                  <T face="mono" style={{ color: theme.text.secondary, fontSize: 12 }}>
                    {[s.distance_m != null ? fmtKm(Math.round(s.distance_m / 100) / 10) : null, t.social.shareVisibility[s.visibility]].filter(Boolean).join(' · ')}
                  </T>
                </View>
              </Surface>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48, width: '100%', maxWidth: 640, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginBottom: space.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  more: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  h: { fontSize: 11, marginTop: space.md, marginBottom: space.sm },
  share: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
});
