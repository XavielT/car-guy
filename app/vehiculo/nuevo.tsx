import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VehicleForm } from '@/components/VehicleForm';
import { saveVehicleDraft } from '@/lib/db/vehicleOps';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

export default function NuevoVehiculoScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh, setActiveVehicle } = useStore();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <VehicleForm
        submitLabel={es.vehicle.create}
        onSubmit={(draft) => {
          void (async () => {
            const id = await saveVehicleDraft(draft);
            await refresh();
            // Switch to it: someone who just added a vehicle means to use it.
            setActiveVehicle(id);
            router.back();
          })();
        }}
      />
    </SafeAreaView>
  );
}
