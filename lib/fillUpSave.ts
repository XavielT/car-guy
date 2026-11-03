/**
 * The part of saving a fill-up that is NOT the form (extracted from app/carga/nueva.tsx for IMP 03112026 Fuel Express,
 * SPEC-B §B7): the duplicate check and everything the review sheet shows. The manual form and Fuel Express both call
 * `evaluateFillUp` BEFORE `upsertFillUp`, so there is one save path, one duplicate rule and one review, not two.
 * Behaviour is exactly what nueva.tsx did inline.
 */
import { reviewFillUp, type FillUpReview } from './domain/economy';
import { findRecentDuplicate } from './domain/fillupDedupe';
import { fuelCfgFor, partialEconomy, type SeriesPoint } from './domain/partialEconomy';
import { perFillEconomyOf } from './domain/perFillEconomy';
import { economyNumber, economyValue } from './format';
import { economyLabel } from './fuel';
import { t } from './i18n';
import type { FillUp, FuelType, Vehicle } from './types';

export type FillUpDraft = Omit<FillUp, 'id' | 'createdAt'>;

/** What the review sheet needs once a fill-up is saved (the id is added by the caller after `upsertFillUp`). */
export type SaveResult = {
  review: FillUpReview;
  fuelType: FuelType;
  missedPrevious: boolean;
  estimate: SeriesPoint | null;
  perFillLine: string | null;
};

export type Evaluation = { duplicate: FillUp } | { duplicate: null; result: SaveResult };

/**
 * `allFillups` = every fill-up (for the duplicate check, which spans vehicles); `vehicleFillups` = this vehicle's, as they
 * were BEFORE this one (so the comparison is with history rather than with itself).
 */
export function evaluateFillUp(draft: FillUpDraft, ctx: { allFillups: readonly FillUp[]; vehicleFillups: FillUp[]; vehicle: Vehicle }): Evaluation {
  const dup = findRecentDuplicate(draft, ctx.allFillups);
  if (dup) return { duplicate: dup };

  const current: FillUp = { ...draft, id: 'review', createdAt: new Date().toISOString() };
  const review = reviewFillUp(current, ctx.vehicleFillups);
  // Note 4: the gauge estimate for this fill-up, when it is a partial with readings.
  const partial = partialEconomy([...ctx.vehicleFillups.filter((f) => f.id !== current.id), current], fuelCfgFor(ctx.vehicle.detail));
  const estimate = partial.segments.find((s) => s.fillUpId === current.id) ?? null;
  // Note 9: km since the previous log over what was added now, approximate.
  const pf = perFillEconomyOf(current.id, [...ctx.vehicleFillups, current]);
  const volumeUnit = ctx.vehicle.detail?.volumeUnit ?? 'gal';
  const economyUnit = draft.fuelType === 'gnv' ? null : ctx.vehicle.detail?.economyUnit;
  const perFillLine =
    pf && review.kmPerUnit == null
      ? t.perFill.line(economyNumber(economyValue(pf.kmPerUnit, volumeUnit, economyUnit)), economyLabel(draft.fuelType, volumeUnit, economyUnit))
      : null;

  return {
    duplicate: null,
    result: { review, fuelType: draft.fuelType, missedPrevious: Boolean(draft.missedPrevious), estimate, perFillLine },
  };
}
