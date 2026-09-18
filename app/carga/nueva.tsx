import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FillUpForm } from '@/components/FillUpForm';
import { FillUpReviewSheet } from '@/components/FillUpReviewSheet';
import { reviewFillUp, type FillUpReview } from '@/lib/domain/economy';
import { es } from '@/lib/i18n/es';
import { defaultFuelForNewLoad, useOdometerHint, useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import type { FillUp, FuelType } from '@/lib/types';

type Result = { review: FillUpReview; fuelType: FuelType; missedPrevious: boolean };

export default function CargarScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, vehicleFillups, upsertFillUp } = useStore();
  const lastOdo = useOdometerHint();
  const [formKey, setFormKey] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  useFocusEffect(
    useCallback(() => {
      setFormKey((value) => value + 1);
    }, []),
  );

  if (!activeVehicle) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['top']}>
      <View style={{ flex: 1 }}>
        <FillUpForm
          key={`${activeVehicle.id}-${formKey}`}
          vehicleId={activeVehicle.id}
          defaultFuel={defaultFuelForNewLoad(activeVehicle)}
          lastOdo={lastOdo}
          submitLabel={es.fuel.save}
          onSubmit={(draft) => {
            // Reviewed against the fill-ups that existed *before* this one, so
            // the comparison is with history rather than with itself.
            const current: FillUp = {
              ...draft,
              id: 'review',
              createdAt: new Date().toISOString(),
            };
            const review = reviewFillUp(current, vehicleFillups);
            upsertFillUp(draft);
            impact();
            setResult({
              review,
              fuelType: draft.fuelType,
              missedPrevious: Boolean(draft.missedPrevious),
            });
          }}
        />
      </View>

      <FillUpReviewSheet
        visible={result != null}
        review={result?.review ?? null}
        fuelType={result?.fuelType ?? activeVehicle.defaultFuelType}
        missedPrevious={result?.missedPrevious ?? false}
        onClose={() => setResult(null)}
        onSeeHistory={() => {
          setResult(null);
          router.push('/(tabs)/historial');
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
