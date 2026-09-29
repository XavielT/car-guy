import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MissingRecord } from '@/components/MissingRecord';
import { SessionForm } from '@/components/track/SessionForm';
import { trackSessions } from '@/lib/db/repos';
import { useTheme } from '@/lib/theme/useTheme';

/** A session and its setup sheet (Pista.dc.html). */
export default function TrackSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const [exists, setExists] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    void trackSessions.getById(id).then((s) => setExists(Boolean(s && !s.deletedAt)));
  }, [id]);

  if (exists === false) return <MissingRecord />;
  if (!exists) return null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <SessionForm key={id} sessionId={id} onDone={() => router.back()} />
    </SafeAreaView>
  );
}
