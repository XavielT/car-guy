import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { SectionHeader, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { COST_CATEGORIES, type GarageCost, type OwnershipCost } from '@/lib/domain/costs';
import { dateLabel, money } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * "Lo que me ha costado" (IMP 29092026 note 8, 03-screens.md Phase 6): Compra ·
 * Mods · Mantenimiento · Combustible · Pista · Otros = Total · RD$/km, and the
 * "desde" line. Every figure comes from `ownershipCost`; this file only lays
 * them out.
 */
export function OwnershipCard({ cost }: { cost: OwnershipCost }) {
  const { theme } = useTheme();
  const since = cost.since
    ? cost.sinceBasis === 'compra'
      ? t.costs.since(dateLabel(cost.since))
      : t.costs.sinceFirst(dateLabel(cost.since))
    : null;
  const footnote = [
    cost.perKm == null
      ? t.costs.noDistance
      : cost.purchasePrice != null && cost.runningPerKm != null
        ? t.costs.perKmHint(money(cost.runningPerKm))
        : null,
    since,
    cost.costPerMonth != null ? t.costs.perMonth(money(cost.costPerMonth), t.stats.ownershipMonths(cost.monthsOwned)) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <SectionHeader title={t.costs.title} caption={t.costs.caption} />
      <Surface>
        {cost.purchasePrice != null ? (
          <Row label={t.costs.purchase} value={money(cost.purchasePrice)} />
        ) : (
          <T face="body" style={[styles.hint, styles.first, { color: theme.text.muted }]}>
            {t.costs.noPurchase}
          </T>
        )}
        {cost.soldPrice != null ? <Row label={t.costs.sold} value={`− ${money(cost.soldPrice)}`} /> : null}
        {COST_CATEGORIES.map((key) => (
          <Row key={key} label={t.costs.categories[key]} value={money(cost.byCategory[key])} muted={cost.byCategory[key] === 0} />
        ))}
        {cost.modsSold > 0 ? (
          <T face="body" style={[styles.hint, { color: theme.text.muted }]}>
            {t.costs.modsSold(money(cost.modsSold))}
          </T>
        ) : null}
        <View style={[styles.rule, { backgroundColor: theme.line }]} />
        <Row label={t.costs.total} value={money(cost.total)} strong />
        <Row label={t.costs.perKm} value={cost.perKm != null ? money(cost.perKm) : '—'} />
        {footnote ? (
          <T face="body" style={[styles.hint, { color: theme.text.secondary }]}>
            {footnote}
          </T>
        ) : null}
      </Surface>
    </>
  );
}

/** The garage total: one row per vehicle and their sum. Hidden with one car — it would repeat the card. */
export function GarageCostCard({ garage }: { garage: GarageCost }) {
  const { theme } = useTheme();
  if (garage.vehicles.length < 2) return null;
  return (
    <>
      <SectionHeader title={t.costs.garage} caption={t.costs.garageCaption(garage.vehicles.length)} />
      <Surface>
        {garage.vehicles.map((entry) => (
          <Row key={entry.vehicleId} label={entry.name} value={money(entry.cost.total)} />
        ))}
        <View style={[styles.rule, { backgroundColor: theme.line }]} />
        <Row label={t.costs.garageTotal} value={money(garage.total)} strong />
        {garage.perKm != null ? <Row label={t.costs.perKm} value={money(garage.perKm)} /> : null}
        {garage.since ? (
          <T face="body" style={[styles.hint, { color: theme.text.secondary }]}>
            {t.costs.since(dateLabel(garage.since))}
          </T>
        ) : null}
      </Surface>
    </>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <T
        face={strong ? 'semibold' : 'body'}
        style={{ color: strong ? theme.text.primary : muted ? theme.text.muted : theme.text.secondary, fontSize: 14, flex: 1 }}
        numberOfLines={1}>
        {label}
      </T>
      <T face="monoBold" style={{ color: muted ? theme.text.muted : theme.text.primary, fontSize: strong ? 16 : 14 }}>
        {value}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, gap: space.md },
  rule: { height: 1, marginVertical: space.sm },
  hint: { fontSize: 12, marginTop: space.sm, lineHeight: 18 },
  first: { marginTop: 0, marginBottom: space.sm },
});
