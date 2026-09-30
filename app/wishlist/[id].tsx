import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WishlistForm } from '@/components/build/WishlistForm';
import { FormSkeleton } from '@/components/ui/Skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** Edit a wishlist item; "Convertir a mod" lives in the form. */
export default function WishScreen() {
  const { id, vehicleId } = useLocalSearchParams<{ id: string; vehicleId?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh, ready } = useStore();
  const target = vehicleId ?? activeVehicle?.id;
  // Without a vehicle in the link, the active one comes with the store's first load.
  const showSkeleton = useDelayedLoading(!target && !ready);
  const twin = <FormSkeleton fields={8} />;
  if (!target) return showSkeleton ? twin : null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <WishlistForm
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
