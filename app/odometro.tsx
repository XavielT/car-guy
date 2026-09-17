import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { PrimaryButton } from '@/components/ui';
import { space } from '@/constants/theme';
import { currentOdometer as currentOdometerQuery, odometer as odometerRepo } from '@/lib/db/repos';
import { odometerWarning } from '@/lib/domain/odometer';
import { isoFromDateInput, todayIsoDate } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { parseDecimal } from '@/lib/math';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * A manual odometer reading. Its own route rather than a field buried in a form,
 * because "what does it read now" is the one number the app asks for most often
 * and every prediction depends on it being current.
 */
export default function OdometroScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh } = useStore();

  const [value, setValue] = useState('');
  const [date, setDate] = useState(todayIsoDate());
  const [current, setCurrent] = useState<number | null>(null);
  const [readings, setReadings] = useState<{ occurredAt: string; valueKm: number }[]>([]);

  useEffect(() => {
    if (!activeVehicle) return;
    void (async () => {
      setCurrent(await currentOdometerQuery(activeVehicle.id));
      setReadings(await odometerRepo.list(activeVehicle.id));
    })();
  }, [activeVehicle]);

  if (!activeVehicle) return null;

  const parsed = value.trim() ? parseDecimal(value) : null;
  const warning = parsed != null ? odometerWarning(parsed, isoFromDateInput(date), readings) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.odometerSheet.title}
        </T>
        <T face="body" style={[styles.hint, { color: theme.text.secondary }]}>
          {es.odometerSheet.hint}
        </T>

        <Field
          label={es.odometerSheet.value}
          placeholder={current != null ? String(Math.round(current)) : '51676'}
          keyboardType="number-pad"
          value={value}
          onChangeText={setValue}
          hint={current != null ? `Última lectura: ${Math.round(current).toLocaleString('es-DO')} km` : undefined}
        />
        <DateField label={es.odometerSheet.date} value={date} onChange={setDate} />

        {warning ? (
          <T face="body" style={[styles.warning, { color: theme.status.proximo }]}>
            {warning}
          </T>
        ) : null}

        <PrimaryButton
          label={es.odometerSheet.save}
          disabled={parsed == null}
          onPress={() => {
            if (parsed == null) return;
            void (async () => {
              await odometerRepo.upsert({
                vehicleId: activeVehicle.id,
                occurredAt: isoFromDateInput(date),
                valueKm: parsed,
                source: 'manual',
              });
              await refresh();
              router.back();
            })();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 28, marginBottom: space.sm },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: space.xl },
  warning: { fontSize: 13, lineHeight: 19, marginBottom: space.md },
});
