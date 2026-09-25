import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { VehicleForm } from '@/components/VehicleForm';
import { space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { importBackup } from '@/lib/backup';
import { saveVehicleDraft } from '@/lib/db/vehicleOps';
import { es } from '@/lib/i18n/es';
import { describeCounts } from '@/lib/import/tucombustible';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

const MARK = require('@/assets/images/icon.png');

/**
 * The first screen of a fresh install (03-screens-ia.md): welcome, then one of
 * two ways in — create the first vehicle, or bring the history over from Tu
 * Combustible RD — with the account card underneath for someone reinstalling.
 *
 * The vehicle form opens on this same screen rather than a new route: there is
 * nothing to go "back" to from a first run, and a stack of one is a dead end.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh, setActiveVehicle, data } = useStore();
  const [step, setStep] = useState<'welcome' | 'vehicle'>('welcome');

  // Signing in from the account card pulls the garage down behind this screen;
  // once a vehicle exists there is nothing left to onboard.
  const hasVehicles = data.vehicles.length > 0;
  useEffect(() => {
    if (hasVehicles) router.replace('/(tabs)');
  }, [hasVehicles, router]);

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

  if (step === 'vehicle') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.formHeader}>
            <GhostButton label={`‹ ${es.onboarding.backToWelcome}`} onPress={() => setStep('welcome')} />
            <T face="display" style={[styles.formTitle, { color: theme.text.primary }]}>
              {es.onboarding.formTitle}
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
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.welcome}>
        <View style={styles.hero}>
          <Image source={MARK} style={styles.mark} accessibilityLabel={es.onboarding.markLabel} />
          <T face="medium" style={[styles.eyebrow, { color: theme.accent }]}>
            {es.home.eyebrow}
          </T>
          <T face="display" style={[styles.title, { color: theme.text.primary }]}>
            {es.app.tagline}
          </T>
          <T face="body" style={[styles.lede, { color: theme.text.secondary }]}>
            {es.onboarding.welcome}
          </T>
        </View>

        <View style={styles.actions}>
          <PrimaryButton label={es.onboarding.createFirst} onPress={() => setStep('vehicle')} />
          <T face="body" style={[styles.altText, { color: theme.text.secondary }]}>
            {es.onboarding.legacyPrompt}
          </T>
          <GhostButton label={es.onboarding.legacyAction} onPress={handleImport} />
        </View>

        <Surface style={styles.account}>
          <T face="title" style={{ color: theme.text.primary, fontSize: 17 }}>
            {es.onboarding.accountTitle}
          </T>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
            {es.onboarding.accountBody}
          </T>
          <GhostButton label={es.onboarding.accountAction} onPress={() => router.push('/cuenta')} />
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  welcome: { flexGrow: 1, padding: space.gutter, paddingBottom: space.xxl },
  hero: { paddingTop: space.xxl, paddingBottom: space.xl },
  mark: { width: 72, height: 72, borderRadius: 18, marginBottom: space.lg },
  eyebrow: { fontSize: 11, letterSpacing: 1.4 },
  title: { fontSize: 34, marginTop: 6 },
  lede: { fontSize: 15, lineHeight: 22, marginTop: space.md },
  actions: { gap: space.md, marginBottom: space.xl },
  altText: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: space.sm },
  account: { gap: space.xs },
  formHeader: { paddingHorizontal: space.gutter, paddingTop: space.lg },
  formTitle: { fontSize: 28, marginTop: space.sm },
});
