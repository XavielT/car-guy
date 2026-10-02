import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { JunteChat } from '@/components/junte/JunteChat';
import { JunteMap, type JunteMapPeer } from '@/components/map';
import { ListCardsSkeleton } from '@/components/skeletons/ListCardsSkeleton';
import { T } from '@/components/T';
import { Chip, EmptyState, GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { milestones, tripShares } from '@/lib/db/repos';
import type { TripShare } from '@/lib/db/types';
import { dateTimeLabel, id as newId } from '@/lib/format';
import { FEATURE_JUNTE_CHAT } from '@/lib/flagsV10';
import { t } from '@/lib/i18n';
import { endJunte, junteDetail, junteInviteUrl, kickJunteMember, linkJunteTrip, setJunteStatus, type JunteDetail } from '@/lib/junte/api';
import { joinJunte, leaveJunte, publishFix, sendKick, setSharing, useJunteLive } from '@/lib/junte/channel';
import { inLiveWindow, isStale, liveWindow, minutesLeft } from '@/lib/junte/live';
import { memberColor } from '@/lib/junte/mapData';
import { currentPlatform, isIosWeb } from '@/lib/platform/capabilities';
import { useProfile } from '@/lib/profile';
import { decodeShareRoute } from '@/lib/social/route';
import { readMySocialProfile } from '@/lib/social/store';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import { useMyPosition } from '@/lib/trips/myPosition';

/**
 * One junte (IMP 01102026 Phase 6, note 13, ADR-57): members by @handle with their status and who is online;
 * Voy / Salir / Terminar; "En vivo" (my dot to the members, in the window only, never stored); the live map;
 * after it, everyone's linked trimmed route on one map, "Guardar como evento", a text summary. Chat behind
 * FEATURE_JUNTE_CHAT (off until push notifications exist).
 */
export default function JunteScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeVehicle } = useStore();
  const profile = useProfile();
  const live = useJunteLive();
  const [detail, setDetail] = useState<JunteDetail | null | 'missing'>(null);
  const [myHandle, setMyHandle] = useState<string | null | undefined>(undefined);
  const [myShares, setMyShares] = useState<TripShare[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await junteDetail(id);
    setDetail(r.ok && r.data ? r.data : 'missing');
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      void load();
      void readMySocialProfile().then((p) => setMyHandle(p?.handle ?? null));
      void tripShares.list().then(setMyShares);
    }, [load]),
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const j = detail && detail !== 'missing' ? detail : null;
  const windowOpen = Boolean(j && inLiveWindow(j, now));
  const me = j?.members.find((m) => m.is_me) ?? null;
  const active = me && (me.status === 'going' || me.status === 'live');

  // The channel: only inside the window, as an active member with a handle (sql/036 refuses the rest anyway).
  useEffect(() => {
    if (!j || !windowOpen || !active || !myHandle) return;
    void joinJunte(j.id, { handle: myHandle, avatar_id: profile.avatarId }, liveWindow(j));
    return () => {
      void leaveJunte();
    };
  }, [j?.id, windowOpen, active, myHandle]); // eslint-disable-line react-hooks/exhaustive-deps

  // My position, only while sharing; each fresh fix goes through the publish gate.
  const pos = useMyPosition(live.sharing);
  useEffect(() => {
    const f = pos.fix;
    if (live.sharing && f) publishFix({ lat: f.lat, lng: f.lng, heading: f.heading, accuracy: f.acc, t: f.t });
  }, [pos.fix, live.sharing]);

  const peers: JunteMapPeer[] = useMemo(() => {
    if (!j) return [];
    const byHandle = new Map(j.members.map((m) => [m.handle, m]));
    return Object.values(live.peers)
      .filter((p) => byHandle.has(p.h))
      .map((p) => {
        const m = byHandle.get(p.h)!;
        return { handle: p.h, lat: p.lat, lng: p.lng, heading: p.hdg, stale: isStale(p, now), avatarId: m.avatar_id, photo: m.photo, name: m.display_name };
      });
  }, [j, live.peers, now]);

  const routes = useMemo(
    () =>
      (j?.members ?? [])
        .map((m, i) => ({ handle: m.handle, color: memberColor(i), pieces: decodeShareRoute(m.route?.polyline), km: m.route?.distance_m ?? null }))
        .filter((r) => r.pieces.length),
    [j],
  );

  const header = <Stack.Screen options={{ headerShown: true, title: j?.title ?? t.juntes.title }} />;
  if (detail === null) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg.base }}>
        {header}
        <ListCardsSkeleton n={3} lines={2} style={{ padding: space.gutter }} />
      </View>
    );
  }
  if (!j) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg.base, justifyContent: 'center' }}>
        {header}
        <EmptyState icon="people-outline" message={live.kicked ? t.juntes.kicked : t.juntes.joinFailed.not_found} />
      </View>
    );
  }

  const ended = j.status === 'ended' || now > liveWindow(j).to;
  const left = minutesLeft(j, now);
  const invite = () => j.code && void Share.share({ message: t.juntes.inviteText(j.title, junteInviteUrl(j.code)) });
  const act = async (fn: () => Promise<unknown>) => {
    await fn();
    await load();
  };
  const toggleLive = (on: boolean) => {
    if (on && Platform.OS !== 'web') Alert.alert(t.juntes.liveWhyTitle, t.juntes.liveWhy);
    void setSharing(on);
    void setJunteStatus(j.id, on ? 'live' : 'going');
  };
  const saveEvent = async () => {
    if (!activeVehicle) return;
    await milestones.upsert({
      id: newId(),
      vehicleId: activeVehicle.id,
      kind: 'otro',
      eventType: 'junte',
      occurredAt: j.starts_at,
      title: j.title,
      story: '',
      odometerKm: null,
      coverMediaId: null,
      deletedAt: null,
    } as never);
    setNote(t.juntes.eventSaved);
  };
  const totalKm = routes.reduce((s, r) => s + (r.km ?? 0), 0) / 1000;
  const myShare = me?.route ? myShares.find((s) => s.polylineTrimmed === me.route?.polyline) ?? null : null;

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      {header}
      <T face="display" style={{ color: theme.text.primary, fontSize: 26, textTransform: 'uppercase' }}>
        {j.title}
      </T>
      <T face="mono" style={{ color: theme.text.secondary, fontSize: 13 }}>
        {ended ? t.juntes.ended : left != null ? t.juntes.timeLeft(left) : t.juntes.starts(dateTimeLabel(j.starts_at))}
        {(j.meet_label ?? j.meet?.label) ? ` · ${j.meet_label ?? j.meet?.label}` : ''}
      </T>
      {j.code && !ended ? (
        <View style={styles.row}>
          <T face="mono" style={{ color: theme.accent, fontSize: 14, flex: 1 }}>
            {t.juntes.code(j.code)}
          </T>
          <GhostButton label={t.juntes.shareInvite} onPress={invite} />
        </View>
      ) : null}

      {!ended && me?.status === 'invited' ? <PrimaryButton label={t.juntes.going} onPress={() => void act(() => setJunteStatus(j.id, 'going'))} /> : null}

      {/* Live */}
      {!ended && active ? (
        windowOpen ? (
          <Surface padded style={{ marginVertical: space.sm, gap: space.xs }}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <T face="semibold" style={{ color: live.sharing ? theme.dangerText : theme.text.primary, fontSize: 15 }}>
                  {t.juntes.live}
                </T>
                <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17 }}>
                  {live.status === 'refused' ? t.juntes.liveRefused : live.status === 'joining' ? t.juntes.liveConnecting : t.juntes.liveHint}
                </T>
              </View>
              <Switch value={live.sharing} disabled={live.status !== 'joined' || !myHandle} onValueChange={toggleLive} accessibilityLabel={t.juntes.live} />
            </View>
            {isIosWeb(currentPlatform()) ? (
              <T face="body" style={{ color: theme.statusText.proximo, fontSize: 12 }}>
                {t.juntes.iphone}
              </T>
            ) : null}
            {!myHandle && myHandle !== undefined ? (
              <T face="body" style={{ color: theme.statusText.proximo, fontSize: 12 }}>
                {t.social.shareNeedsHandle}
              </T>
            ) : null}
            <T face="mono" style={{ color: theme.text.secondary, fontSize: 12 }}>
              {t.juntes.online(Object.keys(live.online).length)}
            </T>
          </Surface>
        ) : (
          <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginVertical: space.sm }}>
            {t.juntes.notYet}
          </T>
        )
      ) : null}

      <JunteMap
        peers={ended ? [] : peers}
        me={!ended && live.sharing && pos.fix ? { lat: pos.fix.lat, lng: pos.fix.lng, heading: pos.fix.heading, fresh: true } : null}
        avatar={{ photoUri: profile.photoUri, avatarId: profile.avatarId, name: profile.displayName }}
        meet={j.meet ? { lat: j.meet.lat, lng: j.meet.lng, label: j.meet.label } : null}
        routes={ended ? routes : []}
        height={300}
      />

      {/* Members */}
      <T face="eyebrow" style={[styles.h, { color: theme.text.muted }]}>
        {t.juntes.members(j.members.length)}
      </T>
      {j.members.map((m, i) => (
        <View key={m.handle} style={[styles.member, { borderBottomColor: theme.line }]}>
          <Pressable onPress={() => router.push({ pathname: '/u/[handle]', params: { handle: m.handle } })} style={styles.who} accessibilityRole="button">
            <View>
              <Avatar size={36} photoUri={m.photo} avatarId={m.avatar_id} name={m.display_name ?? m.handle} decorative />
              {live.online[m.handle] ? <View style={[styles.onlineDot, { backgroundColor: live.online[m.handle].live ? theme.danger : theme.statusText.ok }]} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }} numberOfLines={1}>
                {m.display_name ?? m.handle}
              </T>
              <T face="mono" style={{ color: ended && m.route ? memberColor(i) : theme.text.muted, fontSize: 12 }}>
                @{m.handle} · {m.role === 'owner' ? t.juntes.owner : t.juntes.status[m.status]}
                {m.route?.distance_m ? ` · ${t.juntes.km((m.route.distance_m / 1000).toFixed(1))}` : ''}
              </T>
            </View>
          </Pressable>
          {j.is_owner && !m.is_me && !ended ? (
            <Pressable
              onPress={() =>
                Alert.alert(t.juntes.kickTitle(m.handle), undefined, [
                  { text: t.common.cancel, style: 'cancel' },
                  { text: t.juntes.kick, style: 'destructive', onPress: () => void act(async () => { await kickJunteMember(j.id, m.handle); sendKick(m.handle); }) },
                ])
              }
              accessibilityRole="button"
              hitSlop={8}>
              <T face="semibold" style={{ color: theme.dangerText, fontSize: 13 }}>
                {t.juntes.kick}
              </T>
            </Pressable>
          ) : null}
        </View>
      ))}

      {/* After */}
      {ended && active ? (
        <View style={{ marginTop: space.md }}>
          <T face="eyebrow" style={[styles.h, { color: theme.text.muted }]}>
            {t.juntes.after}
          </T>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17, marginBottom: space.sm }}>
            {t.juntes.afterHint}
          </T>
          {me?.route ? (
            <GhostButton label={t.juntes.unlink} onPress={() => void act(() => linkJunteTrip(j.id, null))} />
          ) : myShares.length ? (
            <View style={styles.chips}>
              {myShares.slice(0, 6).map((s) => (
                <Chip key={s.id} label={`${t.juntes.linkTrip}: ${s.title || s.startedDay || '—'}`} selected={myShare?.id === s.id} onPress={() => void act(() => linkJunteTrip(j.id, s.id))} />
              ))}
            </View>
          ) : (
            <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
              {t.juntes.linkNone}
            </T>
          )}
          {activeVehicle ? <GhostButton label={t.juntes.saveEvent} onPress={() => void saveEvent()} /> : null}
          <GhostButton label={t.juntes.shareSummary} onPress={() => void Share.share({ message: t.juntes.summaryText(j.title, routes.length || j.members.length, totalKm.toFixed(1)) })} />
        </View>
      ) : null}

      {note ? (
        <T face="body" style={{ color: theme.accent, fontSize: 13, marginTop: space.sm }}>
          {note}
        </T>
      ) : null}

      {/* Leave / end */}
      {!ended && active && !j.is_owner ? <GhostButton label={t.juntes.leave} onPress={() => void act(() => setJunteStatus(j.id, 'left')).then(() => router.back())} /> : null}
      {!ended && j.is_owner ? (
        <GhostButton
          danger
          label={t.juntes.end}
          onPress={() =>
            Alert.alert(t.juntes.endTitle, t.juntes.endBody, [
              { text: t.common.cancel, style: 'cancel' },
              { text: t.juntes.end, style: 'destructive', onPress: () => void act(async () => { await endJunte(j.id); await leaveJunte(); }) },
            ])
          }
        />
      ) : null}

      {FEATURE_JUNTE_CHAT && active ? <JunteChat junteId={j.id} isOwner={j.is_owner} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48, width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  h: { fontSize: 11, marginTop: space.md, marginBottom: space.xs },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md, flex: 1 },
  onlineDot: { position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#121212' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.sm },
});
