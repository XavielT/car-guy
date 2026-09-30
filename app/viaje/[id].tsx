import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { MissingRecord } from '@/components/MissingRecord';
import { T } from '@/components/T';
import { shareCardImage, shareSummaryText } from '@/components/track/TrackPieces';
import { confirmDeleteTrip, DistributionBar, setTripRole, TripShareCard, tripText } from '@/components/trips/TripPieces';
import { Chip, GhostButton, PrimaryButton, Segmented, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { odometer as odometerRepo } from '@/lib/db/repos';
import { tripPoints, trips as tripRepo } from '@/lib/db/tripOps';
import type { Trip, TripRole } from '@/lib/db/types';
import { es } from '@/lib/i18n/es';
import { shareTripGeojson } from '@/lib/trips/shareGeojson';
import { tripsMap } from '@/lib/trips/settings';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import type { Fix } from '@/lib/trips/geo';
import { durationLabel, kmhLabel, mapsUrl, parseBuckets } from '@/lib/trips/present';

/**
 * One trip (03-screens.md "Phase 5"): the route on the dark card (by speed
 * while the raw points are still on the phone), the numbers, the speed
 * distribution, vehicle and role, Ver en mapa, Compartir, labels, notes.
 *
 * No replay scrubber in Part A: it needs an animated dot over the raw points
 * with play/pause, and it is the one piece of the screen that is not
 * information. Left for later.
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

  if (trip === null) return <MissingRecord />;
  if (!trip) return null;

  const vehicles = data.vehicles.filter((v) => !v.isArchived || v.id === trip.vehicleId);
  const vehicleName = data.vehicles.find((v) => v.id === trip.vehicleId)?.name;
  const cardW = Math.min(winW, 560) - 2 * space.gutter;
  const url = mapsUrl(trip);
  const dirty = startLabel !== trip.startLabel || endLabel !== trip.endLabel || notes !== trip.notes;

  const flash = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice((n) => (n === text ? null : n)), 4000);
  };

  async function changeRole(role: TripRole) {
    if (!trip || role === trip.role) return;
    const removed = await setTripRole(trip, role);
    await load();
    if (removed) flash(es.trips.passengerOdoRemoved);
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
    const t = await load();
    if (t) {
      setStartLabel(t.startLabel);
      setEndLabel(t.endLabel);
      setNotes(t.notes);
    }
    flash(es.trips.savedNotice);
  }

  const tiles: [string, string][] = [
    [durationLabel(trip.movingS), es.trips.tiles.moving],
    [`${kmhLabel(trip.avgKmh)} km/h`, es.trips.tiles.avg],
  ];
  const eyebrow = (label: string) => (
    <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.lg, marginBottom: space.sm }}>
      {label.toUpperCase()}
    </T>
  );
  const suggestions = (set: (v: string) => void, current: string) => (
    <View style={styles.chips}>
      {es.trips.labelSuggestions.map((s) => (
        <Chip key={s} label={s} selected={current === s} onPress={() => set(current === s ? '' : s)} />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
          {es.trips.eyebrow}
        </T>

        {/* Diagnostics (note 16): a long press on the card shares the trip's GPS points as GeoJSON. */}
        <Pressable onLongPress={() => void shareTripGeojson(trip, points ?? [])} delayLongPress={600} accessibilityHint={es.trips.exportHint}>
          <TripShareCard ref={shotRef} trip={trip} points={points} width={cardW} vehicleName={vehicleName} map={map} />
        </Pressable>
        {!points ? (
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.xs }}>
            {trip.polyline ? es.trips.routeSimplified : es.trips.noRoute}
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

        {eyebrow(es.trips.distribution)}
        <DistributionBar buckets={parseBuckets(trip.speedBuckets)} />
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.xs }}>
          {es.trips.distributionHint}
        </T>

        <View style={[styles.pair, { marginTop: space.md }]}>
          {url ? <GhostButton style={{ flex: 1 }} label={es.trips.openMap} onPress={() => void Linking.openURL(url)} /> : null}
          <GhostButton style={{ flex: 1 }} label={es.trips.share} onPress={() => void shareCardImage(shotRef, `viaje-${trip.startedAt.slice(0, 10)}`)} />
          <GhostButton
            style={{ flex: 1 }}
            label={es.trips.shareText}
            onPress={() => void shareSummaryText(tripText(trip, vehicleName)).then((copied) => copied && flash(es.trips.copied))}
          />
        </View>
        {notice ? (
          <T face="body" style={{ color: theme.accent, fontSize: 13 }}>
            {notice}
          </T>
        ) : null}

        {vehicles.length > 1 ? (
          <>
            {eyebrow(es.trips.vehicle)}
            <View style={styles.chips}>
              {vehicles.map((v) => (
                <Chip key={v.id} label={v.name} selected={trip.vehicleId === v.id} onPress={() => void changeVehicle(v.id)} />
              ))}
            </View>
          </>
        ) : null}

        {eyebrow(es.trips.role)}
        <Segmented<TripRole>
          options={[
            { key: 'conductor', label: es.trips.roleDriver },
            { key: 'pasajero', label: es.trips.rolePassenger },
          ]}
          value={trip.role}
          onChange={(r) => void changeRole(r)}
        />
        {trip.role === 'pasajero' ? (
          <T face="body" style={{ color: theme.text.secondary, fontSize: 12, marginTop: space.xs }}>
            {es.trips.passengerHint}
          </T>
        ) : null}

        {eyebrow(es.trips.labels)}
        <Field label={es.trips.startLabel} placeholder={es.trips.labelPlaceholder} value={startLabel} onChangeText={setStartLabel} />
        {suggestions(setStartLabel, startLabel)}
        <Field label={es.trips.endLabel} placeholder={es.trips.labelPlaceholder} value={endLabel} onChangeText={setEndLabel} />
        {suggestions(setEndLabel, endLabel)}
        <Field label={es.trips.notes} value={notes} onChangeText={setNotes} multiline />
        <PrimaryButton label={es.trips.save} disabled={!dirty} onPress={() => void saveText()} />

        <GhostButton danger label={es.trips.delete} onPress={() => confirmDeleteTrip(trip, () => (router.canGoBack() ? router.back() : router.replace('/viajes')))} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48, gap: 0 },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, padding: space.md },
  pair: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.md },
});
