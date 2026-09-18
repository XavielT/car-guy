import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FillUpForm } from '@/components/FillUpForm';
import { Alert } from '@/lib/alert';
import { lastOdometer } from '@/lib/domain/economy';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

export default function EditCargaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { data, upsertFillUp, deleteFillUp } = useStore();
  const fill = data.fillups.find((f) => f.id === id);
  const others = data.fillups.filter((f) => f.vehicleId === fill?.vehicleId && f.id !== id);

  if (!fill) {
    return <View style={{ flex: 1, backgroundColor: theme.bg.base }} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['top', 'bottom']}>
      <FillUpForm
        vehicleId={fill.vehicleId}
        defaultFuel={fill.fuelType}
        lastOdo={lastOdometer(others)}
        initial={fill}
        submitLabel={es.fuel.saveChanges}
        onSubmit={(draft) => {
          upsertFillUp({ ...draft, id: fill.id });
          router.back();
        }}
        onDelete={() =>
          Alert.alert(es.fuel.deleteTitle, es.fuel.deleteBody, [
            { text: es.common.cancel, style: 'cancel' },
            {
              text: es.common.delete,
              style: 'destructive',
              onPress: () => {
                deleteFillUp(fill.id);
                router.back();
              },
            },
          ])
        }
      />
    </SafeAreaView>
  );
}
