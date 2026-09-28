import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MilestoneForm } from '@/components/album/MilestoneForm';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** New milestone for a vehicle (the active one unless `vehicleId` says otherwise). */
export default function NewMilestoneScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh } = useStore();
  const target = vehicleId ?? activeVehicle?.id;
  if (!target) return null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <MilestoneForm
        vehicleId={target}
        onDone={() => {
          refresh();
          router.back();
        }}
      />
    </SafeAreaView>
  );
}
