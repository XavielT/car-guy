import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TireForm } from '@/components/build/InventoryForms';
import { FormSkeleton } from '@/components/ui/Skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** A tire; `id = nuevo` creates one (optionally on `setId`). */
export default function TireScreen() {
  const { id, vehicleId, setId } = useLocalSearchParams<{ id: string; vehicleId?: string; setId?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh, ready } = useStore();
  const target = vehicleId ?? activeVehicle?.id;
  // Without a vehicle in the link, the active one comes with the store's first load.
  const showSkeleton = useDelayedLoading(!target && !ready);
  const twin = <FormSkeleton fields={7} />;
  if (!target) return showSkeleton ? twin : null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <TireForm
        vehicleId={target}
        skeleton={twin}
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
