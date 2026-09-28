import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WheelSetForm } from '@/components/build/InventoryForms';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** A wheel set; `setId = nuevo` creates one. */
export default function WheelSetScreen() {
  const { setId, vehicleId } = useLocalSearchParams<{ setId: string; vehicleId?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh } = useStore();
  const target = vehicleId ?? activeVehicle?.id;
  if (!target) return null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <WheelSetForm
        vehicleId={target}
        setId={setId === 'nuevo' ? undefined : setId}
        onDone={() => {
          refresh();
          router.back();
        }}
      />
    </SafeAreaView>
  );
}
