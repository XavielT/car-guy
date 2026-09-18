import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { tasks as taskRepo } from '@/lib/db/repos';
import type { ServiceKind, Task } from '@/lib/db/types';
import { es } from '@/lib/i18n/es';
import { parseDecimal } from '@/lib/math';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

const KINDS: ServiceKind[] = ['mantenimiento', 'reparacion', 'mejora'];
const PRIORITIES: Task['priority'][] = ['critica', 'normal', 'baja'];

export default function NuevaTareaScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh } = useStore();

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ServiceKind>('reparacion');
  const [priority, setPriority] = useState<Task['priority']>('normal');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!activeVehicle) return null;

  function save() {
    if (!title.trim()) return setError(es.tasks.nameRequired);
    setError(null);
    void (async () => {
      await taskRepo.upsert({
        vehicleId: activeVehicle!.id,
        title: title.trim(),
        kind,
        priority,
        status: 'pendiente',
        estimatedCostDop: cost.trim() ? parseDecimal(cost) : null,
        notes: notes.trim(),
      });
      await refresh();
      router.back();
    })();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.tasks.new}
        </T>

        <Field
          label={es.tasks.name}
          placeholder={es.tasks.namePlaceholder}
          value={title}
          onChangeText={setTitle}
        />

        <Chips label={es.tasks.kind} options={KINDS.map((k) => [k, es.service.kinds[k]])} value={kind} onChange={(v) => setKind(v as ServiceKind)} />
        <Chips
          label={es.tasks.priority}
          options={PRIORITIES.map((p) => [p, es.tasks.priorities[p]])}
          value={priority}
          onChange={(v) => setPriority(v as Task['priority'])}
        />

        <Field label={es.tasks.estimatedCost} keyboardType="decimal-pad" value={cost} onChangeText={setCost} />
        <Field label={es.tasks.notes} value={notes} onChangeText={setNotes} multiline />

        {error ? (
          <T face="body" style={{ color: theme.danger, fontSize: 13, marginBottom: space.md }}>
            {error}
          </T>
        ) : null}
        <PrimaryButton label={es.tasks.save} onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Chips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [string, string][];
  value: string;
  onChange: (next: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: space.md }}>
      <T face="semibold" style={{ color: theme.text.primary, fontSize: 13, marginBottom: 6 }}>
        {label}
      </T>
      <View style={styles.row}>
        {options.map(([key, text]) => {
          const on = value === key;
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[
                styles.chip,
                { backgroundColor: on ? theme.accent : theme.bg.raised, borderColor: on ? theme.accent : theme.line },
              ]}>
              <T face="semibold" style={{ color: on ? theme.accentInk : theme.text.secondary, fontSize: 13 }}>
                {text}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 28, marginBottom: space.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: space.sm },
});
