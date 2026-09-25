import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReminderForm } from '@/components/ReminderForm';
import { T } from '@/components/T';
import { space } from '@/constants/theme';
import { vehicles as vehicleRepo } from '@/lib/db/repos';
import type { Vehicle } from '@/lib/db/types';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** A reminder the catalog did not think of — or one of its items, set up by hand. */
export default function NuevoRecordatorioScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh } = useStore();
  // The store's vehicle is the legacy shape, without `type`; the catalog picker
  // needs it to hide items that do not apply.
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    vehicleRepo
      .getById(vehicleId)
      .then((v) => {
        if (!cancelled) setVehicle(v);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  if (!vehicle) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.reminders.newTitle}
        </T>
        <ReminderForm
          vehicle={vehicle}
          onSaved={(saved) => {
            void refresh().then(() =>
              router.replace({ pathname: '/recordatorio/[id]', params: { id: saved.id } }),
            );
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 26, marginBottom: space.lg },
});
