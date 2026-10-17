import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { contrastRatio } from '@/lib/domain/contrast';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import { PickerField } from './PickerField';
import { SelectSheet, type SelectOption, type SelectOther } from './SelectSheet';

export type { SelectOption, SelectOther } from './SelectSheet';

/** The colour dot before a value (a swatch, a severity), with the ≥ 3:1 outline the swatch grid has (X3). */
export function ValueDot({ color }: { color: string }) {
  const { theme } = useTheme();
  const outline = (contrastRatio(color, theme.bg.raised) ?? 21) < 3;
  return <View style={[styles.dot, { backgroundColor: color, borderColor: outline ? theme.text.muted : 'transparent' }]} />;
}

/**
 * Every choice of a value is one of these (IMP 16102026 ADR-60, SPEC-B): a field that shows the value, and a sheet
 * with the options that **closes when one is chosen**. Two options or thirty, a form or the settings — the options
 * are never laid out on the screen.
 *
 *  - `PickerField` is the trigger, `SelectSheet` the sheet (a list; the swatch grid for colours; toggles for `multiple`);
 *  - more than 8 options get a search box (`searchable` overrides);
 *  - ✔ marks the current one and the list opens on it; the scrim, Esc and Android's back close without changing it;
 *  - `other` adds "Otro…" with a text field inside the sheet; `allowNone` adds a first "Ninguno" row (value `null`);
 *  - `extra` renders under the field (the vehicle's status asks for a note and a "desde" once chosen).
 */
export function SelectField<V extends string | number | null>({
  label,
  value,
  options,
  onChange,
  variant = 'list',
  searchable,
  other,
  allowNone,
  required,
  error,
  disabled,
  placeholder,
  hint,
  testID,
  title,
  extra,
  dark,
}: {
  label: string;
  value: V | null | undefined;
  options: SelectOption<V>[];
  onChange: (value: V) => void;
  variant?: 'list' | 'swatch';
  searchable?: boolean;
  other?: SelectOther;
  /** A first "Ninguno" row that picks `null` (the field must accept it). */
  allowNone?: string | boolean;
  required?: boolean;
  error?: string | null;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  testID?: string;
  /** The sheet's title; defaults to the label. */
  title?: string;
  extra?: ReactNode;
  /** On an always-dark surface (Modo conducir). */
  dark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const all: SelectOption<V>[] = allowNone
    ? [{ value: null as V, label: typeof allowNone === 'string' ? allowNone : t.pickers.none }, ...options]
    : options;
  const current = all.find((o) => Object.is(o.value, value ?? null));
  const text = current ? current.label : (other?.current ?? null);
  const dot = current?.swatch;
  return (
    <>
      <PickerField
        label={required ? `${label} *` : label}
        value={text}
        placeholder={placeholder ?? t.pickers.choose}
        onPress={() => setOpen(true)}
        disabled={disabled}
        hint={hint}
        error={error}
        testID={testID}
        dark={dark}
        leading={dot ? <ValueDot color={dot} /> : undefined}
      />
      <SelectSheet
        visible={open}
        title={title ?? label}
        options={all}
        value={value ?? null}
        variant={variant}
        searchable={searchable}
        other={other}
        onClose={() => setOpen(false)}
        onPick={(v) => onChange(v)}
      />
      {extra}
    </>
  );
}

/** A field of several values (the oil's specs, the tires used in a session): the sheet stays open until "Listo". */
export function MultiSelectField<V extends string | number>({
  label,
  values,
  options,
  onToggle,
  placeholder,
  hint,
  title,
}: {
  label: string;
  values: V[];
  options: SelectOption<V>[];
  onToggle: (value: V) => void;
  placeholder?: string;
  hint?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const text = values.length
    ? values.map((v) => options.find((o) => Object.is(o.value, v))?.label ?? String(v)).join(' · ')
    : null;
  return (
    <>
      <PickerField label={label} value={text} placeholder={placeholder ?? t.pickers.choose} onPress={() => setOpen(true)} hint={hint} />
      <SelectSheet<V> visible={open} title={title ?? label} options={options} multiple values={values} onToggle={onToggle} onClose={() => setOpen(false)} onPick={() => {}} />
    </>
  );
}

const styles = StyleSheet.create({
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
});
