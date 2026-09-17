import { FillUpForm } from '@/components/FillUpForm';
import { colors } from '@/constants/theme';
import { defaultFuelForNewLoad, useOdometerHint, useStore } from '@/lib/store';
import { money, km, kmPerUnit } from '@/lib/format';
import { FUEL_CATALOG } from '@/lib/fuel';
import { reviewFillUp } from '@/lib/math';
import type { FillUp } from '@/lib/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Alert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useState } from 'react';

export default function CargarScreen() {
  const router = useRouter();
  const { activeVehicle, vehicleFillups, upsertFillUp } = useStore();
  const lastOdo = useOdometerHint();
  const [formKey, setFormKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setFormKey((value) => value + 1);
    }, []),
  );

  if (!activeVehicle) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.receipt }} edges={['top']}>
      <View style={{ flex: 1 }}>
        <FillUpForm
          key={`${activeVehicle.id}-${formKey}`}
          vehicleId={activeVehicle.id}
          defaultFuel={defaultFuelForNewLoad(activeVehicle)}
          lastOdo={lastOdo}
          submitLabel="Guardar carga"
          onSubmit={(draft) => {
            const current: FillUp = {
              ...draft,
              id: 'review',
              createdAt: new Date().toISOString(),
            };
            const review = reviewFillUp(current, vehicleFillups);
            upsertFillUp(draft);
            const statusTitle = review.status === 'low'
              ? 'Rendimiento bajo'
              : review.status === 'great'
                ? 'Buen rendimiento'
                : review.status === 'normal'
                  ? 'Rendimiento estable'
                  : 'Primera medición';
            const lines = [
              `Precio por ${FUEL_CATALOG[draft.fuelType].unitLabel}: ${money(review.pricePerUnit)}`,
              review.distanceKm != null ? `Km recorridos: ${km(review.distanceKm)}` : 'Km recorridos: falta una carga anterior',
              review.kmPerUnit != null ? `Rendimiento: ${kmPerUnit(review.kmPerUnit, draft.fuelType)}` : 'Rendimiento: se calculará con datos suficientes',
              review.costPerKm != null ? `Costo por km: ${money(review.costPerKm)}` : 'Costo por km: se calculará con una carga anterior',
            ];
            if (review.status === 'low' && review.baseline != null) {
              lines.push(`Está por debajo de tu promedio de ${kmPerUnit(review.baseline, draft.fuelType)}. Revisa tráfico, presión de gomas o posibles fugas.`);
            } else if (review.status === 'great' && review.baseline != null) {
              lines.push(`Está por encima de tu promedio de ${kmPerUnit(review.baseline, draft.fuelType)}.`);
            } else if (review.status === 'first') {
              lines.push('Guarda otra carga para empezar a comparar tu rendimiento real.');
            }
            Alert.alert(statusTitle, lines.join('\n'), [
              { text: 'Ver historial', onPress: () => router.push('/(tabs)/historial') },
            ]);
          }}
        />
      </View>
    </SafeAreaView>
  );
}
