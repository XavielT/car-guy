import { T } from '@/components/T';
import { Chip } from '@/components/ui';
import { colors } from '@/constants/theme';
import { FUEL_CATALOG, FUEL_ORDER } from '@/lib/fuel';
import { dateLabel, km, money, volume } from '@/lib/format';
import { economyById } from '@/lib/math';
import { useStore } from '@/lib/store';
import type { FuelType } from '@/lib/types';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HistorialScreen() {
  const router = useRouter();
  const { vehicleFillups, activeVehicle } = useStore();
  const [filter, setFilter] = useState<FuelType | 'all'>('all');
  const eco = useMemo(() => economyById(vehicleFillups), [vehicleFillups]);
  const rows = [...vehicleFillups]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .filter((f) => (filter === 'all' ? true : f.fuelType === filter));

  if (!activeVehicle) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={styles.h}>
          Historial
        </T>
        <T face="body" style={styles.sub}>
          {activeVehicle.name}
          {activeVehicle.plate ? ` · ${activeVehicle.plate}` : ''}
        </T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <Chip label="Todas" selected={filter === 'all'} onPress={() => setFilter('all')} />
          {FUEL_ORDER.map((t) => (
            <Chip
              key={t}
              label={FUEL_CATALOG[t].shortLabel}
              selected={filter === t}
              onPress={() => setFilter(t)}
            />
          ))}
        </ScrollView>

        {rows.length === 0 ? (
          <T face="body" style={styles.empty}>
            No hay cargas todavía. La primera llena el tanque y deja el punto de partida.
          </T>
        ) : (
          rows.map((f) => {
            const point = eco.get(f.id);
            return (
              <Pressable
                key={f.id}
                onPress={() => router.push(`/carga/${f.id}`)}
                style={styles.row}>
                <View style={{ flex: 1 }}>
                  <T face="semibold" style={styles.title}>
                    {FUEL_CATALOG[f.fuelType].label}
                    {f.isFullTank ? '' : ' · parcial'}
                  </T>
                  <T face="body" style={styles.meta}>
                    {dateLabel(f.occurredAt)} · {km(f.odometerKm)}
                    {f.station ? ` · ${f.station}` : ''}
                  </T>
                  {point ? (
                    <T face="mono" style={styles.eco}>
                      {point.kmPerUnit} {FUEL_CATALOG[f.fuelType].unit === 'm3' ? 'km/m³' : 'km/gal'}
                    </T>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T face="monoBold" style={styles.pay}>
                    {money(f.totalDop)}
                  </T>
                  <T face="body" style={styles.meta}>
                    {volume(f.volume, f.fuelType)}
                  </T>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.receipt },
  pad: { padding: 20, paddingBottom: 40 },
  h: { fontSize: 36, color: colors.ink },
  sub: { color: colors.muted, marginBottom: 14, marginTop: 4 },
  empty: { color: colors.muted, marginTop: 24, lineHeight: 22 },
  row: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: { color: colors.ink, fontSize: 16 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  eco: { color: colors.teal, marginTop: 6, fontSize: 12 },
  pay: { color: colors.ink, fontSize: 15 },
});
