import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Field } from '@/components/Field';
import { PickerField, SearchSheet } from '@/components/pickers';
import { T } from '@/components/T';
import { Chip, Surface } from '@/components/ui';
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
  fuel,
}: {
  title: string;
  value: OilFields;
  onChange: (next: OilFields) => void;
  last?: OilFields | null;
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
  const [otherGrade, setOtherGrade] = useState(Boolean(value.oilViscosity && !grades.includes(value.oilViscosity)));

  const set = (patch: Partial<OilFields>) => onChange({ ...value, ...patch });
  const lastLine = last ? oilSummary(last) : null;
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
            setOtherGrade(Boolean(last.oilViscosity && !grades.includes(last.oilViscosity)));
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

      <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
        {t.oil.viscosity}
      </T>
      <View style={styles.wrap}>
        {grades.map((g) => (
          <Chip
            key={g}
            label={g}
            selected={!otherGrade && value.oilViscosity === g}
            onPress={() => {
              setOtherGrade(false);
              set({ oilViscosity: value.oilViscosity === g ? null : g });
            }}
          />
        ))}
        <Chip
          label={t.oil.viscosityOther}
          selected={otherGrade}
          onPress={() => {
            const next = !otherGrade;
            setOtherGrade(next);
            if (!next || grades.includes(value.oilViscosity ?? '')) set({ oilViscosity: null });
          }}
        />
      </View>
      {otherGrade ? (
        <Field
          label={t.oil.viscosityOtherLabel}
          value={value.oilViscosity ?? ''}
          onChangeText={(t) => set({ oilViscosity: t || null })}
          autoCapitalize="characters"
        />
      ) : null}

      <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
        {t.oil.type}
      </T>
      <View style={styles.wrap}>
        {OIL_TYPES.map((ot) => (
          <Chip
            key={ot}
            label={t.oil.types[ot]}
            selected={value.oilType === ot}
            onPress={() => set({ oilType: value.oilType === ot ? null : ot })}
          />
        ))}
      </View>

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

      <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
        {t.oil.spec}
      </T>
      <T face="body" style={[styles.hint, { color: theme.text.muted }]}>
        {t.oil.specHint}
      </T>
      <View style={styles.wrap}>
        {[...specChoices, ...extraSpecs].map((s) => (
          <Chip key={s} label={s} selected={specs.includes(s)} onPress={() => toggleSpec(s)} />
        ))}
      </View>
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
