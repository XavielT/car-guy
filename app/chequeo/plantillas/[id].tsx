import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip, GhostButton, PrimaryButton, Segmented, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { ensureVehicleTemplate, saveTemplate, type TemplateDraftItem } from '@/lib/db/inspectionOps';
import { inspectionItems as itemRepo, inspectionTemplates as templateRepo } from '@/lib/db/repos';
import type { Cadence, OnFail } from '@/lib/db/types';
import { Alert } from '@/lib/alert';
import { userMessage } from '@/lib/diagnostics';
import { t } from '@/lib/i18n';
import { catalogLabel } from '@/lib/i18n/catalog';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

type Row = TemplateDraftItem & { key: string; warning: string };

const CADENCES: Cadence[] = ['diaria', 'semanal', 'mensual', 'antes_de_viaje'];
const ON_FAIL: OnFail[] = ['task', 'reminder', 'none'];

/**
 * The checklist editor: reorder, switch items off, add your own, change how
 * often it comes up.
 *
 * Opening it on a seeded template gives the active vehicle its own copy first
 * (`ensureVehicleTemplate`), so the edit never reaches another vehicle and the
 * catalog re-seed at launch never overwrites it. Switching an item off
 * tombstones it; the editor reads tombstones back so it can be switched on
 * again — no schema change needed for an "enabled" flag.
 */
