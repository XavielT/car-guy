import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { ChartFrame } from '@/components/charts/ChartFrame';
import { T } from '@/components/T';
import { Chip } from '@/components/ui';
import { categoryColors, categoryInkLight, fonts, space } from '@/constants/theme';
import { usePriceData } from '@/hooks/usePriceData';
import { chartSeries } from '@/lib/domain/fuelPrices';
import { money, todayIsoDate } from '@/lib/format';
import { FUEL_CATALOG, FUEL_ORDER } from '@/lib/fuel';
import { localeTag, t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import type { FuelType } from '@/lib/types';

const PLOT_H = 150;

/**
 * Cifras → "Precios" (IMP 30092026 note 1, ADR-46, 03-screens.md Phase 5): one
 * fuel's price over the last 12 months, two series on one axis (RD$ per the
 * fuel's posted unit):
 *   · the person's own rows — the fuel colour (combustible), solid, dots;
 *   · the MICM weeks — neutral ink, dashed, no dots: the reference line.
 * Identity is never colour alone: dashed vs solid, dots vs none, and the legend
 * under the plot names both. Validated (dataviz validate_palette): cyan vs the
 * neutral passes CVD and normal-vision separation and 3:1 on both surfaces
 * (light uses text.secondary; text.muted there sat under the 15 ΔE floor).
 * A fuel chip row picks the fuel; it starts on `defaultFuel`.
 */
export function PricesBlock({ defaultFuel }: { defaultFuel?: FuelType }) {
  const { theme, scheme } = useTheme();
  const { own, refs, loaded } = usePriceData();
  const [fuel, setFuel] = useState<FuelType>(defaultFuel ?? 'regular');

  const userColor = scheme === 'light' ? categoryInkLight.combustible : categoryColors.combustible;
  const micmColor = scheme === 'light' ? theme.text.secondary : theme.text.muted;
  const unit = FUEL_CATALOG[fuel].perUnitLabel;

  const chart = useMemo(() => {
    const { user, micm } = chartSeries(fuel, own, refs, todayIsoDate());
    const dates = [...new Set([...user.map((p) => p.date), ...micm.map((p) => p.date)])].sort();
    const at = (series: { date: string; price: number }[], date: string) => {
      const hits = series.filter((p) => p.date === date);
      return hits.length ? hits[hits.length - 1].price : undefined;
    };
    // A month's name under its first point only.
    const label = (date: string, i: number) => {
      if (i > 0 && dates[i - 1].slice(0, 7) === date.slice(0, 7)) return '';
      const [y, m] = date.split('-').map(Number);
      return new Date(y, m - 1, 15).toLocaleDateString(localeTag(), { month: 'short' });
    };
    const values = [...user, ...micm].map((p) => p.price);
    return {
      dates,
      userData: dates.map((d, i) => ({ value: at(user, d), label: label(d, i), hideDataPoint: at(user, d) == null })),
      micmData: dates.map((d) => ({ value: at(micm, d), hideDataPoint: true })),
      hasUser: user.length > 0,
      hasMicm: micm.length > 0,
      enough: user.length >= 2 || micm.length >= 2,
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 0,
      lastUser: user.at(-1)?.price ?? null,
      lastMicm: micm.at(-1)?.price ?? null,
    };
  }, [fuel, own, refs]);

  const pad = Math.max((chart.max - chart.min) * 0.2, 2);
  const offset = Math.max(0, Math.floor(chart.min - pad));
  const range = Math.ceil(chart.max + pad - offset);

  // gifted-charts draws the first series as `data`; with no user points the MICM line goes there.
  const primary = chart.hasUser ? chart.userData : chart.micmData;
  const secondary = chart.hasUser && chart.hasMicm ? chart.micmData : undefined;
  const primaryIsMicm = !chart.hasUser;

  return (
    <View>
      <ChartFrame
        title={t.fuelPricesUi.chartTitle}
        caption={t.fuelPricesUi.chartCaption(unit)}
        empty={!loaded ? undefined : chart.enough ? undefined : t.fuelPricesUi.chartEmpty}>
        {(width) =>
          loaded && chart.enough ? (
            <View>
              <LineChart
                data={primary.map((p, i) => (primaryIsMicm ? { ...p, label: chart.userData[i].label } : p))}
                width={width - 56}
                height={PLOT_H}
                adjustToWidth
                color={primaryIsMicm ? micmColor : userColor}
                thickness={2}
                {...(primaryIsMicm ? { strokeDashArray: [6, 4], hideDataPoints: true } : { dataPointsColor: userColor, dataPointsRadius: 4 })}
                {...(secondary
                  ? { data2: secondary, color2: micmColor, thickness2: 2, strokeDashArray2: [6, 4], hideDataPoints2: true }
                  : {})}
                yAxisOffset={offset}
                maxValue={range}
                noOfSections={3}
                formatYLabel={(value: string) => String(Math.round(Number(value)))}
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
                disableScroll
                interpolateMissingValues
                extrapolateMissingValues={false}
              />
              <View style={styles.legend}>
                {chart.hasUser ? (
                  <View style={styles.item}>
                    <View style={[styles.solid, { backgroundColor: userColor }]} />
                    <T face="body" style={{ color: theme.text.secondary, fontSize: 12 }}>
                      {t.fuelPricesUi.seriesUser}
                      {chart.lastUser != null ? ` · ${money(chart.lastUser)}` : ''}
                    </T>
                  </View>
                ) : null}
                {chart.hasMicm ? (
                  <View style={styles.item}>
                    <View style={[styles.dashed, { borderColor: micmColor }]} />
                    <T face="body" style={{ color: theme.text.secondary, fontSize: 12 }}>
                      {t.fuelPricesUi.seriesMicm}
                      {chart.lastMicm != null ? ` · ${money(chart.lastMicm)}` : ''}
                    </T>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null
        }
      </ChartFrame>
      <View style={styles.chips}>
        {FUEL_ORDER.map((f) => (
          <Chip key={f} label={FUEL_CATALOG[f].shortLabel} selected={f === fuel} onPress={() => setFuel(f)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  solid: { width: 16, height: 2, borderRadius: 1 },
  dashed: { width: 16, height: 0, borderTopWidth: 2, borderStyle: 'dashed' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: -space.xs, marginBottom: space.md },
});
