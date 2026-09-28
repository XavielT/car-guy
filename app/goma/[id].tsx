import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TireForm } from '@/components/build/InventoryForms';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** A tire; `id = nuevo` creates one (optionally on `setId`). */
export default function TireScreen() {
  const { id, vehicleId, setId } = useLocalSearchParams<{ id: string; vehicleId?: string; setId?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh } = useStore();
  const target = vehicleId ?? activeVehicle?.id;
  if (!target) return null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <TireForm
        vehicleId={target}
        tireId={id === 'nuevo' ? undefined : id}
        initialSetId={setId ?? null}
        onDone={() => {
          refresh();
          router.back();
        }}
      />
    </SafeAreaView>
  );
}
