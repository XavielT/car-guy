import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VehicleForm, type VehicleDraft } from '@/components/VehicleForm';
import { currentOdometer as currentOdometerQuery, vehicles as vehicleRepo } from '@/lib/db/repos';
import { vehicleGallery } from '@/lib/db/tripOps';
import { saveVehicleDraft } from '@/lib/db/vehicleOps';
import { tankForDisplay } from '@/lib/domain/units';
import { dateInputFromIso } from '@/lib/format';
import { t } from '@/lib/i18n';
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
      const [km, gallery] = await Promise.all([currentOdometerQuery(id), vehicleGallery(id)]);
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
        tankVolume: tankForDisplay(v.tankVolume, v.tankVolumeEntered, v.volumeUnit, v.defaultFuelType),
        odometerKm: km,
        purchaseDate: v.purchaseDate ? dateInputFromIso(v.purchaseDate) : null,
        purchasePrice: v.purchasePrice,
        photoMediaId: v.photoMediaId,
        notes: v.notes,
        nickname: v.nickname,
        status: v.status,
        chassisCode: v.chassisCode,
        chassisNumber: v.chassisNumber,
        engineCode: v.engineCode,
        transmission: v.transmission,
        drivetrain: v.drivetrain,
        origin: v.origin,
        importedYear: v.importedYear,
        story: v.story,
        // v6 (IMP 29092026 Phase 3)
        makeId: v.makeId,
        modelId: v.modelId,
        bodyType: v.bodyType,
        colorId: v.colorId,
        interiorColorId: v.interiorColorId,
        interiorMaterial: v.interiorMaterial,
        volumeUnit: v.volumeUnit,
        economyUnit: v.economyUnit,
        statusNote: v.statusNote,
        statusSince: v.statusSince ? dateInputFromIso(v.statusSince) : null,
        galleryIds: gallery.map((item) => item.mediaId),
      });
    })();
  }, [id]);

  if (!initial) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <VehicleForm
        initial={initial}
        submitLabel={t.vehicle.save}
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
