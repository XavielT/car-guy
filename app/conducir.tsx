import Ionicons from '@expo/vector-icons/Ionicons';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CompactSpeed } from '@/components/drive/CompactSpeed';
import { LiveMap, type RoutePoint } from '@/components/map';
import { T } from '@/components/T';
import { listDoneTrips, useAutoReadiness } from '@/components/trips/TripPieces';
import { Segmented } from '@/components/ui';
import { Skeleton } from '@/components/ui/Skeleton';
import { palette, radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { trips as tripRepo } from '@/lib/db/tripOps';
import type { Trip } from '@/lib/db/types';
import { dateLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { armAuto } from '@/lib/trips/auto';
import { appendTrail, trailSince } from '@/lib/trips/driveTrail';
import { startManualTrip, stopTrip } from '@/lib/trips/live';
import { getLiveTrip, gpsNow, setLiveTrip, useLiveTrip } from '@/lib/trips/liveStore';
import { setTripsMode, tripsMode, type TripsMode } from '@/lib/trips/settings';

/** Always dark: a map at night, whatever the app theme (ModoConducir mockup). */
const ink = palette.dark;
const MAP_BG = '#0B0F14';
/** Web has no background location: Automático is native only (same as Viajes → Ajustes). */
const MODES: TripsMode[] = Platform.OS === 'web' ? ['manual', 'off'] : ['auto', 'manual', 'off'];
/** The trail re-reads the open trip's new points this often (the recorder flushes every ~5 s). */
const TRAIL_POLL_MS = 2000;
const NO_TRAIL: RoutePoint[] = [];

/**
 * Modo conducir (IMP 30092026 Phase 4, ADR-43, 03-screens.md): the live map
 * full-bleed, the speed over a top scrim, and a bottom sheet with the vehicle,
 * the mode, INICIAR / TERMINAR and PASAJERO. Keeps the screen on and allows
 * landscape — both only while this screen is focused. Back closes it; a trip
 * keeps recording (the recorder lives in lib/trips/live.ts, not here).
 *
 * Wheelz's live view (05-wheelz-firsthand.md) decided the small things: the map
 * is the screen and the controls sit in one sheet at the bottom; the stop button
 * is the sheet's full-width primary action, never a small corner icon.
 */
export default function ConducirScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const focused = useIsFocused();
  const { activeVehicle, data, setActiveVehicle } = useStore();
  const live = useLiveTrip();
  const auto = useAutoReadiness();

  const [mode, setMode] = useState<TripsMode | null>(null);
  const [passenger, setPassenger] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mapOff, setMapOff] = useState(false);
  // The sheet's measured height: the map keeps its attribution, re-centre button and camera centre above it.
  const [sheetH, setSheetH] = useState(0);
  // Keyed by what they belong to, so a vehicle or trip change reads as "not loaded" without a reset.
  const [lastTripOf, setLastTripOf] = useState<{ vehicleId: string; trip: Trip | null } | null>(null);
  const [trailOf, setTrailOf] = useState<{ tripId: string; points: RoutePoint[] } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void tripsMode().then(setMode);
  }, []);

  // Orientation: unlocked on this screen only; back to portrait when it loses focus (app.json is portrait).
  useFocusEffect(
    useCallback(() => {
      const so = screenOrientation();
      if (!so) return;
      void so.unlockAsync().catch(() => {});
      return () => void so.lockAsync(so.OrientationLock.PORTRAIT_UP).catch(() => {});
    }, []),
  );

  // The live trip's vehicle and role drive the chips while recording.
  const tripVehicle = live ? data.vehicles.find((v) => v.id === live.vehicleId) ?? activeVehicle : activeVehicle;
  const shownPassenger = live ? live.role === 'pasajero' : passenger;

  // The last trip's mini card (no trip recording), for the vehicle shown.
  const vehicleId = tripVehicle?.id;
  useEffect(() => {
    if (live || !vehicleId) return;
    let cancelled = false;
    void listDoneTrips(vehicleId)
      .then((list) => !cancelled && setLastTripOf({ vehicleId, trip: list[0] ?? null }))
      .catch(() => !cancelled && setLastTripOf({ vehicleId, trip: null }));
    return () => {
      cancelled = true;
    };
  }, [live, vehicleId]);
  const lastTrip: Trip | null | undefined = lastTripOf && lastTripOf.vehicleId === vehicleId ? lastTripOf.trip : undefined;

  // The growing trail: the open trip's points, read incrementally while focused.
  const tripId = live?.tripId ?? null;
  const lastT = useRef<{ tripId: string | null; t: number }>({ tripId: null, t: -1 });
  useEffect(() => {
    if (!tripId || !focused) return;
    if (lastT.current.tripId !== tripId) lastT.current = { tripId, t: -1 };
    let cancelled = false;
    const poll = () =>
      void trailSince(tripId, lastT.current.t)
        .then((next) => {
          if (cancelled || !next.length) return;
          lastT.current = { tripId, t: next[next.length - 1].t ?? lastT.current.t };
          setTrailOf((prev) => ({ tripId, points: appendTrail(prev?.tripId === tripId ? prev.points : [], next) }));
        })
        .catch(() => {});
    poll();
    const id = setInterval(poll, TRAIL_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tripId, focused]);
  const trail = trailOf && trailOf.tripId === tripId ? trailOf.points : NO_TRAIL;

  // The sheet's clock (tiempo, GPS going stale) — only while recording.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live]);

  const notify = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 4000);
  };

  const begin = async () => {
    if (!tripVehicle) return;
    setBusy(true);
    const result = await startManualTrip(tripVehicle.id, passenger ? 'pasajero' : 'conductor');
    setBusy(false);
    if (result.ok) return;
    if (result.reason === 'permission') {
      Alert.alert(t.trips.title, t.trips.permissionDenied, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.trips.openSettings, onPress: () => void Linking.openSettings() },
      ]);
    } else if (result.reason !== 'busy') notify(t.trips.needPermission);
  };

  const finish = async () => {
    setBusy(true);
    const result = await stopTrip();
    setBusy(false);
    if (result.kind === 'discarded') {
      notify(
        result.reason === 'duration'
          ? t.trips.discardedBrief(Math.max(1, Math.round(result.durationS / 60)))
          : t.trips.discardedShort(Math.round(result.distanceM)),
      );
    } else if (result.kind === 'saved') notify(t.trips.saved((result.distanceM / 1000).toFixed(1)));
  };

  // PASAJERO: before the start it is the new trip's role; during one it changes the open trip's
  // row (finalize reads it, so a passenger trip never moves the odometer — ADR-30) and the cluster.
  const togglePassenger = async () => {
    const current = getLiveTrip();
    if (!current) {
      setPassenger((p) => !p);
      return;
    }
    const role = current.role === 'pasajero' ? 'conductor' : 'pasajero';
    await tripRepo.upsert({ id: current.tripId, role });
    const after = getLiveTrip();
    if (after && after.tripId === current.tripId) setLiveTrip({ ...after, role });
  };

  // The vehicle chip cycles the garage's cars while nothing records.
  const drivable = data.vehicles.filter((v) => !v.isArchived);
  const cycleVehicle = () => {
    if (live || drivable.length < 2 || !tripVehicle) return;
    const i = drivable.findIndex((v) => v.id === tripVehicle.id);
    setActiveVehicle(drivable[(i + 1) % drivable.length].id);
  };

  // The mode switch, as in Viajes → Ajustes: never mid-trip; Automático needs its permissions first.
  const shownMode: TripsMode = mode && MODES.includes(mode) ? mode : 'manual';
  const chooseMode = (m: TripsMode) => {
    if (m === shownMode || live) return;
    if (m === 'auto' && auto.state !== 'ready') {
      router.push('/viajes/permisos');
      return;
    }
    setMode(m);
    void setTripsMode(m).then(() => armAuto());
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const gps = live ? gpsNow(live, now) : 'none';
  const gpsColor = gps === 'good' ? ink.statusText.ok : gps === 'weak' ? ink.statusText.proximo : ink.text.disabled;
  const elapsedS = live ? Math.max(0, Math.round((now - live.startedAt) / 1000)) : 0;
  const avgKmh = live && live.movingS > 0 ? live.distanceM / 1000 / (live.movingS / 3600) : 0;
  const native = Platform.OS !== 'web';

  const sheet = (
    <ScrollView
      onLayout={(e) => setSheetH(e.nativeEvent.layout.height)}
      style={[
        styles.sheet,
        landscape
          ? { top: insets.top + space.md, right: insets.right + space.md, bottom: insets.bottom + space.md, width: 380, borderRadius: 22 }
          : { left: 0, right: 0, bottom: 0, maxHeight: height * 0.62, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
        { backgroundColor: ink.bg.surface, borderColor: ink.lineStrong },
      ]}
      contentContainerStyle={{ padding: space.lg, paddingBottom: (landscape ? 0 : insets.bottom) + space.lg, gap: space.md }}>
      {!landscape ? <View style={[styles.grabber, { backgroundColor: ink.lineStrong }]} /> : null}

      <View style={styles.chips}>
        <Chip
          label={`${(tripVehicle?.name ?? '—').toUpperCase()}${!live && drivable.length > 1 ? ' ▾' : ''}`}
          a11y={t.drive.vehicleChip(tripVehicle?.name ?? '—')}
          onPress={!live && drivable.length > 1 ? cycleVehicle : undefined}
        />
        <Chip label={t.trips.modes[shownMode].toUpperCase()} a11y={t.drive.modeChip(t.trips.modes[shownMode])} />
        <Chip
          label={t.drive.passenger}
          a11y={t.drive.passengerA11y(shownPassenger)}
          color={shownPassenger ? ink.accent : ink.text.disabled}
          selected={shownPassenger}
          onPress={() => void togglePassenger()}
        />
        {native && focused ? (
          <Chip label={`☀ ${t.drive.keepAwake}`} a11y={t.drive.keepAwake} color={ink.accent} />
        ) : null}
      </View>

      {live ? (
        <View style={styles.stats}>
          <Stat value={(live.distanceM / 1000).toFixed(1)} label={t.drive.km} />
          <Stat value={clock(elapsedS)} label={t.drive.time} />
          <Stat value={String(Math.round(avgKmh))} label={t.drive.avg} />
          <Stat value={String(Math.round(live.maxKmh))} label={t.drive.max} color={ink.accent} />
        </View>
      ) : (
        <>
          {lastTrip === undefined ? (
            <Skeleton padded={false} style={{ flex: 0, backgroundColor: 'transparent' }}>
              <Skeleton.Rect h={64} />
            </Skeleton>
          ) : (
            <Pressable
              onPress={() => (lastTrip ? router.push({ pathname: '/viaje/[id]', params: { id: lastTrip.id } }) : undefined)}
              disabled={!lastTrip}
              accessibilityRole={lastTrip ? 'button' : undefined}
              style={[styles.lastCard, { backgroundColor: ink.bg.raised, borderColor: ink.lineStrong }]}>
              {lastTrip ? (
                <>
                  <T face="title" style={{ color: ink.text.primary, fontSize: 16, letterSpacing: 0.6 }}>
                    {t.drive.lastTrip((lastTrip.distanceM / 1000).toFixed(1), Math.round(lastTrip.maxKmh ?? 0))}
                  </T>
                  <T face="body" style={{ color: ink.text.muted, fontSize: 12 }}>
                    {t.drive.lastTripWhen(dateLabel(lastTrip.startedAt), Math.max(1, Math.round(lastTrip.durationS / 60)))}
                  </T>
                </>
              ) : (
                <T face="body" style={{ color: ink.text.secondary, fontSize: 13 }}>
                  {t.drive.noTrips}
                </T>
              )}
            </Pressable>
          )}
          <Pressable onPress={() => router.push('/viajes')} accessibilityRole="button" style={styles.link}>
            <T face="title" style={{ color: ink.accent, fontSize: 13, letterSpacing: 1 }}>
              {t.drive.seeTrips.toUpperCase()} →
            </T>
          </Pressable>
          {mode ? (
            <Segmented<TripsMode>
              options={MODES.map((key) => ({ key, label: t.trips.modes[key] }))}
              value={shownMode}
              onChange={chooseMode}
            />
          ) : null}
          {!native ? (
            <T face="body" style={{ color: ink.text.muted, fontSize: 12 }}>
              {t.drive.webManual}
            </T>
          ) : null}
          {shownMode === 'off' ? (
            <T face="body" style={{ color: ink.statusText.proximo, fontSize: 12 }}>
              {t.drive.tripsOff}
            </T>
          ) : null}
        </>
      )}

      {notice ? (
        <T face="body" accessibilityRole="alert" style={{ color: ink.text.secondary, fontSize: 13 }}>
          {notice}
        </T>
      ) : null}

      {live ? (
        <Pressable
          onPress={() => void finish()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t.drive.stop}
          style={({ pressed }) => [styles.primary, { backgroundColor: ink.redline, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}>
          <T face="display" style={styles.primaryLabel}>
            {t.drive.stop}
          </T>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => void begin()}
          disabled={busy || shownMode === 'off' || !tripVehicle}
          accessibilityRole="button"
          accessibilityLabel={t.drive.start}
          accessibilityState={{ disabled: busy || shownMode === 'off' }}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: ink.accent, opacity: busy || shownMode === 'off' ? 0.45 : pressed ? 0.85 : 1 },
          ]}>
          <T face="display" style={[styles.primaryLabel, { color: '#121212' }]}>
            {t.drive.start}
          </T>
        </Pressable>
      )}

      <T face="body" style={{ color: ink.text.disabled, fontSize: 11, textAlign: 'center' }}>
        {t.drive.disclaimer}
      </T>
    </ScrollView>
  );

  return (
    <View style={[styles.screen, { backgroundColor: MAP_BG }]}>
      {native && focused ? <KeepScreenOn /> : null}

      <View style={StyleSheet.absoluteFill}>
        <LiveMap trail={trail} follow insets={{ top: insets.top + 120, bottom: landscape ? 0 : sheetH }} onUnavailable={() => setMapOff(true)} />
      </View>

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(11,15,20,0.96)', 'rgba(11,15,20,0.7)', 'rgba(11,15,20,0)']}
        locations={[0, 0.6, 1]}
        style={[styles.scrim, { height: insets.top + 190 }]}
      />

      <View
        style={[styles.top, { top: insets.top + space.lg, left: insets.left + space.xl, right: (landscape ? 380 + space.md : 0) + insets.right + space.xl }]}
        pointerEvents="box-none">
        <CompactSpeed />
        <View style={styles.topRight}>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={t.drive.close}
            accessibilityHint={live ? t.drive.closeHint : undefined}
            hitSlop={8}
            style={[styles.closeBtn, { borderColor: ink.lineStrong }]}>
            <Ionicons name="close" size={20} color={ink.text.primary} />
          </Pressable>
          {live ? (
            <View style={styles.lamps}>
              <Lamp label="GPS" color={gpsColor} a11y={t.trips.gps[gps]} />
              <Lamp label="● REC" color={ink.redlineText} a11y={t.trips.recording} />
            </View>
          ) : null}
        </View>
      </View>

      {mapOff ? (
        <View style={[styles.mapOff, { top: insets.top + 170, borderColor: ink.lineStrong }]}>
          <T face="body" style={{ color: ink.text.secondary, fontSize: 12 }}>
            {t.drive.mapOff}
          </T>
        </View>
      ) : null}

      {sheet}
    </View>
  );
}

