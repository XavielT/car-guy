import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MissingRecord } from '@/components/MissingRecord';
import { EventForm } from '@/components/track/EventForm';
import { trackEvents } from '@/lib/db/repos';
import { useTheme } from '@/lib/theme/useTheme';

/** A track event: its data, sessions, consumables, day summary and photos. */
export default function TrackEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const [exists, setExists] = useState<boolean | undefined>(undefined);
  // Coming back from a session remounts the form, so its list and summary are fresh.
  const [visit, setVisit] = useState(0);

  useEffect(() => {
    void trackEvents.getById(id).then((e) => setExists(Boolean(e && !e.deletedAt)));
  }, [id]);
  useFocusEffect(useCallback(() => setVisit((v) => v + 1), []));

  if (exists === false) return <MissingRecord />;
  if (!exists) return null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <EventForm key={`${id}:${visit}`} eventId={id} onDone={() => (router.canGoBack() ? router.back() : router.replace('/pista'))} />
    </SafeAreaView>
  );
}
