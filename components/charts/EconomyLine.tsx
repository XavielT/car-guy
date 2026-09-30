import type { EconomyUnit, VolumeUnit } from '@/lib/domain/units';
import { LineChart } from 'react-native-gifted-charts';
import { StyleSheet, View } from 'react-native';

import { categoryColors, categoryInkLight, fonts, space } from '@/constants/theme';
import type { EconomyStatus } from '@/lib/domain/partialEconomy';
import type { EconomyPoint, FuelType } from '@/lib/types';
import { economyLabel } from '@/lib/fuel';
import { es } from '@/lib/i18n/es';
import { economyNumber, economyValue } from '@/lib/format';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';
import { ChartFrame } from './ChartFrame';

type Point = EconomyPoint & { status?: EconomyStatus; kmPerUnitLow?: number | null; kmPerUnitHigh?: number | null };

/** The plot's height in px; the whiskers are scaled against it. */
const PLOT_H = 150;

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
  points: pointsIn,
  fuelType,
  volumeUnit = 'gal',
  economyUnit,
  average: averageIn,
}: {
  points: Point[];
  fuelType: FuelType;
  volumeUnit?: VolumeUnit;
  /** L/100 km draws the inverse figures (a lower dot is then the better tank). */
  economyUnit?: EconomyUnit | null;
  /** The headline average (distance-weighted); defaults to the mean of the drawn points. */
  average?: number | null;
}) {
  // Into the vehicle's economy unit. L/100 km inverts, so an estimate's low and high swap.
  const economy = fuelType === 'gnv' ? null : economyUnit;
  const conv = (n: number) => economyValue(n, volumeUnit, economy);
  const inverted = economy === 'l_100km';
  const points: Point[] = pointsIn.map((p) => ({
    ...p,
    kmPerUnit: conv(p.kmPerUnit),
    kmPerUnitLow: (inverted ? p.kmPerUnitHigh : p.kmPerUnitLow) != null ? conv((inverted ? p.kmPerUnitHigh : p.kmPerUnitLow)!) : null,
    kmPerUnitHigh: (inverted ? p.kmPerUnitLow : p.kmPerUnitHigh) != null ? conv((inverted ? p.kmPerUnitLow : p.kmPerUnitHigh)!) : null,
  }));
  averageIn = averageIn != null ? conv(averageIn) : averageIn;
  const { theme, scheme } = useTheme();
  const line = scheme === 'light' ? categoryInkLight.combustible : categoryColors.combustible;

  const unit = economyLabel(fuelType, volumeUnit, economy);
  const known = points.filter((p) => p.status !== 'unknown');
  const average =
    averageIn ?? (known.length > 0 ? known.reduce((sum, p) => sum + p.kmPerUnit, 0) / known.length : 0);

  // Two points is the minimum that draws a line rather than a dot.
  const enough = known.length >= 2;
  const styled = points.some((p) => p.status && p.status !== 'measured');

  // The axis range is ours (offset + maxValue below), so px per km/unit is known and
  // an estimate's band can be drawn to scale: a whisker from its low to its high.
  const values = known.flatMap((p) =>
    p.status === 'estimated' ? [p.kmPerUnit, p.kmPerUnitLow ?? p.kmPerUnit, p.kmPerUnitHigh ?? p.kmPerUnit] : [p.kmPerUnit],
  );
  const min = Math.min(...values, average);
  const max = Math.max(...values, average);
  // A flat series would otherwise collapse onto the axis.
  const pad = Math.max((max - min) * 0.2, 1);
  const offset = Math.max(0, min - pad);
  const range = max + pad - offset;
  const pxPerUnit = PLOT_H / range;

  const dot = (point: Point) => {
    const status = point.status;
    if (status === 'estimated') {
      const up = Math.max(0, ((point.kmPerUnitHigh ?? point.kmPerUnit) - point.kmPerUnit) * pxPerUnit);
      const down = Math.max(0, (point.kmPerUnit - (point.kmPerUnitLow ?? point.kmPerUnit)) * pxPerUnit);
      return (
        <View style={styles.markBox}>
          <View style={[styles.whisker, { top: 9 - up, height: up + down, backgroundColor: line + '66' }]} />
          <View style={[styles.cap, { top: 9 - up, backgroundColor: line + '99' }]} />
          <View style={[styles.cap, { top: 9 + down - 1, backgroundColor: line + '99' }]} />
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
    ...(styled && point.status !== 'unknown' ? { customDataPoint: () => dot(point) } : {}),
  }));

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
          height={PLOT_H}
          adjustToWidth
          color={line}
          thickness={2}
          dataPointsColor={line}
          dataPointsRadius={3}
          // gifted-charts subtracts the offset from every value and adds it
          // back when it writes the label, so `maxValue` is the range above the
          // offset rather than an absolute ceiling.
          yAxisOffset={offset}
          maxValue={range}
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
  // 18 × 18 box centred on the point; the whisker overflows it up and down.
  markBox: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  whisker: { position: 'absolute', left: 8, width: 2 },
  cap: { position: 'absolute', left: 4, width: 10, height: 2 },
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
        <View style={styles.markBox}>
          <View style={[styles.whisker, { top: 1, height: 16, backgroundColor: line + '66' }]} />
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
