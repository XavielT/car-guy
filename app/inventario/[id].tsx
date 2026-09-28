import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InventoryItemForm } from '@/components/build/InventoryForms';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** Edit an inventory item; "Usar en un mod" lives in the form. */
export default function InventoryScreen() {
  const { id, vehicleId } = useLocalSearchParams<{ id: string; vehicleId?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh } = useStore();
  const target = vehicleId ?? activeVehicle?.id;
  if (!target) return null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <InventoryItemForm
        vehicleId={target}
        itemId={id}
        onDone={() => {
          refresh();
          router.back();
        }}
      />
    </SafeAreaView>
  );
}
