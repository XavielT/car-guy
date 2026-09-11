import { VehicleForm } from '@/components/VehicleForm';
import { colors } from '@/constants/theme';
import { useStore } from '@/lib/store';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingScreen() {
  const router = useRouter();
  const { upsertVehicle } = useStore();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.receipt }} edges={['top', 'bottom']}>
      <VehicleForm
        submitLabel="Empezar a registrar"
        onSubmit={(v) => {
          upsertVehicle(v);
          router.replace('/(tabs)');
        }}
      />
    </SafeAreaView>
  );
}
