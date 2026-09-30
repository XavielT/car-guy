import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MissingRecord } from '@/components/MissingRecord';
import { SessionForm } from '@/components/track/SessionForm';
import { FormSkeleton } from '@/components/ui/Skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { trackSessions } from '@/lib/db/repos';
import { useTheme } from '@/lib/theme/useTheme';

/** A session and its setup sheet (Pista.dc.html). */
export default function TrackSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  // undefined: still looking · false: looked, and it is gone.
  const [exists, setExists] = useState<boolean | undefined>(undefined);
  const showSkeleton = useDelayedLoading(exists === undefined);

  useEffect(() => {
    void trackSessions.getById(id).then((s) => setExists(Boolean(s && !s.deletedAt)));
  }, [id]);

  // The same outlines while the screen finds the session and while the form reads it.
  const twin = <FormSkeleton fields={6} />;
  if (exists === false) return <MissingRecord />;
  if (!exists) return showSkeleton ? twin : null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <SessionForm key={id} sessionId={id} skeleton={twin} skeletonContinued={showSkeleton} onDone={() => router.back()} />
    </SafeAreaView>
  );
}
