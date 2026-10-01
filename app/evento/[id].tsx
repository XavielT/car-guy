import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventForm } from '@/components/album/EventForm';
import { MissingRecord } from '@/components/MissingRecord';
import { FormSkeleton } from '@/components/ui/Skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { milestones as milestoneRepo } from '@/lib/db/repos';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** Edit an event (or a hito); opened from the hub's Eventos tab, the album timeline and Historial. */
export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh } = useStore();
  // undefined: still looking · null: looked, and it is gone.
  const [vehicleId, setVehicleId] = useState<string | null | undefined>(undefined);
  const showSkeleton = useDelayedLoading(vehicleId === undefined);

  useEffect(() => {
    void milestoneRepo.getById(id).then((m) => setVehicleId(m && !m.deletedAt ? m.vehicleId : null));
  }, [id]);

  // The same field outlines while the screen finds the event and while the form reads it.
  const twin = <FormSkeleton fields={7} />;
  if (vehicleId === null) return <MissingRecord />;
  if (!vehicleId) return showSkeleton ? twin : null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <EventForm
        vehicleId={vehicleId}
        milestoneId={id}
        skeleton={twin}
        skeletonContinued={showSkeleton}
        onDone={() => {
          refresh();
          router.back();
        }}
      />
    </SafeAreaView>
  );
}
