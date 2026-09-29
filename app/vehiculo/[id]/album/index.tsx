import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { PhotoThumb } from '@/components/album/PhotoThumb';
import { StorageMeter } from '@/components/album/StorageMeter';
import { T } from '@/components/T';
import { Badge, EmptyState, GhostButton, HazardDivider, Segmented, type BadgeTone } from '@/components/ui';
import { categoryColors, categoryInkLight, radius, space, type CategoryKey } from '@/constants/theme';
import { albumPhotos, modPairs, odometerReadings, timelineEvents, type AlbumPhoto } from '@/lib/db/albumQueries';
import { vehicleOwnership, vehicles as vehicleRepo } from '@/lib/db/repos';
import type { Vehicle } from '@/lib/db/types';
import {
  albumYears,
  buildTimeline,
  flattenGrid,
  gridLayout,
  gridSections,
  type GridRow,
  type TimelineItem,
  type TimelineSection,
} from '@/lib/domain/album';
import { dateLabel, km as fmtKm, monthTitle } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The album (IMP 28092026 Phase 3, Album.dc.html): the car's life as a
 * timeline — hitos, mods with their before/after, junte days, repairs with
 * photos, loose photos by month — or as a plain grid. A year scrubber jumps;
 * the meter at the bottom says what is backed up.
 *
 * Both modes are FlatLists over flattened rows. The grid's rows have fixed
 * heights, so a year jump is an offset (`getItemLayout`); timeline cards vary,
 * so it jumps by index.
 */
type Mode = 'timeline' | 'grid';

type Row =
  | { type: 'header'; key: string; section: TimelineSection; current: boolean }
  | { type: 'item'; key: string; item: TimelineItem };

