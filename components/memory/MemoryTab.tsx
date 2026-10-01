import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip, GhostButton, PrimaryButton, Sheet } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { BUY_FIELDS, deleteFact, loadMemory, saveBuyFields, saveFact, type MemoryData } from '@/lib/db/memoryQueries';
import type { VehicleFact, VehicleFactGroup } from '@/lib/db/types';
import { FACT_GROUPS, searchMemory, sectionTitle, type MemoryBuyFields, type MemoryRow } from '@/lib/domain/carMemory';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

type FactDraft = { id?: string; label: string; value: string; groupName: VehicleFactGroup };

/**
 * Ficha → "Lo que uso" (IMP 30092026 note 6, 03-screens.md Phase 5): the car's
 * memory in grouped cards — the specsheet's values and the owner's own facts —
 * a search box, "Copiar" per row, "Lo que compro" (the specsheet's "what I
 * buy" columns) and + Agregar dato.
 */
export function MemoryTab({ vehicleId, onChanged }: { vehicleId: string; onChanged?: () => void }) {
  const { theme } = useTheme();
  const [data, setData] = useState<MemoryData | null>(null);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [fact, setFact] = useState<FactDraft | null>(null);
  const [factError, setFactError] = useState<string | null>(null);
  const [buy, setBuy] = useState<Partial<Record<keyof MemoryBuyFields, string>> | null>(null);

  // Bumped after every write; the effect re-reads.
  const [version, setVersion] = useState(0);
  const load = useCallback(async () => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    loadMemory(vehicleId)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicleId, version]);

  const sections = useMemo(() => (data ? searchMemory(data.sections, query) : []), [data, query]);

  if (!data) return null;

  async function copy(row: MemoryRow) {
    try {
      await Clipboard.setStringAsync(row.value);
      setNotice(t.memory.copied(`${row.label} · ${row.value}`));
    } catch {
      setNotice(null);
    }
  }

  function openFact(f?: VehicleFact) {
    setFactError(null);
    setFact(f ? { id: f.id, label: f.label, value: f.value, groupName: f.groupName } : { label: '', value: '', groupName: 'otros' });
  }

  async function submitFact() {
    if (!fact) return;
    if (!fact.label.trim() || !fact.value.trim()) return setFactError(t.memory.needBoth);
    await saveFact({ ...fact, vehicleId });
    setFact(null);
    await load();
    onChanged?.();
  }

  async function removeFact() {
    if (!fact?.id) return;
    await deleteFact(fact.id);
    setFact(null);
    await load();
    onChanged?.();
  }

  function openBuy() {
    const sheet = data?.sheet as Partial<Record<keyof MemoryBuyFields, string | null>> | null;
    setBuy(Object.fromEntries(BUY_FIELDS.map((k) => [k, sheet?.[k] ?? ''])));
  }

  async function submitBuy() {
    if (!buy) return;
    await saveBuyFields(vehicleId, buy);
    setBuy(null);
    await load();
    onChanged?.();
  }

  const total = data.sections.reduce((n, s) => n + s.rows.length, 0);

  return (
    <View>
      <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginBottom: space.sm }}>
        {t.memory.intro}
      </T>
      <View style={[styles.search, { borderColor: theme.lineStrong, backgroundColor: theme.bg.surface }]}>
        <Ionicons name="search" size={16} color={theme.text.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.memory.search}
          placeholderTextColor={theme.text.muted}
          accessibilityLabel={t.memory.search}
          testID="memory-search"
          style={[styles.searchInput, { color: theme.text.primary }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t.common.cancel} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={theme.text.muted} />
          </Pressable>
        ) : null}
      </View>

      {notice ? (
        <T face="body" accessibilityLiveRegion="polite" style={[styles.notice, { color: theme.text.secondary, backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
          {notice}
        </T>
      ) : null}

      {!total ? (
        <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginBottom: space.md }}>
          {t.memory.empty}
        </T>
      ) : !sections.length ? (
        <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginBottom: space.md }}>
          {t.memory.noResults(query.trim())}
        </T>
      ) : null}

      {sections.map((s) => (
        <View key={s.id} style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
          <T face="eyebrow" accessibilityRole="header" style={{ color: theme.text.muted, fontSize: 11, paddingVertical: 6 }}>
            {s.title}
          </T>
          {s.rows.map((r) => {
            const f = r.factId ? data.facts.find((x) => x.id === r.factId) : undefined;
            return (
              <View key={r.key} style={[styles.row, { borderTopColor: theme.line }]}>
                <Pressable
                  onPress={f ? () => openFact(f) : r.source === 'ficha' && BUY_FIELDS.includes(r.key as keyof MemoryBuyFields) ? openBuy : undefined}
                  disabled={!f && !(r.source === 'ficha' && BUY_FIELDS.includes(r.key as keyof MemoryBuyFields))}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.label}: ${r.value}`}
                  style={styles.rowMain}>
                  <View style={{ flex: 1 }}>
                    <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
                      {r.label}
                    </T>
                    <T face="mono" selectable style={{ color: theme.text.primary, fontSize: 14 }}>
                      {r.value}
                    </T>
                  </View>
                  {r.source === 'ficha' ? (
                    <T face="eyebrow" style={{ color: theme.accent, fontSize: 9 }}>
                      {t.memory.fromFicha}
                    </T>
                  ) : null}
                </Pressable>
                <Pressable
                  onPress={() => void copy(r)}
                  accessibilityRole="button"
                  accessibilityLabel={t.memory.copyA11y(r.label, r.value)}
                  hitSlop={6}
                  style={[styles.copy, { borderColor: theme.lineStrong }]}>
                  <Ionicons name="copy-outline" size={14} color={theme.text.secondary} />
                  <T face="eyebrow" style={{ color: theme.text.secondary, fontSize: 10 }}>
                    {t.memory.copy}
                  </T>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}

      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <PrimaryButton label={t.memory.add} onPress={() => openFact()} />
        </View>
        <GhostButton label={t.memory.editBuy} onPress={openBuy} style={{ flex: 1 }} />
      </View>

      <Sheet visible={Boolean(fact)} onClose={() => setFact(null)} title={fact?.id ? t.memory.factEdit : t.memory.factNew}>
        {fact ? (
          <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
            <Field label={t.memory.label} placeholder={t.memory.labelPlaceholder} value={fact.label} onChangeText={(v) => setFact((x) => x && { ...x, label: v })} autoFocus testID="fact-label" />
            <Field label={t.memory.value} placeholder={t.memory.valuePlaceholder} value={fact.value} onChangeText={(v) => setFact((x) => x && { ...x, value: v })} testID="fact-value" />
            <T face="eyebrow" style={{ color: theme.text.secondary, fontSize: 12, marginBottom: 6 }}>
              {t.memory.group}
            </T>
            <View style={styles.chips}>
              {FACT_GROUPS.map((g) => (
                <Chip key={g} label={sectionTitle(g)} selected={fact.groupName === g} onPress={() => setFact((x) => x && { ...x, groupName: g })} />
              ))}
            </View>
            {factError ? (
              <T face="body" style={{ color: theme.dangerText, fontSize: 13, marginBottom: space.sm }}>
                {factError}
              </T>
            ) : null}
            <PrimaryButton label={t.memory.save} onPress={() => void submitFact()} />
            {fact.id ? <GhostButton danger label={t.memory.delete} onPress={() => void removeFact()} /> : null}
          </ScrollView>
        ) : null}
      </Sheet>

      <Sheet visible={Boolean(buy)} onClose={() => setBuy(null)} title={t.memory.buyTitle}>
        {buy ? (
          <ScrollView style={{ maxHeight: 560 }} keyboardShouldPersistTaps="handled">
            <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.sm }}>
              {t.memory.buyHint}
            </T>
            {BUY_FIELDS.map((k) => (
              <Field key={k} label={t.carMemory.fields[k]} value={buy[k] ?? ''} onChangeText={(v) => setBuy((x) => x && { ...x, [k]: v })} />
            ))}
            <PrimaryButton label={t.memory.save} onPress={() => void submitBuy()} />
          </ScrollView>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.input, paddingHorizontal: space.sm, minHeight: 44, marginBottom: space.md },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  notice: { borderWidth: 1, borderRadius: radius.input, padding: space.sm, fontSize: 13, marginBottom: space.md },
  card: { borderWidth: 1, borderRadius: radius.button, paddingHorizontal: space.md, paddingVertical: space.xs, marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8, minHeight: 48 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radius.input, paddingHorizontal: 8, minHeight: 32 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm, marginBottom: space.md },
  pair: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
});
