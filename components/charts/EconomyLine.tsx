import { LineChart } from 'react-native-gifted-charts';
import { StyleSheet, View } from 'react-native';

import { categoryColors, fonts, space } from '@/constants/theme';
import type { EconomyPoint, FuelType } from '@/lib/types';
import { economyLabel } from '@/lib/fuel';
import { es } from '@/lib/i18n/es';
import { economyNumber } from '@/lib/format';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';
import { ChartFrame } from './ChartFrame';

/**
 * km/gal per measured tank, with the average as a dashed reference line.
 *
 * One point per *measured* tank, not per fill-up: a partial tank and a fill-up
 * flagged `missedPrevious` produce no `EconomyPoint` at all, so the series is
 * shorter than the history and must be built from `computeEconomy`'s output
 * rather than by walking the fill-ups and hoping the indexes line up.
 */
export function EconomyLine({
  points,
  fuelType,
}: {
  points: EconomyPoint[];
  fuelType: FuelType;
}) {
  const { theme } = useTheme();

  const unit = economyLabel(fuelType);
  const average =
    points.length > 0 ? points.reduce((sum, p) => sum + p.kmPerUnit, 0) / points.length : 0;

  // Two points is the minimum that draws a line rather than a dot.
  const enough = points.length >= 2;

  const data = points.map((point) => ({
    value: point.kmPerUnit,
    label: new Date(point.occurredAt).toLocaleDateString('es-DO', { month: 'short' }),
  }));

  const values = points.map((p) => p.kmPerUnit);
  const min = Math.min(...values, average);
  const max = Math.max(...values, average);
  // A flat series would otherwise collapse onto the axis.
  const pad = Math.max((max - min) * 0.2, 1);

  return (
    <ChartFrame
      title={es.stats.economyTitle}
      caption={es.stats.economyCaption(unit)}
      empty={enough ? undefined : es.stats.economyEmpty}
      trailing={
        enough ? (
          <View style={styles.average}>
            <T face="body" style={{ color: theme.text.muted, fontSize: 11 }}>
              {es.stats.average}
            </T>
            <T face="monoBold" style={{ color: theme.text.primary, fontSize: 15 }}>
              {economyNumber(average)}
            </T>
          </View>
        ) : null
      }>
      {(width) => (
        <LineChart
          data={data}
          width={width - 56}
          height={150}
          adjustToWidth
          color={categoryColors.combustible}
          thickness={2}
          dataPointsColor={categoryColors.combustible}
          dataPointsRadius={3}
          // gifted-charts subtracts the offset from every value and adds it
          // back when it writes the label, so `maxValue` is the range above the
          // offset rather than an absolute ceiling.
          yAxisOffset={Math.max(0, min - pad)}
          maxValue={max + pad - Math.max(0, min - pad)}
          noOfSections={3}
          // Without this the axis reads "46.190…" — three decimals of a km/gal
          // figure, clipped by the label width.
          formatYLabel={(value: string) => Number(value).toFixed(1)}
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={theme.line}
          rulesColor={theme.line}
          rulesType="dashed"
          yAxisTextStyle={{ color: theme.text.muted, fontSize: 9, fontFamily: fonts.mono }}
          xAxisLabelTextStyle={{ color: theme.text.muted, fontSize: 10, fontFamily: fonts.medium }}
          yAxisLabelWidth={46}
          initialSpacing={12}
          endSpacing={12}
          // The dashed line the whole chart is read against: a tank below it
          // used more fuel than this car usually does.
          showReferenceLine1
          referenceLine1Position={average}
          referenceLine1Config={{
            color: theme.text.muted,
            dashWidth: 4,
            dashGap: 4,
            thickness: 1,
          }}
          disableScroll
        />
      )}
    </ChartFrame>
  );
}

const styles = StyleSheet.create({
  average: { alignItems: 'flex-end', gap: 2, paddingTop: space.xs },
});
