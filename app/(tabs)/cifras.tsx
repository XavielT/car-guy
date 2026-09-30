import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DistanceBars } from '@/components/charts/DistanceBars';
import { GarageCostCard, OwnershipCard } from '@/components/costs/OwnershipCard';
import { Donut } from '@/components/charts/Donut';
import { EconomyLegend, EconomyLine } from '@/components/charts/EconomyLine';
import { StackedBars } from '@/components/charts/StackedBars';
import { T } from '@/components/T';
import { TripsCifrasBlock } from '@/components/trips/TripPieces';
import { EmptyState, GhostButton, PrimaryButton, SectionHeader, Segmented, Surface } from '@/components/ui';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { space } from '@/constants/theme';
import { garageOwnershipCost, vehicleStats, type VehicleStats } from '@/lib/db/statsQueries';
import type { GarageCost } from '@/lib/domain/costs';
import { latestEconomyInsight } from '@/lib/domain/economy';
import { capacityHint, fuelCfgFor, partialEconomy } from '@/lib/domain/partialEconomy';
import { fromLiters } from '@/lib/domain/units';
import { vehicles as vehicleRepo } from '@/lib/db/repos';
import type { Delta, PeriodKey } from '@/lib/domain/stats';
import { economyNumber, km, kmPerUnit, money } from '@/lib/format';
import { FEATURE_BUILD, FEATURE_TRACK, FEATURE_TRIPS } from '@/lib/flags';
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
  const { activeVehicle, vehicleFillups, data, updateSettings, refresh } = useStore();

  const [period, setPeriod] = useState<PeriodKey>('trimestre');
  const [stats, setStats] = useState<VehicleStats | null>(null);
  const [garage, setGarage] = useState<GarageCost | null>(null);

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

  // The garage total is lifetime and period-free, so it reloads with the data only —
  // and only when there is a garage to total (the card needs two cars).
  const garageSize = data.vehicles.length;
  useEffect(() => {
    if (garageSize < 2) return;
    let cancelled = false;
    garageOwnershipCost()
      .then((result) => {
        if (!cancelled) setGarage(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [data, garageSize]);

  // Economy is a fill-up series, not a spend series, so it comes from the store
  // rather than from the stats query — and from computeEconomy, which drops the
  // tanks it cannot measure.
  // Note 4: measured tanks, reconciled parts, gauge estimates and gaps.
  const includeEstimates = Boolean(data.settings.includeEstimates);
  const partial = partialEconomy(vehicleFillups, fuelCfgFor(activeVehicle?.detail), { includeEstimates });
  const points = partial.series;
  const hasEstimates = points.some((p) => p.status !== 'measured');
  // §1.4: a tank that keeps taking more than its stated size.
  const capacity = capacityHint(vehicleFillups, fuelCfgFor(activeVehicle?.detail));
  const unitOf = activeVehicle?.detail?.volumeUnit ?? 'gal';
  const applyCapacity = () => {
    if (!activeVehicle || !capacity) return;
    void vehicleRepo
      .upsert({
        id: activeVehicle.id,
        tankVolume: capacity.suggestedL,
        tankVolumeEntered: Math.round(fromLiters(capacity.suggestedL, unitOf) * 10) / 10,
      })
      .then(refresh);
  };
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg.base }]} edges={['top']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.pad}>
        <ScreenTitle title={es.stats.title} size={34} sub={es.stats.subtitle(activeVehicle.name)} />

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
                value={partial.average != null ? kmPerUnit(partial.average, activeVehicle.defaultFuelType, activeVehicle.detail?.volumeUnit, activeVehicle.detail?.economyUnit) : '—'}
                onPress={() => scrollTo('economy')}
              />
              {FEATURE_BUILD && stats.modsInvested > 0 ? (
                <Kpi
                  label={es.stats.modsInvested}
                  value={money(stats.modsInvested)}
                  hint={es.stats.modsInvestedHint}
                  onPress={() => router.push({ pathname: '/vehiculo/[id]/build', params: { id: activeVehicle.id } })}
                />
              ) : null}
              {FEATURE_TRACK && stats.trackDays > 0 ? (
                <Kpi
                  label={es.stats.trackDays}
                  value={String(stats.trackDays)}
                  hint={es.stats.trackDaysHint(money(stats.byCategory.find((c) => c.category === 'pista')?.total ?? 0))}
                  onPress={() => router.push({ pathname: '/pista', params: { vehicleId: activeVehicle.id } })}
                />
              ) : null}
            </View>

            <View onLayout={rememberOffset('byMonth')}>
              <StackedBars months={stats.monthly} />
            </View>

            <View onLayout={rememberOffset('byCategory')}>
              <Donut totals={stats.byCategory} total={stats.kpis.spend} />
            </View>

            <View onLayout={rememberOffset('economy')}>
              <EconomyLine
                points={points}
                average={partial.average}
                fuelType={activeVehicle.defaultFuelType}
                volumeUnit={activeVehicle.detail?.volumeUnit}
                economyUnit={activeVehicle.detail?.economyUnit}
              />
              {hasEstimates ? (
                <>
                  <EconomyLegend />
                  <Pressable
                    onPress={() => updateSettings({ includeEstimates: !includeEstimates })}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: includeEstimates }}
                    style={styles.estimatesToggle}>
                    <View
                      style={[
                        styles.estimatesBox,
                        { borderColor: includeEstimates ? theme.accentFill : theme.lineStrong, backgroundColor: includeEstimates ? theme.accentFill : theme.bg.raised },
                      ]}
                    />
                    <T face="body" style={{ color: theme.text.secondary, fontSize: 14, flex: 1 }}>
                      {es.estimate.includeEstimates}
                    </T>
                  </Pressable>
                </>
              ) : null}
              {capacity ? (
                <Surface style={styles.card}>
                  <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20 }}>
                    {es.estimate.capacity(
                      economyNumber(fromLiters(capacity.extraL, unitOf)),
                      unitOf === 'gal' ? 'gal' : 'L',
                      capacity.samples,
                    )}
                  </T>
                  <GhostButton
                    label={es.estimate.capacityApply(
                      economyNumber(fromLiters(capacity.suggestedL, unitOf)),
                      unitOf === 'gal' ? 'gal' : 'L',
                    )}
                    onPress={applyCapacity}
                  />
                </Surface>
              ) : null}
            </View>

            <View onLayout={rememberOffset('km')}>
              <DistanceBars months={stats.monthlyDistance} />
            </View>

            {insight ? (
              <Surface style={styles.card}>
                <T face="eyebrow" style={[styles.cardLabel, { color: theme.text.muted }]}>
                  {es.stats.lastTank}
                  <T face="kana" style={styles.kana}>
                    {' 燃費'}
                  </T>
                </T>
                {/* A word, not a number: Saira, in the one status colour this card gets. */}
                <T
                  face="display"
                  style={[
                    styles.cardValue,
                    {
                      color:
                        insight.status === 'low'
                          ? theme.statusText.urgente
                          : insight.status === 'great'
                            ? theme.statusText.ok
                            : theme.text.primary,
                    },
                  ]}>
                  {es.stats.lastTankValues[insight.status]}
                </T>
                <T face="body" style={[styles.cardHint, { color: theme.text.secondary }]}>
                  {es.stats.lastTankHint(kmPerUnit(insight.baseline, activeVehicle.defaultFuelType, activeVehicle.detail?.volumeUnit, activeVehicle.detail?.economyUnit))}
                </T>
              </Surface>
            ) : null}

            {/* Note 8: "lo que me ha costado" — lib/domain/costs.ts, the same figure as the report and the CSV. */}
            {stats.ownership ? <OwnershipCard cost={stats.ownership} /> : null}
            {garageSize >= 2 && garage ? <GarageCostCard garage={garage} /> : null}

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
                        <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
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

        {/* Phase 5: this month's trips; renders nothing without any. */}
        {FEATURE_TRIPS ? <TripsCifrasBlock vehicleId={activeVehicle.id} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
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

  // "Sin comparación" is not a rise — it gets the neutral colour, not the warning one.
  const deltaColor =
    !delta || delta.percent == null || delta.direction === 'flat' || invertDelta
      ? theme.text.muted
      : delta.direction === 'up'
        ? theme.statusText.urgente
        : theme.statusText.ok;

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
        <T face="eyebrow" style={[styles.cardLabel, { color: theme.text.muted }]}>
          {label}
        </T>
        {/* A long amount steps down instead of being cut off ("RD$ 13,500…"). */}
        <T
          face="monoBold"
          style={[styles.kpiValue, value.length > 10 && { fontSize: 17 }, { color: theme.text.primary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}>
          {value}
        </T>
        {deltaText ? (
          <T face="body" style={{ color: deltaColor, fontSize: 12, marginTop: 4 }}>
            {/* The figure in mono, the words in the body face. */}
            <T face={delta?.percent != null ? 'mono' : 'body'} style={{ fontSize: 11 }}>
              {deltaText}
            </T>{' '}
            {es.stats.vsPrevious}
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
  estimatesToggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44, marginTop: space.sm },
  estimatesBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1 },
  safe: { flex: 1 },
  pad: { padding: space.gutter, paddingBottom: 48 },
  periodHint: { fontSize: 13, marginTop: space.sm, marginBottom: space.lg },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginBottom: space.md },
  kpi: { flexGrow: 1, flexBasis: 150 },
  kpiValue: { fontSize: 22, marginTop: 6 },
  cardLabel: { fontSize: 11 },
  kana: { fontSize: 10, letterSpacing: 0, textTransform: 'none' },
  cardValue: { fontSize: 24, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  cardHint: { fontSize: 12, marginTop: space.sm, lineHeight: 18 },
  card: { marginBottom: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  rule: { height: 1, marginVertical: space.sm },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 },
  actions: { marginTop: space.xl, gap: space.sm },
});
