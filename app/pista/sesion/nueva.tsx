import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SessionForm } from '@/components/track/SessionForm';
import { useTheme } from '@/lib/theme/useTheme';

/** New session: numbered after the last one, its setup copied forward. */
export default function NewTrackSessionScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <SessionForm eventId={eventId} onDone={() => router.back()} />
    </SafeAreaView>
  );
}
