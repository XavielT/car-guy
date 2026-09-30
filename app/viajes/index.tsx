import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { listDoneTrips, TripRow, TripsStrip, tripActions } from '@/components/trips/TripPieces';
import { Chip, EmptyState, GhostButton, Segmented } from '@/components/ui';
import { space } from '@/constants/theme';
import type { Trip } from '@/lib/db/types';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import { filterTrips, monthSummary, type TripFilter } from '@/lib/trips/present';

const FILTERS: TripFilter[] = ['todos', 'mes', 'largos', 'rapidos'];

/**
 * Viajes (03-screens.md "Phase 5"): the done trips of the active vehicle (or of
 * every vehicle), the month strip, filters. Tap opens the trip; long-press
 * offers conductor/pasajero and eliminar.
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
  const shown = list ? filterTrips(list, filter) : [];
  const reload = () => setVersion((v) => v + 1);

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {es.trips.eyebrow}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 30, textTransform: 'uppercase', marginBottom: space.md }}>
        {es.trips.title}
      </T>

      {vehicles.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
          <Chip label={es.trips.allVehicles} selected={!scope} onPress={() => setScope('')} />
          {vehicles.map((v) => (
            <Chip key={v.id} label={v.name} selected={scope === v.id} onPress={() => setScope(v.id)} />
          ))}
        </ScrollView>
      ) : null}

      {list ? <TripsStrip summary={monthSummary(list)} /> : null}

      <Segmented<TripFilter> options={FILTERS.map((key) => ({ key, label: es.trips.filters[key] }))} value={filter} onChange={setFilter} style={{ marginBottom: space.md }} />

      {list && !list.length ? (
        <EmptyState icon="navigate-outline" message={es.trips.empty} actionLabel={es.trips.start} onAction={() => router.push('/(tabs)')} />
      ) : null}
      {list && list.length && !shown.length ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginBottom: space.md }}>
          {es.trips.emptyFiltered}
        </T>
      ) : null}

      {shown.map((t) => (
        <TripRow
          key={t.id}
          trip={t}
          vehicleName={!scope && vehicles.length > 1 ? nameOf(t.vehicleId) : undefined}
          onPress={() => router.push({ pathname: '/viaje/[id]', params: { id: t.id } })}
          onLongPress={() => tripActions(t, reload)}
        />
      ))}

      <View style={{ marginTop: space.md }}>
        <GhostButton label={es.trips.settings} onPress={() => router.push('/viajes/ajustes')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
});
