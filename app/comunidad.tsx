import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip, GhostButton } from '@/components/ui';
import { space } from '@/constants/theme';
import { useSession } from '@/lib/cloud/auth';
import { t } from '@/lib/i18n';
import { searchProfiles, type PersonRef, type ProfileHit } from '@/lib/social/api';
import { loadSocial, socialActions, useSocial } from '@/lib/social/store';
import { useTheme } from '@/lib/theme/useTheme';

type Tab = 'requests' | 'friends' | 'followers' | 'following' | 'blocked';
const TABS: Tab[] = ['requests', 'friends', 'followers', 'following', 'blocked'];

/**
 * Más → Comunidad (IMP 01102026 Phase 5, notes 11, 12): search by @handle or name (accent-insensitive, in the
 * RPC), and the graph — requests to accept, friends, followers, following, blocked. Instant from the local
 * cache; refreshed on focus; offline it says so.
 */
export default function ComunidadScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const social = useSocial();
  const [tab, setTab] = useState<Tab>('requests');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<ProfileHit[] | null>(null);
  const seq = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (session) void loadSocial();
    }, [session]),
  );

  const term = q.trim();
  useEffect(() => {
    if (term.length < 2) return;
    const mine = ++seq.current;
    const timer = setTimeout(() => void searchProfiles(term).then((r) => mine === seq.current && setHits(r.ok ? r.data : [])), 300);
    return () => clearTimeout(timer);
  }, [term]);
  // Too short to search: no results shown (the last answer stays in state, unused).
  const shownHits = term.length >= 2 ? hits : null;

  const header = <Stack.Screen options={{ headerShown: true, title: t.social.title }} />;
  if (!session) {
    return (
      <View style={[styles.pad, { flex: 1, backgroundColor: theme.bg.base }]}>
        {header}
        <T face="body" style={{ color: theme.text.secondary, fontSize: 14 }}>
          {t.social.signedOut}
        </T>
      </View>
    );
  }

  const open = (handle: string) => router.push({ pathname: '/u/[handle]', params: { handle } });
  const row = (person: PersonRef & { photo?: string | null }, trailing?: React.ReactNode, sub?: string) => (
    <View key={person.handle} style={[styles.row, { borderBottomColor: theme.line }]}>
      <Pressable onPress={() => open(person.handle)} accessibilityRole="button" accessibilityLabel={`@${person.handle}`} style={styles.who}>
        <Avatar size={40} photoUri={person.photo ?? null} avatarId={person.avatar_id} name={person.display_name ?? person.handle} decorative />
        <View style={{ flex: 1 }}>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }} numberOfLines={1}>
            {person.display_name ?? person.handle}
          </T>
          <T face="mono" style={{ color: theme.text.muted, fontSize: 12 }}>
            @{person.handle}
            {sub ? ` · ${sub}` : ''}
          </T>
        </View>
      </Pressable>
      {trailing}
    </View>
  );
  const small = (label: string, onPress: () => void, danger = false) => (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} style={[styles.small, { borderColor: danger ? theme.lineStrong : theme.accent }]}>
      <T face="semibold" style={{ color: danger ? theme.text.secondary : theme.accent, fontSize: 13 }}>
        {label}
      </T>
    </Pressable>
  );

  const me = social.me;
  const list = (() => {
    if (tab === 'requests') return (me?.requests ?? []).map((r) => row(r, <View style={styles.pair}>{small(t.social.accept, () => void socialActions.accept(r.handle))}{small(t.social.decline, () => void socialActions.decline(r.handle), true)}</View>));
    if (tab === 'blocked') return (me?.blocked ?? []).map((h) => row({ handle: h, display_name: null, avatar_id: null }, small(t.social.unblock, () => void socialActions.unblock(h), true)));
    const people = social.lists[tab] ?? [];
    const sent = tab === 'following' ? (social.lists.requests_sent ?? []) : [];
    return [
      ...people.map((x) => row(x, tab === 'followers' ? small(t.social.remove, () => void socialActions.removeFollower(x.handle), true) : undefined)),
      ...sent.map((x) => row(x, undefined, t.social.sent)),
    ];
  })();

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      {header}
      <Field label={t.social.searchPlaceholder} value={q} onChangeText={setQ} autoCapitalize="none" autoCorrect={false} />
      {shownHits ? (
        <View style={{ marginBottom: space.lg }}>
          {shownHits.length === 0 ? (
            <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
              {t.social.searchEmpty}
            </T>
          ) : (
            shownHits.map((h) => row(h, undefined, h.my_follow ? t.social.follow[h.my_follow === 'accepted' ? 'following' : 'requested'] : undefined))
          )}
        </View>
      ) : null}

      {social.offline ? (
        <T face="body" style={{ color: theme.statusText.proximo, fontSize: 12, marginBottom: space.sm }}>
          {t.social.offline}
        </T>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((k) => {
          const n = k === 'requests' ? (me?.requests.length ?? 0) : k === 'blocked' ? (me?.blocked.length ?? 0) : k === 'friends' ? (me?.friends ?? 0) : k === 'followers' ? (me?.followers ?? 0) : (me?.following ?? 0);
          return <Chip key={k} label={`${t.social.tabs[k]} ${n}`} selected={tab === k} onPress={() => setTab(k)} />;
        })}
      </ScrollView>
      {list.length ? (
        list
      ) : (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginTop: space.sm }}>
          {t.social.empty[tab]}
        </T>
      )}
      <View style={{ marginTop: space.lg }}>
        <GhostButton label={t.social.preview} onPress={() => router.push('/perfil')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48, width: '100%', maxWidth: 640, alignSelf: 'center' },
  tabs: { gap: space.xs, paddingBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md, flex: 1 },
  pair: { flexDirection: 'row', gap: space.xs },
  small: { borderWidth: 1, borderRadius: 999, paddingHorizontal: space.md, paddingVertical: 6 },
});
