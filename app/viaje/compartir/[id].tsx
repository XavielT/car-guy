import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { T } from '@/components/T';
import { Field } from '@/components/Field';
import { DetailTripSkeleton } from '@/components/skeletons/DetailTripSkeleton';
import { Chip, GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { privacyZones, tripShares } from '@/lib/db/repos';
import { tripPoints, trips as tripRepo } from '@/lib/db/tripOps';
import type { PrivacyZone, Trip, TripShare } from '@/lib/db/types';
import { trimForSharing, type TrimmedShare } from '@/lib/domain/tripShare';
import { id as newId, km as fmtKm } from '@/lib/format';
import { t } from '@/lib/i18n';
import { encodeShareRoute, routePaths } from '@/lib/social/route';
import { readMySocialProfile } from '@/lib/social/store';
import type { ShareVisibility } from '@/lib/social/visibility';
import { useTheme } from '@/lib/theme/useTheme';
import { decodePolyline, type LatLng } from '@/lib/trips/geo';

const VIS: ShareVisibility[] = ['followers', 'friends', 'public'];

/**
 * Viaje → Compartir en mi perfil (IMP 01102026 Phase 5, ADR-56): the route trimmed on the phone — 300–500 m off
 * each end (seeded by the trip id) and the privacy zones cut out — previewed over the full route (only here, on
 * the owner's phone), then published as a trip_share with a visibility. The cloud only ever gets the trimmed
 * pieces.
 */
export default function ShareTripScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [raw, setRaw] = useState<LatLng[] | null>(null);
  const [fromPolyline, setFromPolyline] = useState(false);
  const [zones, setZones] = useState<PrivacyZone[]>([]);
  const [existing, setExisting] = useState<TripShare | null>(null);
  const [visibility, setVisibility] = useState<ShareVisibility>('followers');
  const [title, setTitle] = useState('');
  const [hasHandle, setHasHandle] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const [tr, pts, zs, shares, me] = await Promise.all([
        tripRepo.getById(id),
        tripPoints.forTrip(id),
        privacyZones.list(),
        tripShares.listWhere({ tripId: id }),
        readMySocialProfile(),
      ]);
      setTrip(tr);
      setZones(zs);
      setHasHandle(Boolean(me?.handle));
      if (pts.length > 1) setRaw(pts.map((p) => ({ lat: p.lat, lng: p.lng })));
      else if (tr?.polyline) {
        setRaw(decodePolyline(tr.polyline));
        setFromPolyline(true);
      } else setRaw([]);
      const s = shares[0] ?? null;
      setExisting(s);
      if (s) {
        setVisibility(s.visibility);
        setTitle(s.title ?? '');
      }
    })();
  }, [id]);

  const trimmed: TrimmedShare | null = useMemo(
    () => (raw && trip ? trimForSharing(raw, { tripId: trip.id, zones: zones.map((z) => ({ lat: z.lat, lng: z.lng, radius_m: z.radiusM })) }) : null),
    [raw, trip, zones],
  );

  const header = <Stack.Screen options={{ headerShown: true, title: t.social.shareTitle }} />;
  if (!trip || !raw || !trimmed) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg.base }}>
        {header}
        <DetailTripSkeleton />
      </View>
    );
  }

  const W = Math.min(width, 640) - space.gutter * 2;
  const H = Math.round(W * 0.66);
  // One projection for both: the full route faint, the shared pieces in amber on top.
  const [full, ...shared] = routePaths([raw, ...trimmed.segments], W, H, 12);
  const nothing = trimmed.encoded.length === 0;

  const publish = async () => {
    setBusy(true);
    await tripShares.upsert({
      id: existing?.id ?? newId(),
      tripId: trip.id,
      visibility,
      polylineTrimmed: encodeShareRoute(trimmed.encoded),
      distanceM: Math.round(trimmed.distanceM),
      durationS: trip.durationS ?? null,
      startedDay: trip.startedAt.slice(0, 10),
      title: title.trim() || null,
    });
    setBusy(false);
    router.back();
  };
  const unshare = async () => {
    if (!existing) return;
    setBusy(true);
    await tripShares.softDelete(existing.id);
    setBusy(false);
    router.back();
  };

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      {header}
      <Surface style={{ alignItems: 'center', paddingVertical: space.sm, marginBottom: space.sm }}>
        <Svg width={W} height={H}>
          {full ? <Path d={full} stroke={theme.text.muted} strokeOpacity={0.45} strokeWidth={3} strokeDasharray="6 6" fill="none" /> : null}
          {shared.map((d, i) => (
            <Path key={i} d={d} stroke={theme.accentFill} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </Svg>
      </Surface>
      <T face="mono" style={{ color: theme.text.secondary, fontSize: 12, marginBottom: space.sm }}>
        {fmtKm(Math.round(trimmed.distanceM / 100) / 10)}
      </T>
      <T face="body" style={[styles.p, { color: theme.text.secondary }]}>
        {t.social.shareTrimNote}
      </T>
      {fromPolyline ? (
        <T face="body" style={[styles.p, { color: theme.text.muted, fontSize: 12 }]}>
          {t.social.shareNoPoints}
        </T>
      ) : null}

      {!hasHandle ? (
        <T face="body" style={[styles.p, { color: theme.statusText.proximo }]}>
          {t.social.shareNeedsHandle}
        </T>
      ) : nothing ? (
        <T face="body" style={[styles.p, { color: theme.statusText.proximo }]}>
          {t.social.shareNothing}
        </T>
      ) : (
        <>
          <View style={styles.chips}>
            {VIS.map((v) => (
              <Chip key={v} label={t.social.shareVisibility[v]} selected={visibility === v} onPress={() => setVisibility(v)} />
            ))}
          </View>
          <Field label={t.social.shareTitleField} value={title} onChangeText={setTitle} />
          <PrimaryButton label={existing ? t.social.shareUpdate : t.social.sharePublish} disabled={busy} onPress={() => void publish()} />
        </>
      )}
      {existing ? <GhostButton danger label={t.social.shareRemove} disabled={busy} onPress={() => void unshare()} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48, width: '100%', maxWidth: 640, alignSelf: 'center' },
  p: { fontSize: 13, lineHeight: 19, marginBottom: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.sm },
});
