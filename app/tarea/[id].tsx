import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Sheet, StatusPill, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { tasks as taskRepo } from '@/lib/db/repos';
import type { Task } from '@/lib/db/types';
import { money } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { Alert } from '@/lib/alert';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

const STATUSES: Task['status'][] = ['pendiente', 'en_progreso', 'hecha'];

/**
 * A task is a note to self that the car needs something. Marking it done offers
 * to turn it into a real record, because a repair that happened and left no
 * trace in the history is exactly the gap this app exists to close.
 */
export default function TareaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh, data } = useStore();

  const [task, setTask] = useState<Task | null>(null);
  const [askRegister, setAskRegister] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    taskRepo
      .getById(id)
      .then((row) => {
        if (!cancelled) setTask(row);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, data]);

  if (!task) return null;

  async function setStatus(status: Task['status']) {
    await taskRepo.upsert({ id: task!.id, status });
    await refresh();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {task.title}
        </T>
        <View style={styles.meta}>
          <StatusPill
            status={task.priority === 'critica' ? 'vencido' : task.priority === 'baja' ? 'ok' : 'proximo'}
            label={es.tasks.priorities[task.priority]}
          />
        </View>

        <Surface style={{ marginBottom: space.md }}>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
            {es.service.kinds[task.kind]}
            {task.estimatedCostDop != null ? ` · ${money(task.estimatedCostDop)}` : ''}
          </T>
          {task.notes ? (
            <T face="body" style={{ color: theme.text.secondary, marginTop: space.sm, lineHeight: 20 }}>
              {task.notes}
            </T>
          ) : null}
        </Surface>

        <View style={styles.row}>
          {STATUSES.map((s) => {
            const on = task.status === s;
            return (
              <Pressable
                key={s}
                onPress={() => {
                  if (s === 'hecha' && task.status !== 'hecha') return setAskRegister(true);
                  void setStatus(s);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
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

        <View style={{ height: space.lg }} />
        <GhostButton
          danger
          label={es.common.delete}
          onPress={() =>
            Alert.alert(task.title, es.tasks.deleteConfirm, [
              { text: es.common.cancel, style: 'cancel' },
              {
                text: es.common.delete,
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    await taskRepo.softDelete(task.id);
                    await refresh();
                    router.back();
                  })();
                },
              },
            ])
          }
        />
      </ScrollView>

      <Sheet visible={askRegister} onClose={() => setAskRegister(false)} title={es.tasks.markDoneTitle}>
        <T face="body" style={{ color: theme.text.secondary, marginBottom: space.lg, lineHeight: 20 }}>
          {es.tasks.markDoneBody}
        </T>
        <PrimaryButton
          label={es.tasks.registerNow}
          onPress={() => {
            setAskRegister(false);
            void (async () => {
              await setStatus('hecha');
              router.push({
                pathname: '/servicio/nuevo',
                params: { kind: task.kind, taskId: task.id, title: task.title },
              });
            })();
          }}
        />
        <GhostButton
          label={es.tasks.justClose}
          onPress={() => {
            setAskRegister(false);
            void setStatus('hecha');
          }}
        />
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 26 },
  meta: { flexDirection: 'row', marginTop: space.sm, marginBottom: space.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: space.sm },
});
