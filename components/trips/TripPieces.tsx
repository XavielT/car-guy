import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Location from 'expo-location';
import { AppState, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { T } from '@/components/T';
import { Badge, GhostButton, SectionHeader, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { odometer as odometerRepo } from '@/lib/db/repos';
import { trips as tripRepo } from '@/lib/db/tripOps';
import type { Trip, TripRole } from '@/lib/db/types';
import { Alert } from '@/lib/alert';
import { localeTag, t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import { autoReadiness, type AutoReadiness } from '@/lib/trips/auto';
import { getAutostartState, getBatteryState, openAutostartSettings, openBatterySettings, type AutostartState, type BatteryState } from '@/modules/miui-autostart';
import { agoShort, autoBlocker, lastFixTime } from '@/lib/trips/autoStatus';
import { machineState } from '@/lib/trips/engine';
import { tripsMode, type TripsMode } from '@/lib/trips/settings';
import type { Fix, LatLng } from '@/lib/trips/geo';
import { fitTiles, OSM_COPYRIGHT_URL, TILE_SIZE } from '@/lib/trips/tiles';
import {
  BUCKET_COLORS,
  bucketPercents,
  coloredRuns,
  durationLabel,
  equivalences,
  fitRoute,
  kmhLabel,
  kmLabel,
  monthSummary,
  pathD,
  routePointsForDrawing,
  thinPoints,
  timeRange,
  timesLabel,
  tripRoute,
  type Box,
  type TripSummary,
} from '@/lib/trips/present';

/**
 * OSM's tile policy asks apps to identify themselves. A browser sends its own
 * User-Agent (and the page as referrer); the phone names Car Guy.
 */
const TILE_HEADERS: Record<string, string> | undefined =
  Platform.OS === 'web' ? undefined : { 'User-Agent': `CarGuy/${Constants.expoConfig?.version ?? '2'} (+https://car-guy.vercel.app)` };

/**
 * Trip UI shared by the list, the detail, the vehicle hub tab and Cifras
 * (IMP 29092026 Phase 5A, 03-screens.md "Phase 5"). The TrackPieces pattern:
 * pieces here, screens stay thin.
 */

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/** Done, non-deleted trips, newest first; one vehicle or all. */
export async function listDoneTrips(vehicleId?: string): Promise<Trip[]> {
  const rows = await tripRepo.list(vehicleId, { orderBy: 'started_at', direction: 'DESC' });
  return rows.filter((t) => t.status === 'done');
}

/**
 * Conductor ↔ pasajero. A passenger trip must not move the odometer (ADR-30),
 * so going to pasajero tombstones the trip's `trip_estimate` reading; going
 * back does not recreate it (the estimate belongs to the moment the trip
 * ended). Returns true when a reading was removed.
 */
export async function setTripRole(trip: Trip, role: TripRole): Promise<boolean> {
  let removed = false;
  if (role === 'pasajero') {
    const readingId = trip.odometerReadingId ?? `odo_trip_${trip.id}`;
    const reading = await odometerRepo.getById(readingId);
    if (reading) {
      await odometerRepo.softDelete(readingId);
      removed = true;
    }
    await tripRepo.upsert({ id: trip.id, role, odometerReadingId: null });
  } else {
    await tripRepo.upsert({ id: trip.id, role });
  }
  return removed;
}

/** Asks, then soft-deletes the trip (and its odometer estimate). */
export function confirmDeleteTrip(trip: Trip, onDone?: () => void) {
  Alert.alert(t.trips.delete, t.trips.deleteBody, [
    { text: t.common.cancel, style: 'cancel' },
    {
      text: t.common.delete,
      style: 'destructive',
      onPress: () =>
        void (async () => {
          const readingId = trip.odometerReadingId ?? `odo_trip_${trip.id}`;
          if (await odometerRepo.getById(readingId)) await odometerRepo.softDelete(readingId);
          await tripRepo.softDelete(trip.id);
          onDone?.();
        })(),
    },
  ]);
}

/** Long-press on a row: role toggle and delete. */
export function tripActions(trip: Trip, onChanged?: () => void) {
  const toPassenger = trip.role !== 'pasajero';
  Alert.alert(t.trips.actions, undefined, [
    { text: t.common.cancel, style: 'cancel' },
    {
      text: toPassenger ? t.trips.markPassenger : t.trips.markDriver,
      onPress: () => void setTripRole(trip, toPassenger ? 'pasajero' : 'conductor').then(() => onChanged?.()),
    },
    { text: t.trips.delete, style: 'destructive', onPress: () => confirmDeleteTrip(trip, onChanged) },
  ]);
}

export type LocationPermission = 'granted' | 'denied' | 'undetermined' | 'unknown';

/**
 * The foreground location permission (Part A needs only this one): its state,
 * and `ask()` — the system prompt while it can still be asked, else the app's
 * system settings (native) since Android/iOS stop showing the prompt.
 */
export function useLocationPermission() {
  const [state, setState] = useState<LocationPermission>('unknown');
  const [canAsk, setCanAsk] = useState(true);

  const apply = (r: Location.LocationPermissionResponse) => {
    setState(r.granted ? 'granted' : r.status === 'denied' ? 'denied' : 'undetermined');
    setCanAsk(r.canAskAgain);
  };
  const fail = () => setState('unknown');
  const check = () => Location.getForegroundPermissionsAsync().then(apply, fail);

  useEffect(() => {
    void Location.getForegroundPermissionsAsync().then(apply, fail);
    // Coming back from the system settings: read it again.
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void Location.getForegroundPermissionsAsync().then(apply, fail));
    return () => sub.remove();
  }, []);

  const ask = async () => {
    if (state === 'denied' && !canAsk && Platform.OS !== 'web') {
      await Linking.openSettings();
      return;
    }
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch {
      // Web without geolocation, or dismissed.
    }
    await check();
  };

  return { state, canAsk, ask, check };
}

/**
 * Whether Automático can run on this phone (Part B), re-read on return from
 * the system settings — where Android 11+ sends the user for "todo el tiempo".
 */
export function useAutoReadiness() {
  const [state, setState] = useState<AutoReadiness | null>(null);
  const check = () =>
    autoReadiness().then(
      (r) => {
        setState(r);
        return r;
      },
      () => {
        setState('unavailable');
        return 'unavailable' as const;
      },
    );
  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void check());
    return () => sub.remove();
  }, []);
  return { state, check };
}

