import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Sheet, StatusPill, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import {
  inspectionItems as itemRepo,
  inspectionResults as resultRepo,
  tasks as taskRepo,
} from '@/lib/db/repos';
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
  // A task from a failed check knows which result it came from, and through it
  // the catalog item — so the record it becomes can carry that item and reset
  // its reminder, and the task can link back to the check.
  const [origin, setOrigin] = useState<{ inspectionId: string; serviceTypeId: string | null } | null>(null);
  const [askRegister, setAskRegister] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const row = await taskRepo.getById(id);
      if (cancelled) return;
      setTask(row);
      const source = row?.sourceInspectionResultId;
      if (!source) return setOrigin(null);
      const result = await resultRepo.getById(source);
      // Tasks saved before results had stable ids point at the run itself.
      if (!result) return !cancelled && setOrigin({ inspectionId: source, serviceTypeId: null });
      // The item may have been switched off in the editor since; it still says
      // what was checked.
      const [item] = await itemRepo.listWhere({ id: result.itemId }, { includeDeleted: true });
      if (!cancelled) {
        setOrigin({ inspectionId: result.inspectionId, serviceTypeId: item?.relatedServiceTypeId ?? null });
      }
    })().catch(() => {});
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
          {origin ? (
            <Pressable
              onPress={() => router.push({ pathname: '/inspeccion/[id]', params: { id: origin.inspectionId } })}
              accessibilityRole="link">
              <T face="body" style={{ color: theme.accent, fontSize: 13, marginTop: space.sm }}>
                {es.tasks.fromInspection} ›
              </T>
            </Pressable>
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
                params: {
                  kind: task.kind,
                  taskId: task.id,
                  title: task.title,
                  ...(origin?.serviceTypeId ? { serviceTypeId: origin.serviceTypeId } : {}),
                },
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
  chip: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: space.sm },
});
