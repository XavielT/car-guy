import type { EconomyUnit, VolumeUnit } from '@/lib/domain/units';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { TabsHistorialSkeleton } from '@/components/skeletons/TabsScreensSkeleton';
import { T } from '@/components/T';
import { EmptyState, GhostButton, RecordRow, Sheet, type RecordKind } from '@/components/ui';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { radius, space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { oilSummaries } from '@/lib/db/oilQueries';
import { history } from '@/lib/db/repos';
import type { HistoryEntry } from '@/lib/db/types';
import { perFillEconomy, type PerFillEconomy } from '@/lib/domain/perFillEconomy';
import { dateLabel, economyNumber, economyValue, km as fmtKm, kmPerUnit, money, monthTitle } from '@/lib/format';
import { economyLabel } from '@/lib/fuel';
import { historyIcon, historySubtitle, historyTitle } from '@/lib/domain/history';
import { FEATURE_EVENTS } from '@/lib/flagsV8';
import { t } from '@/lib/i18n';
import { FEATURE_ALBUM, FEATURE_BUILD, FEATURE_DIY, FEATURE_TRACK, FEATURE_TRIPS } from '@/lib/flags';
import { economyById } from '@/lib/math';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import type { FillUp } from '@/lib/types';

/** The filter chips — a function so the labels follow the language (ADR-39). */
const filters = (): { key: 'todo' | RecordKind; label: string }[] => [
  { key: 'todo', label: t.history.all },
  { key: 'combustible', label: t.history.kinds.combustible },
  { key: 'mantenimiento', label: t.history.kinds.mantenimiento },
  { key: 'reparacion', label: t.history.kinds.reparacion },
  // With the build log live the chip says MODS; it still finds v2.0 "mejora" records.
  { key: 'mejora', label: FEATURE_BUILD ? t.build.tabs.mods : t.history.kinds.mejora },
  { key: 'chequeo', label: t.history.kinds.chequeo },
  { key: 'gasto', label: t.history.kinds.gasto },
  // Milestones and track days are in the feed already (schema v2); their chips
  // appear with the screens that create them.
  ...(FEATURE_ALBUM ? [{ key: 'hito' as const, label: t.history.kinds.hito }] : []),
  // Events (ADR-44): crashes, breakdowns, tickets — their own rows since PROMPT-05.
  ...(FEATURE_EVENTS ? [{ key: 'evento' as const, label: t.events.historyChip }] : []),
  ...(FEATURE_TRACK ? [{ key: 'pista' as const, label: t.history.kinds.pista }] : []),
  ...(FEATURE_TRIPS ? [{ key: 'viaje' as const, label: t.history.kinds.viaje }] : []),
];

const PAGE = 50;

/**
 * The unified timeline — the thing Xaviel asked for in so many words: "todo lo
 * relacionado a su vehículo … un historial".
 *
 * It reads `history_feed`, the SQL view that unions fuel, service records,
 * expenses and inspections into one shape, so adding a kind in a later phase
 * means changing the view rather than this screen.
 */
export default function HistorialScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, vehicleFillups, data } = useStore();

  const [filter, setFilter] = useState<'todo' | RecordKind>('todo');
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  // `entries` starts empty, so "no records yet" would flash before the first
  // query answers: until then the rows' outline instead (ADR-40). Only the
  // first load — a filter, a search or a new record keeps the rows up.
  const [loaded, setLoaded] = useState(false);
  const showSkeleton = useDelayedLoading(!loaded);
  const [limit, setLimit] = useState(PAGE);
  const [hasMore, setHasMore] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // "5W-30 sintético · Castrol" per maintenance record with an oil item (note 16).
  const [oilLines, setOilLines] = useState<Map<string, string>>(new Map());

  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;

    (async () => {
      // One row over the limit tells us whether a "Cargar más" is worth showing
      // without a second COUNT query.
      const rows = await history.feed(vehicleId, {
        // Migrated improvements are mods now (schema v2); the Mejoras chip still finds them.
        kinds: filter === 'todo' ? undefined : filter === 'mejora' ? ['mejora', 'mod'] : [filter],
        q: query.trim() || undefined,
        limit: limit + 1,
      });
      if (cancelled) return;
      setHasMore(rows.length > limit);
      const page = rows.slice(0, limit);
      const oil = await oilSummaries(page.filter((e) => e.kind === 'mantenimiento').map((e) => e.id));
      if (cancelled) return;
      setOilLines(oil);
      setEntries(page);
      setLoaded(true);
    })().catch(() => {
      if (!cancelled) setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [vehicleId, filter, query, limit, data]);

  // km/gal per fill-up, exactly as the old screen showed it.
  const economy = useMemo(() => economyById(vehicleFillups), [vehicleFillups]);
  const perFillById = useMemo(() => perFillEconomy(vehicleFillups), [vehicleFillups]);
  const fillUpsById = useMemo(() => new Map(vehicleFillups.map((f) => [f.id, f])), [vehicleFillups]);

  const months = useMemo(() => groupByMonth(entries), [entries]);

  if (!activeVehicle) return null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg.base }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <ScreenTitle
          title={t.history.title}
          kana="記録"
          size={34}
          sub={`${activeVehicle.name}${activeVehicle.plate ? ` · ${activeVehicle.plate}` : ''}`}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersRow}>
          {filters().map((f) => {
            const on = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => {
                  setFilter(f.key);
                  setLimit(PAGE);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                aria-selected={on}
                hitSlop={{ top: 4, bottom: 4 }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: on ? theme.accentFill : theme.bg.surface,
                    borderColor: on ? theme.accentFill : theme.lineStrong,
                  },
                ]}>
                <T face="title" style={[styles.chipLabel, { color: on ? theme.accentFillInk : theme.text.secondary }]}>
                  {f.label}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>

        <Field
          label={t.history.search}
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setLimit(PAGE);
          }}
        />

        {!loaded || showSkeleton ? (
          showSkeleton ? <TabsHistorialSkeleton /> : null
        ) : entries.length === 0 ? (
          <EmptyState
            icon="time-outline"
            message={query.trim() || filter !== 'todo' ? t.history.emptyFiltered : t.history.empty}
          />
        ) : (
          months.map((group) => (
            <View key={group.key}>
              <View style={[styles.monthHeader, { borderColor: theme.lineStrong }]}>
                <T face="display" accessibilityRole="header" style={[styles.monthLabel, { color: theme.text.primary }]}>
                  {group.label}
                </T>
                <T face="mono" style={{ color: theme.text.secondary, fontSize: 13 }}>
                  {money(group.total)}
                </T>
              </View>
              {group.items.map((entry) => (
                <RecordRow
                  key={`${entry.kind}-${entry.id}`}
                  kind={entry.kind}
                  icon={historyIcon(entry)}
                  title={historyTitle(entry)}
                  meta={metaFor(entry, oilLines.get(entry.id))}
                  amount={entry.amountDop != null ? money(entry.amountDop) : null}
                  tag={tagFor(entry, economy, fillUpsById, activeVehicle.detail?.volumeUnit ?? 'gal', activeVehicle.detail?.economyUnit, perFillById)}
                  onPress={() => openDetail(entry, router)}
                />
              ))}
            </View>
          ))
        )}

        {hasMore && !showSkeleton ? <GhostButton label={t.history.loadMore} onPress={() => setLimit((l) => l + PAGE)} /> : null}
      </ScrollView>

      <Pressable
        onPress={() => setPickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t.history.addTitle}
        style={({ pressed }) => [styles.fab, { backgroundColor: pressed ? theme.accentPressed : theme.accentFill }]}>
        <Ionicons name="add" size={28} color={theme.accentFillInk} />
      </Pressable>

      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title={t.history.addTitle}>
        {(
          [
            [t.history.addFuel, '/carga/nueva'],
            [t.history.addService, '/servicio/nuevo?kind=mantenimiento'],
            [t.history.addRepair, '/servicio/nuevo?kind=reparacion'],
            [t.history.addUpgrade, '/servicio/nuevo?kind=mejora'],
            [t.history.addExpense, '/gasto/nuevo'],
            [t.history.addInspection, '/chequeo'],
            [t.history.addOdometer, '/odometro'],
            ...(FEATURE_ALBUM
              ? ([
                  [t.history.addMilestone, '/evento/nuevo?type=hito'],
                  ...(FEATURE_EVENTS ? ([[t.events.add, '/evento/nuevo']] as const) : []),
                  [t.history.addPhotos, '/album/importar'],
                ] as const)
              : []),
            ...(FEATURE_DIY ? ([[t.history.addObd, '/obd?add=1']] as const) : []),
          ] as const
        ).map(([label, route]) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            onPress={() => {
              setPickerOpen(false);
              router.push(route as never);
            }}
            style={[styles.pickerRow, { borderColor: theme.line }]}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
              {label}
            </T>
          </Pressable>
        ))}
      </Sheet>
    </SafeAreaView>
  );
}

