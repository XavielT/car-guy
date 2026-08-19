import { FillUpForm } from '@/components/FillUpForm';
import { colors } from '@/constants/theme';
import { lastOdometer } from '@/lib/math';
import { useStore } from '@/lib/store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EditCargaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, upsertFillUp, deleteFillUp } = useStore();
  const fill = data.fillups.find((f) => f.id === id);
  const others = data.fillups.filter((f) => f.vehicleId === fill?.vehicleId && f.id !== id);

  if (!fill) {
    return <View style={{ flex: 1, backgroundColor: colors.receipt }} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.receipt }} edges={['top']}>
      <FillUpForm
        vehicleId={fill.vehicleId}
        defaultFuel={fill.fuelType}
        lastOdo={lastOdometer(others)}
        initial={fill}
        submitLabel="Guardar cambios"
        onSubmit={(draft) => {
          upsertFillUp({ ...draft, id: fill.id });
          router.back();
        }}
        onDelete={() =>
          Alert.alert('Borrar carga', 'Se quita del historial y se recalcula el consumo.', [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Borrar',
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
