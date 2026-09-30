import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FillUpForm } from '@/components/FillUpForm';
import { FillUpReviewSheet } from '@/components/FillUpReviewSheet';
import { reviewFillUp, type FillUpReview } from '@/lib/domain/economy';
import { findRecentDuplicate } from '@/lib/domain/fillupDedupe';
import { fuelCfgFor, partialEconomy, type SeriesPoint } from '@/lib/domain/partialEconomy';
import { perFillEconomyOf } from '@/lib/domain/perFillEconomy';
import { economyNumber, economyValue } from '@/lib/format';
import { economyLabel } from '@/lib/fuel';
import { Alert } from '@/lib/alert';
import { es } from '@/lib/i18n/es';
import { defaultFuelForNewLoad, useOdometerHint, useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import type { FillUp, FuelType } from '@/lib/types';

type Result = { id: string; review: FillUpReview; fuelType: FuelType; missedPrevious: boolean; estimate: SeriesPoint | null; perFillLine: string | null };

export default function CargarScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, vehicleFillups, upsertFillUp } = useStore();
  const lastOdo = useOdometerHint();
  const { data } = useStore();
  const [result, setResult] = useState<Result | null>(null);

  // Note 8: after a save this screen is left for the fill-up's detail — the form
  // never stays up holding the values it just saved (no re-key on focus).
  const openSaved = (fillId: string) => router.replace({ pathname: '/carga/[id]', params: { id: fillId, saved: '1' } });

  if (!activeVehicle) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <View style={{ flex: 1 }}>
        <FillUpForm
          key={activeVehicle.id}
          vehicleId={activeVehicle.id}
          defaultFuel={defaultFuelForNewLoad(activeVehicle)}
          lastOdo={lastOdo}
          submitLabel={es.fuel.save}
          onSubmit={(draft) => {
            const dup = findRecentDuplicate(draft, data.fillups);
            if (dup) {
              Alert.alert(es.fuel.duplicateTitle, es.fuel.duplicateBody, [
                { text: es.common.cancel, style: 'cancel' },
                { text: es.fuel.duplicateOpen, onPress: () => openSaved(dup.id) },
              ]);
              return false;
            }
            // Reviewed against the fill-ups that existed *before* this one, so
            // the comparison is with history rather than with itself.
            const current: FillUp = {
              ...draft,
              id: 'review',
              createdAt: new Date().toISOString(),
            };
            const review = reviewFillUp(current, vehicleFillups);
            // Note 4: the gauge estimate for this fill-up, when it is a partial with readings.
            const partial = partialEconomy([...vehicleFillups.filter((f) => f.id !== current.id), current], fuelCfgFor(activeVehicle.detail));
            const estimate = partial.segments.find((s) => s.fillUpId === current.id) ?? null;
            // Note 9: km since the previous log over what was added now, approximate.
            const pf = perFillEconomyOf(current.id, [...vehicleFillups, current]);
            const volumeUnit = activeVehicle.detail?.volumeUnit ?? 'gal';
            const economyUnit = draft.fuelType === 'gnv' ? null : activeVehicle.detail?.economyUnit;
            const perFillLine = pf && review.kmPerUnit == null
              ? es.perFill.line(economyNumber(economyValue(pf.kmPerUnit, volumeUnit, economyUnit)), economyLabel(draft.fuelType, volumeUnit, economyUnit))
              : null;
            const savedId = upsertFillUp(draft);
            impact();
            setResult({
              id: savedId,
              review,
              fuelType: draft.fuelType,
              missedPrevious: Boolean(draft.missedPrevious),
              estimate,
              perFillLine,
            });
          }}
        />
      </View>

      <FillUpReviewSheet
        visible={result != null}
        review={result?.review ?? null}
        fuelType={result?.fuelType ?? activeVehicle.defaultFuelType}
        volumeUnit={activeVehicle.detail?.volumeUnit}
        economyUnit={activeVehicle.detail?.economyUnit}
        missedPrevious={result?.missedPrevious ?? false}
        estimate={result?.estimate ?? null}
        perFillLine={result?.perFillLine ?? null}
        onClose={() => {
          const savedId = result?.id;
          setResult(null);
          if (savedId) openSaved(savedId);
        }}
        onSeeHistory={() => {
          setResult(null);
          router.replace('/(tabs)/historial');
        }}
      />
    </SafeAreaView>
  );
}

/** Light tap on save. Native only — the web build must not reach for haptics. */
function impact() {
  if (Platform.OS === 'web') return;
  void import('expo-haptics')
    .then((H) => H.impactAsync(H.ImpactFeedbackStyle.Light))
    .catch(() => {});
}
