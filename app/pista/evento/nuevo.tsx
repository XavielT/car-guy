import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventForm } from '@/components/track/EventForm';
import { useTheme } from '@/lib/theme/useTheme';

/** New track event. Saving it moves to its own screen, where sessions are added. */
export default function NewTrackEventScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <EventForm vehicleId={vehicleId} onDone={() => router.back()} />
    </SafeAreaView>
  );
}
