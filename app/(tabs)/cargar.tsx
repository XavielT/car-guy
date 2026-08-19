import { FillUpForm } from '@/components/FillUpForm';
import { colors } from '@/constants/theme';
import { defaultFuelForNewLoad, useOdometerHint, useStore } from '@/lib/store';
import { useRouter } from 'expo-router';
import { Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CargarScreen() {
  const router = useRouter();
  const { activeVehicle, upsertFillUp } = useStore();
  const lastOdo = useOdometerHint();

  if (!activeVehicle) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.receipt }} edges={['top']}>
      <View style={{ flex: 1 }}>
        <FillUpForm
          vehicleId={activeVehicle.id}
          defaultFuel={defaultFuelForNewLoad(activeVehicle)}
          lastOdo={lastOdo}
          submitLabel="Guardar carga"
          onSubmit={(draft) => {
            upsertFillUp(draft);
            Alert.alert('Carga guardada', 'Quedó en el historial de este vehículo.');
            router.push('/(tabs)/historial');
          }}
        />
      </View>
    </SafeAreaView>
  );
}
