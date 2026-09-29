import type { VolumeUnit } from '@/lib/domain/units';
import { LineChart } from 'react-native-gifted-charts';
import { StyleSheet, View } from 'react-native';

import { categoryColors, categoryInkLight, fonts, space } from '@/constants/theme';
import type { EconomyStatus } from '@/lib/domain/partialEconomy';
import type { EconomyPoint, FuelType } from '@/lib/types';
import { economyLabel } from '@/lib/fuel';
import { es } from '@/lib/i18n/es';
import { economyNumber } from '@/lib/format';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';
import { ChartFrame } from './ChartFrame';

type Point = EconomyPoint & { status?: EconomyStatus };

/**
 * km/gal per tank, with the average as a dashed reference line.
 *
 * Since note 4 the series is `partialEconomy().series`: measured tanks are
 * solid dots, tanks reconciled inside a measured span carry a ring, gauge
 * estimates are hollow dots with a light halo standing for their error band,
 * and an unknown segment is a gap in the line. A plain `computeEconomy` list
 * (all measured) still draws as before.
 */
export function EconomyLine({
  points,
  fuelType,
  volumeUnit = 'gal',
  average: averageIn,
}: {
  points: Point[];
  fuelType: FuelType;
  volumeUnit?: VolumeUnit;
  /** The headline average (distance-weighted); defaults to the mean of the drawn points. */
  average?: number | null;
}) {
  const { theme, scheme } = useTheme();
  const line = scheme === 'light' ? categoryInkLight.combustible : categoryColors.combustible;

  const unit = economyLabel(fuelType, volumeUnit);
  const known = points.filter((p) => p.status !== 'unknown');
  const average =
    averageIn ?? (known.length > 0 ? known.reduce((sum, p) => sum + p.kmPerUnit, 0) / known.length : 0);

  // Two points is the minimum that draws a line rather than a dot.
  const enough = known.length >= 2;
  const styled = points.some((p) => p.status && p.status !== 'measured');

  const dot = (status: EconomyStatus | undefined) => {
    if (status === 'estimated') {
      return (
        <View style={[styles.halo, { backgroundColor: line + '33' }]}>
          <View style={[styles.hollow, { borderColor: line, backgroundColor: theme.bg.surface }]} />
        </View>
      );
    }
    if (status === 'reconciled') {
      return (
        <View style={[styles.ring, { borderColor: line }]}>
          <View style={[styles.solid, { backgroundColor: line }]} />
        </View>
      );
    }
    return <View style={[styles.solid, { backgroundColor: line }]} />;
  };

  const data = points.map((point) => ({
    // An unknown segment has no number: a gap in the line (interpolateMissingValues off).
    value: point.status === 'unknown' ? undefined : point.kmPerUnit,
    label: new Date(point.occurredAt).toLocaleDateString('es-DO', { month: 'short' }),
    ...(styled && point.status !== 'unknown' ? { customDataPoint: () => dot(point.status) } : {}),
  }));

  const values = known.map((p) => p.kmPerUnit);
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
            <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10 }}>
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
          color={line}
          thickness={2}
          dataPointsColor={line}
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
          xAxisLabelTextStyle={{ color: theme.text.muted, fontSize: 11, fontFamily: fonts.title }}
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
          interpolateMissingValues={false}
          // A gap's missing value would otherwise count as 0 and push the axis below zero.
          mostNegativeValue={0}
          noOfSectionsBelowXAxis={0}
        />
      )}
    </ChartFrame>
  );
}

const styles = StyleSheet.create({
  average: { alignItems: 'flex-end', gap: 2, paddingTop: space.xs },
  solid: { width: 7, height: 7, borderRadius: 4 },
  ring: { width: 13, height: 13, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  hollow: { width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  halo: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});

/** The legend under the chart when it mixes kinds of points (note 4). */
export function EconomyLegend() {
  const { theme, scheme } = useTheme();
  const line = scheme === 'light' ? categoryInkLight.combustible : categoryColors.combustible;
  const item = (label: string, mark: React.ReactNode) => (
    <View style={legend.item} key={label}>
      <View style={legend.mark}>{mark}</View>
      <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
        {label}
      </T>
    </View>
  );
  return (
    <View style={legend.row}>
      {item(es.estimate.legend.measured, <View style={[styles.solid, { backgroundColor: line }]} />)}
      {item(
        es.estimate.legend.reconciled,
        <View style={[styles.ring, { borderColor: line }]}>
          <View style={[styles.solid, { backgroundColor: line }]} />
        </View>,
      )}
      {item(
        es.estimate.legend.estimated,
        <View style={[styles.halo, { backgroundColor: line + '33' }]}>
          <View style={[styles.hollow, { borderColor: line, backgroundColor: theme.bg.surface }]} />
        </View>,
      )}
      {item(es.estimate.legend.unknown, <View style={[legend.gap, { backgroundColor: theme.line }]} />)}
    </View>
  );
}

const legend = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mark: { width: 18, alignItems: 'center' },
  gap: { width: 14, height: 2, opacity: 0.6 },
});
