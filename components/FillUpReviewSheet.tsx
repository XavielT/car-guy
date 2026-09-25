import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/theme';
import type { FillUpReview } from '@/lib/domain/economy';
import { km, kmPerUnit, money } from '@/lib/format';
import { FUEL_CATALOG } from '@/lib/fuel';
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
};

export function FillUpReviewSheet({
  review,
  fuelType,
  missedPrevious,
  visible,
  onClose,
  onSeeHistory,
}: {
  review: FillUpReview | null;
  fuelType: FuelType;
  missedPrevious: boolean;
  visible: boolean;
  onClose: () => void;
  onSeeHistory: () => void;
}) {
  const { theme } = useTheme();
  if (!review) return null;

  const meta = FUEL_CATALOG[fuelType];
  const average = review.baseline != null ? kmPerUnit(review.baseline, fuelType) : null;

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
          : null;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      // Same rule as the body: a broken chain is the real story, not "first".
      title={missedPrevious ? es.fuelReview.chainBrokenTitle : es.fuelReview.titles[review.status]}>
      <StatusPill
        status={TONES[review.status]}
        label={es.fuelReview.statusLabels[review.status]}
        style={{ marginBottom: space.lg }}
      />

      <View style={[styles.rows, { borderColor: theme.line }]}>
        <KeyValueRow label={es.fuelReview.price(meta.unitLabel)} value={money(review.pricePerUnit)} />
        <KeyValueRow
          label={es.fuelReview.distance}
          value={review.distanceKm != null ? km(review.distanceKm) : es.fuelReview.noPrevious}
        />
        <KeyValueRow
          label={es.fuelReview.economy}
          value={review.kmPerUnit != null ? kmPerUnit(review.kmPerUnit, fuelType) : es.fuelReview.pending}
          big={review.kmPerUnit != null}
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

      <PrimaryButton label={es.fuelReview.seeHistory} onPress={onSeeHistory} />
      <GhostButton label={es.fuelReview.close} onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  rows: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: space.sm },
  body: { fontSize: 14, lineHeight: 21, marginTop: space.md, marginBottom: space.lg },
});
