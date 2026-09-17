import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VehicleForm, type VehicleDraft } from '@/components/VehicleForm';
import { currentOdometer as currentOdometerQuery, vehicles as vehicleRepo } from '@/lib/db/repos';
import { saveVehicleDraft } from '@/lib/db/vehicleOps';
import { dateInputFromIso } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

export default function EditarVehiculoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh } = useStore();
  const [initial, setInitial] = useState<Partial<VehicleDraft> | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const v = await vehicleRepo.getById(id);
      if (!v) return;
      const km = await currentOdometerQuery(id);
      setInitial({
        id: v.id,
        name: v.name,
        type: v.type,
        make: v.make,
        model: v.model,
        year: v.year,
        color: v.color,
        plate: v.plate,
        vin: v.vin,
        defaultFuelType: v.defaultFuelType,
        tankVolume: v.tankVolume,
        odometerKm: km,
        purchaseDate: v.purchaseDate ? dateInputFromIso(v.purchaseDate) : null,
        purchasePrice: v.purchasePrice,
        photoMediaId: v.photoMediaId,
        notes: v.notes,
      });
    })();
  }, [id]);

  if (!initial) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <VehicleForm
        initial={initial}
        submitLabel={es.vehicle.save}
        onSubmit={(draft) => {
          void (async () => {
            await saveVehicleDraft(draft);
            await refresh();
            router.back();
          })();
        }}
      />
    </SafeAreaView>
  );
}
