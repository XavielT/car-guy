import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MilestoneForm } from '@/components/album/MilestoneForm';
import { milestones as milestoneRepo } from '@/lib/db/repos';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** Edit a milestone; opened from the album timeline and from Historial. */
export default function MilestoneScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh } = useStore();
  const [vehicleId, setVehicleId] = useState<string | null>(null);

  useEffect(() => {
    void milestoneRepo.getById(id).then((m) => setVehicleId(m?.vehicleId ?? null));
  }, [id]);

  if (!vehicleId) return null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <MilestoneForm
        vehicleId={vehicleId}
        milestoneId={id}
        onDone={() => {
          refresh();
          router.back();
        }}
      />
    </SafeAreaView>
  );
}
