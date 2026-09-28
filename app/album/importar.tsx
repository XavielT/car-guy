import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/DateField';
import { T } from '@/components/T';
import { Chip, GhostButton, PrimaryButton, Sheet } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { dateAtPrecision, type DatePrecision } from '@/lib/domain/album';
import { dateLabel, monthTitle } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { importCandidates, pickCandidates, saveOriginal, type Candidate, type ImportProgress } from '@/lib/media';
import {
  candidatesFromLibrary,
  chooseMorePhotos,
  ensurePhotoPermission,
  LIBRARY_AVAILABLE,
  libraryYears,
  monthCounts,
  monthPhotos,
  type LibraryPhoto,
  type PhotoAccess,
} from '@/lib/media/library';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Importing old photos (IMP 28092026 Phase 3, ADR-18) — the Jetta lesson.
 *
 * Android: year → month (with counts) → that month's photos, pick with
 * checkboxes or "Seleccionar mes", across as many months as you like. Web:
 * a multi-file input. Both end in the same confirmation sheet: the dates found
 * (and where they came from), one date for all when they are wrong or missing,
 * the vehicle, "guardar los originales", then progress with cancel and the
 * result "N importadas, M repetidas".
 */
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];

type Stage = { kind: 'years' } | { kind: 'month'; year: number; month: number };