function groupByMonth(entries: HistoryEntry[]) {
  const groups: { key: string; label: string; total: number; items: HistoryEntry[] }[] = [];
  for (const entry of entries) {
    const d = new Date(entry.occurredAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, label: monthTitle(d.getFullYear(), d.getMonth()), total: 0, items: [] };
      groups.push(group);
    }
    group.total += entry.amountDop ?? 0;
    group.items.push(entry);
  }
  return groups;
}

function metaFor(entry: HistoryEntry, oil?: string): string {
  const parts = [dateLabel(entry.occurredAt)];
  if (entry.odometerKm != null) parts.push(fmtKm(entry.odometerKm));
  const subtitle = historySubtitle(entry);
  // A check's subtitle is now its photo count ("📷 2"), never the template id.
  if (subtitle) parts.push(subtitle);
  if (oil) parts.push(oil);
  return parts.join(' · ');
}

/**
 * A fill-up's tag: "Parcial" for a partial tank (it never has an economy
 * number of its own — the next full tank measures it), otherwise its economy
 * in the unit its fuel is sold in, so GNV reads km/m³ rather than km/gal.
 */
function tagFor(
  entry: HistoryEntry,
  economy: ReturnType<typeof economyById>,
  fillUps: Map<string, FillUp>,
  volumeUnit: VolumeUnit,
  economyUnit?: EconomyUnit,
  perFill?: Map<string, PerFillEconomy>,
): string | null {
  if (entry.kind !== 'combustible') return null;
  const fill = fillUps.get(entry.id);
  if (fill && !fill.isFullTank) {
    // Note 9: a partial still says roughly how it went, marked approximate.
    const pf = perFill?.get(entry.id);
    if (!pf) return t.history.partialTag;
    const econ = fill.fuelType === 'gnv' ? null : economyUnit;
    return `${t.history.partialTag} · ${t.perFill.short(economyNumber(economyValue(pf.kmPerUnit, volumeUnit, econ)), economyLabel(fill.fuelType, volumeUnit, econ))}`;
  }
  const point = economy.get(entry.id);
  return point && fill ? kmPerUnit(point.kmPerUnit, fill.fuelType, volumeUnit, economyUnit) : null;
}

