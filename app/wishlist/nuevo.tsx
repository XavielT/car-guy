import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WishlistForm } from '@/components/build/WishlistForm';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** New wishlist item for a vehicle. */
export default function NewWishScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh } = useStore();
  const target = vehicleId ?? activeVehicle?.id;
  if (!target) return null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <WishlistForm
        vehicleId={target}
        onDone={() => {
          refresh();
          router.back();
        }}
      />
    </SafeAreaView>
  );
}
