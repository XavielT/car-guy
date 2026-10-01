import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventForm } from '@/components/album/EventForm';
import { EVENT_TYPES, type EventType } from '@/lib/domain/events';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * New event for a vehicle (the active one unless `vehicleId` says otherwise).
 * `type` preselects the type: the album's "Agregar hito" sends `hito`; the
 * hub's Eventos tab sends nothing and starts on a minor damage.
 */
export default function NewEventScreen() {
  const { vehicleId, type } = useLocalSearchParams<{ vehicleId?: string; type?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh } = useStore();
  const target = vehicleId ?? activeVehicle?.id;
  const initialType = EVENT_TYPES.some((e) => e.id === type) ? (type as EventType) : 'dano_menor';
  if (!target) return null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <EventForm
        vehicleId={target}
        initialType={initialType}
        onDone={() => {
          refresh();
          router.back();
        }}
      />
    </SafeAreaView>
  );
}
