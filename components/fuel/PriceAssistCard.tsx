import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { fuelPrices } from '@/lib/db/repos';
import { saveFuelPrice } from '@/lib/db/priceOps';
import type { FuelPrice } from '@/lib/db/types';
import { paidVsReference, receiptPriceOffer, type OfferRow } from '@/lib/domain/priceAssist';
import { FEATURE_PRICE_ASSIST } from '@/lib/flagsAi';
import { money } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import type { FillUp, Settings } from '@/lib/types';

/**
 * Fuel price assist (SPEC-G §G5), on the fill-up's detail screen. Two parts, neither of which calls a model:
 *  - a deterministic line: what was paid per gallon against the board's reference price for that fuel;
 *  - when the fill-up came from a receipt (`fromReceipt`), the station's price offered as a `recibo` row. Saved only on "Sí".
 */
export function PriceAssistCard({ fill, volumeUnit, settings, fromReceipt }: { fill: FillUp; volumeUnit: 'gal' | 'l'; settings: Pick<Settings, 'referencePrices' | 'priceWeekLabel'>; fromReceipt: boolean }) {
  const { theme } = useTheme();
  const [existing, setExisting] = useState<OfferRow[] | null>(null);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'done' | 'declined' | 'error'>('idle');

  useEffect(() => {
    if (!FEATURE_PRICE_ASSIST || !fromReceipt) return;
    let alive = true;
    void fuelPrices
      .list()
      .then((rows) => alive && setExisting((rows as FuelPrice[]).map((r) => ({ fuelType: r.fuelType as FillUp['fuelType'], validFrom: r.validFrom, station: r.station, source: r.source, deletedAt: r.deletedAt ?? null }))))
      .catch(() => alive && setExisting([]));
    return () => void (alive = false);
  }, [fromReceipt]);

  const paid = useMemo(() => paidVsReference({ pricePerUnit: fill.pricePerUnit, fuelType: fill.fuelType, volumeUnit, reference: settings.referencePrices }), [fill, volumeUnit, settings.referencePrices]);
  const offer = useMemo(
    () => (fromReceipt && existing ? receiptPriceOffer({ fillUp: fill, volumeUnit, reference: settings.referencePrices, existing }) : null),
    [fromReceipt, existing, fill, volumeUnit, settings.referencePrices],
  );

  if (!FEATURE_PRICE_ASSIST || (!paid && !offer && phase !== 'done')) return null;

  const x = t.priceAssist;
  const line = paid
    ? paid.tone === 'above'
      ? x.above(money(Math.abs(paid.diffPerGal)), money(paid.refPerGal), settings.priceWeekLabel)
      : paid.tone === 'below'
        ? x.below(money(Math.abs(paid.diffPerGal)), money(paid.refPerGal), settings.priceWeekLabel)
        : x.same(money(paid.refPerGal), settings.priceWeekLabel)
    : null;

  async function accept() {
    if (!offer) return;
    setPhase('saving');
    try {
      await saveFuelPrice({ fuelType: offer.fuelType, price: offer.price, validFrom: offer.validFrom, source: 'recibo', station: offer.station, note: offer.note });
      setPhase('done');
    } catch {
      setPhase('error');
    }
  }

  return (
    <Surface padded style={{ marginTop: space.md }}>
      {line ? (
        <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20 }}>
          {line}
        </T>
      ) : null}
      {phase === 'done' ? (
        <T face="semibold" accessibilityLiveRegion="polite" style={{ color: theme.statusText.ok, fontSize: 14, marginTop: space.xs }}>
          {x.offered}
        </T>
      ) : offer && phase !== 'declined' ? (
        <View style={{ marginTop: line ? space.sm : 0, gap: space.xs }}>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
            {x.offerTitle}
          </T>
          <T face="body" style={{ color: theme.text.primary, fontSize: 14, lineHeight: 20 }}>
            {x.offerBody(offer.station, money(offer.price))}
          </T>
          {phase === 'error' ? (
            <T face="body" accessibilityRole="alert" style={{ color: theme.statusText.vencido, fontSize: 13 }}>
              {x.failed}
            </T>
          ) : null}
          <PrimaryButton label={x.offerYes} onPress={() => void accept()} disabled={phase === 'saving'} />
          <GhostButton label={x.offerNo} onPress={() => setPhase('declined')} />
        </View>
      ) : null}
    </Surface>
  );
}
