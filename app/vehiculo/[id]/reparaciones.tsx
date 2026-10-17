import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PermissionBanner } from '@/components/permissions/PermissionBanner';
import { FilterBar } from '@/components/pickers';
import { ListCardsSkeleton } from '@/components/skeletons/ListCardsSkeleton';
import { T } from '@/components/T';
import { EmptyState, PrimaryButton, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { serviceRecords as serviceRecordRepo } from '@/lib/db/repos';
import type { ServiceCategory, ServiceRecord } from '@/lib/db/types';
import { todayIso } from '@/lib/domain/dates';
import {
  applyRepairFilters,
  isWarrantySoon,
  NO_REPAIR_FILTERS,
  ownWork,
  repairShops,
  repairsOf,
  repairYears,
  summarizeByShop,
  totalSpent,
  warrantyState,
  type RepairFilters,
} from '@/lib/domain/repairs';
import { dateLabel, money } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Reparaciones (IMP 16102026 N7): every repair of the car — the shop's and the ones you did yourself — with the total
 * spent, filters by system, shop and year, and a summary by shop (how many times, how much, the last visit).
 */
export default function RepairsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { data } = useStore();
  const [rows, setRows] = useState<ServiceRecord[] | null>(null);
  const [filters, setFilters] = useState<RepairFilters>(NO_REPAIR_FILTERS);

  useEffect(() => {
    if (!id) return;
    let live = true;
    void serviceRecordRepo
      .listWhere({ vehicleId: id })
      .then((all) => live && setRows(repairsOf(all)))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [id, data]);

  const showSkeleton = useDelayedLoading(rows === null);
  const all = rows ?? [];
  const shown = useMemo(() => applyRepairFilters(all, filters), [all, filters]);
  const today = todayIso();
  const soon = all.filter((r) => isWarrantySoon(r.warrantyUntilDate, today)).length;
  const shops = repairShops(all);
  const years = repairYears(all);
  const systems = [...new Set(all.map((r) => r.system).filter((s): s is ServiceCategory => Boolean(s)))];

  const add = () => router.push({ pathname: '/servicio/nuevo', params: { kind: 'reparacion', vehicleId: id } });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
          {t.repair.list.eyebrow}
        </T>
        <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 30, textTransform: 'uppercase', marginBottom: space.md }}>
          {t.repair.list.title}
        </T>

        {rows === null ? (
          showSkeleton ? <ListCardsSkeleton n={4} lines={2} /> : null
        ) : !all.length ? (
          <EmptyState icon="build-outline" message={t.repair.list.empty} actionLabel={t.repair.title} onAction={add} />
        ) : (
          <>
            <Surface style={{ marginBottom: space.md }}>
              <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
                {t.repair.list.spent}
              </T>
              <T face="monoBold" style={{ color: theme.text.primary, fontSize: 26, marginTop: 2 }}>
                {money(totalSpent(shown))}
              </T>
              <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 2 }}>
                {t.repair.list.count(shown.length)}
                {ownWork(shown).length ? ` · ${t.repair.list.own}: ${ownWork(shown).length}` : ''}
              </T>
              {soon ? (
                <T face="semibold" style={{ color: theme.statusText.proximo, fontSize: 13, marginTop: space.sm }}>
                  {t.repair.list.warranties(soon)}
                </T>
              ) : null}
            </Surface>

            {/* A warranty about to end, and no permission to tell you: the way to allow it, right here (ADR-59). */}
            {soon ? <PermissionBanner ids={['notifications']} /> : null}

            <FilterBar
              filters={[
                {
                  key: 'system',
                  label: t.repair.list.filterSystem,
                  value: filters.system as string,
                  options: [{ value: '', label: t.repair.list.all }, ...systems.map((s) => ({ value: s as string, label: t.repair.systems[s] }))],
                  onChange: (v: string) => setFilters((f) => ({ ...f, system: v as ServiceCategory | '' })),
                },
                ...(shops.length
                  ? [
                      {
                        key: 'shop',
                        label: t.repair.list.filterShop,
                        value: filters.shop,
                        options: [{ value: '', label: t.repair.list.all }, ...shops.map((s) => ({ value: s, label: s }))],
                        onChange: (v: string) => setFilters((f) => ({ ...f, shop: v })),
                      },
                    ]
                  : []),
                {
                  key: 'year',
                  label: t.repair.list.filterYear,
                  value: filters.year,
                  options: [{ value: '', label: t.repair.list.all }, ...years.map((y) => ({ value: y, label: y }))],
                  onChange: (v: string) => setFilters((f) => ({ ...f, year: v })),
                },
              ]}
            />

            {summarizeByShop(shown).length ? (
              <>
                <T face="eyebrow" accessibilityRole="header" style={[styles.section, { color: theme.text.muted }]}>
                  {t.repair.list.byShop}
                </T>
                {summarizeByShop(shown).map((s) => (
                  <Surface key={s.shop} style={{ marginBottom: space.sm }}>
                    <View style={styles.shopRow}>
                      <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
                        {s.shop}
                      </T>
                      <T face="monoBold" style={{ color: theme.text.primary, fontSize: 14 }}>
                        {money(s.spent)}
                      </T>
                    </View>
                    <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
                      {t.repair.list.visits(s.visits)} · {t.repair.list.last(dateLabel(s.last))}
                    </T>
                  </Surface>
                ))}
              </>
            ) : null}

            {!shown.length ? (
              <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginTop: space.md }}>
                {t.repair.list.emptyFiltered}
              </T>
            ) : (
              <View style={{ marginTop: space.md }}>
                {shown.map((r) => {
                  const w = warrantyState(r.warrantyUntilDate, today);
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => router.push({ pathname: '/servicio/[id]', params: { id: r.id } })}
                      accessibilityRole="button"
                      style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.line }]}>
                      <View style={styles.shopRow}>
                        <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
                          {r.title}
                        </T>
                        <T face="monoBold" style={{ color: theme.text.primary, fontSize: 14 }}>
                          {money(r.totalDop)}
                        </T>
                      </View>
                      <T face="mono" style={{ color: theme.text.secondary, fontSize: 12, marginTop: 2 }}>
                        {dateLabel(r.occurredAt)}
                        <T face="body" style={{ fontSize: 12 }}>
                          {` · ${r.doneBy === 'self' ? t.repair.doneBy.self : r.shop || t.repair.doneBy[r.doneBy]}`}
                          {r.system ? ` · ${t.repair.systems[r.system]}` : ''}
                        </T>
                      </T>
                      {w.state === 'active' || w.state === 'today' ? (
                        <T face="body" style={{ color: isWarrantySoon(r.warrantyUntilDate, today) ? theme.statusText.proximo : theme.statusText.ok, fontSize: 12, marginTop: 2 }}>
                          {t.repair.detail.warranty}: {w.state === 'today' ? t.repair.detail.warrantyToday : t.repair.detail.warrantyLeft(w.days)}
                        </T>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
            <View style={{ marginTop: space.lg }}>
              <PrimaryButton label={t.repair.title} onPress={add} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  section: { fontSize: 11, marginTop: space.md, marginBottom: space.sm },
  shopRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  card: { minHeight: 64, padding: space.md, borderRadius: radius.button, borderWidth: 1, marginBottom: space.sm },
});
