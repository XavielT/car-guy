import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { MiuiChecklist, useAutoReadiness, useLocationPermission } from '@/components/trips/TripPieces';
import { GhostButton, Segmented, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { vehicles as vehicleRepo } from '@/lib/db/repos';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import { armAuto } from '@/lib/trips/auto';
import { DEFAULT_TRIP_CFG } from '@/lib/trips/machine';
import { useLiveTrip } from '@/lib/trips/liveStore';
import {
  setTripsKeepAwake,
  setTripsMap,
  setTripsMode,
  setTripsThresholds,
  tripsKeepAwake,
  tripsMap,
  tripsMode,
  tripsThresholds,
  type TripsMode,
} from '@/lib/trips/settings';

/** Web has no background location: Automático is native only. */
const MODES: TripsMode[] = Platform.OS === 'web' ? ['manual', 'off'] : ['auto', 'manual', 'off'];

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
  const [map, setMap] = useState(true);
  const perm = useLocationPermission();
  const auto = useAutoReadiness();
  const live = useLiveTrip();
  const [busyNote, setBusyNote] = useState(false);

  const chooseMode = (m: TripsMode) => {
    if (m === shownMode) return;
    // Changing how trips are recorded in the middle of one would cut it.
    if (live) {
      setBusyNote(true);
      return;
    }
    setBusyNote(false);
    if (m === 'auto' && auto.state !== 'ready') {
      router.push('/viajes/permisos');
      return;
    }
    setMode(m);
    void setTripsMode(m).then(() => armAuto());
  };

  useEffect(() => {
    void tripsMode().then(setMode);
    void tripsKeepAwake().then(setAwake);
    void tripsMap().then(setMap);
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
          onChange={chooseMode}
        />
      ) : null}
      <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: space.sm }}>
        {es.trips.modeHint[shownMode]}
      </T>
      {busyNote ? (
        <T face="body" style={{ color: theme.statusText.proximo, fontSize: 13, marginTop: 2 }}>
          {es.trips.autoBusy}
        </T>
      ) : null}
      {shownMode === 'auto' && auto.state ? (
        <T face="semibold" style={{ color: auto.state === 'ready' ? theme.statusText.ok : theme.statusText.proximo, fontSize: 13, marginTop: 2 }}>
          {es.trips.readiness[auto.state]}
        </T>
      ) : null}
      {shownMode === 'auto' ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17, marginTop: space.sm }}>
          {es.trips.battery}
        </T>
      ) : null}
      {shownMode === 'auto' ? <MiuiChecklist /> : null}

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

      {eyebrow(es.trips.mapSetting)}
      <Surface padded>
        <View style={styles.rowBetween}>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 14, flex: 1 }}>
            {es.trips.mapSettingHint}
          </T>
          <Switch
            value={map}
            onValueChange={(v) => {
              setMap(v);
              void setTripsMap(v);
            }}
            accessibilityLabel={es.trips.mapSetting}
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

      {Platform.OS !== 'web' ? <AdvancedThresholds eyebrow={eyebrow} /> : null}

      <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.lg }}>
        {es.trips.pointsInfo}
      </T>
    </ScrollView>
  );
}

type ThresholdKey = keyof typeof es.trips.thresholds;

/** The field's value ↔ the machine's cfg key (km/h is stored as m/s). */
const THRESHOLD_CFG: Record<ThresholdKey, { key: keyof typeof DEFAULT_TRIP_CFG; toCfg: (n: number) => number; fromCfg: (n: number) => number }> = {
  startKmh: { key: 'startSpeedMs', toCfg: (n) => n / 3.6, fromCfg: (n) => Math.round(n * 3.6) },
  startSamples: { key: 'startSamples', toCfg: (n) => n, fromCfg: (n) => n },
  stopMinutes: { key: 'stopMinutes', toCfg: (n) => n, fromCfg: (n) => n },
  minDistanceM: { key: 'minDistanceM', toCfg: (n) => n, fromCfg: (n) => n },
  mergeMinutes: { key: 'mergeMinutes', toCfg: (n) => n, fromCfg: (n) => n },
};

/**
 * ADR-28's constants, tunable on the road (trips_thresholds). Collapsed by
 * default; an empty field means the default. The task reads them on every batch.
 */
function AdvancedThresholds({ eyebrow }: { eyebrow: (label: string) => React.ReactNode }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [stored, setStored] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (open && !stored) void tripsThresholds().then(setStored);
  }, [open, stored]);

  const save = (k: ThresholdKey, text: string) => {
    const map = THRESHOLD_CFG[k];
    const next = { ...(stored ?? {}) };
    const n = Number(text.replace(',', '.'));
    if (!text.trim() || !Number.isFinite(n) || n <= 0) delete next[map.key];
    else next[map.key] = map.toCfg(n);
    setStored(next);
    void setTripsThresholds(next);
  };

  return (
    <>
      {eyebrow(es.trips.advanced)}
      <GhostButton label={open ? es.common.close : es.trips.advanced} onPress={() => setOpen((o) => !o)} />
      {open && stored ? (
        <View>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: space.sm }}>
            {es.trips.advancedHint}
          </T>
          {(Object.keys(THRESHOLD_CFG) as ThresholdKey[]).map((k) => {
            const map = THRESHOLD_CFG[k];
            const v = stored[map.key];
            return (
              <ThresholdField
                key={`${k}:${v ?? ''}`}
                label={es.trips.thresholds[k].label}
                placeholder={String(es.trips.thresholds[k].def)}
                value={v != null ? String(map.fromCfg(v)) : ''}
                onCommit={(text) => save(k, text)}
              />
            );
          })}
          <GhostButton
            label={es.trips.advancedReset}
            onPress={() => {
              setStored({});
              void setTripsThresholds({});
            }}
          />
        </View>
      ) : null}
    </>
  );
}

function ThresholdField({ label, placeholder, value, onCommit }: { label: string; placeholder: string; value: string; onCommit: (text: string) => void }) {
  const [text, setText] = useState(value);
  return (
    <Field
      label={label}
      keyboardType="number-pad"
      placeholder={placeholder}
      value={text}
      onChangeText={setText}
      onBlur={() => text !== value && onCommit(text)}
      maxLength={4}
    />
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