const GAP = 6;
const HEADER_H = 48;

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme, scheme } = useTheme();
  const { width } = useWindowDimensions();

  const [mode, setMode] = useState<Mode>('timeline');
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [photos, setPhotos] = useState<AlbumPhoto[] | null>(null);
  const [sections, setSections] = useState<TimelineSection[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const listRef = useRef<FlatList<Row>>(null);
  const gridRef = useRef<FlatList<GridRow>>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [v, ps, events, readings, pairs, own] = await Promise.all([
      vehicleRepo.getById(id),
      albumPhotos(id),
      timelineEvents(id),
      odometerReadings(id),
      modPairs(id),
      vehicleOwnership.getById(`own_${id}`),
    ]);
    setVehicle(v);
    setPhotos(ps);
    const built = buildTimeline({ photos: ps, events, readings, modPairs: pairs });
    setSections(built);
    const oldest = ps.length ? ps[ps.length - 1].takenAt ?? ps[ps.length - 1].createdAt : null;
    const eventDates = events.map((e) => e.date).sort();
    setYears(
      albumYears({
        acquiredAt: own?.acquiredAt ?? null,
        soldAt: own?.soldAt ?? null,
        oldestPhoto: [oldest, eventDates[0]].filter(Boolean).sort()[0] ?? null,
      }),
    );
  }, [id]);

  // Back from the importer, the viewer or a hito: re-read.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const today = new Date();
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const rows: Row[] = useMemo(
    () =>
      sections.flatMap((s) => [
        { type: 'header' as const, key: `h:${s.key}`, section: s, current: s.key === currentKey },
        ...s.items.map((item) => ({ type: 'item' as const, key: item.id, item })),
      ]),
    [sections, currentKey],
  );

  const inner = width - space.gutter * 2;
  const cell = Math.floor((inner - GAP * 2) / 3);
  const gridRows = useMemo(() => flattenGrid(gridSections(photos ?? [])), [photos]);
  const layout = useMemo(() => gridLayout(gridRows, HEADER_H, cell + GAP), [gridRows, cell]);

  const colorOf = (k: CategoryKey) => (scheme === 'light' ? categoryInkLight[k] : categoryColors[k]);
  const name = vehicle ? (vehicle.nickname || vehicle.name).toUpperCase() : '';
  const openPhoto = (mediaId: string) => router.push({ pathname: '/foto/[id]', params: { id: mediaId, vehicleId: id } });

  function jumpTo(year: number) {
    setActiveYear(year);
    if (mode === 'grid') {
      const index = gridRows.findIndex((r) => r.type === 'header' && r.year <= year);
      if (index >= 0) gridRef.current?.scrollToOffset({ offset: layout[index].offset, animated: true });
    } else {
      const index = rows.findIndex((r) => r.type === 'header' && r.section.year <= year);
      if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
    }
  }

  const header = (
    <View>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
            {es.album.eyebrow(name)}
            <T face="kana" style={{ color: theme.text.muted, fontSize: 10, letterSpacing: 0, textTransform: 'none' }}>
              {' 記録'}
            </T>
          </T>
          <T face="display" accessibilityRole="header" style={[styles.h, { color: theme.text.primary }]}>
            {mode === 'timeline' ? es.album.title : es.album.gridTitle}
          </T>
        </View>
        <Pressable
          onPress={() => router.push({ pathname: '/album/importar', params: { vehicleId: id } })}
          accessibilityRole="button"
          accessibilityLabel={es.album.import}
          style={[styles.importBtn, { backgroundColor: theme.accentFill }]}>
          <Ionicons name="images-outline" size={22} color={theme.accentFillInk} />
        </Pressable>
      </View>

      <Segmented<Mode>
        options={[
          { key: 'timeline', label: es.album.viewTimeline },
          { key: 'grid', label: es.album.viewGrid },
        ]}
        value={mode}
        onChange={setMode}
        style={{ marginTop: space.md }}
      />

      {years.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.scrubber, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]} contentContainerStyle={styles.scrubberInner}>
          {[...years].reverse().map((y) => {
            const on = activeYear === y;
            return (
              <Pressable key={y} onPress={() => jumpTo(y)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={String(y)} hitSlop={6} style={styles.yearBtn}>
                <T face={on ? 'monoBold' : 'mono'} style={{ color: on ? theme.accent : theme.text.muted, fontSize: 12 }}>
                  {y}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.actions}>
        <GhostButton label={es.album.addHito} onPress={() => router.push({ pathname: '/hito/nuevo', params: { vehicleId: id } })} style={{ flex: 1 }} />
        <GhostButton label={es.album.state} onPress={() => router.push({ pathname: '/vehiculo/[id]/album/estado', params: { id } })} style={{ flex: 1 }} />
      </View>
    </View>
  );

  const footer = <StorageMeter vehicleId={id} style={{ marginTop: space.xl }} />;
  const empty =
    photos && !photos.length && !sections.length ? (
      <EmptyState icon="images-outline" message={es.album.empty} actionLabel={es.album.import} onAction={() => router.push({ pathname: '/album/importar', params: { vehicleId: id } })} />
    ) : null;

  if (mode === 'grid') {
    return (
      <FlatList
        ref={gridRef}
        style={{ backgroundColor: theme.bg.base }}
        contentContainerStyle={styles.pad}
        data={gridRows}
        keyExtractor={(r) => r.key}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={empty}
        getItemLayout={(_, index) => ({ ...layout[index], index })}
        initialNumToRender={12}
        windowSize={7}
        renderItem={({ item: r }) =>
          r.type === 'header' ? (
            <View style={[styles.gridHeader, { height: HEADER_H }]}>
              <T face="display" style={{ color: theme.text.primary, fontSize: 18, textTransform: 'uppercase' }}>
                {r.month == null ? es.album.yearOnly(r.year) : monthTitle(r.year, r.month)}
              </T>
              <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
                {es.album.photos(r.count)}
              </T>
            </View>
          ) : (
            <View style={[styles.gridRow, { height: cell + GAP }]}>
              {r.photos.map((p) => (
                <PhotoThumb key={p.id} mediaId={p.id} blurhash={p.blurhash} size={cell} onPress={() => openPhoto(p.id)} accessibilityLabel={p.takenAt ? dateLabel(p.takenAt) : es.viewer.noDate}>
                  {p.isFavorite ? <Ionicons name="star" size={14} color={theme.accentFill} style={styles.star} /> : null}
                </PhotoThumb>
              ))}
            </View>
          )
        }
      />
    );
  }

  return (
    <FlatList
      ref={listRef}
      style={{ backgroundColor: theme.bg.base }}
      contentContainerStyle={styles.pad}
      data={rows}
      keyExtractor={(r) => r.key}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={empty}
      initialNumToRender={8}
      windowSize={7}
      onScrollToIndexFailed={({ index, averageItemLength }) =>
        listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true })
      }
      renderItem={({ item: r }) =>
        r.type === 'header' ? (
          <SectionHeader section={r.section} current={r.current} />
        ) : (
          <TimelineCard
            item={r.item}
            width={inner - 26}
            dot={dotColor(r.item, colorOf, theme.text.muted)}
            onPhoto={openPhoto}
            onOpen={() => {
              if (r.item.kind === 'hito') router.push({ pathname: '/hito/[id]', params: { id: r.item.id } });
              else if (r.item.kind === 'mantenimiento') router.push({ pathname: '/servicio/[id]', params: { id: r.item.id } });
              else if (r.item.kind === 'pista') router.push({ pathname: '/pista/evento/[id]', params: { id: r.item.id } });
            }}
          />
        )
      }
    />
  );
}

