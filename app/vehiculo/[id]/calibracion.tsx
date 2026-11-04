import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { usePermissionRequest } from '@/components/permissions/usePermissionRequest';
import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { vehicles as vehicleRepo } from '@/lib/db/repos';
import type { Vehicle } from '@/lib/db/types';
import { t } from '@/lib/i18n';
import { parseDecimal } from '@/lib/math';
import { useTheme } from '@/lib/theme/useTheme';
import { DEFAULT_CALIBRATION, factorInRange, proposeSpeedFactor, roundFactor, steadySample, type CarCalibration, type SpeedSample } from '@/lib/trips/calibration';
import { loadCalibration, saveCalibration } from '@/lib/trips/calibrationStore';
import { fixFromLocation } from '@/lib/trips/machine';
import { SpeedEngine } from '@/lib/trips/speed';
import { WEB_PRECISE_GPS } from '@/lib/trips/webGeo';

/**
 * Ficha → Calibración (SPEC-I §I2). "Calibrar velocidad": hold a steady speed, type what the dash says, the app averages the fused GPS speed
 * over the last ~10 steady seconds; after 3 samples it proposes the median factor. The saved trips keep GPS truth: "Mostrar velocidad" only
 * changes what the cluster shows. The explanation is in plain words because the dash over-reading is on purpose, not a bug.
 */
