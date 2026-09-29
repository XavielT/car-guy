import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { useLocationPermission } from '@/components/trips/TripPieces';
import { GhostButton, Segmented, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { vehicles as vehicleRepo } from '@/lib/db/repos';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import { setTripsKeepAwake, setTripsMode, tripsKeepAwake, tripsMode, type TripsMode } from '@/lib/trips/settings';

/**
 * Modes offered by this build. Part B adds 'auto' at the front of this list
 * (and its permission card in permisos.tsx); nothing else here changes.
 */
const MODES: TripsMode[] = ['manual', 'off'];

/**
 * Ajustes → Viajes (03-screens.md "Phase 5"): how trips are recorded, keep the
 * screen on, the redline per vehicle, the location permission.
 */
export default function TripSettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { data } = useStore();
  const [mode, setMode] = useState<TripsMode | null>(null);
  const [awake, setAwake] = useState(true);
  const perm = useLocationPermission();

  useEffect(() => {
    void tripsMode().then(setMode);
    void tripsKeepAwake().then(setAwake);
  }, []);

  const vehicles = data.vehicles.filter((v) => !v.isArchived && v.detail);
  // A mode this build does not offer yet (auto stored by a later build) shows as manual.
  const shownMode: TripsMode = mode && MODES.includes(mode) ? mode : 'manual';

  const eyebrow = (label: string) => (
    <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.lg, marginBottom: space.sm }}>
      {label.toUpperCase()}
    </T>
  );

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {es.trips.eyebrow}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase' }}>
        {es.trips.settingsTitle}
      </T>

      {eyebrow(es.trips.mode)}
      {mode ? (
        <Segmented<TripsMode>
          options={MODES.map((key) => ({ key, label: es.trips.modes[key] }))}
          value={shownMode}
          onChange={(m) => {
            setMode(m);
            void setTripsMode(m);
          }}
        />
      ) : null}
      <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: space.sm }}>
        {es.trips.modeHint[shownMode]}
      </T>
      <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
        {es.trips.autoSoon}
      </T>

      {eyebrow(es.trips.permission)}
      <Surface padded>
        <View style={styles.rowBetween}>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
            {es.trips.permissionState[perm.state]}
          </T>
          <View style={[styles.dot, { backgroundColor: perm.state === 'granted' ? theme.status.ok : perm.state === 'denied' ? theme.status.vencido : theme.status.proximo }]} />
        </View>
        {perm.state !== 'granted' ? (
          <GhostButton label={perm.state === 'denied' && !perm.canAsk ? es.trips.openSettings : es.trips.permissionFix} onPress={() => void perm.ask()} />
        ) : null}
        <GhostButton label={es.trips.permissionMore} onPress={() => router.push('/viajes/permisos')} />
      </Surface>

      {eyebrow(es.trips.keepAwake)}
      <Surface padded>
        <View style={styles.rowBetween}>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 14, flex: 1 }}>
            {es.trips.keepAwakeHint}
          </T>
          <Switch
            value={awake}
            onValueChange={(v) => {
              setAwake(v);
              void setTripsKeepAwake(v);
            }}
            accessibilityLabel={es.trips.keepAwake}
            trackColor={{ true: theme.accentFill, false: theme.lineStrong }}
          />
        </View>
      </Surface>

      {vehicles.length ? (
        <>
          {eyebrow(es.trips.redline)}
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: space.sm }}>
            {es.trips.redlineHint}
          </T>
          {vehicles.map((v) => (
            <RedlineField key={`${v.id}:${v.detail!.limitKmh}`} vehicleId={v.id} name={v.name} value={v.detail!.limitKmh} />
          ))}
        </>
      ) : null}

      <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.lg }}>
        {es.trips.pointsInfo}
      </T>
    </ScrollView>
  );
}

/** One vehicle's redline, saved when the field loses focus (40–300 km/h). */
function RedlineField({ vehicleId, name, value }: { vehicleId: string; name: string; value: number }) {
  const [text, setText] = useState(String(value ?? ''));
  const commit = () => {
    const n = Math.round(Number(text.replace(',', '.')));
    if (!Number.isFinite(n) || n < 40 || n > 300) {
      setText(String(value ?? ''));
      return;
    }
    if (n !== value) void vehicleRepo.upsert({ id: vehicleId, limitKmh: n });
  };
  return <Field label={es.trips.redlineField(name)} keyboardType="number-pad" value={text} onChangeText={setText} onBlur={commit} maxLength={3} />;
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