/** Xiaomi, Redmi and POCO phones run MIUI/HyperOS, which kills background apps by default. */
export function isMiuiPhone(): boolean {
  if (Platform.OS !== 'android') return false;
  const c = Platform.constants as { Manufacturer?: string; Brand?: string };
  return /xiaomi|redmi|poco/i.test(`${c.Manufacturer ?? ''} ${c.Brand ?? ''}`);
}

/**
 * The three MIUI steps (research 01 §1.7). Step 1 carries the real state when
 * the phone tells it (modules/miui-autostart, re-read on return from the
 * settings), with a button straight to MIUI's autostart list.
 */
export function MiuiChecklist() {
  const { theme } = useTheme();
  const [autostart, setAutostart] = useState<AutostartState>(() => getAutostartState());
  const [battery, setBattery] = useState<BatteryState>(() => getBatteryState());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      setAutostart(getAutostartState());
      setBattery(getBatteryState());
    });
    return () => sub.remove();
  }, []);
  if (!isMiuiPhone()) return null;
  const verdict =
    autostart === 'enabled' ? { text: t.trips.miuiAutostartOn, color: theme.statusText.ok } : autostart === 'disabled' ? { text: t.trips.miuiAutostartOff, color: theme.statusText.vencido } : null;
  // Step 2 is the battery one: its real state since 2.4.3 (Phase 0 found the Redmi optimised).
  const batteryVerdict =
    battery === 'unrestricted' ? { text: t.trips.batteryOn, color: theme.statusText.ok } : battery === 'optimized' ? { text: t.trips.batteryOff, color: theme.statusText.vencido } : null;
  return (
    <Surface padded style={{ gap: space.sm, marginTop: space.md }}>
      <T face="title" style={{ color: theme.text.primary, fontSize: 16, textTransform: 'uppercase' }}>
        {t.trips.miuiTitle}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20 }}>
        {t.trips.miuiIntro}
      </T>
      {t.trips.miuiSteps.map((step, i) => (
        <View key={step} style={{ gap: 2 }}>
          <T face="body" style={{ color: theme.text.primary, fontSize: 14, lineHeight: 20 }}>
            {`${i + 1}. ${step}`}
          </T>
          {i === 0 && verdict ? (
            <T face="semibold" style={{ color: verdict.color, fontSize: 13 }}>
              {verdict.text}
            </T>
          ) : null}
          {i === 1 && batteryVerdict ? (
            <T face="semibold" style={{ color: batteryVerdict.color, fontSize: 13 }}>
              {batteryVerdict.text}
            </T>
          ) : null}
        </View>
      ))}
      {autostart !== 'enabled' ? (
        <GhostButton label={t.trips.miuiOpenAutostart} onPress={() => void (openAutostartSettings() || Linking.openSettings())} />
      ) : null}
      {battery === 'optimized' ? <GhostButton label={t.trips.batteryOpen} onPress={() => void (openBatterySettings() || Linking.openSettings())} /> : null}
      <GhostButton label={t.trips.openSettings} onPress={() => void Linking.openSettings()} />
    </Surface>
  );
}

