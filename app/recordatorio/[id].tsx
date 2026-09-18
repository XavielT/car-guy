import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton, StatusPill, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { currentOdometer as currentOdometerQuery, reminders as reminderRepo } from '@/lib/db/repos';
import type { Reminder } from '@/lib/db/types';
import { completeReminder, describeReset } from '@/lib/domain/reminders';
import { isoFromDateInput, todayIsoDate } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { Alert } from '@/lib/alert';
import { parseDecimal } from '@/lib/math';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * One reminder: mark it done, or turn it into a real maintenance record.
 *
 * Completing here writes the same patch `saveServiceRecord` would, so a
 * reminder ticked by hand and one satisfied by logging the work end up in
 * exactly the same state.
 */
export default function RecordatorioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh, data } = useStore();

  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [date, setDate] = useState(todayIsoDate());
  const [km, setKm] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const row = await reminderRepo.getById(id);
      if (cancelled || !row) return;
      setReminder(row);
      const current = await currentOdometerQuery(row.vehicleId);
      if (!cancelled && current != null) setKm(String(Math.round(current)));
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, data]);

  if (!reminder) return null;

  function markDone(thenRegister: boolean) {
    const patch = completeReminder(reminder!, {
      date: isoFromDateInput(date),
      km: km.trim() ? parseDecimal(km) : null,
    });
    void (async () => {
      await reminderRepo.upsert(patch);
      await refresh();
      if (thenRegister && reminder!.serviceTypeId) {
        router.replace({
          pathname: '/servicio/nuevo',
          params: { kind: 'mantenimiento', title: reminder!.title },
        });
        return;
      }
      Alert.alert(es.reminders.completedToast, describeReset(reminder!, patch));
      router.back();
    })();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {reminder.title}
        </T>
        {reminder.notes ? (
          <T face="body" style={{ color: theme.text.secondary, marginBottom: space.lg, lineHeight: 20 }}>
            {reminder.notes}
          </T>
        ) : null}

        <Surface style={{ marginBottom: space.lg }}>
          <T face="medium" style={{ color: theme.text.muted, fontSize: 11, letterSpacing: 0.9, marginBottom: space.sm }}>
            {es.reminders.completeTitle.toUpperCase()}
          </T>
          <DateField label={es.reminders.completeDate} value={date} onChange={setDate} />
          <Field label={es.reminders.completeKm} keyboardType="number-pad" value={km} onChangeText={setKm} />
        </Surface>

        {reminder.serviceTypeId ? (
          <PrimaryButton label={es.reminders.completeRegister} onPress={() => markDone(true)} />
        ) : null}
        <GhostButton label={es.reminders.completeJust} onPress={() => markDone(false)} />

        <View style={styles.meta}>
          <StatusPill status={reminder.isEnabled ? 'ok' : 'proximo'} label={reminder.isEnabled ? 'Activo' : 'Desactivado'} />
        </View>
        <GhostButton
          label={reminder.isEnabled ? 'Desactivar' : 'Activar'}
          onPress={() => {
            void (async () => {
              await reminderRepo.upsert({ id: reminder.id, isEnabled: !reminder.isEnabled });
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
  h: { fontSize: 26, marginBottom: space.sm },
  meta: { flexDirection: 'row', marginTop: space.xl, marginBottom: space.sm },
});
