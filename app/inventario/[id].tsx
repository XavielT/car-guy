import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InventoryItemForm } from '@/components/build/InventoryForms';
import { FormSkeleton } from '@/components/ui/Skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** Edit an inventory item; "Usar en un mod" lives in the form. */
export default function InventoryScreen() {
  const { id, vehicleId } = useLocalSearchParams<{ id: string; vehicleId?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh, ready } = useStore();
  const target = vehicleId ?? activeVehicle?.id;
  // Without a vehicle in the link, the active one comes with the store's first load.
  const showSkeleton = useDelayedLoading(!target && !ready);
  const twin = <FormSkeleton fields={6} />;
  if (!target) return showSkeleton ? twin : null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <InventoryItemForm
        vehicleId={target}
        skeleton={twin}
        itemId={id}
        onDone={() => {
          refresh();
          router.back();
        }}
      />
    </SafeAreaView>
  );
}
