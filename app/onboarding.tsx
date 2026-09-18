import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { GhostButton } from '@/components/ui';
import { VehicleForm } from '@/components/VehicleForm';
import { space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { importBackup } from '@/lib/backup';
import { saveVehicleDraft } from '@/lib/db/vehicleOps';
import { es } from '@/lib/i18n/es';
import { describeCounts } from '@/lib/import/tucombustible';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

export default function OnboardingScreen() {
  const router = useRouter();
  const { theme } = useTheme();
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
        es.onboarding.importedTitle,
        result.kind === 'legacy'
          ? es.onboarding.importedLegacy(describeCounts(result.counts))
          : es.onboarding.importedMerge(result.counts.merged),
      );
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert(
        es.onboarding.importFailedTitle,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <T face="medium" style={[styles.eyebrow, { color: theme.accent }]}>
            {es.home.eyebrow}
          </T>
          <T face="display" style={[styles.title, { color: theme.text.primary }]}>
            {es.app.tagline}
          </T>
        </View>

        <VehicleForm
          submitLabel={es.vehicle.create}
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
          <T face="body" style={[styles.altText, { color: theme.text.secondary }]}>
            {es.onboarding.legacyPrompt}
          </T>
          <GhostButton label={es.onboarding.legacyAction} onPress={handleImport} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: space.gutter, paddingTop: space.xxl, paddingBottom: space.sm },
  eyebrow: { fontSize: 11, letterSpacing: 1.4 },
  title: { fontSize: 32, marginTop: 6 },
  alt: { paddingHorizontal: space.gutter, paddingBottom: space.xxl },
  altText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
