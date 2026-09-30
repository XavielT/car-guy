import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FillUpForm } from '@/components/FillUpForm';
import { Alert } from '@/lib/alert';
import { lastOdometer } from '@/lib/domain/economy';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** Editing a fill-up (opened from its detail, `app/carga/[id]/index.tsx` → Editar). */
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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <FillUpForm
        vehicleId={fill.vehicleId}
        defaultFuel={fill.fuelType}
        lastOdo={lastOdometer(others)}
        initial={fill}
        submitLabel={t.fuel.saveChanges}
        onSubmit={(draft) => {
          upsertFillUp({ ...draft, id: fill.id });
          // Back to the detail it was opened from (note 8: detail first, editor behind "Editar").
          router.back();
        }}
        onDelete={() =>
          Alert.alert(t.fuel.deleteTitle, t.fuel.deleteBody, [
            { text: t.common.cancel, style: 'cancel' },
            {
              text: t.common.delete,
              style: 'destructive',
              onPress: () => {
                deleteFillUp(fill.id);
                // The detail under this editor is gone too.
                router.dismissTo('/(tabs)/historial');
              },
            },
          ])
        }
      />
    </SafeAreaView>
  );
}
