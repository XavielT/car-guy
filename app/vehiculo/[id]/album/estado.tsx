import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

import { PhotoThumb } from '@/components/album/PhotoThumb';
import { VehicleEstadoSkeleton } from '@/components/skeletons/VehicleSkeletons';
import { T } from '@/components/T';
import { LcdDigits, PrimaryButton, Surface } from '@/components/ui';
import { palette, radius, space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { albumPhotos, odometerReadings, pinSnapshot, stateInputs, type AlbumPhoto } from '@/lib/db/albumQueries';
import { vehicleOwnership } from '@/lib/db/repos';
import { photoDate, stateAt, type StateMod } from '@/lib/domain/album';
import { specLabelByKey } from '@/lib/domain/build';
import { dateLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * "Así estaba el carro" (IMP 28092026 Phase 3): pick a day in the car's life and
 * see it as it was — the photos up to then, the mods on it, the odometer, the
 * ficha. "Fijar como snapshot" freezes that ficha with a label (spec_snapshot).
 *
 * The date control is a tappable track with month steps: no slider dependency,
 * and it behaves the same on web and Android.
 */
const DAY = 86_400_000;

/** A date-only "2018-01-01" is that day at noon here, not UTC midnight (which is 31 Dec in DR). */
function localTime(iso: string): number {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getTime() : new Date(iso).getTime();
}

export default function EstadoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();

  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [when, setT] = useState<number>(() => Date.now());
  const [inputs, setInputs] = useState<{ photos: AlbumPhoto[]; mods: StateMod[]; readings: { occurredAt: string; valueKm: number }[]; stock: Record<string, unknown> } | null>(null);
  const [trackWidth, setTrackWidth] = useState(1);
  const [pinned, setPinned] = useState(false);
  const showSkeleton = useDelayedLoading(inputs === null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const [photos, readings, si, own] = await Promise.all([albumPhotos(id), odometerReadings(id), stateInputs(id), vehicleOwnership.getById(`own_${id}`)]);
      setInputs({ photos, readings, ...si });
      const dates = [
        own?.acquiredAt,
        ...photos.map((p) => photoDate(p)),
        ...readings.map((r) => r.occurredAt),
        ...si.mods.map((m) => m.installedAt),
      ]
        .filter((d): d is string => Boolean(d))
        .map(localTime);
      // A year-only sale date ("2021") must not cut off that year's photos.
      const to = Math.max(own?.soldAt ? localTime(own.soldAt) : Date.now(), ...dates);
      const from = dates.length ? Math.min(...dates, to - DAY) : to - 365 * DAY;
      setRange({ from, to });
      setT(to);
    })().catch(() => setInputs((prev) => prev ?? { photos: [], mods: [], readings: [], stock: {} }));
  }, [id]);

  const state = useMemo(() => (inputs ? stateAt(new Date(when).toISOString(), inputs) : null), [inputs, when]);

  function step(months: number) {
    if (!range) return;
    const d = new Date(when);
    d.setMonth(d.getMonth() + months);
    setT(Math.min(range.to, Math.max(range.from, d.getTime())));
    setPinned(false);
  }

  function onTrack(x: number) {
    if (!range) return;
    const ratio = Math.min(1, Math.max(0, x / trackWidth));
    setT(Math.round(range.from + ratio * (range.to - range.from)));
    setPinned(false);
  }

  async function pin() {
    if (!state || !id) return;
    const label = t.estado.pinLabel(dateLabel(state.date));
    await pinSnapshot({ vehicleId: id, label, asOf: state.date, specs: state.specs, coverMediaId: state.photos[0]?.id ?? null });
    setPinned(true);
  }

  const ratio = range ? (when - range.from) / Math.max(1, range.to - range.from) : 1;
  const cell = Math.floor((width - space.gutter * 2 - 12) / 3);
  const specEntries = state ? Object.entries(state.specs).filter(([, v]) => v != null && v !== '') : [];

  // `inputs` is null until the first read: the page's outline after 150 ms
  // (ADR-40) instead of "sin mods · sin specs · sin fotos" flashing first.
  if (!inputs || showSkeleton) {
    return showSkeleton ? <VehicleEstadoSkeleton cell={cell} /> : <View style={{ flex: 1, backgroundColor: theme.bg.base }} />;
  }

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {t.estado.eyebrow}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 30, textTransform: 'uppercase' }}>
        {state ? t.estado.on(dateLabel(state.date)) : t.estado.title}
      </T>

      <View style={styles.sliderRow}>
        <Pressable onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel={t.estado.prevMonth} hitSlop={8} style={[styles.stepBtn, { borderColor: theme.lineStrong }]}>
          <Ionicons name="chevron-back" size={20} color={theme.text.primary} />
        </Pressable>
        <Pressable
          onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
          onPress={(e) => onTrack(e.nativeEvent.locationX)}
          accessibilityRole="adjustable"
          accessibilityLabel={t.estado.slider}
          accessibilityValue={{ text: state ? dateLabel(state.date) : '' }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
          style={styles.track}>
          <View style={[styles.rail, { backgroundColor: theme.lineStrong }]} />
          <View style={[styles.rail, { backgroundColor: theme.accentFill, width: `${Math.round(ratio * 100)}%` }]} />
          <View style={[styles.knob, { left: `${Math.round(ratio * 100)}%`, backgroundColor: theme.accentFill, borderColor: theme.bg.base }]} />
        </Pressable>
        <Pressable onPress={() => step(1)} accessibilityRole="button" accessibilityLabel={t.estado.nextMonth} hitSlop={8} style={[styles.stepBtn, { borderColor: theme.lineStrong }]}>
          <Ionicons name="chevron-forward" size={20} color={theme.text.primary} />
        </Pressable>
      </View>
      {range ? (
        <View style={styles.ends}>
          <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
            {dateLabel(new Date(range.from).toISOString())}
          </T>
          <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
            {dateLabel(new Date(range.to).toISOString())}
          </T>
        </View>
      ) : null}

      <View style={[styles.odo, { backgroundColor: palette.dark.bg.well, borderColor: palette.dark.lineStrong }]}>
        <LcdDigits value={state?.odometerKm ?? null} height={30} color={palette.dark.text.primary} lastColor={palette.dark.needle} />
        <T face="eyebrow" style={{ color: palette.dark.text.muted, fontSize: 10, marginTop: 6 }}>
          {t.estado.odometer}
        </T>
      </View>

      <Surface style={styles.card}>
        <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.sm }}>
          {t.estado.mods}
        </T>
        {state?.modsInstalled.length ? (
          state.modsInstalled.map((m) => (
            <T key={m.id} face="medium" style={{ color: theme.text.primary, fontSize: 15, marginBottom: 4 }}>
              {`· ${m.name}`}
            </T>
          ))
        ) : (
          <T face="body" style={{ color: theme.text.secondary, fontSize: 14 }}>
            {t.estado.noMods}
          </T>
        )}
      </Surface>

      <Surface style={styles.card}>
        <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.sm }}>
          {t.estado.specs}
        </T>
        {specEntries.length ? (
          specEntries.map(([k, v]) => (
            <View key={k} style={styles.specRow}>
              <T face="body" style={{ color: theme.text.secondary, fontSize: 14, flex: 1 }}>
                {t.estado.specLabels[k] ?? specLabelByKey(k)}
              </T>
              <View style={{ alignItems: 'flex-end' }}>
                <T face="mono" style={{ color: theme.text.primary, fontSize: 14 }}>
                  {String(v)}
                </T>
                <T face="eyebrow" style={{ color: state!.specSource[k] ? theme.accent : theme.text.muted, fontSize: 9 }}>
                  {state!.specSource[k] ? t.estado.from(state!.specSource[k]) : t.estado.stock}
                </T>
              </View>
            </View>
          ))
        ) : (
          <T face="body" style={{ color: theme.text.secondary, fontSize: 14 }}>
            {t.estado.noSpecs}
          </T>
        )}
      </Surface>

      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.md, marginBottom: space.sm }}>
        {t.estado.photos}
      </T>
      {state?.photos.length ? (
        <View style={styles.grid}>
          {state.photos.map((p) => (
            <PhotoThumb key={p.id} mediaId={p.id} blurhash={p.blurhash} size={cell} onPress={() => router.push({ pathname: '/foto/[id]', params: { id: p.id, vehicleId: id } })} />
          ))}
        </View>
      ) : (
        <T face="body" style={{ color: theme.text.secondary, fontSize: 14 }}>
          {t.estado.noPhotos}
        </T>
      )}

      <View style={{ marginTop: space.xl }}>
        <PrimaryButton label={pinned ? t.estado.pinned : t.estado.pin} disabled={pinned || !specEntries.length} onPress={() => void pin()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  stepBtn: { width: 44, height: 44, borderWidth: 1, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 44, justifyContent: 'center' },
  rail: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2 },
  knob: { position: 'absolute', width: 22, height: 22, borderRadius: 11, borderWidth: 3, marginLeft: -11 },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 52 },
  odo: { alignSelf: 'center', alignItems: 'center', borderWidth: 1, borderRadius: radius.button, paddingHorizontal: 14, paddingVertical: 10, marginTop: space.lg, marginBottom: space.lg },
  card: { marginBottom: space.md },
  specRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
