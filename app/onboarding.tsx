import { VehicleForm } from '@/components/VehicleForm';
import { GhostButton } from '@/components/ui';
import { T } from '@/components/T';
import { colors } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { importBackup } from '@/lib/backup';
import { describeCounts } from '@/lib/import/tucombustible';
import { saveVehicleDraft } from '@/lib/db/vehicleOps';
import { useStore } from '@/lib/store';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingScreen() {
  const router = useRouter();
  const { refresh, setActiveVehicle } = useStore();

  /**
   * The second way in. Car Guy ships as a new Android app, so someone coming
   * from Tu Combustible RD arrives at an empty install with their history in a
   * JSON file — this is where they get it back (decision D1).
   */
  async function handleImport() {
    try {
      const result = await importBackup();
      if (!result) return;
      await refresh();
      Alert.alert(
        'Datos importados',
        result.kind === 'legacy'
          ? `Listo: ${describeCounts(result.counts)}.`
          : `Listo: ${result.counts.merged} registros restaurados.`,
      );
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Importar', error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.receipt }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <VehicleForm
          submitLabel="Empezar a registrar"
          onSubmit={(draft) => {
            void (async () => {
              const id = await saveVehicleDraft(draft);
              await refresh();
              setActiveVehicle(id);
              router.replace('/(tabs)');
            })();
          }}
        />
        <View style={styles.alt}>
          <T face="body" style={styles.altText}>
            ¿Vienes de Tu Combustible RD? Trae tu historial completo desde el respaldo JSON.
          </T>
          <GhostButton label="Importar respaldo de Tu Combustible RD" onPress={handleImport} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  alt: { paddingHorizontal: 20, paddingBottom: 24 },
  altText: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