function Chip({
  label,
  a11y,
  color = ink.text.secondary,
  selected,
  onPress,
}: {
  label: string;
  a11y: string;
  color?: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <T face="title" numberOfLines={1} style={{ color, fontSize: 11, letterSpacing: 0.9 }}>
      {label}
    </T>
  );
  const style = [styles.chip, { backgroundColor: ink.bg.raised, borderColor: selected ? ink.accent : ink.lineStrong }];
  if (!onPress) {
    return (
      <View style={style} accessible accessibilityLabel={a11y}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={selected != null ? 'switch' : 'button'}
      accessibilityState={selected != null ? { checked: selected } : undefined}
      accessibilityLabel={a11y}
      hitSlop={6}
      style={({ pressed }) => [style, pressed && { opacity: 0.85 }]}>
      {body}
    </Pressable>
  );
}

function Stat({ value, label, color = ink.text.primary }: { value: string; label: string; color?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${label} ${value}`}>
      <T face="monoBold" style={{ color, fontSize: 16 }}>
        {value}
      </T>
      <T face="body" style={{ color: ink.text.muted, fontSize: 11 }}>
        {label}
      </T>
    </View>
  );
}

function Lamp({ label, color, a11y }: { label: string; color: string; a11y: string }) {
  return (
    <View style={[styles.lamp, { borderColor: ink.lineStrong }]} accessible accessibilityLabel={a11y}>
      <T face="eyebrow" style={{ color, fontSize: 10, letterSpacing: 1.2 }}>
        {label}
      </T>
    </View>
  );
}

/** mm:ss, or h:mm:ss past the hour. */
function clock(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

/** expo-keep-awake's hook: mounted only while this screen is focused (native). */
function KeepScreenOn() {
  useKeepAwake('car-guy-drive');
  return null;
}

type ScreenOrientationModule = typeof import('expo-screen-orientation');
let orientationModule: ScreenOrientationModule | null | undefined;
/** expo-screen-orientation, or null on web / a build without the native module (never throws). */
function screenOrientation(): ScreenOrientationModule | null {
  if (Platform.OS === 'web') return null;
  if (orientationModule !== undefined) return orientationModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    orientationModule = require('expo-screen-orientation') as ScreenOrientationModule;
  } catch {
    orientationModule = null;
  }
  return orientationModule;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0 },
  top: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  topRight: { alignItems: 'flex-end', gap: 6 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(27,27,27,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lamps: { flexDirection: 'row', gap: 6 },
  lamp: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(27,27,27,0.9)' },
  mapOff: {
    position: 'absolute',
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: radius.tag,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    backgroundColor: 'rgba(11,15,20,0.85)',
  },
  sheet: { position: 'absolute', borderWidth: 1, flexGrow: 0 },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, minHeight: 30, justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: 8 },
  lastCard: { borderWidth: 1, borderRadius: radius.card, padding: space.md, gap: 2 },
  link: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  primary: { borderRadius: 12, minHeight: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  primaryLabel: { color: '#FFFFFF', fontSize: 18, letterSpacing: 2 },
});
