import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompleteReminderSheet } from '@/components/CompleteReminderSheet';
import { T } from '@/components/T';
import { EmptyState, GhostButton, PrimaryButton, StatusPill, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { reminders as reminderRepo } from '@/lib/db/repos';
import { evaluatedReminders, type EvaluatedReminder } from '@/lib/db/reminderQueries';
import type { Reminder } from '@/lib/db/types';
import { addDays, todayIso } from '@/lib/domain/dates';
import { STATUS_LABEL, type ReminderState } from '@/lib/domain/reminders';
import { dateLabel } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** The order the groups appear in — the engine's severity, then the switched-off. */
const GROUPS: (ReminderState | 'disabled')[] = ['vencido', 'urgente', 'proximo', 'sin_datos', 'ok', 'disabled'];

/**
 * Everything the car is waiting on, worst first.
 *
 * The line under each title is the whole point: not "due at 57,000 km", which
 * means nothing while you are looking at a calendar, but "faltan 320 km ·
 * ~12 oct (estimado)" — the app doing the arithmetic from how much this
 * particular vehicle actually gets driven.
 *
 * Disabled reminders get their own group at the bottom rather than vanishing:
 * the Revisión técnica starts switched off, and a reminder you turned off by
 * mistake has to be findable to turn back on.
 */
export default function RecordatoriosScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh, data } = useStore();
  const [rows, setRows] = useState<EvaluatedReminder[]>([]);
  const [completing, setCompleting] = useState<Reminder | null>(null);

  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    evaluatedReminders(vehicleId, todayIso(), { includeDisabled: true })
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicleId, data]);

  if (!activeVehicle) return null;

  const groupOf = (row: EvaluatedReminder) => (row.reminder.isEnabled ? row.status.status : 'disabled');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.reminders.title}
        </T>
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {es.reminders.subtitle}
        </T>

        <PrimaryButton label={es.reminders.add} onPress={() => router.push('/recordatorio/nuevo')} />

        {rows.length === 0 ? (
          <EmptyState icon="alarm-outline" message={es.reminders.empty} />
        ) : (
          GROUPS.map((group) => {
            const members = rows.filter((row) => groupOf(row) === group);
            if (members.length === 0) return null;
            return (
              <View key={group}>
                <T face="medium" style={[styles.group, { color: theme.text.muted }]}>
                  {`${es.reminders.groups[group]} · ${members.length}`.toUpperCase()}
                </T>
                {members.map(({ reminder, status }) => (
                  <Surface
                    key={reminder.id}
                    style={{ marginBottom: space.sm, opacity: reminder.isEnabled ? 1 : 0.6 }}>
                    <View style={styles.headerRow}>
                      <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
                        {reminder.title}
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

                    <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 6 }}>
                      {describe(status)}
                    </T>

                    {status.status !== 'sin_datos' && status.confidence === 'baja' && status.dueKm != null ? (
                      <T face="body" style={{ color: theme.text.muted, fontSize: 11, marginTop: 4 }}>
                        {es.reminders.lowConfidence}
                      </T>
                    ) : null}

                    <View style={styles.actions}>
                      {reminder.isEnabled ? (
                        <>
                          <GhostButton label={es.reminders.done} onPress={() => setCompleting(reminder)} />
                          <GhostButton
                            label={es.reminders.snooze}
                            onPress={() => {
                              void (async () => {
                                await reminderRepo.upsert({
                                  id: reminder.id,
                                  snoozedUntil: addDays(todayIso(), 7),
                                });
                                await refresh();
                              })();
                            }}
                          />
                        </>
                      ) : (
                        <GhostButton
                          label={es.reminders.enable}
                          onPress={() => {
                            void (async () => {
                              await reminderRepo.upsert({ id: reminder.id, isEnabled: true });
                              await refresh();
                            })();
                          }}
                        />
                      )}
                      <GhostButton
                        label={es.reminders.edit}
                        onPress={() =>
                          router.push({ pathname: '/recordatorio/[id]', params: { id: reminder.id } })
                        }
                      />
                    </View>
                  </Surface>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      <CompleteReminderSheet reminder={completing} onClose={() => setCompleting(null)} />
    </SafeAreaView>
  );
}

/**
 * "faltan 320 km · ~12 oct (estimado)" or "vence 31 ene" — the sentence the
 * whole screen exists for.
 *
 * The date side reads as an absolute date ("vence 31 ene 2027") rather than a
 * count of days: the marbete deadline is a date people know, and "faltan 128
 * días" makes them do the arithmetic backwards. Only the last two days and the
 * overdue case switch to relative words, where they are clearer.
 */
function describe(status: EvaluatedReminder['status']): string {
  if (status.status === 'sin_datos' && status.dueDays == null && status.dueKm == null) {
    return es.reminders.noData;
  }

  const parts: string[] = [];

  if (status.dueKm != null) {
    parts.push(
      status.dueKm < 0
        ? es.reminders.overdueKm(Math.abs(Math.round(status.dueKm)))
        : es.reminders.dueKm(Math.round(status.dueKm)),
    );
    // The predicted date is only worth showing when it comes before the
    // calendar limit — otherwise it just repeats a later date.
    if (
      status.predictedDueDate &&
      (status.dueDays == null ||
        status.predictedDueDate < addDays(todayIso(), status.dueDays))
    ) {
      parts.push(es.reminders.estimated(shortDate(status.predictedDueDate)));
    }
  }

  if (status.dueDays != null) {
    const due = addDays(todayIso(), status.dueDays);
    if (status.dueDays < 0) parts.push(es.reminders.overdueDays(Math.abs(status.dueDays)));
    else if (status.dueDays <= 1) parts.push(es.reminders.dueDays(status.dueDays));
    else parts.push(es.reminders.dueOn(shortDate(due)));
  }

  return parts.join(' · ');
}

/** "12 oct", with the year only when it is not this one. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date(todayIso()).getFullYear();
  return sameYear
    ? d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }).replace('.', '')
    : dateLabel(iso);
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 30 },
  sub: { fontSize: 13, marginTop: 2, marginBottom: space.lg, lineHeight: 19 },
  group: { fontSize: 11, letterSpacing: 0.9, marginTop: space.xl, marginBottom: space.sm },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, marginTop: space.sm },
});
