import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModForm } from '@/components/build/ModForm';
import { MissingRecord } from '@/components/MissingRecord';
import { FormSkeleton } from '@/components/ui/Skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { mods as modRepo } from '@/lib/db/repos';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** Edit a mod; opened from the build, Historial and the album timeline. */
export default function ModScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh } = useStore();
  // undefined: still looking · null: looked, and it is gone.
  const [vehicleId, setVehicleId] = useState<string | null | undefined>(undefined);
  const showSkeleton = useDelayedLoading(vehicleId === undefined);

  useEffect(() => {
    void modRepo.getById(id).then((m) => setVehicleId(m?.vehicleId ?? null));
  }, [id]);

  // The same field outlines while the screen finds the mod and while the form reads it.
  const twin = <FormSkeleton fields={8} />;
  if (vehicleId === null) return <MissingRecord />;
  if (!vehicleId) return showSkeleton ? twin : null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ModForm
        vehicleId={vehicleId}
        modId={id}
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