function dotColor(item: TimelineItem, colorOf: (k: CategoryKey) => string, muted: string): string {
  switch (item.kind) {
    case 'hito':
      return colorOf('album');
    case 'mod':
      return colorOf('mejora');
    case 'pista':
      return colorOf('track');
    case 'mantenimiento':
      return colorOf('mantenimiento');
    default:
      return muted;
  }
}

function SectionHeader({ section, current }: { section: TimelineSection; current: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={styles.sectionHeader} accessibilityRole="header">
      <T face="display" style={{ color: current ? theme.text.primary : theme.text.secondary, fontSize: 20, textTransform: 'uppercase' }}>
        {section.month == null ? es.album.yearOnly(section.year) : monthTitle(section.year, section.month)}
      </T>
      {/* The one hazard divider the screen gets: this month. */}
      {current ? <HazardDivider style={{ flex: 1 }} /> : <View style={[styles.rule, { backgroundColor: theme.lineStrong }]} />}
      {section.odometerKm != null ? (
        <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
          {fmtKm(Math.round(section.odometerKm))}
        </T>
      ) : null}
    </View>
  );
}

const BADGE: Record<TimelineItem['kind'], BadgeTone> = { hito: 'red', mod: 'green', pista: 'amber', mantenimiento: 'outline', fotos: 'outline' };