/**
 * "Automático no está grabando" (IMP 01102026 Phase 1): Phase 0 found the Redmi in Automático with no location
 * permission at all, and nothing outside Ajustes said so. Shown on Inicio and Viajes only when the mode is
 * Automático and something blocks it; one tap to Permisos. Re-read on every return to the app.
 */
export function AutoBlockedCard() {
  const { theme } = useTheme();
  const router = useRouter();
  const auto = useAutoReadiness();
  const [mode, setMode] = useState<TripsMode | null>(null);
  const [extra, setExtra] = useState(() => ({ autostart: getAutostartState(), battery: getBatteryState() }));
  useEffect(() => {
    const read = () => {
      void tripsMode().then(setMode);
      setExtra({ autostart: isMiuiPhone() ? getAutostartState() : 'unknown', battery: getBatteryState() });
    };
    read();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && read());
    return () => sub.remove();
  }, []);
  if (Platform.OS === 'web') return null;
  const blocker = autoBlocker({ mode, readiness: auto.state, autostart: isMiuiPhone() ? extra.autostart : 'unknown', battery: extra.battery });
  if (!blocker) return null;
  return (
    <Surface padded style={{ gap: space.xs, borderColor: theme.statusText.vencido, borderWidth: 1 }}>
      <T face="title" style={{ color: theme.statusText.vencido, fontSize: 15, textTransform: 'uppercase' }} accessibilityRole="header">
        {t.trips.autoBlockedTitle}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20 }}>
        {t.trips.autoBlocked[blocker]}
      </T>
      <GhostButton label={t.trips.autoBlockedFix} onPress={() => router.push('/viajes/permisos')} />
    </Surface>
  );
}

