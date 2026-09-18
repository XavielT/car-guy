import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { EmptyState, GhostButton, RecordRow, Sheet, type RecordKind } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { history } from '@/lib/db/repos';
import type { HistoryEntry } from '@/lib/db/types';
import { FUEL_CATALOG } from '@/lib/fuel';
import { dateLabel, km as fmtKm, money, monthTitle } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { economyById } from '@/lib/math';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

const FILTERS: { key: 'todo' | RecordKind; label: string }[] = [
  { key: 'todo', label: es.history.all },
  { key: 'combustible', label: es.history.kinds.combustible },
  { key: 'mantenimiento', label: es.history.kinds.mantenimiento },
  { key: 'reparacion', label: es.history.kinds.reparacion },
  { key: 'mejora', label: es.history.kinds.mejora },
  { key: 'chequeo', label: es.history.kinds.chequeo },
  { key: 'gasto', label: es.history.kinds.gasto },
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
  const [limit, setLimit] = useState(PAGE);
  const [hasMore, setHasMore] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;

    (async () => {
      // One row over the limit tells us whether a "Cargar más" is worth showing
      // without a second COUNT query.
      const rows = await history.feed(vehicleId, {
        kinds: filter === 'todo' ? undefined : [filter],
        q: query.trim() || undefined,
        limit: limit + 1,
      });
      if (cancelled) return;
      setHasMore(rows.length > limit);
      setEntries(rows.slice(0, limit));
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [vehicleId, filter, query, limit, data]);

  // km/gal per fill-up, exactly as the old screen showed it.
  const economy = useMemo(() => economyById(vehicleFillups), [vehicleFillups]);

  const months = useMemo(() => groupByMonth(entries), [entries]);

  if (!activeVehicle) return null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg.base }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.history.title}
        </T>
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {activeVehicle.name}
          {activeVehicle.plate ? ` · ${activeVehicle.plate}` : ''}
        </T>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          {FILTERS.map((f) => {
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
                style={[
                  styles.chip,
                  { backgroundColor: on ? theme.accent : theme.bg.raised, borderColor: on ? theme.accent : theme.line },
                ]}>
                <T face="semibold" style={{ color: on ? theme.accentInk : theme.text.secondary, fontSize: 13 }}>
                  {f.label}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>

        <Field
          label={es.history.search}
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setLimit(PAGE);
          }}
        />

        {entries.length === 0 ? (
          <EmptyState
            icon="time-outline"
            message={query.trim() || filter !== 'todo' ? es.history.emptyFiltered : es.history.empty}
          />
        ) : (
          months.map((group) => (
            <View key={group.key}>
              <View style={styles.monthHeader}>
                <T face="title" style={{ color: theme.text.primary, fontSize: 17 }}>
                  {group.label}
                </T>
                <T face="mono" style={{ color: theme.text.muted, fontSize: 13 }}>
                  {money(group.total)}
                </T>
              </View>
              {group.items.map((entry) => (
                <RecordRow
                  key={`${entry.kind}-${entry.id}`}
                  kind={entry.kind}
                  title={titleFor(entry)}
                  meta={metaFor(entry)}
                  amount={entry.amountDop != null ? money(entry.amountDop) : null}
                  tag={tagFor(entry, economy)}
                  onPress={() => openDetail(entry, router)}
                />
              ))}
            </View>
          ))
        )}

        {hasMore ? <GhostButton label={es.history.loadMore} onPress={() => setLimit((l) => l + PAGE)} /> : null}
      </ScrollView>

      <Pressable
        onPress={() => setPickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={es.history.addTitle}
        style={[styles.fab, { backgroundColor: theme.accent }]}>
        <Ionicons name="add" size={26} color={theme.accentInk} />
      </Pressable>

      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title={es.history.addTitle}>
        {(
          [
            [es.history.addFuel, '/carga/nueva'],
            [es.history.addService, '/servicio/nuevo?kind=mantenimiento'],
            [es.history.addRepair, '/servicio/nuevo?kind=reparacion'],
            [es.history.addUpgrade, '/servicio/nuevo?kind=mejora'],
            [es.history.addExpense, '/gasto/nuevo'],
            [es.history.addOdometer, '/odometro'],
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

function titleFor(entry: HistoryEntry): string {
  // The view stores the fuel type in `title` for fill-ups and the inspection
  // status for checks; both need translating into something a person reads.
  if (entry.kind === 'combustible') {
    return FUEL_CATALOG[entry.title as keyof typeof FUEL_CATALOG]?.label ?? entry.title;
  }
  if (entry.kind === 'chequeo') return entry.title === 'ok' ? 'Chequeo · todo bien' : 'Chequeo · con fallas';
  return entry.title || '—';
}

function metaFor(entry: HistoryEntry): string {
  const parts = [dateLabel(entry.occurredAt)];
  if (entry.odometerKm != null) parts.push(fmtKm(entry.odometerKm));
  if (entry.subtitle && entry.kind !== 'chequeo') parts.push(entry.subtitle);
  return parts.join(' · ');
}

function tagFor(entry: HistoryEntry, economy: ReturnType<typeof economyById>): string | null {
  if (entry.kind !== 'combustible') return null;
  const point = economy.get(entry.id);
  return point ? `${point.kmPerUnit} km/gal` : null;
}

function openDetail(entry: HistoryEntry, router: ReturnType<typeof useRouter>) {
  if (entry.kind === 'combustible') {
    router.push({ pathname: '/carga/[id]', params: { id: entry.id } });
    return;
  }
  if (entry.kind === 'mantenimiento' || entry.kind === 'reparacion' || entry.kind === 'mejora') {
    router.push({ pathname: '/servicio/[id]', params: { id: entry.id } });
  }
  // Expenses and inspections get their detail routes with the rest of their
  // screens; until then those rows are informative rather than tappable-through.
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pad: { padding: space.gutter, paddingBottom: 96 },
  h: { fontSize: 34 },
  sub: { fontSize: 13, marginTop: 2, marginBottom: space.lg },
  filters: { marginBottom: space.md },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.chip,
    marginRight: space.sm,
    borderWidth: 1,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  fab: {
    position: 'absolute',
    right: space.gutter,
    bottom: space.gutter,
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerRow: { paddingVertical: space.md, borderBottomWidth: 1 },
});
