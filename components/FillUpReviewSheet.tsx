import type { EconomyUnit, VolumeUnit } from '@/lib/domain/units';
import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/theme';
import type { FillUpReview } from '@/lib/domain/economy';
import type { SeriesPoint } from '@/lib/domain/partialEconomy';
import { economyNumber, economyValue, km, kmPerUnit, money } from '@/lib/format';
import { economyLabel, unitLabelFor } from '@/lib/fuel';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';
import type { FuelType } from '@/lib/types';
import { T } from './T';
import { GhostButton, KeyValueRow, PrimaryButton, Sheet, StatusPill, type Tone } from './ui';

/**
 * What the app has to say about the fill-up you just saved.
 *
 * This was an `Alert.alert` with four lines joined by newlines, which on web was
 * a blocking `window.alert` in system chrome. The numbers are exactly the same
 * ones; they just sit in the app's own sheet now, with the verdict as a
 * StatusPill instead of buried in a dialog title.
 *
 * `normal` and `first` are neutral rather than green: "the same as always" is
 * not an achievement, and "no comparison yet" is not a verdict at all.
 */
const TONES: Record<FillUpReview['status'], Tone> = {
  low: 'vencido',
  great: 'ok',
  normal: 'neutral',
  first: 'neutral',
  partial: 'neutral',
};

/**
 * The review of one fill-up — the sheet after a save and the fill-up's detail
 * screen show the same thing (IMP 30092026 note 8). `perFillLine` is the
 * "≈ por echada" line (note 9), shown muted when there is one.
 */
export function FillUpReviewBody({
  review,
  fuelType,
  volumeUnit = 'gal',
  economyUnit,
  missedPrevious,
  estimate,
  perFillLine,
}: {
  review: FillUpReview;
  fuelType: FuelType;
  volumeUnit?: VolumeUnit;
  economyUnit?: EconomyUnit | null;
  missedPrevious: boolean;
  estimate?: SeriesPoint | null;
  perFillLine?: string | null;
}) {
  const { theme } = useTheme();

  const unitLabel = unitLabelFor(fuelType, volumeUnit);
  const economy = fuelType === 'gnv' ? null : economyUnit;
  const average = review.baseline != null ? kmPerUnit(review.baseline, fuelType, volumeUnit, economy) : null;

  // A partial with gauge readings has an estimate (hollow dot on Cifras), or a
  // plain-Spanish reason it has none. A full tank keeps the measured review.
  const economyLabelText = economyLabel(fuelType, volumeUnit, economy);
  const estimated = review.status === 'partial' && estimate?.status === 'estimated' ? estimate : null;
  const unknownReason =
    review.status === 'partial' && estimate?.status === 'unknown' && estimate.reason && estimate.reason !== 'missing_gauge'
      ? es.estimate.reasons[estimate.reason]
      : null;
  const fmt = (n: number | null | undefined) => (n == null ? '—' : economyNumber(economyValue(n, volumeUnit, economy)));
  // L/100 km inverts the scale: the estimate's worst case is its high end.
  const inverted = economy === 'l_100km';
  const estimateBody = estimated
    ? [
        es.estimate.approx(
          fmt(estimated.kmPerUnit),
          fmt(inverted ? estimated.kmPerUnitHigh : estimated.kmPerUnitLow),
          fmt(inverted ? estimated.kmPerUnitLow : estimated.kmPerUnitHigh),
          economyLabelText,
        ),
        estimated.warnings?.includes('gauge_pump_mismatch') ? es.estimate.mismatch : null,
      ]
        .filter(Boolean)
        .join('\n')
    : unknownReason;

  // The flag explains the missing numbers better than "first measurement" does,
  // so it wins when both would apply.
  const body = missedPrevious
    ? es.fuelReview.chainBroken
    : review.status === 'low' && average
      ? es.fuelReview.lowBody(average)
      : review.status === 'great' && average
        ? es.fuelReview.greatBody(average)
        : review.status === 'first'
          ? es.fuelReview.firstBody
          : review.status === 'partial'
            ? (estimateBody ?? es.fuelReview.partialBody)
            : null;

  return (
    <>
      <StatusPill
        status={TONES[review.status]}
        label={es.fuelReview.statusLabels[review.status]}
        style={{ marginBottom: space.lg }}
      />

      <View style={[styles.rows, { borderColor: theme.line }]}>
        <KeyValueRow label={es.fuelReview.price(unitLabel)} value={money(review.pricePerUnit)} />
        <KeyValueRow
          label={es.fuelReview.distance}
          value={review.distanceKm != null ? km(review.distanceKm) : es.fuelReview.noPrevious}
        />
        <KeyValueRow
          label={es.fuelReview.economy}
          value={
            review.kmPerUnit != null
              ? kmPerUnit(review.kmPerUnit, fuelType, volumeUnit, economy)
              : estimated
                ? es.estimate.short(fmt(estimated.kmPerUnit), economyLabelText)
                : es.fuelReview.pending
          }
          big={review.kmPerUnit != null || estimated != null}
        />
        <KeyValueRow
          label={es.fuelReview.costPerKm}
          value={review.costPerKm != null ? money(review.costPerKm) : es.fuelReview.pending}
        />
      </View>

      {body ? (
        <T face="body" style={[styles.body, { color: theme.text.secondary }]}>
          {body}
        </T>
      ) : null}

      {perFillLine ? (
        <T face="body" style={[styles.perFill, { color: theme.text.muted }]}>
          {perFillLine}
        </T>
      ) : null}
    </>
  );
}

export function FillUpReviewSheet({
  review,
  fuelType,
  volumeUnit = 'gal',
  economyUnit,
  missedPrevious,
  estimate,
  visible,
  onClose,
  onSeeHistory,
  perFillLine,
}: {
  review: FillUpReview | null;
  fuelType: FuelType;
  /** The vehicle's unit (v6); the review's numbers are already in it. */
  volumeUnit?: VolumeUnit;
  /** L/100 km shows the inverse figures (lib/format.ts economyValue). */
  economyUnit?: EconomyUnit | null;
  missedPrevious: boolean;
  /** Note 4: this fill-up's gauge segment, when there is one. Only a partial uses it. */
  estimate?: SeriesPoint | null;
  visible: boolean;
  onClose: () => void;
  onSeeHistory: () => void;
  perFillLine?: string | null;
}) {
  if (!review) return null;
  const title = missedPrevious ? es.fuelReview.chainBrokenTitle : es.fuelReview.titles[review.status];
  return (
    // Same rule as the body: a broken chain is the real story, not "first".
    <Sheet visible={visible} onClose={onClose} title={title}>
      <FillUpReviewBody
        review={review}
        fuelType={fuelType}
        volumeUnit={volumeUnit}
        economyUnit={economyUnit}
        missedPrevious={missedPrevious}
        estimate={estimate}
        perFillLine={perFillLine}
      />
      <PrimaryButton label={es.fuelReview.seeHistory} onPress={onSeeHistory} />
      <GhostButton label={es.fuelReview.close} onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  rows: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: space.sm },
  body: { fontSize: 14, lineHeight: 21, marginTop: space.md, marginBottom: space.lg },
  perFill: { fontSize: 13, lineHeight: 19, marginTop: space.sm, marginBottom: space.md },
});
