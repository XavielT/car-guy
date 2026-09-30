import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListCardsSkeleton } from '@/components/skeletons/ListCardsSkeleton';
import { T } from '@/components/T';
import { EmptyState, PrimaryButton, Segmented, StatusPill, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { tasks as taskRepo } from '@/lib/db/repos';
import type { Task } from '@/lib/db/types';
import { money } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

type Status = Task['status'];

const STATUSES: Status[] = ['pendiente', 'en_progreso', 'hecha'];

/** Critical first — the whole point of a priority is that it changes the order. */
const PRIORITY_ORDER: Record<Task['priority'], number> = { critica: 0, normal: 1, baja: 2 };

export default function TareasScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, data } = useStore();

  const [status, setStatus] = useState<Status>('pendiente');
  const [rows, setRows] = useState<Task[]>([]);
  // The empty state waits for the first read instead of flashing (ADR-40).
  const [loaded, setLoaded] = useState(false);

  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    (async () => {
      const all = await taskRepo.list(vehicleId, { orderBy: 'created_at', direction: 'DESC' });
      if (cancelled) return;
      setRows(
        all
          .filter((t) => t.status === status)
          .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]),
      );
    })()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, status, data]);

  const showSkeleton = useDelayedLoading(!loaded);

  if (!activeVehicle) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {t.tasks.title}
        </T>
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {t.tasks.subtitle}
        </T>

        <Segmented
          style={styles.row}
          options={STATUSES.map((s) => ({ key: s, label: t.tasks.statuses[s] }))}
          value={status}
          onChange={setStatus}
        />

        {showSkeleton ? (
          <ListCardsSkeleton n={4} />
        ) : !loaded ? null : rows.length === 0 ? (
          <EmptyState icon="checkmark-done-outline" message={t.tasks.empty} />
        ) : (
          rows.map((task) => (
            <Pressable
              key={task.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/tarea/[id]', params: { id: task.id } })}>
              <Surface style={{ marginBottom: space.sm }}>
                <View style={styles.taskHeader}>
                  <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
                    {task.title}
                  </T>
                  {task.priority === 'critica' ? <StatusPill status="vencido" label={t.tasks.priorities.critica} /> : null}
                </View>
                <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginTop: 4 }}>
                  {t.service.kinds[task.kind]}
                  {task.estimatedCostDop != null ? (
                    <T face="mono" style={{ fontSize: 12 }}>
                      {` · ${money(task.estimatedCostDop)}`}
                    </T>
                  ) : null}
                  {task.sourceInspectionResultId ? ` · ${t.tasks.fromInspection}` : ''}
                </T>
              </Surface>
            </Pressable>
          ))
        )}

        <View style={{ height: space.lg }} />
        <PrimaryButton label={t.tasks.new} onPress={() => router.push('/tarea/nueva')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 30, lineHeight: 32, textTransform: 'uppercase', letterSpacing: 0.3 },
  sub: { fontSize: 13, marginTop: 2, marginBottom: space.lg, lineHeight: 19 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  chip: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: space.sm },
  taskHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
