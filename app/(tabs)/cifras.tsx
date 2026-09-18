import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { SectionHeader, Surface } from '@/components/ui';
import { categoryColors, space } from '@/constants/theme';
import {
  computeEconomy,
  distanceInLogs,
  inMonth,
  latestEconomyInsight,
  roundMoney,
  sumSpend,
} from '@/lib/domain/economy';
import { km, money, monthTitle } from '@/lib/format';
import { FUEL_CATALOG, FUEL_ORDER, economyLabel } from '@/lib/fuel';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import type { FuelType } from '@/lib/types';

function monthBuckets(fillups: { occurredAt: string; totalDop: number }[]) {
  const map = new Map<string, number>();
  for (const f of fillups) {
    const d = new Date(f.occurredAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    map.set(key, (map.get(key) ?? 0) + f.totalDop);
  }
  return [...map.entries()]
    .map(([key, total]) => {
      const [y, m] = key.split('-').map(Number);
      return { year: y, month: m, total: roundMoney(total), label: monthTitle(y, m) };
    })
    .sort((a, b) => (a.year === b.year ? b.month - a.month : b.year - a.year))
    .slice(0, 6);
}

/**
 * Restyled onto the tokens this phase, not rebuilt: PROMPT-07 replaces the tiles
 * and bars with the real statistics screen. Every number here is the one the
 * previous version showed.
 */
export default function CifrasScreen() {
  const { theme } = useTheme();
  const { vehicleFillups, vehicleExpenses, activeVehicle } = useStore();
  if (!activeVehicle) return null;

  const now = new Date();
  const monthLogs = vehicleFillups.filter((f) => inMonth(f.occurredAt, now.getFullYear(), now.getMonth()));
  const byType = FUEL_ORDER.map((type) => ({
    type,
    total: sumSpend(vehicleFillups.filter((f) => f.fuelType === type)),
  })).filter((x) => x.total > 0);
  const maxType = Math.max(...byType.map((x) => x.total), 1);
  const months = monthBuckets(vehicleFillups);
  const maxMonth = Math.max(...months.map((m) => m.total), 1);
  const dist = distanceInLogs(vehicleFillups);
  const allSpend = sumSpend(vehicleFillups);
  const expenseSpend = roundMoney(vehicleExpenses.reduce((total, expense) => total + expense.amountDop, 0));
  const combinedSpend = roundMoney(allSpend + expenseSpend);
  const costKm = dist > 0 ? roundMoney(combinedSpend / dist) : null;
  const eco = computeEconomy(vehicleFillups);
  const insight = latestEconomyInsight(vehicleFillups);
  const avg = eco.length ? eco.reduce((a, p) => a + p.kmPerUnit, 0) / eco.length : null;
  const unit = economyLabel(activeVehicle.defaultFuelType);
  const odometerRows = [...vehicleFillups].sort(
    (a, b) => a.odometerKm - b.odometerKm || new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
  const totalKm =
    odometerRows.length > 1
      ? odometerRows[odometerRows.length - 1].odometerKm - odometerRows[0].odometerKm
      : 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg.base }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.stats.title}
        </T>
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {es.stats.subtitle(activeVehicle.name)}
        </T>

        <Tile label={es.stats.thisMonth} value={money(sumSpend(monthLogs))} />
        <Tile
          label={es.stats.totalCost}
          value={money(combinedSpend)}
          hint={es.stats.totalCostSplit(money(allSpend), money(expenseSpend))}
        />
        <Tile
          label={es.stats.costPerKm}
          value={costKm != null ? money(costKm) : '—'}
          hint={dist ? es.stats.costPerKmHint(km(dist)) : es.stats.costPerKmEmpty}
        />
        <Tile
          label={es.stats.kmLogged}
          value={totalKm ? km(totalKm) : '—'}
          hint={odometerRows.length ? es.stats.readings(odometerRows.length) : es.stats.readingsEmpty}
        />
        <Tile
          label={es.stats.average}
          value={avg != null ? `${avg.toFixed(2)} ${unit}` : '—'}
        />

        {insight ? (
          <Tile
            label={es.stats.lastTank}
            value={es.stats.lastTankValues[insight.status]}
            hint={es.stats.lastTankHint(`${insight.baseline.toFixed(2)} ${unit}`)}
          />
        ) : null}

        <SectionHeader title={es.stats.timeline} />
        {odometerRows.length === 0 ? (
          <T face="body" style={[styles.hint, { color: theme.text.muted }]}>
            {es.stats.timelineEmpty}
          </T>
        ) : (
          odometerRows.map((fillup, index) => {
            const previous = odometerRows[index - 1];
            const distance = previous ? fillup.odometerKm - previous.odometerKm : null;
            const at = new Date(fillup.occurredAt);
            return (
              <View key={fillup.id} style={[styles.timelineRow, { borderBottomColor: theme.line }]}>
                <View style={[styles.timelineDot, { backgroundColor: theme.accent }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.barHead}>
                    <T face="monoBold" style={{ color: theme.text.primary, fontSize: 14 }}>
                      {km(fillup.odometerKm)}
                    </T>
                    <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
                      {monthTitle(at.getFullYear(), at.getMonth())}
                    </T>
                  </View>
                  <T face="body" style={[styles.hint, { color: theme.text.muted, marginTop: 4 }]}>
                    {distance != null ? es.stats.timelineStep(km(distance)) : es.stats.timelineStart}
                  </T>
                </View>
              </View>
            );
          })
        )}

        <SectionHeader title={es.stats.byType} />
        {byType.length === 0 ? (
          <T face="body" style={[styles.hint, { color: theme.text.muted }]}>
            {es.stats.byTypeEmpty}
          </T>
        ) : (
          byType.map((x) => (
            <Bar
              key={x.type}
              label={FUEL_CATALOG[x.type as FuelType].label}
              value={money(x.total)}
              fraction={x.total / maxType}
              color={categoryColors.combustible}
            />
          ))
        )}

        <SectionHeader title={es.stats.byMonth} />
        {months.length === 0 ? (
          <T face="body" style={[styles.hint, { color: theme.text.muted }]}>
            {es.stats.byMonthEmpty}
          </T>
        ) : (
          months.map((m) => (
            <Bar
              key={`${m.year}-${m.month}`}
              label={m.label}
              value={money(m.total)}
              fraction={m.total / maxMonth}
              color={categoryColors.mantenimiento}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { theme } = useTheme();
  return (
    <Surface style={styles.tile}>
      <T face="medium" style={[styles.tileLabel, { color: theme.text.muted }]}>
        {label.toUpperCase()}
      </T>
      <T face="monoBold" style={[styles.tileValue, { color: theme.text.primary }]}>
        {value}
      </T>
      {hint ? (
        <T face="body" style={[styles.hint, { color: theme.text.secondary, marginTop: space.sm }]}>
          {hint}
        </T>
      ) : null}
    </Surface>
  );
}

function Bar({
  label,
  value,
  fraction,
  color,
}: {
  label: string;
  value: string;
  fraction: number;
  color: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.barBlock}>
      <View style={styles.barHead}>
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
          {label}
        </T>
        <T face="mono" style={{ color: theme.text.secondary, fontSize: 13 }}>
          {value}
        </T>
      </View>
      <View style={[styles.track, { backgroundColor: theme.bg.raised }]}>
        <View style={[styles.fill, { width: `${Math.max(fraction, 0.02) * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pad: { padding: space.gutter, paddingBottom: 48 },
  h: { fontSize: 34 },
  sub: { marginTop: 6, marginBottom: space.lg, lineHeight: 22 },
  tile: { marginBottom: space.md },
  tileLabel: { fontSize: 11, letterSpacing: 0.9 },
  tileValue: { fontSize: 26, marginTop: space.sm },
  hint: { fontSize: 12, lineHeight: 18 },
  barBlock: { marginBottom: space.md },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  timelineRow: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
  },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  track: { height: 10, borderRadius: 999, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 999 },
});
