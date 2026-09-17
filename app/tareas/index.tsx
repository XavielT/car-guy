import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { EmptyState, PrimaryButton, StatusPill, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { tasks as taskRepo } from '@/lib/db/repos';
import type { Task } from '@/lib/db/types';
import { money } from '@/lib/format';
import { es } from '@/lib/i18n/es';
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
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicleId, status, data]);

  if (!activeVehicle) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.tasks.title}
        </T>
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {es.tasks.subtitle}
        </T>

        <View style={styles.row}>
          {STATUSES.map((s) => {
            const on = status === s;
            return (
              <Pressable
                key={s}
                onPress={() => setStatus(s)}
                style={[
                  styles.chip,
                  { backgroundColor: on ? theme.accent : theme.bg.raised, borderColor: on ? theme.accent : theme.line },
                ]}>
                <T face="semibold" style={{ color: on ? theme.accentInk : theme.text.secondary, fontSize: 13 }}>
                  {es.tasks.statuses[s]}
                </T>
              </Pressable>
            );
          })}
        </View>

        {rows.length === 0 ? (
          <EmptyState icon="checkmark-done-outline" message={es.tasks.empty} />
        ) : (
          rows.map((task) => (
            <Pressable
              key={task.id}
              onPress={() => router.push({ pathname: '/tarea/[id]', params: { id: task.id } })}>
              <Surface style={{ marginBottom: space.sm }}>
                <View style={styles.taskHeader}>
                  <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
                    {task.title}
                  </T>
                  {task.priority === 'critica' ? <StatusPill status="vencido" label={es.tasks.priorities.critica} /> : null}
                </View>
                <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 4 }}>
                  {es.service.kinds[task.kind]}
                  {task.estimatedCostDop != null ? ` · ${money(task.estimatedCostDop)}` : ''}
                  {task.sourceInspectionResultId ? ` · ${es.tasks.fromInspection}` : ''}
                </T>
              </Surface>
            </Pressable>
          ))
        )}

        <View style={{ height: space.lg }} />
        <PrimaryButton label={es.tasks.new} onPress={() => router.push('/tarea/nueva')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 30 },
  sub: { fontSize: 13, marginTop: 2, marginBottom: space.lg, lineHeight: 19 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  chip: { borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: space.sm },
  taskHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
