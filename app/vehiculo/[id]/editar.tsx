import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VehicleForm, type VehicleDraft } from '@/components/VehicleForm';
import { currentOdometer as currentOdometerQuery, vehicles as vehicleRepo } from '@/lib/db/repos';
import { vehicleGallery } from '@/lib/db/tripOps';
import { recalibrateVehicle } from '@/lib/db/gaugeOps';
import { draftFromVehicle } from '@/lib/db/vehicleDraft';
import { saveVehicleDraft } from '@/lib/db/vehicleOps';
import { Alert } from '@/lib/alert';
import { parseCalibration } from '@/lib/domain/gaugeCalibration';
import { isLearned } from '@/lib/domain/gaugeVehicle';
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
      setInitial(draftFromVehicle(v, km, gallery.map((item) => item.mediaId)));
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
            const before = await vehicleRepo.getById(draft.id ?? id);
            await saveVehicleDraft(draft);
            const after = await vehicleRepo.getById(draft.id ?? id);
            await refresh();
            router.back();
            // Research 03 §7.5: a tank that changed by more than 2 L may be a new tank — offer to relearn the gauge.
            const changedL = before?.tankVolume != null && after?.tankVolume != null ? Math.abs(after.tankVolume - before.tankVolume) : 0;
            if (after && changedL > 2 && isLearned(parseCalibration(after.gaugeCalibration))) {
              Alert.alert(t.gauge.resetTitle, t.gauge.resetTankBody, [
                { text: t.common.cancel, style: 'cancel' },
                {
                  text: t.gauge.reset,
                  style: 'destructive',
                  onPress: () => void recalibrateVehicle(after.id, { resetAt: new Date().toISOString() }).then(refresh),
                },
              ]);
            }
          })();
        }}
      />
    </SafeAreaView>
  );
}