export default function ImportScreen() {
  const { vehicleId: paramVehicle } = useLocalSearchParams<{ vehicleId?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { data, activeVehicle, refresh } = useStore();
  const { width } = useWindowDimensions();

  const [vehicleId, setVehicleId] = useState(paramVehicle ?? activeVehicle?.id ?? '');
  const [access, setAccess] = useState<PhotoAccess | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  // Keyed by what they were read for, so a year or month change shows "…"
  // without resetting state inside an effect.
  const [countsFor, setCountsFor] = useState<{ year: number; counts: number[] } | null>(null);
  const [reload, setReload] = useState(0);
  const [stage, setStage] = useState<Stage>({ kind: 'years' });
  const [monthFor, setMonthFor] = useState<{ key: string; list: LibraryPhoto[] } | null>(null);
  const [selected, setSelected] = useState<Map<string, LibraryPhoto>>(new Map());

  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [override, setOverride] = useState(false);
  const [overrideDate, setOverrideDate] = useState(new Date().toISOString().slice(0, 10));
  const [precision, setPrecision] = useState<DatePrecision>('month');
  const [keepOriginals, setKeepOriginals] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [running, setRunning] = useState(false);
  const stop = useRef(false);

  // The Ex vehicles are the point (the Jetta), so every vehicle is a target.
  const targets = data.vehicles.filter((v) => v.detail);

  useEffect(() => {
    if (!LIBRARY_AVAILABLE) return;
    void ensurePhotoPermission().then(setAccess);
  }, []);

  useEffect(() => {
    if (!access?.granted) return;
    void libraryYears().then((ys) => {
      setYears(ys);
      if (ys.length && !ys.includes(year)) setYear(ys[0]);
    });
  }, [access?.granted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!access?.granted) return;
    let cancelled = false;
    void monthCounts(year).then((counts) => !cancelled && setCountsFor({ year, counts }));
    return () => {
      cancelled = true;
    };
  }, [access?.granted, year, reload]);

  const monthKey = stage.kind === 'month' ? `${stage.year}-${stage.month}` : null;
  useEffect(() => {
    if (stage.kind !== 'month') return;
    let cancelled = false;
    const key = `${stage.year}-${stage.month}`;
    void monthPhotos(stage.year, stage.month).then((list) => !cancelled && setMonthFor({ key, list }));
    return () => {
      cancelled = true;
    };
  }, [stage]);

  const counts = countsFor?.year === year ? countsFor.counts : null;
  const monthList = monthFor && monthFor.key === monthKey ? monthFor.list : null;

  async function openReview() {
    setCandidates(await candidatesFromLibrary([...selected.values()]));
  }

  async function pickOnWeb() {
    // Straight from the press: the browser only opens a file input inside a gesture.
    const picked = await pickCandidates({ multiple: true });
    if (picked.length) setCandidates(picked);
  }

  const summary = useMemo(() => {
    const c = candidates ?? [];
    const dated = c.filter((x) => x.takenAt).map((x) => x.takenAt!).sort();
    return {
      exif: c.filter((x) => x.dateSource === 'exif').length,
      file: c.filter((x) => x.dateSource === 'file').length,
      none: c.filter((x) => x.dateSource === 'none').length,
      from: dated[0] ?? null,
      to: dated[dated.length - 1] ?? null,
    };
  }, [candidates]);

  // No photo has a date: one date for all is the only way forward.
  // The chosen date fills the photos that have none; "todas" puts it on every one.
  const showDate = override || summary.none > 0;

  async function start() {
    if (!candidates?.length || !vehicleId) return;
    const [y, m, d] = overrideDate.split('-').map(Number);
    const chosen = dateAtPrecision(y, m - 1, d, precision);
    const batch = candidates.map((c) => {
      const own = override ? null : c.takenAt;
      // A photo that keeps its own date keeps day precision; the chosen date brings its own.
      return { ...c, takenAt: own ?? chosen, precision: own ? ('day' as DatePrecision) : precision };
    });
    stop.current = false;
    setRunning(true);
    setProgress({ done: 0, total: batch.length, imported: 0, duplicates: 0, failed: 0 });
    // Originals first, while the untouched files are still in hand.
    if (keepOriginals) {
      for (const c of batch) {
        if (stop.current) break;
        try {
          await saveOriginal(c);
        } catch {
          // The share sheet was dismissed; the import still happens.
        }
      }
    }
    const result = await importCandidates(batch, { vehicleId }, { onProgress: setProgress, shouldStop: () => stop.current });
    setProgress(result);
    setRunning(false);
    setSelected(new Map());
    refresh();
  }

  const cell = Math.floor((width - space.gutter * 2 - 12) / 3);
  const target = targets.find((v) => v.id === vehicleId);

  // ------------------------------------------------------------ render ---

  let body: React.ReactNode;
  if (!LIBRARY_AVAILABLE) {
    body = (
      <View style={styles.webBox}>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20 }}>
          {es.importer.webHint}
        </T>
        <PrimaryButton label={es.importer.pick} onPress={() => void pickOnWeb()} />
      </View>
    );
  } else if (!access) {
    body = <ActivityIndicator color={theme.accent} style={{ marginTop: space.xl }} />;
  } else if (!access.granted) {
    body = (
      <View style={styles.webBox}>
        <T face="title" style={{ color: theme.text.primary, fontSize: 18, textTransform: 'uppercase' }}>
          {es.importer.permissionTitle}
        </T>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20 }}>
          {access.canAskAgain ? es.importer.permissionBody : es.importer.permissionDenied}
        </T>
        {access.canAskAgain ? <PrimaryButton label={es.importer.permissionAsk} onPress={() => void ensurePhotoPermission().then(setAccess)} /> : null}
      </View>
    );
  } else if (stage.kind === 'years') {
    body = (
      <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: space.md }}>
          {years.map((y) => (
            <Chip key={y} label={String(y)} selected={y === year} onPress={() => setYear(y)} />
          ))}
        </ScrollView>
        <View style={styles.months}>
          {MONTHS.map((label, i) => {
            const n = counts?.[i] ?? 0;
            const picked = [...selected.values()].filter((p) => p.creationTime && new Date(p.creationTime).getFullYear() === year && new Date(p.creationTime).getMonth() === i).length;
            return (
              <Pressable
                key={label}
                disabled={!counts || n === 0}
                onPress={() => setStage({ kind: 'month', year, month: i })}
                accessibilityRole="button"
                accessibilityLabel={`${monthTitle(year, i)}: ${n}`}
                style={[styles.month, { backgroundColor: theme.bg.surface, borderColor: picked ? theme.accentFill : theme.lineStrong, opacity: counts && n === 0 ? 0.45 : 1 }]}>
                <T face="title" style={{ color: theme.text.primary, fontSize: 15, letterSpacing: 1 }}>
                  {label}
                </T>
                <T face="mono" style={{ color: theme.text.muted, fontSize: 12, marginTop: 4 }}>
                  {counts ? es.importer.monthCount(n) : '…'}
                </T>
                {picked ? (
                  <T face="mono" style={{ color: theme.accent, fontSize: 11, marginTop: 2 }}>
                    {`✓ ${picked}`}
                  </T>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </>
    );
  } else {
    const list = monthList ?? [];
    const allOn = list.length > 0 && list.every((p) => selected.has(p.id));
    body = (
      <>
        <View style={styles.monthBar}>
          <Pressable onPress={() => setStage({ kind: 'years' })} accessibilityRole="button" accessibilityLabel={es.common.back} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={theme.text.primary} />
          </Pressable>
          <T face="display" style={{ color: theme.text.primary, fontSize: 20, flex: 1, textTransform: 'uppercase' }}>
            {monthTitle(stage.year, stage.month)}
          </T>
          {list.length ? (
            <GhostButton
              label={allOn ? es.importer.clearMonth : es.importer.selectMonth}
              onPress={() =>
                setSelected((prev) => {
                  const next = new Map(prev);
                  for (const p of list) {
                    if (allOn) next.delete(p.id);
                    else next.set(p.id, p);
                  }
                  return next;
                })
              }
            />
          ) : null}
        </View>
        {monthList == null ? (
          <T face="body" style={{ color: theme.text.muted, marginTop: space.lg }}>
            {es.importer.loading}
          </T>
        ) : !list.length ? (
          <T face="body" style={{ color: theme.text.muted, marginTop: space.lg }}>
            {es.importer.emptyMonth}
          </T>
        ) : null}
        <FlatList
          data={list}
          numColumns={3}
          keyExtractor={(p) => p.id}
          columnWrapperStyle={{ gap: 6 }}
          contentContainerStyle={{ gap: 6, paddingBottom: 120 }}
          initialNumToRender={18}
          windowSize={5}
          renderItem={({ item: p }) => {
            const on = selected.has(p.id);
            return (
              <Pressable
                onPress={() =>
                  setSelected((prev) => {
                    const next = new Map(prev);
                    if (on) next.delete(p.id);
                    else next.set(p.id, p);
                    return next;
                  })
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={p.creationTime ? dateLabel(new Date(p.creationTime).toISOString()) : es.viewer.noDate}
                style={{ width: cell, height: cell }}>
                <Image source={{ uri: p.uri }} recyclingKey={p.id} contentFit="cover" style={[StyleSheet.absoluteFill, { borderRadius: radius.input }]} />
                <View style={[styles.check, { backgroundColor: on ? theme.accentFill : 'rgba(0,0,0,0.45)', borderColor: on ? theme.accentFill : '#FFFFFF' }]}>
                  {on ? <Ionicons name="checkmark" size={16} color={theme.accentFillInk} /> : null}
                </View>
              </Pressable>
            );
          }}
        />
      </>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <View style={styles.pad}>
        <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
          {es.importer.target(target?.name ?? '—')}
        </T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: space.sm, marginBottom: space.md }}>
          {targets.map((v) => (
            <Chip key={v.id} label={v.name} selected={v.id === vehicleId} onPress={() => setVehicleId(v.id)} />
          ))}
        </ScrollView>
        {access?.limited ? (
          <View style={[styles.banner, { backgroundColor: theme.statusBg.proximo, borderColor: theme.status.proximo }]}>
            <T face="body" style={{ color: theme.text.primary, fontSize: 13, flex: 1 }}>
              {es.importer.limited}
            </T>
            <GhostButton label={es.importer.chooseMore} onPress={() => void chooseMorePhotos().then(() => setReload((n) => n + 1))} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>{body}</View>
      </View>

      {LIBRARY_AVAILABLE && selected.size ? (
        <View style={[styles.footer, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
          <T face="mono" style={{ color: theme.text.primary, fontSize: 13, flex: 1 }}>
            {es.importer.selected(selected.size)}
          </T>
          <PrimaryButton label={es.importer.review} onPress={() => void openReview()} />
        </View>
      ) : null}

      <Sheet visible={Boolean(candidates)} onClose={() => (running ? null : (setCandidates(null), setProgress(null)))} title={es.importer.confirmTitle(candidates?.length ?? 0)}>
        {progress && !running ? (
          <View style={{ gap: space.md }}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 16 }}>
              {es.importer.result(progress.imported, progress.duplicates)}
            </T>
            {progress.failed ? (
              <T face="body" style={{ color: theme.dangerText, fontSize: 13 }}>
                {es.importer.failed(progress.failed)}
              </T>
            ) : null}
            <PrimaryButton
              label={es.importer.done}
              onPress={() => {
                setCandidates(null);
                setProgress(null);
                router.replace({ pathname: '/vehiculo/[id]/album', params: { id: vehicleId } });
              }}
            />
          </View>
        ) : running && progress ? (
          <View style={{ gap: space.md }}>
            <T face="mono" style={{ color: theme.text.primary, fontSize: 14 }}>
              {es.importer.progress(progress.done, progress.total)}
            </T>
            <View style={[styles.bar, { backgroundColor: theme.lineStrong }]}>
              <View style={{ height: 6, borderRadius: 3, width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%`, backgroundColor: theme.accentFill }} />
            </View>
            <GhostButton label={es.importer.cancel} onPress={() => (stop.current = true)} />
          </View>
        ) : (
          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: space.md }}>
            <View>
              <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
                {es.importer.detected}
              </T>
              <T face="mono" style={{ color: theme.text.primary, fontSize: 13, marginTop: 4 }}>
                {summary.from ? `${dateLabel(summary.from)} → ${dateLabel(summary.to!)}` : es.viewer.noDate}
              </T>
              <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 2 }}>
                {[
                  summary.exif ? `${summary.exif} ${es.importer.fromExif}` : null,
                  summary.file ? `${summary.file} ${es.importer.fromFile}` : null,
                  summary.none ? `${summary.none} ${es.importer.noDate}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </T>
              {summary.file ? (
                <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 4 }}>
                  {es.importer.fileDateWarning}
                </T>
              ) : null}
            </View>

            <View style={styles.switchRow}>
              <T face="semibold" style={{ color: theme.text.primary, fontSize: 14, flex: 1 }}>
                {es.importer.overrideAll}
              </T>
              <Switch value={override} onValueChange={setOverride} accessibilityLabel={es.importer.overrideAll} />
            </View>
            {showDate ? (
              <>
                <DateField label={override ? es.importer.overrideLabel : es.importer.undatedLabel(summary.none)} value={overrideDate} onChange={setOverrideDate} noFuture />
                <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
                  {es.importer.precision}
                </T>
                <View style={{ flexDirection: 'row' }}>
                  {(['day', 'month', 'year'] as DatePrecision[]).map((p) => (
                    <Chip key={p} label={es.importer.precisions[p]} selected={precision === p} onPress={() => setPrecision(p)} />
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
                  {Platform.OS === 'web' ? es.importer.downloadOriginals : es.importer.saveOriginals}
                </T>
                {Platform.OS !== 'web' ? (
                  <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
                    {es.importer.saveOriginalsHint}
                  </T>
                ) : null}
              </View>
              <Switch value={keepOriginals} onValueChange={setKeepOriginals} accessibilityLabel={es.importer.saveOriginals} />
            </View>

            <PrimaryButton
              label={es.importer.start(candidates?.length ?? 0)}
              onPress={() => void start()}
            />
          </ScrollView>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { flex: 1, paddingHorizontal: space.gutter, paddingTop: space.lg },
  webBox: { gap: space.lg, marginTop: space.md },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  month: { width: '31%', flexGrow: 1, borderWidth: 1, borderRadius: radius.input, paddingVertical: space.md, alignItems: 'center', minHeight: 72 },
  monthBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  check: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.input, padding: space.sm, marginBottom: space.md },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.gutter, paddingVertical: space.md, borderTopWidth: 1 },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
