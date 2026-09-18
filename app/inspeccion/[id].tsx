import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { GaugeRing, GhostButton, PrimaryButton, StatusPill, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import {
  inspectionResults as resultRepo,
  inspections as inspectionRepo,
  inspectionTemplates as templateRepo,
  tasks as taskRepo,
} from '@/lib/db/repos';
import type { Inspection, InspectionResult, Task } from '@/lib/db/types';
import { todayIso } from '@/lib/domain/dates';
import { weeklyStreak } from '@/lib/domain/inspections';
import { dateLabel, km as fmtKm } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * How it went — and, when everything is fine, a little celebration.
 *
 * The one exclamation mark the voice guide allows lives here: finishing a check
 * is the behaviour the whole app is trying to reinforce.
 */
export default function InspeccionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { data } = useStore();

  const [run, setRun] = useState<Inspection | null>(null);
  const [results, setResults] = useState<InspectionResult[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const row = await inspectionRepo.getById(id);
      if (!row || cancelled) return;
      const [rows, template, tasks, history] = await Promise.all([
        resultRepo.listWhere({ inspectionId: id }),
        templateRepo.getById(row.templateId),
        taskRepo.listWhere({ vehicleId: row.vehicleId, sourceInspectionResultId: id }),
        inspectionRepo.list(row.vehicleId, { orderBy: 'occurred_at', direction: 'DESC', limit: 40 }),
      ]);
      if (cancelled) return;
      setRun(row);
      setResults(rows);
      setTemplateName(template?.name ?? '');
      setOpenTasks(tasks);
      setStreak(
        template?.cadence === 'semanal'
          ? weeklyStreak(history.filter((h) => h.templateId === row.templateId), todayIso())
          : 0,
      );
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, data]);

  // Haptics are a native-only nicety; the web build must not reach for them.
  useEffect(() => {
    if (Platform.OS === 'web' || !run || run.status !== 'ok') return;
    void import('expo-haptics')
      .then((H) => H.notificationAsync(H.NotificationFeedbackType.Success))
      .catch(() => {});
  }, [run]);

  if (!run) return null;

  const failures = results.filter((r) => r.result === 'falla');
  const answered = results.filter((r) => r.result !== 'na').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.hero}>
          <GaugeRing
            progress={results.length ? answered / results.length : 1}
            size={132}
            value={failures.length ? String(failures.length) : '✓'}
            label={failures.length ? es.check.resultWithFails(failures.length) : ''}
            color={failures.length ? theme.status.vencido : theme.status.ok}
          />
        </View>

        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {failures.length === 0 ? es.check.resultAllGood : es.check.resultWithFails(failures.length)}
        </T>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: space.lg }}>
          {templateName} · {dateLabel(run.occurredAt)}
          {run.odometerKm != null ? ` · ${fmtKm(run.odometerKm)}` : ''}
          {run.durationSec ? ` · ${Math.max(1, Math.round(run.durationSec / 60))} min` : ''}
        </T>

        {failures.length === 0 && streak > 1 ? (
          <T face="title" style={{ color: theme.status.ok, fontSize: 18, marginBottom: space.lg }}>
            {es.check.streakWeeks(streak)} {es.check.streak}. {es.check.celebrate}
          </T>
        ) : null}

        {failures.map((failure) => (
          <Surface key={failure.id} style={{ marginBottom: space.sm }}>
            <View style={styles.row}>
              <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
                {failure.labelSnapshot}
              </T>
              <StatusPill status="vencido" label={es.check.fail} />
            </View>
            {failure.note ? (
              <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 6, lineHeight: 19 }}>
                {failure.note}
              </T>
            ) : null}
          </Surface>
        ))}

        {openTasks.length ? (
          <>
            <T face="title" style={[styles.section, { color: theme.text.primary }]}>
              {es.check.resultTasks}
            </T>
            {openTasks.map((task) => (
              <GhostButton
                key={task.id}
                label={task.title}
                onPress={() => router.push({ pathname: '/tarea/[id]', params: { id: task.id } })}
              />
            ))}
          </>
        ) : null}

        <View style={{ height: space.lg }} />
        <PrimaryButton label="Volver" onPress={() => router.replace('/(tabs)/chequeo')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  hero: { alignItems: 'center', marginBottom: space.lg },
  h: { fontSize: 28 },
  section: { fontSize: 18, marginTop: space.lg, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
