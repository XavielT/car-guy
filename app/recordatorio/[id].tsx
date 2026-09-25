import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompleteReminderSheet } from '@/components/CompleteReminderSheet';
import { ReminderForm } from '@/components/ReminderForm';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton, SectionHeader, StatusPill, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { evaluatedReminders, type EvaluatedReminder } from '@/lib/db/reminderQueries';
import { reminders as reminderRepo, vehicles as vehicleRepo } from '@/lib/db/repos';
import type { Vehicle } from '@/lib/db/types';
import { addDays, todayIso } from '@/lib/domain/dates';
import { PGR_MULTAS_URL } from '@/lib/domain/legal-dr';
import { STATUS_LABEL } from '@/lib/domain/reminders';
import { dateLabel, km as fmtKm } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { Alert } from '@/lib/alert';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * One reminder: where it stands, the three things you do to it (Hecho,
 * Posponer, Activar/Desactivar), and the form to change it.
 *
 * `?complete=1` opens straight on the "Hecho" sheet — the path a notification
 * or an older link takes.
 */
export default function RecordatorioScreen() {
  const { id, complete } = useLocalSearchParams<{ id: string; complete?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh, data } = useStore();

  const [row, setRow] = useState<EvaluatedReminder | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [completing, setCompleting] = useState(complete === '1');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const reminder = await reminderRepo.getById(id);
      if (!reminder || cancelled) return;
      const [rows, v] = await Promise.all([
        evaluatedReminders(reminder.vehicleId, todayIso(), { includeDisabled: true }),
        vehicleRepo.getById(reminder.vehicleId),
      ]);
      if (cancelled) return;
      setRow(rows.find((r) => r.reminder.id === id) ?? null);
      setVehicle(v);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, data]);

  if (!row || !vehicle) return null;
  const { reminder, status } = row;

  const setEnabled = (isEnabled: boolean) =>
    void (async () => {
      await reminderRepo.upsert({ id: reminder.id, isEnabled });
      await refresh();
    })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {reminder.title}
        </T>

        <Surface style={{ marginBottom: space.lg }}>
          <View style={styles.statusRow}>
            <T face="medium" style={{ color: theme.text.muted, fontSize: 11, letterSpacing: 0.9, flex: 1 }}>
              {es.reminders.status.toUpperCase()}
            </T>
            {reminder.isEnabled ? (
              <StatusPill
                status={status.status === 'sin_datos' ? 'neutral' : status.status}
                label={status.snoozed ? es.reminders.snoozed : STATUS_LABEL[status.status]}
              />
            ) : (
              <StatusPill status="neutral" label={es.reminders.disabledLabel} />
            )}
          </View>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginTop: space.sm, lineHeight: 20 }}>
            {[
              reminder.dueDate ? es.reminders.dueOn(dateLabel(reminder.dueDate)) : null,
              reminder.dueKm != null ? fmtKm(reminder.dueKm) : null,
              status.predictedDueDate ? es.reminders.estimated(dateLabel(status.predictedDueDate)) : null,
            ]
              .filter(Boolean)
              .join(' · ') || es.reminders.noData}
          </T>
          {reminder.notes ? (
            <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginTop: space.sm, lineHeight: 19 }}>
              {reminder.notes}
            </T>
          ) : null}
        </Surface>

        {reminder.legalKind === 'licencia' ? (
          <Surface style={{ marginBottom: space.lg }}>
            <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 19 }}>
              {es.reminders.multasNote}
            </T>
            <Pressable
              onPress={() => void Linking.openURL(PGR_MULTAS_URL)}
              accessibilityRole="link"
              style={{ paddingTop: space.sm }}>
              <T face="semibold" style={{ color: theme.accent, fontSize: 14 }}>
                {es.reminders.multasLink}
              </T>
            </Pressable>
          </Surface>
        ) : null}

        {reminder.isEnabled ? (
          <>
            <PrimaryButton label={es.reminders.done} onPress={() => setCompleting(true)} />
            <GhostButton
              label={es.reminders.snooze}
              onPress={() =>
                void (async () => {
                  await reminderRepo.upsert({ id: reminder.id, snoozedUntil: addDays(todayIso(), 7) });
                  await refresh();
                })()
              }
            />
            <GhostButton label={es.reminders.disable} onPress={() => setEnabled(false)} />
          </>
        ) : (
          <PrimaryButton label={es.reminders.enable} onPress={() => setEnabled(true)} />
        )}

        <SectionHeader title={es.reminders.editTitle} style={{ marginTop: space.xl }} />
        <ReminderForm
          // Remounts on save so the fields show what was actually stored.
          key={reminder.updatedAt}
          vehicle={vehicle}
          reminder={reminder}
          onSaved={() => {
            void refresh().then(() => Alert.alert(es.reminders.form.saved));
          }}
        />

        <View style={{ height: space.lg }} />
        <GhostButton
          danger
          label={es.reminders.remove}
          onPress={() =>
            Alert.alert(es.reminders.remove, es.reminders.removeConfirm, [
              { text: es.common.cancel, style: 'cancel' },
              {
                text: es.reminders.remove,
                style: 'destructive',
                onPress: () =>
                  void (async () => {
                    await reminderRepo.softDelete(reminder.id);
                    await refresh();
                    router.back();
                  })(),
              },
            ])
          }
        />
      </ScrollView>

      <CompleteReminderSheet reminder={completing ? reminder : null} onClose={() => setCompleting(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 26, marginBottom: space.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
