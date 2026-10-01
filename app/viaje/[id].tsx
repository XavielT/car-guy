import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { TripMap } from '@/components/map';
import { MissingRecord } from '@/components/MissingRecord';
import { DetailTripSkeleton } from '@/components/skeletons/DetailTripSkeleton';
import { T } from '@/components/T';
import { shareCardImage, shareSummaryText } from '@/components/track/TrackPieces';
import { confirmDeleteTrip, DistributionBar, setTripRole, TripShareCard, tripText } from '@/components/trips/TripPieces';
import { Chip, GhostButton, PrimaryButton, Segmented, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { odometer as odometerRepo } from '@/lib/db/repos';
import { tripPoints, trips as tripRepo } from '@/lib/db/tripOps';
import type { Trip, TripRole } from '@/lib/db/types';
import { FEATURE_MAP_V2 } from '@/lib/flagsV8';
import { t } from '@/lib/i18n';
import { ATTRIBUTION_URL, mapAttribution } from '@/lib/map/config';
import { shareTripGeojson } from '@/lib/trips/shareGeojson';
import { tripsMap } from '@/lib/trips/settings';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import type { Fix } from '@/lib/trips/geo';
import { routePointsFromDrawn } from '@/lib/trips/geojson';
import { durationLabel, kmhLabel, mapsUrl, parseBuckets, routePointsForDrawing } from '@/lib/trips/present';

/**
 * One trip (03-screens.md "Phase 4/5"): the route on the dark card (by speed
 * while the raw points are still on the phone), the numbers, the speed
 * distribution, vehicle and role, Compartir, labels, notes.
 *
 * Phase 4 (ADR-41): with the map on (Ajustes → Viajes → Mapa: en línea) the
 * card's route is the MapLibre TripMap — pan/zoom, start/end dots, the replay
 * dot, long-press → the GPS export. When the style cannot load, the OSM
 * mosaic comes back with a "Sin mapa en línea" line. "Compartir" still
 * captures the static card (mosaic or plain): a GL map does not snapshot, so
 * an off-screen copy is mounted for the capture and shot once its tiles load.
 */
export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { data } = useStore();
  const { width: winW } = useWindowDimensions();
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [points, setPoints] = useState<Fix[] | null>(null);
  // OpenStreetMap under the route (Ajustes → Viajes; default on).
  const [map, setMap] = useState(false);
  useEffect(() => {
    void tripsMap().then(setMap);
  }, []);
  const [startLabel, setStartLabel] = useState('');
  const [endLabel, setEndLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const shotRef = useRef<View>(null);
  // The MapLibre map could not load its style (offline, provider down).
  const [mapDown, setMapDown] = useState(false);
  const onMapDown = useCallback(() => setMapDown(true), []);
  // Replay: the index of the dot along the drawn route; null when stopped.
  const [replayAt, setReplayAt] = useState<number | null>(null);
  // Share while the live map is up: the off-screen static card, until captured.
  const [shooting, setShooting] = useState(false);

  const routePts = useMemo(() => (trip ? routePointsFromDrawn(routePointsForDrawing(points, trip)) : []), [trip, points]);
  const replay = useMemo(() => (replayAt != null && routePts[replayAt] ? { lat: routePts[replayAt].lat, lng: routePts[replayAt].lng } : null), [replayAt, routePts]);
  const replaying = replayAt != null;
  useEffect(() => {
    if (!replaying) return;
    // ~10 s for the whole route, whatever its length: ≤ 200 frames, ≥ 50 ms apart.
    const step = Math.max(1, Math.ceil(routePts.length / 200));
    const frames = Math.max(1, Math.ceil(routePts.length / step));
    const id = setInterval(() => {
      setReplayAt((i) => (i == null ? null : i + step >= routePts.length ? null : i + step));
    }, Math.max(50, Math.round(10_000 / frames)));
    return () => clearInterval(id);
  }, [replaying, routePts.length]);
  // Captures the off-screen card once (its tiles settled, or after 6 s regardless).
  const shot = useRef(false);
  const shoot = useCallback(() => {
    if (shot.current || !trip) return;
    shot.current = true;
    void shareCardImage(shotRef, `viaje-${trip.startedAt.slice(0, 10)}`).finally(() => setShooting(false));
  }, [trip]);
  useEffect(() => {
    if (!shooting) return;
    const id = setTimeout(shoot, 6000);
    return () => clearTimeout(id);
  }, [shooting, shoot]);
  const exportPoints = useCallback(() => {
    if (trip) void shareTripGeojson(trip, points ?? []);
  }, [trip, points]);

  const load = useCallback(async () => {
    const t = await tripRepo.getById(id);
    setTrip(t && t.status === 'done' ? t : null);
    return t;
  }, [id]);

  useEffect(() => {
    void tripRepo.getById(id).then((t) => {
      setTrip(t && t.status === 'done' ? t : null);
      if (!t) return;
      setStartLabel(t.startLabel);
      setEndLabel(t.endLabel);
      setNotes(t.notes);
    });
    void tripPoints.forTrip(id).then((p) => setPoints(p.length > 1 ? p : null));
  }, [id]);

  // undefined: still loading · null: gone (or not a finished trip). Later loads
  // keep the trip on screen, so the skeleton only covers the first read.
  const showSkeleton = useDelayedLoading(trip === undefined);
  if (trip === null) return <MissingRecord />;
  if (!trip) return showSkeleton ? <DetailTripSkeleton /> : null;

  const vehicles = data.vehicles.filter((v) => !v.isArchived || v.id === trip.vehicleId);
  const vehicleName = data.vehicles.find((v) => v.id === trip.vehicleId)?.name;
  const cardW = Math.min(winW, 560) - 2 * space.gutter;
  // The map is the map now (Phase 4): no "Ver en mapa" link out.
  const url = FEATURE_MAP_V2 ? null : mapsUrl(trip);
  const liveMap = FEATURE_MAP_V2 && map && !mapDown;
  const shotName = `viaje-${trip.startedAt.slice(0, 10)}`;
  const share = () => {
    if (!liveMap) void shareCardImage(shotRef, shotName);
    else {
      shot.current = false;
      setShooting(true);
    }
  };
  const dirty = startLabel !== trip.startLabel || endLabel !== trip.endLabel || notes !== trip.notes;

  const flash = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice((n) => (n === text ? null : n)), 4000);
  };

  async function changeRole(role: TripRole) {
    if (!trip || role === trip.role) return;
    const removed = await setTripRole(trip, role);
    await load();
    if (removed) flash(t.trips.passengerOdoRemoved);
  }

  async function changeVehicle(vehicleId: string) {
    if (!trip || vehicleId === trip.vehicleId) return;
    // The odometer estimate was for the other car: it goes, and is not moved.
    const readingId = trip.odometerReadingId ?? `odo_trip_${trip.id}`;
    if (await odometerRepo.getById(readingId)) await odometerRepo.softDelete(readingId);
    await tripRepo.upsert({ id: trip.id, vehicleId, odometerReadingId: null });
    await load();
  }

  async function saveText() {
    if (!trip) return;
    await tripRepo.upsert({ id: trip.id, startLabel: startLabel.trim(), endLabel: endLabel.trim(), notes: notes.trim() });
    const saved = await load();
    if (saved) {
      setStartLabel(saved.startLabel);
      setEndLabel(saved.endLabel);
      setNotes(saved.notes);
    }
    flash(t.trips.savedNotice);
  }

  const tiles: [string, string][] = [
    [durationLabel(trip.movingS), t.trips.tiles.moving],
    [`${kmhLabel(trip.avgKmh)} km/h`, t.trips.tiles.avg],
  ];
  const eyebrow = (label: string) => (
    <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.lg, marginBottom: space.sm }}>
      {label.toUpperCase()}
    </T>
  );
  const suggestions = (set: (v: string) => void, current: string) => (
    <View style={styles.chips}>
      {t.trips.labelSuggestions.map((s) => (
        <Chip key={s} label={s} selected={current === s} onPress={() => set(current === s ? '' : s)} />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
          {t.trips.eyebrow}
        </T>

        {FEATURE_MAP_V2 && map && mapDown ? (
          <T face="semibold" style={{ color: theme.statusText.proximo, fontSize: 12, marginTop: space.xs }}>
            {t.trips.mapOffline}
          </T>
        ) : null}
        {liveMap ? (
          <View accessibilityHint={t.trips.exportHint}>
            <TripShareCard
              trip={trip}
              points={points}
              width={cardW}
              vehicleName={vehicleName}
              renderRoute={(w, h) => (
                <View style={{ width: w, height: h, borderRadius: radius.card, overflow: 'hidden' }}>
                  <TripMap points={routePts} replay={replay} height={h} onLongPress={exportPoints} onUnavailable={onMapDown} />
                </View>
              )}
            />
            <Pressable onPress={() => void Linking.openURL(ATTRIBUTION_URL)} accessibilityRole="link" style={{ marginTop: space.xs }}>
              <T face="body" style={{ color: theme.text.muted, fontSize: 11 }}>
                {mapAttribution()}
              </T>
            </Pressable>
          </View>
        ) : (
          // Diagnostics (note 16): a long press on the card shares the trip's GPS points as GeoJSON.
          <Pressable onLongPress={exportPoints} delayLongPress={600} accessibilityHint={t.trips.exportHint}>
            <TripShareCard ref={shotRef} trip={trip} points={points} width={cardW} vehicleName={vehicleName} map={map} />
          </Pressable>
        )}
        {!points ? (
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.xs }}>
            {trip.polyline ? t.trips.routeSimplified : t.trips.noRoute}
          </T>
        ) : null}

        <View style={[styles.tiles, { marginTop: space.md }]}>
          {tiles.map(([v, l]) => (
            <Surface key={l} style={styles.tile}>
              <T face="monoBold" style={{ color: theme.text.primary, fontSize: 18 }}>
                {v}
              </T>
              <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10 }}>
                {l.toUpperCase()}
              </T>
            </Surface>
          ))}
        </View>

        {eyebrow(t.trips.distribution)}
        <DistributionBar buckets={parseBuckets(trip.speedBuckets)} />
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.xs }}>
          {t.trips.distributionHint}
        </T>

        <View style={[styles.pair, { marginTop: space.md }]}>
          {url ? <GhostButton style={{ flex: 1 }} label={t.trips.openMap} onPress={() => void Linking.openURL(url)} /> : null}
          {liveMap && routePts.length > 1 ? (
            <GhostButton style={{ flex: 1 }} label={replaying ? t.trips.replayStop : t.trips.replay} onPress={() => setReplayAt(replaying ? null : 0)} />
          ) : null}
          <GhostButton style={{ flex: 1 }} label={t.trips.share} disabled={shooting} onPress={share} />
          <GhostButton
            style={{ flex: 1 }}
            label={t.trips.shareText}
            onPress={() => void shareSummaryText(tripText(trip, vehicleName)).then((copied) => copied && flash(t.trips.copied))}
          />
        </View>
        {notice ? (
          <T face="body" style={{ color: theme.accent, fontSize: 13 }}>
            {notice}
          </T>
        ) : null}

        {vehicles.length > 1 ? (
          <>
            {eyebrow(t.trips.vehicle)}
            <View style={styles.chips}>
              {vehicles.map((v) => (
                <Chip key={v.id} label={v.name} selected={trip.vehicleId === v.id} onPress={() => void changeVehicle(v.id)} />
              ))}
            </View>
          </>
        ) : null}

        {eyebrow(t.trips.role)}
        <Segmented<TripRole>
          options={[
            { key: 'conductor', label: t.trips.roleDriver },
            { key: 'pasajero', label: t.trips.rolePassenger },
          ]}
          value={trip.role}
          onChange={(r) => void changeRole(r)}
        />
        {trip.role === 'pasajero' ? (
          <T face="body" style={{ color: theme.text.secondary, fontSize: 12, marginTop: space.xs }}>
            {t.trips.passengerHint}
          </T>
        ) : null}

        {eyebrow(t.trips.labels)}
        <Field label={t.trips.startLabel} placeholder={t.trips.labelPlaceholder} value={startLabel} onChangeText={setStartLabel} />
        {suggestions(setStartLabel, startLabel)}
        <Field label={t.trips.endLabel} placeholder={t.trips.labelPlaceholder} value={endLabel} onChangeText={setEndLabel} />
        {suggestions(setEndLabel, endLabel)}
        <Field label={t.trips.notes} value={notes} onChangeText={setNotes} multiline />
        <PrimaryButton label={t.trips.save} disabled={!dirty} onPress={() => void saveText()} />

        <GhostButton danger label={t.trips.delete} onPress={() => confirmDeleteTrip(trip, () => (router.canGoBack() ? router.back() : router.replace('/viajes')))} />
      </ScrollView>
      {shooting ? (
        // The static card for "Compartir" while the live map is up: off screen, shot once its tiles are in.
        <View pointerEvents="none" style={styles.offscreen}>
          <TripShareCard
            ref={shotRef}
            trip={trip}
            points={points}
            width={cardW}
            vehicleName={vehicleName}
            map={map}
            onRouteReady={() => setTimeout(shoot, 150)}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48, gap: 0 },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, padding: space.md },
  pair: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.md },
  offscreen: { position: 'absolute', left: -10000, top: 0 },
});
