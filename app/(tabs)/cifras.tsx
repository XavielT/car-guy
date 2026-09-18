import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DistanceBars } from '@/components/charts/DistanceBars';
import { Donut } from '@/components/charts/Donut';
import { EconomyLine } from '@/components/charts/EconomyLine';
import { StackedBars } from '@/components/charts/StackedBars';
import { T } from '@/components/T';
import { EmptyState, GhostButton, PrimaryButton, SectionHeader, Segmented, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { vehicleStats, type VehicleStats } from '@/lib/db/statsQueries';
import { computeEconomy, latestEconomyInsight } from '@/lib/domain/economy';
import type { Delta, PeriodKey } from '@/lib/domain/stats';
import { km, money } from '@/lib/format';
import { economyLabel } from '@/lib/fuel';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

const PERIODS: PeriodKey[] = ['mes', 'trimestre', 'ano', 'todo'];

/**
 * The statistics screen: what the car costs, how far it goes and how that is
 * changing — note 9, *"con estadísticas y todo"*.
 *
 * Every number comes from `lib/domain/stats.ts` through `vehicleStats`; this
 * file does no arithmetic beyond picking a colour for an arrow.
 */
export default function CifrasScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, vehicleFillups, data } = useStore();

  const [period, setPeriod] = useState<PeriodKey>('trimestre');
  const [stats, setStats] = useState<VehicleStats | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const chartOffsets = useRef<Record<string, number>>({});

  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    vehicleStats(vehicleId, period)
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicleId, period, data]);

  // Economy is a fill-up series, not a spend series, so it comes from the store
  // rather than from the stats query — and from computeEconomy, which drops the
  // tanks it cannot measure.
  const points = computeEconomy(vehicleFillups);
  const insight = latestEconomyInsight(vehicleFillups);

  const scrollTo = useCallback((key: string) => {
    const y = chartOffsets.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  }, []);

  // useCallback, not a plain arrow: the lint rule that guards refs treats a
  // closure built during render as a read of `current`, and it is right to —
  // the stable identity is also one fewer prop change per chart.
  const rememberOffset = useCallback(
    (key: string) => (event: { nativeEvent: { layout: { y: number } } }) => {
      chartOffsets.current[key] = event.nativeEvent.layout.y;
    },
    [],
  );

  if (!activeVehicle) return null;

  const empty = stats != null && stats.kpis.spend === 0 && points.length === 0;
  const unit = economyLabel(activeVehicle.defaultFuelType);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg.base }]} edges={['top']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.stats.title}
        </T>
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {es.stats.subtitle(activeVehicle.name)}
        </T>

        <Segmented<PeriodKey>
          options={PERIODS.map((key) => ({ key, label: es.stats.periods[key] }))}
          value={period}
          onChange={setPeriod}
        />
        <T face="body" style={[styles.periodHint, { color: theme.text.muted }]}>
          {es.stats.periodHint[period]}
        </T>

        {empty ? (
          <EmptyState
            icon="stats-chart-outline"
            message={es.stats.empty}
            actionLabel={es.quickActions.fuel}
            onAction={() => router.push('/carga/nueva')}
          />
        ) : null}

        {stats && !empty ? (
          <>
            <View style={styles.kpis}>
              <Kpi
                label={es.stats.spend}
                value={money(stats.kpis.spend)}
                delta={stats.kpis.spendDelta}
                onPress={() => scrollTo('byMonth')}
              />
              <Kpi
                label={es.stats.costPerKm}
                value={stats.kpis.costPerKm != null ? money(stats.kpis.costPerKm) : '—'}
                hint={stats.kpis.costPerKm == null ? es.stats.noDistance : undefined}
                onPress={() => scrollTo('byCategory')}
              />
              <Kpi
                label={es.stats.distance}
                value={stats.kpis.distanceKm > 0 ? km(stats.kpis.distanceKm) : '—'}
                delta={stats.kpis.distanceDelta}
                invertDelta
                onPress={() => scrollTo('km')}
              />
              <Kpi
                label={es.stats.economy}
                value={points.length ? `${averageOf(points).toFixed(2)} ${unit}` : '—'}
                onPress={() => scrollTo('economy')}
              />
            </View>

            <View onLayout={rememberOffset('byMonth')}>
              <StackedBars months={stats.monthly} />
            </View>

            <View onLayout={rememberOffset('byCategory')}>
              <Donut totals={stats.byCategory} total={stats.kpis.spend} />
            </View>

            <View onLayout={rememberOffset('economy')}>
              <EconomyLine points={points} fuelType={activeVehicle.defaultFuelType} />
            </View>

            <View onLayout={rememberOffset('km')}>
              <DistanceBars months={stats.monthlyDistance} />
            </View>

            {insight ? (
              <Surface style={styles.card}>
                <T face="medium" style={[styles.cardLabel, { color: theme.text.muted }]}>
                  {es.stats.lastTank.toUpperCase()}
                </T>
                <T face="monoBold" style={[styles.cardValue, { color: theme.text.primary }]}>
                  {es.stats.lastTankValues[insight.status]}
                </T>
                <T face="body" style={[styles.cardHint, { color: theme.text.secondary }]}>
                  {es.stats.lastTankHint(`${insight.baseline.toFixed(2)} ${unit}`)}
                </T>
              </Surface>
            ) : null}

            {stats.ownership ? (
              <>
                <SectionHeader title={es.stats.ownership} caption={es.stats.ownershipCaption} />
                <Surface>
                  <Row label={es.stats.ownershipPurchase} value={money(stats.ownership.purchasePrice)} />
                  {stats.ownership.soldPrice != null ? (
                    <Row label={es.stats.ownershipSold} value={`− ${money(stats.ownership.soldPrice)}`} />
                  ) : null}
                  <Row label={es.stats.ownershipSpend} value={money(stats.ownership.spend)} />
                  <View style={[styles.rule, { backgroundColor: theme.line }]} />
                  <Row label={es.stats.ownershipTotal} value={money(stats.ownership.total)} strong />
                  {stats.ownership.costPerMonth != null ? (
                    <T face="body" style={[styles.cardHint, { color: theme.text.secondary }]}>
                      {es.stats.ownershipPerMonth}: {money(stats.ownership.costPerMonth)} ·{' '}
                      {es.stats.ownershipMonths(stats.ownership.monthsOwned)}
                    </T>
                  ) : null}
                </Surface>
              </>
            ) : null}

            <SectionHeader title={es.stats.upcoming} caption={es.stats.upcomingCaption} />
            <Surface>
              {stats.upcoming.items.length === 0 ? (
                <T face="body" style={{ color: theme.text.muted, fontSize: 13, lineHeight: 19 }}>
                  {es.stats.upcomingEmpty}
                </T>
              ) : (
                <>
                  {stats.upcoming.items.map((item) => (
                    <View key={item.id} style={styles.upcomingRow}>
                      <View style={{ flex: 1 }}>
                        <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
                          {item.title}
                        </T>
                        <T face="body" style={{ color: theme.text.muted, fontSize: 11, marginTop: 2 }}>
                          {es.stats.upcomingBasis[item.basis]}
                        </T>
                      </View>
                      <T face="mono" style={{ color: theme.text.primary, fontSize: 13 }}>
                        {money(item.amountDop)}
                      </T>
                    </View>
                  ))}
                  <View style={[styles.rule, { backgroundColor: theme.line }]} />
                  <Row label={es.stats.total} value={money(stats.upcoming.total)} strong />
                </>
              )}
            </Surface>

            <View style={styles.actions}>
              <PrimaryButton
                label={es.stats.report}
                onPress={() => router.push({ pathname: '/reporte', params: { period } })}
              />
              <GhostButton label={es.stats.csv} onPress={() => router.push('/exportar')} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function averageOf(points: { kmPerUnit: number }[]): number {
  return points.reduce((sum, p) => sum + p.kmPerUnit, 0) / points.length;
}

/**
 * One headline number. Tapping it scrolls to the chart it came from, which is
 * the whole reason a tile is a button rather than a label.
 *
 * `invertDelta` exists because up is not always good: spending more is worse,
 * driving more is neither, so distance gets a neutral colour rather than the
 * red that a rise in spend earns.
 */
function Kpi({
  label,
  value,
  hint,
  delta,
  invertDelta,
  onPress,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: Delta | null;
  invertDelta?: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  const deltaColor =
    !delta || delta.direction === 'flat' || invertDelta
      ? theme.text.muted
      : delta.direction === 'up'
        ? theme.status.urgente
        : theme.status.ok;

  const deltaText = !delta
    ? null
    : delta.percent == null
      ? delta.direction === 'up'
        ? es.stats.deltaNew
        : null
      : delta.direction === 'flat'
        ? es.stats.deltaFlat
        : delta.direction === 'up'
          ? es.stats.deltaUp(delta.percent)
          : es.stats.deltaDown(delta.percent);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [styles.kpi, { opacity: pressed ? 0.85 : 1 }]}>
      <Surface>
        <T face="medium" style={[styles.cardLabel, { color: theme.text.muted }]}>
          {label.toUpperCase()}
        </T>
        <T face="monoBold" style={[styles.kpiValue, { color: theme.text.primary }]} numberOfLines={1}>
          {value}
        </T>
        {deltaText ? (
          <T face="body" style={{ color: deltaColor, fontSize: 11, marginTop: 4 }}>
            {deltaText} {es.stats.vsPrevious}
          </T>
        ) : hint ? (
          <T face="body" style={{ color: theme.text.muted, fontSize: 11, marginTop: 4 }}>
            {hint}
          </T>
        ) : null}
      </Surface>
    </Pressable>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <T face={strong ? 'semibold' : 'body'} style={{ color: strong ? theme.text.primary : theme.text.secondary, fontSize: 14 }}>
        {label}
      </T>
      <T face="monoBold" style={{ color: theme.text.primary, fontSize: strong ? 16 : 14 }}>
        {value}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pad: { padding: space.gutter, paddingBottom: 48 },
  h: { fontSize: 34 },
  sub: { marginTop: 6, marginBottom: space.lg, lineHeight: 22 },
  periodHint: { fontSize: 11, marginTop: space.sm, marginBottom: space.lg },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginBottom: space.md },
  kpi: { flexGrow: 1, flexBasis: 150 },
  kpiValue: { fontSize: 22, marginTop: 6 },
  cardLabel: { fontSize: 11, letterSpacing: 0.9 },
  cardValue: { fontSize: 22, marginTop: 6 },
  cardHint: { fontSize: 12, marginTop: space.sm, lineHeight: 18 },
  card: { marginBottom: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  rule: { height: 1, marginVertical: space.sm },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 },
  actions: { marginTop: space.xl, gap: space.sm },
});
