import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton, StatusPill, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import {
  currentOdometer as currentOdometerQuery,
  expenses as expenseRepo,
  fuel as fuelRepo,
  serviceRecords as serviceRecordRepo,
  vehicleSpecs as specRepo,
  vehicles as vehicleRepo,
} from '@/lib/db/repos';
import type { Vehicle, VehicleSpec } from '@/lib/db/types';
import { money } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useMediaUri } from '@/lib/media/useMediaUri';
import { Alert } from '@/lib/alert';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The vehicle's own page: what it is, what it reads, what you keep forgetting
 * about it, and what it has cost.
 *
 * The specs list is free-form on purpose. Every car has a couple of numbers the
 * owner looks up at the worst possible moment — tyre pressure at the pump, oil
 * grade at the counter — and no fixed schema would cover a Corolla, a diesel
 * pickup and a motorcycle at once.
 */
export default function VehicleProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh, setActiveVehicle, activeVehicle, data } = useStore();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [specs, setSpecs] = useState<VehicleSpec[]>([]);
  const [odometerKm, setOdometerKm] = useState<number | null>(null);
  const [totals, setTotals] = useState({ spend: 0, fillups: 0, services: 0 });
  const [specName, setSpecName] = useState('');
  const [specValue, setSpecValue] = useState('');

  const photoUri = useMediaUri(vehicle?.photoMediaId);

  // Reloads on two triggers: `version`, bumped by this screen's own mutations,
  // and the store's `data`, which changes whenever anything else writes — which
  // is how coming back from the edit screen shows the new photo instead of the
  // copy this screen loaded when it first mounted.
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      const [v, s, km, fuels, services, expenses] = await Promise.all([
        vehicleRepo.getById(id),
        specRepo.listWhere({ vehicleId: id }, { orderBy: 'sort_order', direction: 'ASC' }),
        currentOdometerQuery(id),
        fuelRepo.list(id),
        serviceRecordRepo.list(id),
        expenseRepo.list(id),
      ]);
      if (cancelled) return;

      setVehicle(v);
      setSpecs(s);
      setOdometerKm(km);
      setTotals({
        spend:
          fuels.reduce((t, f) => t + f.totalDop, 0) +
          services.reduce((t, r) => t + r.totalDop, 0) +
          expenses.reduce((t, e) => t + e.amountDop, 0),
        fillups: fuels.length,
        services: services.length,
      });
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [id, version, data]);

  if (!vehicle) return null;

  const subtitle = [es.vehicleTypes[vehicle.type], vehicle.year, vehicle.make, vehicle.model]
    .filter(Boolean)
    .join(' · ');

  async function addSpec() {
    if (!specName.trim() || !specValue.trim() || !vehicle) return;
    await specRepo.upsert({
      vehicleId: vehicle.id,
      name: specName.trim(),
      value: specValue.trim(),
      sortOrder: specs.length,
    });
    setSpecName('');
    setSpecValue('');
    reload();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, styles.photoEmpty, { backgroundColor: theme.bg.raised }]}>
            <T face="body" style={{ color: theme.text.muted }}>
              {es.profile.noPhoto}
            </T>
          </View>
        )}

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <T face="display" style={[styles.name, { color: theme.text.primary }]}>
              {vehicle.name}
            </T>
            <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
              {subtitle}
            </T>
          </View>
          {vehicle.plate ? (
            <View style={[styles.plate, { borderColor: theme.line, backgroundColor: theme.bg.raised }]}>
              <T face="monoBold" style={{ color: theme.text.primary, fontSize: 13 }}>
                {vehicle.plate}
              </T>
            </View>
          ) : null}
        </View>

        {vehicle.isArchived ? (
          <View style={{ marginBottom: space.md }}>
            <StatusPill status="proximo" label={es.profile.archived} />
          </View>
        ) : null}

        <Surface style={{ marginBottom: space.md }}>
          <T face="medium" style={[styles.eyebrow, { color: theme.text.muted }]}>
            {es.profile.currentOdometer.toUpperCase()}
          </T>
          <T face="monoBold" style={{ color: theme.text.primary, fontSize: 30 }}>
            {odometerKm == null ? '—' : `${Math.round(odometerKm).toLocaleString('es-DO')} km`}
          </T>
          <GhostButton
            label={es.profile.addReading}
            onPress={() => {
              setActiveVehicle(vehicle.id);
              router.push('/odometro');
            }}
          />
        </Surface>

        <View style={styles.tiles}>
          <Tile label={es.profile.totalSpend} value={money(totals.spend)} />
          <Tile label={es.profile.kmLogged} value={odometerKm ? `${Math.round(odometerKm)}` : '—'} />
          <Tile label={es.profile.fillupCount} value={String(totals.fillups)} />
          <Tile label={es.profile.serviceCount} value={String(totals.services)} />
        </View>

        <T face="title" style={[styles.section, { color: theme.text.primary }]}>
          {es.profile.specs}
        </T>
        {specs.length === 0 ? (
          <T face="body" style={[styles.empty, { color: theme.text.muted }]}>
            {es.profile.specsEmpty}
          </T>
        ) : (
          specs.map((spec) => (
            <View key={spec.id} style={[styles.specRow, { borderColor: theme.line }]}>
              <T face="body" style={{ color: theme.text.secondary, flex: 1 }}>
                {spec.name}
              </T>
              <T face="mono" style={{ color: theme.text.primary }}>
                {spec.value}
              </T>
              <Pressable
                onPress={() => void specRepo.softDelete(spec.id).then(reload)}
                accessibilityLabel={`Quitar ${spec.name}`}
                style={styles.specRemove}>
                <T face="body" style={{ color: theme.text.muted }}>
                  ×
                </T>
              </Pressable>
            </View>
          ))
        )}

        <View style={styles.suggestions}>
          {es.specSuggestions.filter((s) => !specs.some((x) => x.name === s)).map((s) => (
            <Pressable
              key={s}
              onPress={() => setSpecName(s)}
              style={[styles.suggestion, { borderColor: theme.line, backgroundColor: theme.bg.raised }]}>
              <T face="body" style={{ color: theme.text.secondary, fontSize: 12 }}>
                {s}
              </T>
            </Pressable>
          ))}
        </View>

        <View style={styles.pair}>
          <View style={styles.half}>
            <Field label={es.profile.specName} value={specName} onChangeText={setSpecName} />
          </View>
          <View style={styles.half}>
            <Field label={es.profile.specValue} value={specValue} onChangeText={setSpecValue} />
          </View>
        </View>
        <GhostButton label={es.profile.addSpec} onPress={() => void addSpec()} />

        <View style={{ height: space.xl }} />
        <PrimaryButton
          label={es.profile.edit}
          onPress={() => router.push({ pathname: '/vehiculo/[id]/editar', params: { id: vehicle.id } })}
        />
        <GhostButton
          label={vehicle.isArchived ? es.profile.unarchive : es.profile.archive}
          onPress={() => {
            void (async () => {
              await vehicleRepo.upsert({ id: vehicle.id, isArchived: !vehicle.isArchived });
              await refresh();
              reload();
            })();
          }}
        />
        <T face="body" style={[styles.empty, { color: theme.text.muted }]}>
          {es.profile.archiveHint}
        </T>
        <GhostButton
          danger
          label={es.profile.remove}
          onPress={() =>
            Alert.alert(es.profile.removeConfirmTitle, es.profile.removeConfirmBody(vehicle.name), [
              { text: es.common.cancel, style: 'cancel' },
              {
                text: es.profile.remove,
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    await vehicleRepo.softDelete(vehicle.id);
                    await refresh();
                    router.back();
                  })();
                },
              },
            ])
          }
        />
        {activeVehicle?.id === vehicle.id ? null : (
          <GhostButton label="Hacer activo" onPress={() => setActiveVehicle(vehicle.id)} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.bg.surface, borderColor: theme.line }]}>
      <T face="monoBold" style={{ color: theme.text.primary, fontSize: 16 }}>
        {value}
      </T>
      <T face="body" style={{ color: theme.text.muted, fontSize: 11, marginTop: 2 }}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  photo: { width: '100%', height: 180, borderRadius: radius.card, marginBottom: space.lg },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.lg },
  name: { fontSize: 26 },
  plate: { borderWidth: 1, borderRadius: 8, paddingHorizontal: space.sm, paddingVertical: 4 },
  eyebrow: { fontSize: 11, letterSpacing: 0.9, marginBottom: 4 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: radius.input,
    padding: space.md,
  },
  section: { fontSize: 20, marginTop: space.md, marginBottom: space.sm },
  empty: { fontSize: 12, lineHeight: 18, marginBottom: space.md },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderBottomWidth: 1,
  },
  specRemove: { paddingHorizontal: space.sm, minWidth: 32, alignItems: 'center' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: space.md },
  suggestion: { borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.sm, paddingVertical: 4 },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
});
