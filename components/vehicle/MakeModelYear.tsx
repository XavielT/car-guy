import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field } from '@/components/Field';
import { PickerField, SearchSheet, YearWheel, type SearchItem } from '@/components/pickers';
import { space } from '@/constants/theme';
import { allMakes, makeById, modelById, modelsFor } from '@/lib/domain/refdata';
import { t } from '@/lib/i18n';

export type MakeModelValue = {
  makeId: string | null;
  make: string;
  modelId: string | null;
  model: string;
  year: string;
};

const range = (from: number | null, to: number | null) =>
  from && to ? `${from}–${to}` : from ? `${from}–` : to ? `–${to}` : undefined;

/**
 * Marca → Modelo → Año (03-screens.md Phase 3 §2). Marca and Modelo are search
 * sheets over lib/domain/refdata with "Otro…" for anything not listed — then
 * the id is null and the typed text is what is stored. Año opens the wheel with
 * the model's known years highlighted; it can still be typed.
 */
export function MakeModelYear({ value, onChange }: { value: MakeModelValue; onChange: (next: MakeModelValue) => void }) {
  const [open, setOpen] = useState<'make' | 'model' | 'year' | null>(null);

  const makeItems = useMemo<SearchItem[]>(
    () =>
      allMakes().map((m) => ({
        key: m.id,
        label: m.name,
        keywords: [m.aliases.join(' '), ...modelsFor(m.id).map((x) => `${x.name} ${x.aliases.join(' ')}`)].join(' '),
        section: m.top ? t.vehicleForm.topMakes : t.vehicleForm.otherMakes,
      })),
    [],
  );
  const modelItems = useMemo<SearchItem[]>(
    () =>
      value.makeId
        ? modelsFor(value.makeId).map((m) => ({ key: m.id, label: m.name, sub: range(m.from, m.to), keywords: m.aliases.join(' ') }))
        : [],
    [value.makeId],
  );
  const model = value.modelId ? modelById(value.modelId) : undefined;
  const yearNumber = /^\d{4}$/.test(value.year.trim()) ? Number(value.year.trim()) : null;

  return (
    <View>
      <View style={styles.pair}>
        <PickerField
          label={t.vehicleForm.make}
          value={value.make}
          placeholder={t.vehicleForm.makePlaceholder}
          onPress={() => setOpen('make')}
        />
        <PickerField
          label={t.vehicleForm.model}
          value={value.model}
          placeholder={value.make ? t.vehicleForm.modelPlaceholder : t.vehicleForm.modelFirst}
          onPress={() => setOpen('model')}
          disabled={!value.make}
        />
      </View>
      <View style={styles.pair}>
        <PickerField
          label={t.vehicleForm.year}
          value={value.year}
          placeholder={t.vehicleForm.yearPlaceholder}
          onPress={() => setOpen('year')}
        />
        <View style={styles.half}>
          <Field
            label={t.vehicleForm.yearTyped}
            placeholder="2015"
            keyboardType="number-pad"
            maxLength={4}
            value={value.year}
            onChangeText={(year) => onChange({ ...value, year })}
          />
        </View>
      </View>

      <SearchSheet
        visible={open === 'make'}
        title={t.vehicleForm.makeSearch}
        items={makeItems}
        selectedKey={value.makeId}
        onClose={() => setOpen(null)}
        onPick={(pick) => {
          if ('other' in pick) onChange({ ...value, makeId: null, make: pick.other, modelId: null, model: '' });
          else if (pick.key !== value.makeId) onChange({ ...value, makeId: pick.key, make: makeById(pick.key)?.name ?? pick.label, modelId: null, model: '' });
        }}
      />
      <SearchSheet
        visible={open === 'model'}
        title={t.vehicleForm.modelSearch}
        items={modelItems}
        selectedKey={value.modelId}
        onClose={() => setOpen(null)}
        onPick={(pick) =>
          onChange('other' in pick ? { ...value, modelId: null, model: pick.other } : { ...value, modelId: pick.key, model: pick.label })
        }
      />
      <YearWheel
        visible={open === 'year'}
        value={yearNumber}
        range={model ? { from: model.from, to: model.to } : null}
        onClose={() => setOpen(null)}
        onPick={(year) => onChange({ ...value, year: String(year) })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
});