function TimelineCard({
  item,
  width,
  dot,
  onPhoto,
  onOpen,
}: {
  item: TimelineItem;
  width: number;
  dot: string;
  onPhoto: (id: string) => void;
  onOpen: () => void;
}) {
  const { theme } = useTheme();
  const label =
    item.kind === 'mod' && item.removed
      ? es.album.kinds.modRemoved
      : item.kind === 'pista'
        ? es.album.disciplines[item.discipline] ?? es.album.kinds.pista
        : es.album.kinds[item.kind];
  const title = item.kind === 'fotos' ? es.album.photos(item.photos.length) : item.title;
  const note = item.kind === 'hito' ? [item.subtitle, item.story ? `“${item.story}”` : null].filter(Boolean).join(' · ') : item.kind !== 'fotos' ? item.subtitle : null;
  const pair = item.kind === 'mod' && (item.before || item.after) ? { before: item.before ?? null, after: item.after ?? null } : null;

  const columns = item.kind === 'fotos' ? 4 : 3;
  const cell = Math.floor((width - GAP * (columns - 1)) / columns);
  const shown = item.photos.slice(0, columns);
  const extra = item.photos.length - shown.length;
  const tappable = item.kind === 'hito' || item.kind === 'mantenimiento' || item.kind === 'pista';

  return (
    <View style={styles.card}>
      <View style={styles.railCol}>
        <View style={[styles.rail, { backgroundColor: theme.lineStrong }]} />
        <View style={[styles.dot, { backgroundColor: dot, borderColor: theme.bg.base }]} />
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <Pressable onPress={tappable ? onOpen : undefined} disabled={!tappable} accessibilityRole={tappable ? 'button' : undefined} style={styles.cardTitle}>
          <Badge label={label} tone={BADGE[item.kind]} />
          <T face="semibold" numberOfLines={2} style={{ color: theme.text.primary, fontSize: 16, flex: 1 }}>
            {title}
          </T>
        </Pressable>

        {pair ? (
          <View style={styles.pair}>
            {(['before', 'after'] as const).map((k) =>
              pair[k] ? (
                <PhotoThumb key={k} mediaId={pair[k]!} size={Math.floor((width - GAP) / 2)} height={92} onPress={() => onPhoto(pair[k]!)} accessibilityLabel={k === 'before' ? es.album.before : es.album.after}>
                  <View style={[styles.pairTag, { backgroundColor: k === 'after' ? theme.accentFill : 'rgba(18,18,18,0.7)' }]}>
                    <T face="eyebrow" style={{ color: k === 'after' ? theme.accentFillInk : '#B3B3B3', fontSize: 10 }}>
                      {k === 'before' ? es.album.before : es.album.after}
                    </T>
                  </View>
                </PhotoThumb>
              ) : null,
            )}
          </View>
        ) : null}

        {shown.length ? (
          <View style={styles.thumbs}>
            {shown.map((p, i) => {
              const last = i === shown.length - 1 && extra > 0;
              return (
                <PhotoThumb key={p.id} mediaId={p.id} blurhash={p.blurhash} size={cell} onPress={() => onPhoto(p.id)} accessibilityLabel={last ? es.album.more(extra + 1) : p.takenAt ? dateLabel(p.takenAt) : title}>
                  {last ? (
                    <View style={[StyleSheet.absoluteFill, styles.more]}>
                      <T face="monoBold" style={{ color: '#FFFFFF', fontSize: 15 }}>
                        {es.album.more(extra + 1)}
                      </T>
                    </View>
                  ) : null}
                </PhotoThumb>
              );
            })}
          </View>
        ) : null}

        {note ? (
          <T face="body" numberOfLines={3} style={{ color: theme.text.secondary, fontSize: 13 }}>
            {note}
          </T>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  h: { fontSize: 30, lineHeight: 32, textTransform: 'uppercase', marginTop: 2 },
  importBtn: { width: 44, height: 44, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  scrubber: { marginTop: space.md, borderWidth: 1, borderRadius: 10, flexGrow: 0 },
  scrubberInner: { paddingHorizontal: space.sm, gap: space.sm, flexGrow: 1, justifyContent: 'space-between' },
  yearBtn: { paddingVertical: 10, paddingHorizontal: 6, minHeight: 40, justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, marginBottom: space.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: space.lg, marginBottom: space.sm },
  rule: { flex: 1, height: 1 },
  card: { flexDirection: 'row', gap: 12, marginBottom: space.md },
  railCol: { width: 2, alignItems: 'center' },
  rail: { position: 'absolute', top: 0, bottom: -space.md, width: 2, borderRadius: 1 },
  dot: { position: 'absolute', top: 6, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  pair: { flexDirection: 'row', gap: GAP },
  pairTag: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  thumbs: { flexDirection: 'row', gap: GAP },
  more: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  gridHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gridRow: { flexDirection: 'row', gap: GAP },
  star: { position: 'absolute', top: 4, right: 4 },
});
