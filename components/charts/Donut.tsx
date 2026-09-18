import { PieChart } from 'react-native-gifted-charts';
import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/theme';
import type { CategoryTotal } from '@/lib/domain/stats';
import { money } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';
import { ChartFrame } from './ChartFrame';
import { CATEGORY_COLOR } from './StackedBars';

/**
 * Spend by category as a donut with the total in the hole and a legend that
 * carries the amounts.
 *
 * The slices are not labelled in place: five slice labels on a phone overlap
 * into mush, and the legend already says the same thing in a column that can be
 * read. Colour alone never carries meaning here — every legend row has a name
 * and a figure beside its swatch.
 */
export function Donut({ totals, total }: { totals: CategoryTotal[]; total: number }) {
  const { theme } = useTheme();

  const data = totals.map((entry) => ({
    value: entry.total,
    color: CATEGORY_COLOR[entry.category],
  }));

  return (
    <ChartFrame
      title={es.stats.byCategory}
      caption={es.stats.byCategoryCaption}
      empty={totals.length ? undefined : es.stats.byCategoryEmpty}>
      {() => (
        <View style={styles.row}>
          <PieChart
            data={data}
            donut
            radius={72}
            innerRadius={48}
            innerCircleColor={theme.bg.surface}
            strokeWidth={2}
            strokeColor={theme.bg.surface}
            centerLabelComponent={() => (
              <View style={{ alignItems: 'center' }}>
                <T face="body" style={{ color: theme.text.muted, fontSize: 10 }}>
                  {es.stats.total}
                </T>
                <T face="monoBold" style={{ color: theme.text.primary, fontSize: 13 }}>
                  {money(total)}
                </T>
              </View>
            )}
          />

          <View style={styles.legend}>
            {totals.map((entry) => (
              <View key={entry.category} style={styles.legendRow}>
                <View style={[styles.swatch, { backgroundColor: CATEGORY_COLOR[entry.category] }]} />
                <T
                  face="body"
                  numberOfLines={1}
                  style={{ color: theme.text.secondary, fontSize: 13, flex: 1 }}>
                  {es.stats.categories[entry.category]}
                </T>
                <View style={{ alignItems: 'flex-end' }}>
                  <T face="mono" style={{ color: theme.text.primary, fontSize: 12 }}>
                    {money(entry.total)}
                  </T>
                  <T face="body" style={{ color: theme.text.muted, fontSize: 10 }}>
                    {Math.round(entry.share * 100)} %
                  </T>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </ChartFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xl, flexWrap: 'wrap' },
  legend: { flex: 1, minWidth: 180, gap: space.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
