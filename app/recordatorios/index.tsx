import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { EmptyState, GhostButton, StatusPill, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { reminders as reminderRepo } from '@/lib/db/repos';
import { evaluatedReminders, type EvaluatedReminder } from '@/lib/db/reminderQueries';
import { addDays, todayIso } from '@/lib/domain/dates';
import { displayDueDate, STATUS_LABEL } from '@/lib/domain/reminders';
import { dateLabel } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Everything the car is waiting on, worst first.
 *
 * The line under each title is the whole point: not "due at 57,000 km", which
 * means nothing while you are looking at a calendar, but "faltan 320 km ·
 * ~12 oct (estimado)" — the app doing the arithmetic from how much this
 * particular vehicle actually gets driven.
 */
export default function RecordatoriosScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh, data } = useStore();
  const [rows, setRows] = useState<EvaluatedReminder[]>([]);

  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    evaluatedReminders(vehicleId)
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicleId, data]);

  if (!activeVehicle) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.reminders.title}
        </T>
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {es.reminders.subtitle}
        </T>

        {rows.length === 0 ? (
          <EmptyState icon="alarm-outline" message={es.reminders.empty} />
        ) : (
          rows.map(({ reminder, status }) => (
            <Surface key={reminder.id} style={{ marginBottom: space.sm }}>
              <View style={styles.headerRow}>
                <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
                  {reminder.title}
                </T>
                <StatusPill
                  status={status.status === 'sin_datos' ? 'proximo' : status.status}
                  label={status.snoozed ? es.reminders.snoozed : STATUS_LABEL[status.status]}
                />
              </View>

              <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 6 }}>
                {describe(reminder, status)}
              </T>

              {status.status !== 'sin_datos' && status.confidence === 'baja' && status.dueKm != null ? (
                <T face="body" style={{ color: theme.text.muted, fontSize: 11, marginTop: 4 }}>
                  {es.reminders.lowConfidence}
                </T>
              ) : null}

              <View style={styles.actions}>
                <GhostButton
                  label={es.reminders.done}
                  onPress={() =>
                    router.push({ pathname: '/recordatorio/[id]', params: { id: reminder.id, complete: '1' } })
                  }
                />
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
              </View>
            </Surface>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** "faltan 320 km · ~12 oct (estimado)" — the sentence the whole screen exists for. */
function describe(
  reminder: EvaluatedReminder['reminder'],
  status: EvaluatedReminder['status'],
): string {
  if (status.status === 'sin_datos') return es.reminders.noData;

  const parts: string[] = [];

  if (status.dueKm != null) {
    parts.push(
      status.dueKm < 0
        ? es.reminders.overdueKm(Math.abs(Math.round(status.dueKm)))
        : es.reminders.dueKm(Math.round(status.dueKm)),
    );
  }

  if (status.dueDays != null) {
    parts.push(
      status.dueDays < 0
        ? es.reminders.overdueDays(Math.abs(status.dueDays))
        : es.reminders.dueDays(status.dueDays),
    );
  }

  // A predicted date only earns its place when the km side is what is driving
  // the number — otherwise it just repeats the due date.
  const shown = displayDueDate(reminder, status);
  if (shown && status.dueKm != null && status.dueKm >= 0 && shown === status.predictedDueDate) {
    parts.push(es.reminders.estimated(dateLabel(shown)));
  } else if (shown && status.dueDays != null) {
    parts.push(dateLabel(shown));
  }

  return parts.join(' · ');
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 30 },
  sub: { fontSize: 13, marginTop: 2, marginBottom: space.lg, lineHeight: 19 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.lg, marginTop: space.sm },
});
