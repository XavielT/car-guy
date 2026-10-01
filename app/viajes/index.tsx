import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { HeatMap } from '@/components/map';

import { TripsListSkeleton } from '@/components/skeletons/TripsListSkeleton';
import { TipCard } from '@/components/TipCard';
import { T } from '@/components/T';
import { listDoneTrips, TripRow, TripsHeatMap, TripsStrip, tripActions } from '@/components/trips/TripPieces';
import { Chip, EmptyState, GhostButton, Segmented } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import type { Trip } from '@/lib/db/types';
import { FEATURE_MAP_V2 } from '@/lib/flagsV8';
import { t } from '@/lib/i18n';
import { ATTRIBUTION_URL, mapAttribution } from '@/lib/map/config';
import { sampleAlong } from '@/lib/trips/geojson';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import { filterTrips, monthSummary, tripRoute, type TripFilter } from '@/lib/trips/present';
import { tripsMap } from '@/lib/trips/settings';

const FILTERS: TripFilter[] = ['todos', 'mes', 'largos', 'rapidos'];

/**
 * Viajes (03-screens.md "Phase 5"): the done trips of the active vehicle (or of
 * every vehicle), the month strip, filters. Tap opens the trip; long-press
 * offers conductor/pasajero and eliminar.
 *
 * "Por dónde manejas" (Phase 4, ADR-41): a MapLibre heatmap of the listed
 * trips (the filter chips pick the period), their polylines sampled every
 * 35 m; the OSM mosaic returns with "Sin mapa en línea" when the style fails.
 */
export default function TripsScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { data, activeVehicle } = useStore();
  // One vehicle (the one we came from, else the active one) or all ('').
  const [scope, setScope] = useState<string>(vehicleId ?? activeVehicle?.id ?? '');
  const [filter, setFilter] = useState<TripFilter>('todos');
  const [list, setList] = useState<Trip[] | null>(null);
  const [version, setVersion] = useState(0);
  const { width: windowW } = useWindowDimensions();
  const width = Math.min(windowW, 560);
  const [map, setMap] = useState(false);
  useEffect(() => {
    void tripsMap().then(setMap);
  }, []);
  const [heatDown, setHeatDown] = useState(false);
  const onHeatDown = useCallback(() => setHeatDown(true), []);

  // `data` changes after every write (the store's change listener), which also
  // covers coming back from a trip that was edited or deleted.
  useEffect(() => {
    let cancelled = false;
    void listDoneTrips(scope || undefined).then((t) => !cancelled && setList(t));
    return () => {
      cancelled = true;
    };
  }, [scope, version, data]);

  const vehicles = data.vehicles.filter((v) => !v.isArchived);
  const nameOf = (id: string) => vehicles.find((v) => v.id === id)?.name ?? data.vehicles.find((v) => v.id === id)?.name;
  const shown = useMemo(() => (list ? filterTrips(list, filter) : []), [list, filter]);
  const heatPoints = useMemo(() => sampleAlong(shown.slice(0, 200).map(tripRoute), 35), [shown]);
  const reload = () => setVersion((v) => v + 1);
  // First load only: later reloads (a write, a scope change) keep the old list up.
  const showSkeleton = useDelayedLoading(list === null);

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {t.trips.eyebrow}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 30, textTransform: 'uppercase', marginBottom: space.md }}>
        {t.trips.title}
      </T>
      <TipCard id="trips" />

      {vehicles.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
          <Chip label={t.trips.allVehicles} selected={!scope} onPress={() => setScope('')} />
          {vehicles.map((v) => (
            <Chip key={v.id} label={v.name} selected={scope === v.id} onPress={() => setScope(v.id)} />
          ))}
        </ScrollView>
      ) : null}

      {showSkeleton ? <TripsListSkeleton /> : null}

      {list && !showSkeleton ? <TripsStrip summary={monthSummary(list)} /> : null}

      {showSkeleton ? null : (
        <Segmented<TripFilter> options={FILTERS.map((key) => ({ key, label: t.trips.filters[key] }))} value={filter} onChange={setFilter} style={{ marginBottom: space.md }} />
      )}

      {map && shown.length && !showSkeleton && FEATURE_MAP_V2 && !heatDown && heatPoints.length ? (
        <View style={{ marginBottom: space.md }}>
          <View style={{ borderRadius: radius.card, overflow: 'hidden' }}>
            <HeatMap points={heatPoints} height={Math.round((width - 2 * space.gutter) * 0.62)} onUnavailable={onHeatDown} />
          </View>
          <Pressable onPress={() => void Linking.openURL(ATTRIBUTION_URL)} accessibilityRole="link" style={{ marginTop: space.xs }}>
            <T face="body" style={{ color: theme.text.muted, fontSize: 11 }}>
              {mapAttribution()}
            </T>
          </Pressable>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.xs }}>
            {t.trips.heatCaption}
          </T>
        </View>
      ) : map && shown.length && !showSkeleton ? (
        <>
          {FEATURE_MAP_V2 && heatDown ? (
            <T face="semibold" style={{ color: theme.statusText.proximo, fontSize: 12, marginBottom: space.xs }}>
              {t.trips.mapOffline}
            </T>
          ) : null}
          <TripsHeatMap trips={shown} width={width - 2 * space.gutter} height={Math.round((width - 2 * space.gutter) * 0.62)} />
        </>
      ) : null}

      {list && !list.length && !showSkeleton ? (
        <EmptyState icon="navigate-outline" message={t.trips.empty} actionLabel={t.trips.start} onAction={() => router.push('/(tabs)')} />
      ) : null}
      {list && list.length && !shown.length && !showSkeleton ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginBottom: space.md }}>
          {t.trips.emptyFiltered}
        </T>
      ) : null}

      {(showSkeleton ? [] : shown).map((t) => (
        <TripRow
          key={t.id}
          trip={t}
          vehicleName={!scope && vehicles.length > 1 ? nameOf(t.vehicleId) : undefined}
          onPress={() => router.push({ pathname: '/viaje/[id]', params: { id: t.id } })}
          onLongPress={() => tripActions(t, reload)}
        />
      ))}

      <View style={{ marginTop: space.md }}>
        <GhostButton label={t.trips.settings} onPress={() => router.push('/viajes/ajustes')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
});