export default function CalibrationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const location = usePermissionRequest('location_foreground');
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [cal, setCal] = useState<CarCalibration>(DEFAULT_CALIBRATION);
  const [samples, setSamples] = useState<SpeedSample[]>([]);
  const [dash, setDash] = useState('');
  const [watching, setWatching] = useState(false);
  const [gps, setGps] = useState<number | null>(null);
  const [estimated, setEstimated] = useState(false);
  const [steady, setSteady] = useState<ReturnType<typeof steadySample>>({ ok: false, reason: 'short' });
  const [note, setNote] = useState<string | null>(null);
  const recent = useRef<{ t: number; kmh: number }[]>([]);
  const sub = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    void Promise.all([vehicleRepo.getById(id), loadCalibration(id)]).then(([v, c]) => {
      setVehicle(v);
      setCal(c);
    });
    return () => sub.current?.remove();
  }, [id]);

  async function start() {
    setNote(null);
    if (!(await location.ensure())) return;
    const Location = await import('expo-location');
    const engine = new SpeedEngine();
    recent.current = [];
    sub.current?.remove();
    sub.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0, ...WEB_PRECISE_GPS } as never, (loc) => {
      const s = engine.push(fixFromLocation(loc));
      if (!s || !s.known) return;
      const kmh = s.ms * 3.6;
      recent.current = [...recent.current.filter((p) => s.t - p.t <= 15_000), { t: s.t, kmh }];
      setGps(kmh);
      setEstimated(s.estimated);
      setSteady(steadySample(recent.current));
    });
    setWatching(true);
  }

  function stop() {
    sub.current?.remove();
    sub.current = null;
    setWatching(false);
  }

  const proposal = useMemo(() => proposeSpeedFactor(samples), [samples]);

  function takeSample() {
    const typed = parseDecimal(dash);
    if (!steady.ok || typed == null || !Number.isFinite(typed) || typed <= 0) return;
    setSamples((s) => [...s, { dashKmh: typed, gpsKmh: steady.gpsKmh }]);
    setDash('');
    setNote(null);
  }

  async function apply() {
    if (!proposal || !vehicle) return;
    if (!factorInRange(proposal.factor)) return setNote(t.calibration.outOfRange);
    const next = { ...cal, speedFactor: roundFactor(proposal.factor) };
    await saveCalibration(vehicle.id, next);
    setCal(next);
    setNote(t.calibration.applied);
  }

  async function setShow(dashMode: boolean) {
    if (!vehicle) return;
    const next: CarCalibration = { ...cal, show: dashMode ? 'dash' : 'gps' };
    await saveCalibration(vehicle.id, next);
    setCal(next);
  }

  async function reset() {
    if (!vehicle) return;
    await saveCalibration(vehicle.id, DEFAULT_CALIBRATION);
    setCal(DEFAULT_CALIBRATION);
    setSamples([]);
    setNote(t.calibration.reset);
  }

  const why = steady.ok ? null : steady.reason === 'slow' ? t.calibration.tooSlow : steady.reason === 'varying' ? t.calibration.changing : t.calibration.holdSteady;

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ headerShown: true, title: t.calibration.title }} />
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase' }}>
        {t.calibration.title}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20, marginBottom: space.md }}>
        {t.calibration.intro}
      </T>

      <Surface padded style={{ marginBottom: space.md }}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
              {t.calibration.showDash}
            </T>
            <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
              {cal.show === 'dash' ? t.calibration.showingDash(cal.speedFactor) : t.calibration.showingGps}
            </T>
          </View>
          <Switch value={cal.show === 'dash'} onValueChange={(v) => void setShow(v)} accessibilityLabel={t.calibration.showDash} disabled={!factorInRange(cal.speedFactor) || cal.speedFactor === 1} />
        </View>
        {cal.speedFactor === 1 ? (
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.xs }}>
            {t.calibration.needFirst}
          </T>
        ) : null}
      </Surface>

      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.sm }}>
        {t.calibration.speedTitle}
      </T>
      <Surface padded>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 19 }}>
          {t.calibration.howTo}
        </T>
        {watching ? (
          <View style={{ marginTop: space.sm, gap: space.xs }}>
            <T face="display" accessibilityLiveRegion="polite" style={{ color: theme.text.primary, fontSize: 40 }}>
              {gps == null ? '—' : String(Math.round(gps))}
              <T face="body" style={{ color: theme.text.muted, fontSize: 14 }}>
                {' km/h GPS'}
              </T>
            </T>
            {estimated ? (
              <T face="body" style={{ color: theme.statusText.proximo, fontSize: 12 }}>
                {t.calibration.estimatedWarning}
              </T>
            ) : null}
            <T face="body" accessibilityLiveRegion="polite" style={{ color: steady.ok ? theme.statusText.ok : theme.text.muted, fontSize: 13 }}>
              {steady.ok ? t.calibration.steadyNow : why}
            </T>
            <Field label={t.calibration.dashLabel} keyboardType="number-pad" value={dash} onChangeText={setDash} />
            <PrimaryButton label={t.calibration.takeSample} onPress={takeSample} disabled={!steady.ok || !dash.trim()} />
            <GhostButton label={t.calibration.stopWatching} onPress={stop} />
          </View>
        ) : (
          <PrimaryButton label={t.calibration.start} onPress={() => void start()} />
        )}
        {location.sheet}
      </Surface>

      {samples.length ? (
        <View style={{ marginTop: space.md }}>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.xs }}>
            {t.calibration.samples(samples.length)}
          </T>
          {samples.map((s, i) => (
            <T key={i} face="mono" style={{ color: theme.text.secondary, fontSize: 13 }}>
              {t.calibration.sampleLine(s.dashKmh, Math.round(s.gpsKmh * 10) / 10)}
            </T>
          ))}
        </View>
      ) : null}

      {proposal ? (
        <Surface padded style={{ marginTop: space.md }}>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 16 }}>
            {proposal.percent >= 0 ? t.calibration.dashHigher(Math.abs(proposal.percent).toFixed(1)) : t.calibration.dashLower(Math.abs(proposal.percent).toFixed(1))}
          </T>
          <T face="body" style={{ color: proposal.agrees ? theme.text.secondary : theme.statusText.proximo, fontSize: 13, marginTop: 2 }}>
            {proposal.agrees ? t.calibration.agree : t.calibration.disagree}
          </T>
          <PrimaryButton label={t.calibration.apply(roundFactor(proposal.factor))} onPress={() => void apply()} disabled={!factorInRange(proposal.factor)} />
        </Surface>
      ) : samples.length ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginTop: space.sm }}>
          {t.calibration.moreSamples(3 - samples.length)}
        </T>
      ) : null}

      {note ? (
        <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.accent, fontSize: 13, marginTop: space.sm }}>
          {note}
        </T>
      ) : null}
      {cal.speedFactor !== 1 || samples.length ? <GhostButton label={t.calibration.resetButton} onPress={() => void reset()} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