export default function TemplateEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh } = useStore();

  const [templateId, setTemplateId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [cadence, setCadence] = useState<Cadence>('semanal');
  const [isEnabled, setIsEnabled] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    if (!id || !vehicleId) return;
    let cancelled = false;
    (async () => {
      const template = await templateRepo.getById(id);
      // A vehicle's own copy lists its switched-off items so they can come
      // back; a seeded template's tombstones are items the catalog dropped.
      const items = template
        ? await itemRepo.listWhere(
            { templateId: id },
            { orderBy: 'sort_order', direction: 'ASC', includeDeleted: template.vehicleId === vehicleId },
          )
        : [];
      if (cancelled || !template) return;
      setTemplateId(template.id);
      setName(template.name);
      setCadence(template.cadence);
      setIsEnabled(template.isEnabled);
      // Active items first in their order, then the ones switched off before.
      const sorted = [...items].sort(
        (a, b) => Number(a.deletedAt != null) - Number(b.deletedAt != null) || a.sortOrder - b.sortOrder,
      );
      setRows(
        sorted.map((item) => ({
          key: item.id,
          id: item.id,
          groupName: item.groupName,
          label: item.label,
          how: item.how,
          warning: item.warning,
          onFail: item.onFail,
          enabled: item.deletedAt == null,
        })),
      );
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, vehicleId]);

  if (!templateId) return null;

  const patchRow = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const move = (index: number, delta: -1 | 1) =>
    setRows((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      {
        key: `new_${prev.length}_${Date.now()}`,
        groupName: prev[prev.length - 1]?.groupName ?? '',
        label: '',
        how: '',
        warning: '',
        onFail: 'task',
        enabled: true,
      },
    ]);

  function save() {
    const active = rows.filter((r) => r.enabled);
    if (active.length === 0) return setError(t.check.editor.empty);
    if (active.some((r) => !r.label.trim())) return setError(t.check.editor.labelRequired);
    setError(null);
    setSaving(true);
    void (async () => {
      try {
        // Only now does a seeded template become this vehicle's copy — backing
        // out of the editor leaves the vehicle on the defaults.
        const target = await ensureVehicleTemplate(templateId!, activeVehicle!.id);
        const remapped =
          target === templateId
            ? rows
            : rows.map((r) => (r.id ? { ...r, id: `${r.id}@${activeVehicle!.id}` } : r));
        await saveTemplate(target, { name: name.trim() || t.check.title, cadence, isEnabled }, remapped);
        await refresh();
        router.back();
      } catch (e) {
        setSaving(false);
        Alert.alert(t.check.editor.title, userMessage('template-save', e, t.check.editor.saveFailed));
      }
    })();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: space.lg, lineHeight: 19 }}>
          {t.check.editor.copyNote}
        </T>

        <Field label={t.check.editor.name} value={name} onChangeText={setName} />

        <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
          {t.check.editor.cadence}
        </T>
        <View style={styles.chips}>
          {CADENCES.map((c) => (
            <Chip key={c} label={t.check.cadences[c]} selected={cadence === c} onPress={() => setCadence(c)} />
          ))}
        </View>

        <View style={styles.switchRow}>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 14, flex: 1 }}>
            {t.check.editor.enabled}
          </T>
          <Switch
            value={isEnabled}
            onValueChange={setIsEnabled}
            accessibilityLabel={t.check.editor.enabled}
            trackColor={{ true: theme.accentFill, false: theme.lineStrong }}
          />
        </View>

        <T face="eyebrow" accessibilityRole="header" style={[styles.section, { color: theme.text.muted }]}>
          {t.check.editor.items}
        </T>

        {rows.map((row, index) => (
          <Surface key={row.key} style={{ marginBottom: space.sm, opacity: row.enabled ? 1 : 0.55 }}>
            <View style={styles.itemHeader}>
              <Switch
                value={row.enabled}
                onValueChange={(v) => patchRow(row.key, { enabled: v })}
                accessibilityLabel={row.label || t.check.editor.newTitle}
                trackColor={{ true: theme.accentFill, false: theme.lineStrong }}
              />
              <View style={{ flex: 1 }}>
                <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
                  {catalogLabel('checkItem', row, 'label') || t.check.editor.newTitle}
                </T>
                <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
                  {row.enabled ? catalogLabel('checkItem', row, 'groupName') : t.check.editor.removed}
                </T>
              </View>
              <Pressable
                onPress={() => move(index, -1)}
                disabled={index === 0}
                accessibilityRole="button"
                accessibilityLabel={`${t.check.editor.up}: ${row.label}`}
                hitSlop={6}
                style={[styles.arrow, { borderColor: theme.line, opacity: index === 0 ? 0.3 : 1 }]}>
                <T face="semibold" style={{ color: theme.text.secondary }}>↑</T>
              </Pressable>
              <Pressable
                onPress={() => move(index, 1)}
                disabled={index === rows.length - 1}
                accessibilityRole="button"
                accessibilityLabel={`${t.check.editor.down}: ${row.label}`}
                hitSlop={6}
                style={[styles.arrow, { borderColor: theme.line, opacity: index === rows.length - 1 ? 0.3 : 1 }]}>
                <T face="semibold" style={{ color: theme.text.secondary }}>↓</T>
              </Pressable>
            </View>

            {/* Seeded items keep their wording; only what you added is editable in full. */}
            {row.enabled && !row.id ? (
              <View style={{ marginTop: space.md }}>
                <Field
                  label={t.check.editor.label}
                  value={row.label}
                  onChangeText={(v) => patchRow(row.key, { label: v })}
                />
                <Field
                  label={t.check.editor.how}
                  value={row.how}
                  multiline
                  onChangeText={(v) => patchRow(row.key, { how: v })}
                />
                <Field
                  label={t.check.editor.group}
                  value={row.groupName}
                  onChangeText={(v) => patchRow(row.key, { groupName: v })}
                />
              </View>
            ) : null}

            {row.enabled ? (
              <View style={{ marginTop: space.md }}>
                <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: 6 }}>
                  {t.check.editor.onFail}
                </T>
                <Segmented
                  options={ON_FAIL.map((k) => ({ key: k, label: t.check.onFailShort[k] }))}
                  value={row.onFail}
                  onChange={(v) => patchRow(row.key, { onFail: v })}
                />
              </View>
            ) : null}
          </Surface>
        ))}

        <GhostButton label={t.check.editor.add} onPress={addRow} />

        {error ? (
          <T face="body" style={{ color: theme.dangerText, fontSize: 13, marginTop: space.md }}>
            {error}
          </T>
        ) : null}

        <View style={{ height: space.lg }} />
        <PrimaryButton label={t.check.editor.save} onPress={save} disabled={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  label: { fontSize: 12, marginBottom: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  section: { fontSize: 12, marginTop: space.xl, marginBottom: space.sm },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  arrow: { borderWidth: 1, borderRadius: 8, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
