import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { MultiSelectField, PickerField, SearchSheet, SelectField, selectOptions } from '@/components/pickers';
import { T } from '@/components/T';
import { Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import {
  joinSpecs,
  oilBrands,
  oilGrades,
  oilSummary,
  OIL_TYPES,
  sameOil,
  specsFor,
  splitSpecs,
  type OilFields,
} from '@/lib/domain/oil';
import type { OilType } from '@/lib/db/types';
import type { MemorySuggestion } from '@/lib/domain/carMemory';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The Aceite block under an oil item of the service form (IMP 29092026 note
 * 16): Viscosidad chips, Tipo chips, Marca (search sheet + "Otro…"),
 * Especificación (several chips, stored as one "API SP · ILSAC GF-6A" text).
 *
 * `last` is the previous oil of this vehicle for the same item. It is offered
 * as one tappable row, never filled in silently: the oil can change between
 * visits and a wrong prefill is worse than an empty field.
 */
export function OilBlock({
  title,
  value,
  onChange,
  last,
  memory,
  fuel,
}: {
  title: string;
  value: OilFields;
  onChange: (next: OilFields) => void;
  last?: OilFields | null;
  /** "Igual que siempre" from the car's memory (lib/domain/carMemory.ts suggestionsFor). */
  memory?: MemorySuggestion | null;
  fuel: 'gasolina' | 'diesel' | null;
}) {
  const { theme } = useTheme();
  const grades = useMemo(() => oilGrades().map((g) => g.es), []);
  const brandItems = useMemo(() => oilBrands().map((b) => ({ key: b.id, label: b.es })), []);
  const specs = splitSpecs(value.oilSpec);
  const specChoices = specsFor(fuel, specs).map((s) => s.es);
  // Saved specs that are not in the list (typed elsewhere) still show, as chips of their own.
  const extraSpecs = specs.filter((s) => !specChoices.includes(s));
  const [brandOpen, setBrandOpen] = useState(false);

  const set = (patch: Partial<OilFields>) => onChange({ ...value, ...patch });
  const lastLine = last ? oilSummary(last) : null;
  const memoryOil = memory?.oil && Object.keys(memory.oil).length ? memory.oil : null;
  const memoryApplied = memoryOil ? sameOil({ ...value, ...memoryOil }, value) : false;
  const brandKey = brandItems.find((b) => b.label === value.oilBrand)?.key ?? null;

  function toggleSpec(label: string) {
    const next = specs.includes(label) ? specs.filter((s) => s !== label) : [...specs, label];
    set({ oilSpec: joinSpecs(next) });
  }

  return (
    <Surface style={styles.card}>
      <T face="eyebrow" accessibilityRole="header" style={[styles.title, { color: theme.text.secondary }]}>
        {title}
      </T>

      {last && lastLine && !sameOil(last, value) ? (
        <Pressable
          onPress={() => {
            onChange({ ...last });
          }}
          accessibilityRole="button"
          accessibilityLabel={`${t.oil.sameAsLastA11y}: ${lastLine}`}
          style={[styles.suggestion, { borderColor: theme.accent, backgroundColor: theme.bg.raised }]}>
          <Ionicons name="refresh" size={16} color={theme.accent} />
          <T face="body" style={{ color: theme.text.primary, fontSize: 13, flex: 1 }}>
            {t.oil.sameAsLast(lastLine)}
          </T>
        </Pressable>
      ) : null}

      {memory && !memoryApplied ? (
        memoryOil ? (
          <Pressable
            onPress={() => {
              onChange({ ...value, ...memoryOil });
            }}
            accessibilityRole="button"
            accessibilityLabel={memory.label}
            testID="oil-same-as-always"
            style={[styles.suggestion, { borderColor: theme.accent, backgroundColor: theme.bg.raised }]}>
            <Ionicons name="bookmark-outline" size={16} color={theme.accent} />
            <T face="body" style={{ color: theme.text.primary, fontSize: 13, flex: 1 }}>
              {memory.label}
            </T>
          </Pressable>
        ) : (
          <T face="body" style={[styles.hint, { color: theme.text.secondary }]}>
            {memory.label}
          </T>
        )
      ) : null}

      <SelectField<string | null>
        label={t.oil.viscosity}
        value={value.oilViscosity && grades.includes(value.oilViscosity) ? value.oilViscosity : null}
        allowNone
        options={grades.map((g) => ({ value: g as string | null, label: g }))}
        other={{ label: t.oil.viscosityOther, current: value.oilViscosity && !grades.includes(value.oilViscosity) ? value.oilViscosity : null, onOther: (text) => set({ oilViscosity: text.trim().toUpperCase() || null }) }}
        onChange={(g) => set({ oilViscosity: g })}
      />

      <SelectField<OilType | null> label={t.oil.type} value={value.oilType} allowNone options={selectOptions(OIL_TYPES, (ot) => t.oil.types[ot])} onChange={(ot) => set({ oilType: ot })} />

      <PickerField
        label={t.oil.brand}
        value={value.oilBrand}
        placeholder={t.oil.brandPlaceholder}
        onPress={() => setBrandOpen(true)}
      />
      <SearchSheet
        visible={brandOpen}
        title={t.oil.brandSheet}
        items={brandItems}
        selectedKey={brandKey}
        otherLabel={t.oil.brandOther}
        onPick={(pick) => set({ oilBrand: 'other' in pick ? pick.other : pick.label })}
        onClose={() => setBrandOpen(false)}
      />

      <MultiSelectField label={t.oil.spec} hint={t.oil.specHint} values={specs} options={selectOptions([...specChoices, ...extraSpecs], (x) => x)} onToggle={toggleSpec} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space.md },
  title: { fontSize: 12, marginBottom: space.sm },
  label: { fontSize: 12, marginBottom: 6, marginTop: space.sm },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm, marginBottom: space.sm },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginBottom: space.sm,
  },
});
