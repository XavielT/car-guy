import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { GhostButton, PrimaryButton, Sheet } from '@/components/ui';
import { space } from '@/constants/theme';
import { currentOdometer as currentOdometerQuery, reminders as reminderRepo } from '@/lib/db/repos';
import type { Reminder } from '@/lib/db/types';
import { todayIso } from '@/lib/domain/dates';
import { completeReminder, describeReset } from '@/lib/domain/reminders';
import { dateInputFromIso, isoFromDateInput } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { Alert } from '@/lib/alert';
import { parseDecimal } from '@/lib/math';
import { useStore } from '@/lib/store';

/**
 * "Hecho": when, at what odometer, and whether it deserves a record.
 *
 * "¿Registrar como mantenimiento?" does **not** complete the reminder here. It
 * hands the date, the odometer and the catalog item to the service form, and
 * saving that record is what resets the reminder — once. Completing it first
 * and then letting the record reset it again advanced a fixed interval twice.
 */
export function CompleteReminderSheet({
  reminder,
  onClose,
}: {
  reminder: Reminder | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const { refresh } = useStore();
  const [date, setDate] = useState(() => dateInputFromIso(todayIso()));
  const [km, setKm] = useState('');

  const reminderId = reminder?.id;
  const vehicleId = reminder?.vehicleId;

  useEffect(() => {
    if (!reminderId || !vehicleId) return;
    let cancelled = false;
    // Reset per reminder: the sheet stays mounted between rows.
    currentOdometerQuery(vehicleId)
      .then((current) => {
        if (cancelled) return;
        setDate(dateInputFromIso(todayIso()));
        setKm(current != null ? String(Math.round(current)) : '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reminderId, vehicleId]);

  const parsedKm = km.trim() ? parseDecimal(km) : null;

  function register() {
    if (!reminder?.serviceTypeId) return;
    onClose();
    router.push({
      pathname: '/servicio/nuevo',
      params: {
        kind: 'mantenimiento',
        serviceTypeId: reminder.serviceTypeId,
        date,
        ...(parsedKm != null ? { km: String(parsedKm) } : {}),
      },
    });
  }

  function justDone() {
    if (!reminder) return;
    const patch = completeReminder(reminder, { date: isoFromDateInput(date), km: parsedKm });
    void (async () => {
      await reminderRepo.upsert(patch);
      await refresh();
      onClose();
      Alert.alert(es.reminders.completedToast, describeReset(reminder, patch));
    })();
  }

  return (
    <Sheet visible={reminder != null} onClose={onClose} title={reminder?.title ?? es.reminders.completeTitle}>
      <DateField label={es.reminders.completeDate} value={date} onChange={setDate} />
      <Field label={es.reminders.completeKm} keyboardType="number-pad" value={km} onChangeText={setKm} />
      <View style={{ gap: space.xs }}>
        {reminder?.serviceTypeId ? (
          <PrimaryButton label={es.reminders.completeRegister} onPress={register} />
        ) : null}
        {reminder?.serviceTypeId ? (
          <GhostButton label={es.reminders.completeJust} onPress={justDone} />
        ) : (
          <PrimaryButton label={es.reminders.completeJust} onPress={justDone} />
        )}
      </View>
    </Sheet>
  );
}
