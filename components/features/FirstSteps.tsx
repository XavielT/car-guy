import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

export type FirstStep = { id: 'vehicle' | 'fillup' | 'trips'; done: boolean; onPress: () => void };

const LABEL = () => ({ vehicle: t.hoy.firstStepVehicle, fillup: t.hoy.firstStepFillup, trips: t.hoy.firstStepTrips });

/**
 * "Primeros pasos" (SPEC-K §K6): three steps, not a tour. Done/not done comes from REAL data (a car exists, a fill-up exists, automatic
 * trips are on), never from a box the person ticked. Dismissible; the caller stops rendering it when all are done or it was hidden.
 */
export function FirstSteps({ steps, onDismiss }: { steps: FirstStep[]; onDismiss: () => void }) {
  const { theme } = useTheme();
  const labels = LABEL();
  const done = steps.filter((s) => s.done).length;
  return (
    <Surface style={{ marginBottom: space.sm }}>
      <View style={styles.head}>
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
          {t.hoy.firstSteps}
        </T>
        <T face="mono" style={{ color: theme.text.muted, fontSize: 13 }}>
          {t.hoy.firstStepsDone(done, steps.length)}
        </T>
      </View>
      {steps.map((s) => (
        <Pressable key={s.id} onPress={s.onPress} disabled={s.done} accessibilityRole="button" accessibilityState={{ checked: s.done, disabled: s.done }} accessibilityLabel={labels[s.id]} style={styles.row}>
          <Ionicons name={s.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={s.done ? theme.statusText.ok : theme.text.muted} />
          <T face="body" style={{ color: s.done ? theme.text.muted : theme.text.primary, fontSize: 15, flex: 1, textDecorationLine: s.done ? 'line-through' : 'none' }}>
            {labels[s.id]}
          </T>
        </Pressable>
      ))}
      <Pressable onPress={onDismiss} accessibilityRole="button" style={styles.dismiss}>
        <T face="semibold" style={{ color: theme.text.secondary, fontSize: 13 }}>
          {t.hoy.firstStepsDismiss}
        </T>
      </Pressable>
    </Surface>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: space.xs },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.md },
  dismiss: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