/** "Último punto GPS recibido: hace 3 min" — so the person can see the service is alive (Viajes → Ajustes). */
export function LastFixLine() {
  const { theme } = useTheme();
  const [at, setAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let alive = true;
    const read = () => void machineState().then((s) => alive && setAt(lastFixTime(s))).catch(() => {});
    read();
    const id = setInterval(() => {
      setNow(Date.now());
      read();
    }, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return (
    <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
      {t.trips.lastFixAt(at == null ? null : agoShort(now - at))}
    </T>
  );
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(localeTag(), { weekday: 'short', day: 'numeric', month: 'short' });

// ---------------------------------------------------------------------------
// Route drawings
// ---------------------------------------------------------------------------

/** 64×40 route thumbnail for a list row (decoded polyline, one colour). */
export function RouteSparkline({ polyline, width = 64, height = 40 }: { polyline: string | null; width?: number; height?: number }) {
  const { theme } = useTheme();
  const d = useMemo(() => pathD(fitRoute(tripRoute({ polyline }), { width, height, pad: 4 })), [polyline, width, height]);
  return (
    <View style={[styles.spark, { width, height, backgroundColor: theme.bg.well, borderColor: theme.line }]}>
      {d ? (
        <Svg width={width} height={height}>
          <Path d={d} stroke={theme.accent} strokeWidth={1.6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * The route on the dark card: coloured by speed bucket when the raw points
 * are still on the phone (< 30 days; cleaned like the stats, ADR-42), else the simplified polyline in one
 * colour. Start dot green, end a checkered flag. Always dark, like a cluster.
 * With `map`, OpenStreetMap tiles lie under it (tinted dark) and the route is
 * drawn in their projection; the credit links to OSM's copyright page.
 * `onReady` fires once every tile has loaded or failed (at once without
 * tiles) — the trip detail captures the share image then (Phase 4).
 */
export function RouteSvg({ trip, points, width, height, map = false, onReady }: { trip: Trip; points: Fix[] | null; width: number; height: number; map?: boolean; onReady?: () => void }) {
  const { runs, single, ends, tiles } = useMemo(() => {
    const box = { width, height, pad: 16 };
    // Raw points cleaned like the stats (accuracy, jumps, excursions) and thinned; else the polyline.
    const drawn = routePointsForDrawing(points, trip);
    const raw = drawn.source === 'points' ? drawn.points : null;
    const src: LatLng[] = drawn.points;
    const fit = map ? fitTiles(src, box) : null;
    const project = fit ? (pts: readonly LatLng[], b: Box) => fitTiles(pts, b)?.xy ?? [] : fitRoute;
    const xy = fit ? fit.xy : fitRoute(src, box);
    return {
      runs: raw ? coloredRuns(raw, box, Infinity, project) : [],
      single: raw ? '' : pathD(xy),
      ends: xy.length > 1 ? { start: xy[0], end: xy[xy.length - 1] } : null,
      tiles: fit?.tiles ?? [],
    };
  }, [trip, points, width, height, map]);

  const settled = useRef(0);
  const readyFired = useRef(false);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  const fireReady = () => {
    if (readyFired.current) return;
    readyFired.current = true;
    onReadyRef.current?.();
  };
  const tileSettled = () => {
    settled.current += 1;
    if (settled.current >= tiles.length) fireReady();
  };
  useEffect(() => {
    if (!tiles.length) fireReady();
  }, [tiles.length]);

  const allPaths = runs.length ? runs.map((r) => r.d) : single ? [single] : [];
  const svg = (
    <Svg width={width} height={height} accessibilityLabel={t.trips.routeA11y(kmLabel(trip.distanceM))} style={tiles.length ? StyleSheet.absoluteFill : undefined}>
      {tiles.length ? null : <Rect x={0} y={0} width={width} height={height} rx={radius.card} fill="#0B0B0D" />}
      {/* Glow: the same line, wider and faint. */}
      {allPaths.map((d, i) => (
        <Path key={`g${i}`} d={d} stroke={runs.length ? BUCKET_COLORS[runs[i].bucket] : '#E10600'} strokeOpacity={tiles.length ? 0.35 : 0.22} strokeWidth={9} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {allPaths.map((d, i) => (
        <Path key={`p${i}`} d={d} stroke={runs.length ? BUCKET_COLORS[runs[i].bucket] : '#FF3B30'} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {ends ? (
        <>
          <Circle cx={ends.start.x} cy={ends.start.y} r={6} fill="#3DDC84" stroke="#0B0B0D" strokeWidth={2} />
          <EndFlag x={ends.end.x} y={ends.end.y} />
        </>
      ) : null}
    </Svg>
  );
  if (!tiles.length) return svg;
  return (
    <View style={{ width, height, borderRadius: radius.card, overflow: 'hidden', backgroundColor: '#0B0B0D' }}>
      {tiles.map((t) => (
        <Image
          key={t.key}
          source={{ uri: t.url, headers: TILE_HEADERS }}
          cachePolicy="disk"
          recyclingKey={t.key}
          onLoad={tileSettled}
          onError={tileSettled}
          style={{ position: 'absolute', left: Math.floor(t.left), top: Math.floor(t.top), width: TILE_SIZE + 1, height: TILE_SIZE + 1 }}
          accessible={false}
        />
      ))}
      {/* The cluster look: the map dimmed, the route on top. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,11,13,0.55)' }]} />
      {svg}
      <Pressable
        onPress={() => void Linking.openURL(OSM_COPYRIGHT_URL)}
        accessibilityRole="link"
        style={styles.osmCredit}>
        <T face="body" style={{ color: '#EDEDED', fontSize: 10 }}>
          {t.trips.mapCredit}
        </T>
      </Pressable>
    </View>
  );
}

/**
 * Where you drive (2.2.2): the listed trips on one OpenStreetMap map, each a
 * faint line — where they pile up (the street you repeat) it glows. Up to 60
 * trips, each thinned; tiles as in RouteSvg.
 */
export function TripsHeatMap({ trips, width, height }: { trips: Trip[]; width: number; height: number }) {
  const { theme } = useTheme();
  const drawn = useMemo(() => {
    const routes = trips
      .slice(0, 60)
      .map((t) => thinPoints(tripRoute(t), 120))
      .filter((r) => r.length > 1);
    if (!routes.length) return null;
    const box = { width, height, pad: 20 };
    const fit = fitTiles(routes.flat(), box);
    if (!fit) return null;
    return { tiles: fit.tiles, paths: routes.map((r) => pathD(r.map(fit.project))) };
  }, [trips, width, height]);
  if (!drawn) return null;
  return (
    <View style={{ marginBottom: space.md }}>
      <View style={{ width, height, borderRadius: radius.card, overflow: 'hidden', backgroundColor: '#0B0B0D' }}>
        {drawn.tiles.map((t) => (
          <Image
            key={t.key}
            source={{ uri: t.url, headers: TILE_HEADERS }}
            cachePolicy="disk"
            recyclingKey={t.key}
            style={{ position: 'absolute', left: Math.floor(t.left), top: Math.floor(t.top), width: TILE_SIZE + 1, height: TILE_SIZE + 1 }}
            accessible={false}
          />
        ))}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,11,13,0.62)' }]} />
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} accessibilityLabel={t.trips.heatA11y(drawn.paths.length)}>
          {drawn.paths.map((d, i) => (
            <Path key={`w${i}`} d={d} stroke="#FF5F00" strokeOpacity={0.14} strokeWidth={10} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {drawn.paths.map((d, i) => (
            <Path key={`c${i}`} d={d} stroke="#FFB300" strokeOpacity={0.45} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          ))}
        </Svg>
        <Pressable onPress={() => void Linking.openURL(OSM_COPYRIGHT_URL)} accessibilityRole="link" style={styles.osmCredit}>
          <T face="body" style={{ color: '#EDEDED', fontSize: 10 }}>
            {t.trips.mapCredit}
          </T>
        </Pressable>
      </View>
      <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.xs }}>
        {t.trips.heatCaption}
      </T>
    </View>
  );
}

/** A small checkered flag planted at (x, y). */
function EndFlag({ x, y }: { x: number; y: number }) {
  const s = 4;
  const cells: [number, number][] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) if ((r + c) % 2 === 0) cells.push([c, r]);
  return (
    <G x={x} y={y - 16}>
      <Rect x={-1} y={0} width={2} height={16} fill="#FFFFFF" />
      <Rect x={1} y={0} width={4 * s} height={3 * s} fill="#FFFFFF" />
      {cells.map(([c, r]) => (
        <Rect key={`${c}${r}`} x={1 + c * s} y={r * s} width={s} height={s} fill="#111111" />
      ))}
    </G>
  );
}

/** The five-bucket bar with its legend (% of moving time). */
export function DistributionBar({ buckets }: { buckets: number[] }) {
  const { theme } = useTheme();
  const pct = bucketPercents(buckets);
  if (!pct) {
    return (
      <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
        {t.trips.distributionEmpty}
      </T>
    );
  }
  return (
    <View>
      <View style={[styles.bar, { backgroundColor: theme.bg.well }]}>
        {pct.map((p, i) => (p > 0 ? <View key={i} style={{ flex: p, backgroundColor: BUCKET_COLORS[i] }} /> : null))}
      </View>
      <View style={styles.legend}>
        {pct.map((p, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: BUCKET_COLORS[i] }]} />
            <T face="mono" style={{ color: theme.text.secondary, fontSize: 11 }}>
              {t.trips.buckets[i]} · {p}%
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// List pieces
// ---------------------------------------------------------------------------

export function TripRow({ trip, vehicleName, onPress, onLongPress }: { trip: Trip; vehicleName?: string; onPress: () => void; onLongPress?: () => void }) {
  const { theme } = useTheme();
  const labels = [trip.startLabel, trip.endLabel].some(Boolean) ? `${trip.startLabel || '…'} → ${trip.endLabel || '…'}` : null;
  const top = [dayLabel(trip.startedAt), timeRange(trip.startedAt, trip.endedAt)].join(' · ');
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={t.trips.rowA11y(dayLabel(trip.startedAt), kmLabel(trip.distanceM), durationLabel(trip.durationS))}
      accessibilityHint={onLongPress ? t.trips.actions : undefined}
      style={({ pressed }) => [styles.row, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong, opacity: pressed ? 0.85 : 1 }]}>
      <RouteSparkline polyline={trip.polyline} />
      <View style={{ flex: 1, gap: 2 }}>
        <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }} numberOfLines={1}>
          {[top, vehicleName].filter(Boolean).join(' · ').toUpperCase()}
        </T>
        {labels ? (
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }} numberOfLines={1}>
            {labels}
          </T>
        ) : null}
        <View style={styles.rowLine}>
          <T face="mono" style={{ color: theme.text.primary, fontSize: 13 }}>
            {kmLabel(trip.distanceM)} km · {durationLabel(trip.durationS)}
          </T>
          <T face="monoBold" style={{ color: theme.statusText.proximo, fontSize: 13 }}>
            {t.trips.maxShort(kmhLabel(trip.maxKmh))}
          </T>
        </View>
      </View>
      {trip.role === 'pasajero' ? <Badge label={t.trips.passenger} tone="amber" /> : null}
    </Pressable>
  );
}

/** km este mes · viajes · al volante. */
export function TripsStrip({ summary }: { summary: TripSummary }) {
  const { theme } = useTheme();
  const cells: [string, string][] = [
    [kmLabel(summary.distanceM), t.trips.strip.km],
    [String(summary.count), t.trips.strip.count],
    [durationLabel(summary.durationS), t.trips.strip.time],
  ];
  return (
    <View style={[styles.strip, { backgroundColor: theme.bg.well, borderColor: theme.lineStrong }]}>
      {cells.map(([v, l]) => (
        <View key={l} style={{ flex: 1 }}>
          <T face="monoBold" style={{ color: theme.text.primary, fontSize: 18 }} numberOfLines={1} adjustsFontSizeToFit>
            {v}
          </T>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10 }}>
            {l}
          </T>
        </View>
      ))}
    </View>
  );
}

/** The hub's Viajes tab: the vehicle's last trips and a way to the list. */
export function TripsHubTab({ vehicleId, version }: { vehicleId: string; version: number }) {
  const router = useRouter();
  const { theme } = useTheme();
  const { data } = useStore();
  const [list, setList] = useState<Trip[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listDoneTrips(vehicleId).then((t) => !cancelled && setList(t));
    return () => {
      cancelled = true;
    };
  }, [vehicleId, version, data]);

  if (!list) return null;
  return (
    <View style={{ gap: space.sm }}>
      <TripsStrip summary={monthSummary(list)} />
      {!list.length ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
          {t.trips.empty}
        </T>
      ) : (
        <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
          {t.trips.hubRecent}
        </T>
      )}
      {list.slice(0, 3).map((t) => (
        <TripRow key={t.id} trip={t} onPress={() => router.push({ pathname: '/viaje/[id]', params: { id: t.id } })} />
      ))}
      <GhostButton label={t.trips.hubAll} onPress={() => router.push({ pathname: '/viajes', params: { vehicleId } })} />
    </View>
  );
}

/** Cifras → Viajes: this month's numbers and the DR equivalences. Nothing without trips. */
export function TripsCifrasBlock({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const { theme } = useTheme();
  const { data } = useStore();
  const [summary, setSummary] = useState<TripSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listDoneTrips(vehicleId).then((t) => !cancelled && setSummary(monthSummary(t)));
    return () => {
      cancelled = true;
    };
  }, [vehicleId, data]);

  if (!summary || !summary.count) return null;
  const kmTotal = summary.distanceM / 1000;
  const eq = equivalences(kmTotal, t.trips.equivalences);
  const tiles: [string, string][] = [
    [String(summary.count), t.trips.cifras.count],
    [kmLabel(summary.distanceM), t.trips.cifras.km],
    [durationLabel(summary.durationS), t.trips.cifras.time],
    [summary.maxKmh != null ? `${kmhLabel(summary.maxKmh)} km/h` : '—', t.trips.cifras.max],
  ];
  return (
    <View style={{ marginTop: space.md }}>
      <SectionHeader title={t.trips.cifrasTitle} caption={t.trips.cifrasCaption} />
      <Pressable onPress={() => router.push({ pathname: '/viajes', params: { vehicleId } })} accessibilityRole="button" accessibilityLabel={t.trips.cifrasTitle}>
        <Surface>
          <View style={styles.tiles}>
            {tiles.map(([v, l]) => (
              <View key={l} style={styles.tile}>
                <T face="monoBold" style={{ color: theme.text.primary, fontSize: 20 }} numberOfLines={1} adjustsFontSizeToFit>
                  {v}
                </T>
                <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10 }}>
                  {l.toUpperCase()}
                </T>
              </View>
            ))}
          </View>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.md, marginBottom: space.xs }}>
            {t.trips.equivalencesTitle.toUpperCase()}
          </T>
          {eq.map((e) => (
            <View key={e.key} style={styles.eqRow}>
              <T face="monoBold" style={{ color: theme.accent, fontSize: 14, minWidth: 64 }}>
                {timesLabel(e.times)}
              </T>
              <T face="body" style={{ color: theme.text.secondary, fontSize: 13, flex: 1 }}>
                {t.trips.equivalences.find((d) => d.key === e.key)?.label}
              </T>
            </View>
          ))}
          <T face="body" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.xs }}>
            {t.trips.equivalencesNote}
          </T>
        </Surface>
      </Pressable>
    </View>
  );
}

