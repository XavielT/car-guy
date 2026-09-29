import { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Sheet } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { pinSnapshot } from '@/lib/db/albumQueries';
import { deleteSnapshot, saveStock, setOverride } from '@/lib/db/buildQueries';
import type { SpecSnapshot } from '@/lib/db/types';
import { formatSpec, SPEC_FIELDS, SPEC_GROUPS, specValues, type CurrentSpec, type SpecField, type Specs } from '@/lib/domain/build';
import { dateLabel } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The SPECS tab (03-screens.md Block B): every field of the ficha, grouped
 * Motor · Chasis · Ruedas · Dimensiones, as Stock | Actual with where the
 * actual came from (STOCK / the mod's name / TÚ). Tap a row to correct it
 * (an override); edit the stock sheet; freeze today's ficha as a snapshot;
 * share the table as an image.
 */
export function SpecsTab({
  vehicleId,
  vehicleName,
  current,
  stock,
  snapshots,
  onChanged,
}: {
  vehicleId: string;
  vehicleName: string;
  current: Record<string, CurrentSpec>;
  stock: Specs;
  snapshots: SpecSnapshot[];
  onChanged: () => void;
}) {
  const { theme } = useTheme();
  const shotRef = useRef<View>(null);
  const [editing, setEditing] = useState<SpecField | null>(null);
  const [value, setValue] = useState('');
  const [stockOpen, setStockOpen] = useState(false);
  const [stockDraft, setStockDraft] = useState<Record<string, string>>({});
  const [pinned, setPinned] = useState(false);

  function openOverride(f: SpecField) {
    setEditing(f);
    setValue(current[f.key]?.source?.kind === 'override' ? String(current[f.key]?.value ?? '') : '');
  }

  async function saveOverride(clear = false) {
    if (!editing) return;
    await setOverride(vehicleId, editing.key, clear ? null : value.trim() || null);
    setEditing(null);
    onChanged();
  }

  function openStock() {
    setStockDraft(Object.fromEntries(SPEC_FIELDS.map((f) => [f.key, stock[f.key] != null ? String(stock[f.key]) : ''])));
    setStockOpen(true);
  }

  async function saveStockDraft() {
    await saveStock(vehicleId, stockDraft);
    setStockOpen(false);
    onChanged();
  }

  async function pin() {
    const today = new Date().toISOString();
    await pinSnapshot({ vehicleId, label: es.specs.snapshotLabel(dateLabel(today)), asOf: today, specs: specValues(current), coverMediaId: null });
    setPinned(true);
    onChanged();
  }

  async function share() {
    if (!shotRef.current) return;
    const uri = await captureRef(shotRef, { format: 'png', quality: 1, result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile', fileName: `ficha-${vehicleName.toLowerCase().replace(/\s+/g, '-')}-` } as Parameters<typeof captureRef>[1]);
    if (!uri) return;
    if (Platform.OS === 'web') {
      // html2canvas hands back a data URI on web: download it.
      const a = document.createElement('a');
      a.href = uri;
      a.download = `ficha-${vehicleName.toLowerCase().replace(/\s+/g, '-')}.png`;
      a.click();
      return;
    }
    const Sharing = await import('expo-sharing');
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png' });
  }

  const hasAny = Object.keys(current).length > 0;

  return (
    <View>
      {/* collapsable={false}: Android must keep this View in the native tree to capture it. */}
      <View ref={shotRef} collapsable={false} style={{ backgroundColor: theme.bg.base }}>
        <T face="eyebrow" style={{ color: theme.accent, fontSize: 11, marginBottom: space.sm }}>
          {`${vehicleName.toUpperCase()} · FICHA`}
        </T>
        {!hasAny ? (
          <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginBottom: space.md }}>
            {es.specs.empty}
          </T>
        ) : null}
        {SPEC_GROUPS.map((g) => (
          <View key={g.key} style={[styles.group, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
            <View style={styles.headRow}>
              <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, flex: 1.2 }}>
                {g.label}
              </T>
              <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10, flex: 1, textAlign: 'right' }}>
                {es.specs.stock}
              </T>
              <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10, flex: 1.3, textAlign: 'right' }}>
                {es.specs.actual}
              </T>
            </View>
            {SPEC_FIELDS.filter((f) => f.group === g.key).map((f) => {
              const c = current[f.key];
              const src = c?.source;
              const changed = src && src.kind !== 'stock';
              const chip = !src ? null : src.kind === 'stock' ? es.specs.stock : src.kind === 'override' ? es.specs.you : src.modName;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => openOverride(f)}
                  accessibilityRole="button"
                  accessibilityLabel={`${f.label}: stock ${formatSpec(f.key, c?.stock ?? null)}, actual ${formatSpec(f.key, c?.value ?? null)}${chip ? `, ${chip}` : ''}`}
                  style={[styles.row, { borderTopColor: theme.line }]}>
                  <T face="body" style={{ color: theme.text.secondary, fontSize: 14, flex: 1.2 }}>
                    {f.label}
                  </T>
                  <T face="mono" numberOfLines={1} style={{ color: theme.text.muted, fontSize: 12, flex: 1, textAlign: 'right' }}>
                    {formatSpec(f.key, c?.stock ?? null)}
                  </T>
                  <View style={{ flex: 1.3, alignItems: 'flex-end' }}>
                    <T face="mono" numberOfLines={1} style={{ color: changed ? theme.accent : theme.text.primary, fontSize: 13 }}>
                      {formatSpec(f.key, c?.value ?? null)}
                    </T>
                    {chip && changed ? (
                      <T face="eyebrow" numberOfLines={1} style={{ color: src?.kind === 'override' ? theme.statusText.urgente : theme.text.muted, fontSize: 9 }}>
                        {chip}
                      </T>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <GhostButton label={es.specs.editStock} onPress={openStock} />
      <PrimaryButton label={pinned ? es.specs.pinned : es.specs.pin} disabled={pinned || !hasAny} onPress={() => void pin()} />
      <GhostButton label={es.specs.share} disabled={!hasAny} onPress={() => void share()} />

      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.lg, marginBottom: space.sm }}>
        {es.specs.snapshots}
      </T>
      {snapshots.length ? (
        snapshots.map((s) => (
          <View key={s.id} style={[styles.snap, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
            <View style={{ flex: 1 }}>
              <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
                {s.label}
              </T>
              <T face="mono" numberOfLines={2} style={{ color: theme.text.muted, fontSize: 11 }}>
                {Object.entries(JSON.parse(s.specs || '{}') as Specs)
                  .slice(0, 4)
                  .map(([k, v]) => formatSpec(k, v))
                  .join(' · ')}
              </T>
            </View>
            <GhostButton label={es.specs.deleteSnapshot} danger onPress={() => void deleteSnapshot(s.id).then(onChanged)} />
          </View>
        ))
      ) : (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
          {es.specs.noSnapshots}
        </T>
      )}

      <Sheet visible={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? es.specs.overrideTitle(editing.label) : ''}>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: space.md }}>
          {es.specs.overrideHint}
        </T>
        <Field
          label={es.specs.override}
          value={value}
          onChangeText={setValue}
          keyboardType={editing?.kind === 'number' ? 'decimal-pad' : 'default'}
          placeholder={editing ? formatSpec(editing.key, current[editing.key]?.value ?? null) : ''}
        />
        <PrimaryButton label={es.specs.save} onPress={() => void saveOverride()} />
        {editing && current[editing.key]?.source?.kind === 'override' ? <GhostButton label={es.specs.clearOverride} onPress={() => void saveOverride(true)} /> : null}
      </Sheet>

      <Sheet visible={stockOpen} onClose={() => setStockOpen(false)} title={es.specs.stockTitle}>
        <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: space.md }}>
            {es.specs.stockHint}
          </T>
          {SPEC_FIELDS.map((f) => (
            <Field
              key={f.key}
              label={f.unit ? `${f.label} (${f.unit})` : f.label}
              value={stockDraft[f.key] ?? ''}
              onChangeText={(t) => setStockDraft((d) => ({ ...d, [f.key]: t }))}
              keyboardType={f.kind === 'number' ? 'decimal-pad' : 'default'}
            />
          ))}
        </ScrollView>
        <PrimaryButton label={es.specs.save} onPress={() => void saveStockDraft()} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderWidth: 1, borderRadius: radius.button, paddingHorizontal: space.md, paddingVertical: space.sm, marginBottom: space.md },
  headRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 44 },
  snap: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.input, padding: space.sm, marginBottom: space.sm },
});
