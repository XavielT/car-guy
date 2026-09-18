import { BarChart } from 'react-native-gifted-charts';
import { StyleSheet, View } from 'react-native';

import { categoryColors, fonts, space } from '@/constants/theme';
import { money } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { STAT_CATEGORIES, type MonthlySpend, type StatCategory } from '@/lib/domain/stats';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';
import { ChartFrame } from './ChartFrame';

/** The category palette, keyed the way `StatCategory` is. */
export const CATEGORY_COLOR: Record<StatCategory, string> = {
  combustible: categoryColors.combustible,
  mantenimiento: categoryColors.mantenimiento,
  reparacion: categoryColors.reparacion,
  mejora: categoryColors.mejora,
  legal: categoryColors.legal,
  otros: categoryColors.otros,
};

const MONTH_INITIALS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/**
 * Spend per month, stacked by category — the chart that answers "where does the
 * money go" without needing a legend read twice.
 *
 * Months with nothing spent stay in the data (see `monthlySpendByCategory`), so
 * a quiet month reads as a gap rather than disappearing and squeezing the axis.
 */
export function StackedBars({ months }: { months: MonthlySpend[] }) {
  const { theme } = useTheme();

  const hasData = months.some((month) => month.total > 0);
  const max = Math.max(...months.map((m) => m.total), 1);

  const data = months.map((month) => ({
    label: MONTH_INITIALS[month.monthIndex],
    stacks: STAT_CATEGORIES.filter((category) => month.byCategory[category] > 0).map((category) => ({
      value: month.byCategory[category],
      color: CATEGORY_COLOR[category],
    })),
  }));

  // gifted-charts needs at least one stack per bar or it drops the label with it.
  const safeData = data.map((bar) =>
    bar.stacks.length ? bar : { ...bar, stacks: [{ value: 0, color: theme.line }] },
  );

  return (
    <ChartFrame
      title={es.stats.byMonth}
      caption={es.stats.byMonthCaption}
      empty={hasData ? undefined : es.stats.byMonthEmpty}>
      {(width) => (
        <View>
          <BarChart
            stackData={safeData}
            width={width - 56}
            height={160}
            barWidth={Math.max(14, Math.min(28, (width - 90) / months.length - 10))}
            spacing={10}
            initialSpacing={10}
            maxValue={max * 1.15}
            noOfSections={3}
            barBorderTopLeftRadius={4}
            barBorderTopRightRadius={4}
            yAxisThickness={0}
            xAxisThickness={1}
            xAxisColor={theme.line}
            rulesColor={theme.line}
            rulesType="dashed"
            yAxisTextStyle={{ color: theme.text.muted, fontSize: 9, fontFamily: fonts.mono }}
            xAxisLabelTextStyle={{ color: theme.text.muted, fontSize: 10, fontFamily: fonts.medium }}
            yAxisLabelWidth={44}
            formatYLabel={(value: string) => compact(Number(value))}
            disablePress
          />
          <Legend months={months} />
        </View>
      )}
    </ChartFrame>
  );
}

/** Only the categories that actually appear, so the legend stays honest. */
function Legend({ months }: { months: MonthlySpend[] }) {
  const { theme } = useTheme();
  const totals = new Map<StatCategory, number>();
  for (const month of months) {
    for (const category of STAT_CATEGORIES) {
      const value = month.byCategory[category];
      if (value > 0) totals.set(category, (totals.get(category) ?? 0) + value);
    }
  }

  const present = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  if (!present.length) return null;

  return (
    <View style={styles.legend}>
      {present.map(([category, total]) => (
        <View key={category} style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: CATEGORY_COLOR[category] }]} />
          <T face="body" style={{ color: theme.text.secondary, fontSize: 12 }}>
            {es.stats.categories[category]}
          </T>
          <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
            {money(total)}
          </T>
        </View>
      ))}
    </View>
  );
}

/** "12.5k" beats "12,500.00" on a 44 px axis. */
export function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 9, height: 9, borderRadius: 2 },
});