/**
 * The shareable card: route + headline numbers + wordmark, no plate. A
 * forwardRef so the share button captures exactly this view (TrackPieces).
 * `renderRoute` replaces the static route (the trip detail puts the live
 * MapLibre map there, Phase 4); `onRouteReady` is RouteSvg's onReady.
 */
export const TripShareCard = forwardRef<
  View,
  { trip: Trip; points: Fix[] | null; width: number; vehicleName?: string; map?: boolean; renderRoute?: (width: number, height: number) => ReactNode; onRouteReady?: () => void }
>(function TripShareCard({ trip, points, width, vehicleName, map, renderRoute, onRouteReady }, ref) {
  const h = Math.round(width * 0.62);
  const stats: [string, string][] = [
    [`${kmLabel(trip.distanceM)} km`, t.trips.tiles.distance],
    [durationLabel(trip.durationS), t.trips.tiles.duration],
    [`${kmhLabel(trip.avgMovingKmh ?? trip.avgKmh)} km/h`, t.trips.tiles.avgMoving],
    [`${kmhLabel(trip.maxKmh)} km/h`, t.trips.tiles.max],
  ];
  return (
    // collapsable={false}: Android must keep this View in the native tree to capture it.
    <View ref={ref} collapsable={false} style={styles.shareCard}>
      <T face="eyebrow" style={{ color: '#FFB300', fontSize: 11 }}>
        {[dayLabel(trip.startedAt), timeRange(trip.startedAt, trip.endedAt), vehicleName].filter(Boolean).join(' · ').toUpperCase()}
      </T>
      {trip.startLabel || trip.endLabel ? (
        <T face="title" style={{ color: '#FFFFFF', fontSize: 16, textTransform: 'uppercase' }} numberOfLines={1}>
          {`${trip.startLabel || '…'} → ${trip.endLabel || '…'}`}
        </T>
      ) : null}
      <View style={{ marginVertical: space.sm }}>
        {renderRoute ? renderRoute(width - 2 * space.md, h) : <RouteSvg trip={trip} points={points} width={width - 2 * space.md} height={h} map={map} onReady={onRouteReady} />}
      </View>
      <View style={styles.tiles}>
        {stats.map(([v, l]) => (
          <View key={l} style={styles.tile}>
            <T face="monoBold" style={{ color: '#FFFFFF', fontSize: 18 }} numberOfLines={1} adjustsFontSizeToFit>
              {v}
            </T>
            <T face="eyebrow" style={{ color: '#9A9AA2', fontSize: 10 }}>
              {l.toUpperCase()}
            </T>
          </View>
        ))}
      </View>
      <T face="eyebrow" style={{ color: '#6B6B73', fontSize: 9, textAlign: 'right', marginTop: space.xs }}>
        CAR GUY · 走り
      </T>
    </View>
  );
});