function openDetail(entry: HistoryEntry, router: ReturnType<typeof useRouter>) {
  if (entry.kind === 'combustible') {
    router.push({ pathname: '/carga/[id]', params: { id: entry.id } });
    return;
  }
  if (entry.kind === 'mantenimiento' || entry.kind === 'reparacion' || entry.kind === 'mejora') {
    router.push({ pathname: '/servicio/[id]', params: { id: entry.id } });
    return;
  }
  if (entry.kind === 'gasto') {
    router.push({ pathname: '/gasto/[id]', params: { id: entry.id } });
    return;
  }
  if (entry.kind === 'mod') {
    router.push({ pathname: '/mod/[id]', params: { id: entry.id } });
    return;
  }
  if (entry.kind === 'hito' || entry.kind === 'evento') {
    router.push({ pathname: '/evento/[id]', params: { id: entry.id } });
    return;
  }
  if (entry.kind === 'obd') {
    router.push({ pathname: '/obd/[code]', params: { code: entry.title, vehicleId: entry.vehicleId } });
    return;
  }
  if (entry.kind === 'pista') {
    router.push({ pathname: '/pista/evento/[id]', params: { id: entry.id } });
    return;
  }
  if (entry.kind === 'viaje') {
    router.push({ pathname: '/viaje/[id]', params: { id: entry.id } });
    return;
  }
  router.push({ pathname: '/inspeccion/[id]', params: { id: entry.id } });
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pad: { padding: space.gutter, paddingBottom: 96 },
  // flexGrow 0 + centred row: on web a horizontal ScrollView otherwise grows into the space a short
  // list leaves (the skeleton's), and every chip stretches with it.
  filters: { marginBottom: space.md, flexGrow: 0 },
  filtersRow: { alignItems: 'center' },
  // Filter pill (Build.dc.html's MODS · SPECS chips): Saira 600 tracked.
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space.md + 2,
    borderRadius: radius.chip,
    marginRight: space.sm,
    borderWidth: 1,
  },
  chipLabel: { fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: space.xl,
    marginBottom: space.sm,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  monthLabel: { fontSize: 20, textTransform: 'uppercase', letterSpacing: 0.4 },
  // Amber rounded square, 56 px — a switch on the dash, not a Material circle.
  fab: {
    position: 'absolute',
    right: space.gutter,
    bottom: space.gutter,
    width: 56,
    height: 56,
    borderRadius: radius.button + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerRow: { paddingVertical: space.md, borderBottomWidth: 1 },
});
