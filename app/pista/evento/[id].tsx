import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MissingRecord } from '@/components/MissingRecord';
import { EventForm } from '@/components/track/EventForm';
import { FormSkeleton } from '@/components/ui/Skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { trackEvents } from '@/lib/db/repos';
import { useTheme } from '@/lib/theme/useTheme';

/** A track event: its data, sessions, consumables, day summary and photos. */
export default function TrackEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  // undefined: still looking · false: looked, and it is gone.
  const [exists, setExists] = useState<boolean | undefined>(undefined);
  const showSkeleton = useDelayedLoading(exists === undefined);
  // Coming back from a session remounts the form, so its list and summary are fresh.
  const [visit, setVisit] = useState(0);

  useEffect(() => {
    void trackEvents.getById(id).then((e) => setExists(Boolean(e && !e.deletedAt)));
  }, [id]);
  useFocusEffect(useCallback(() => setVisit((v) => v + 1), []));

  const twin = <FormSkeleton fields={7} />;
  if (exists === false) return <MissingRecord />;
  if (!exists) return showSkeleton ? twin : null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <EventForm
        key={`${id}:${visit}`}
        eventId={id}
        // The first open only (the first focus is visit 1); a remount on coming back is a refresh.
        skeleton={visit <= 1 ? twin : null}
        skeletonContinued={visit <= 1 && showSkeleton}
        onDone={() => (router.canGoBack() ? router.back() : router.replace('/pista'))}
      />
    </SafeAreaView>
  );
}