/** The trip as text, for WhatsApp. */
export function tripText(trip: Trip, vehicleName?: string): string {
  const lines = [
    [dayLabel(trip.startedAt), timeRange(trip.startedAt, trip.endedAt)].join(' · '),
    vehicleName ?? null,
    trip.startLabel || trip.endLabel ? `${trip.startLabel || '…'} → ${trip.endLabel || '…'}` : null,
    `${kmLabel(trip.distanceM)} km · ${durationLabel(trip.durationS)}`,
    `${t.trips.tiles.max}: ${kmhLabel(trip.maxKmh)} km/h`,
  ].filter((l): l is string => Boolean(l));
  return t.trips.summaryText(lines);
}

const styles = StyleSheet.create({
  osmCredit: { position: 'absolute', right: 6, bottom: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.55)' },
  spark: { borderWidth: 1, borderRadius: radius.tag, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.button, padding: space.md, marginBottom: space.sm },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  strip: { flexDirection: 'row', gap: space.md, borderWidth: 1, borderRadius: radius.button, paddingVertical: space.md, paddingHorizontal: space.md, marginBottom: space.md },
  bar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  tile: { width: '50%', paddingRight: space.sm },
  eqRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 3 },
  shareCard: { backgroundColor: '#141417', borderRadius: radius.card, padding: space.md, borderWidth: 1, borderColor: '#2A2A30' },
});
