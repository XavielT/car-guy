import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { radius, space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import { PrimaryButton, Sheet } from '../ui';
import { T } from '../T';
import { SearchSheet, type SearchItem } from './SearchSheet';
import { SwatchGrid, type Swatch } from './SwatchGrid';

/**
 * One option of a SelectField (IMP 16102026 ADR-60). `value` is whatever the field stores — a string id, a number
 * (4 hours, a 300 m radius), `null` ("Ninguno"); the sheet never needs it to be a string.
 */
export type SelectOption<V = string> = {
  value: V;
  label: string;
  /** A line under the label ("10,000 km / 12 meses"). */
  hint?: string;
  /** Items with the same group sit under its heading, in the order given. */
  group?: string;
  /** Extra words the search also matches. */
  keywords?: string;
  /** A colour dot before the label (swatch variant, severities). */
  swatch?: string | null;
};

export type SelectOther = {
  /** The row's text; default "Otro…". */
  label?: string;
  /** The typed value (stored by the caller, e.g. a free-text colour). */
  onOther: (text: string) => void;
  /** What the field shows when the value is the typed one. */
  current?: string | null;
};

/** `SelectOption`s from a list of values and a labeller — the usual case (a const array of ids and their texts). */
export function selectOptions<V extends string | number>(list: readonly V[], label: (v: V) => string): SelectOption<V>[] {
  return list.map((value) => ({ value, label: label(value) }));
}

/** More options than this get a search box (SPEC-B). */
export const SEARCH_ABOVE = 8;

/**
 * The sheet behind a SelectField (and behind each filter pill): the options, the chosen one marked ✔ and in view,
 * closing on a pick. The scrim, ✕/back (Android) and Esc (web, the Modal's close request) close it **without**
 * changing the value. Single choice: `SearchSheet` (search above 8 options, "Otro…" with its text field). `swatch`:
 * the colour grid. `multiple`: toggles that stay open with "Listo".
 */
export function SelectSheet<V>({
  visible,
  title,
  options,
  value,
  onPick,
  onClose,
  variant = 'list',
  searchable,
  other,
  multiple,
  values,
  onToggle,
}: {
  visible: boolean;
  title: string;
  options: SelectOption<V>[];
  value?: V | null;
  onPick: (value: V) => void;
  onClose: () => void;
  variant?: 'list' | 'swatch';
  searchable?: boolean;
  other?: SelectOther;
  multiple?: boolean;
  values?: V[];
  onToggle?: (value: V) => void;
}) {
  const items: SearchItem[] = useMemo(
    () => options.map((o, i) => ({ key: String(i), label: o.label, sub: o.hint, keywords: o.keywords, section: o.group })),
    [options],
  );
  const selectedIndex = options.findIndex((o) => Object.is(o.value, value));

  if (multiple) {
    return <MultiSheet visible={visible} title={title} options={options} values={values ?? []} onToggle={onToggle ?? (() => {})} onClose={onClose} />;
  }
  if (variant === 'swatch') {
    return <SwatchPicker visible={visible} title={title} options={options} value={value} onPick={onPick} onClose={onClose} other={other} />;
  }
  return (
    <SearchSheet
      visible={visible}
      title={title}
      items={items}
      selectedKey={selectedIndex >= 0 ? String(selectedIndex) : null}
      searchable={searchable ?? options.length > SEARCH_ABOVE}
      allowOther={Boolean(other)}
      otherLabel={other?.label}
      onClose={onClose}
      onPick={(pick) => {
        if ('other' in pick) other?.onOther(pick.other);
        else onPick(options[Number(pick.key)].value);
      }}
    />
  );
}

function SwatchPicker<V>({
  visible,
  title,
  options,
  value,
  onPick,
  onClose,
  other,
}: {
  visible: boolean;
  title: string;
  options: SelectOption<V>[];
  value?: V | null;
  onPick: (value: V) => void;
  onClose: () => void;
  other?: SelectOther;
}) {
  // A "Ninguno" option (value null) is a row above the grid; the colours keep their indexes in `options`.
  const noneIndex = options.findIndex((o) => o.value === null);
  const swatches: Swatch[] = options.map((o, i) => ({ id: String(i), label: o.label, hex: i === noneIndex ? null : (o.swatch ?? null) }));
  const { theme } = useTheme();
  const selected = options.findIndex((o) => Object.is(o.value, value));
  const [typed, setTyped] = useState<string | null>(null);
  return (
    <Sheet visible={visible} onClose={onClose} title={title} avoidKeyboard>
      {noneIndex >= 0 ? (
        <Pressable
          onPress={() => {
            onPick(options[noneIndex].value);
            onClose();
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === noneIndex || (selected < 0 && value == null) }}
          style={[styles.row, { borderColor: theme.line }]}>
          <T face="semibold" style={{ color: theme.text.secondary, fontSize: 16 }}>
            {options[noneIndex].label}
          </T>
        </Pressable>
      ) : null}
      <SwatchGrid
        swatches={swatches}
        value={selected >= 0 ? String(selected) : null}
        otherText={typed ?? other?.current ?? null}
        onChange={(next) => {
          if (next.id != null) {
            setTyped(null);
            onPick(options[Number(next.id)].value);
          } else setTyped(next.label ?? '');
        }}
        onPicked={() => {
          if (typed != null && typed.trim()) other?.onOther(typed.trim());
          setTyped(null);
          onClose();
        }}
      />
    </Sheet>
  );
}

function MultiSheet<V>({
  visible,
  title,
  options,
  values,
  onToggle,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: SelectOption<V>[];
  values: V[];
  onToggle: (value: V) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <ScrollView style={{ maxHeight: height * 0.5 }}>
        {options.map((o, i) => {
          const on = values.some((v) => Object.is(v, o.value));
          return (
            <Pressable
              key={i}
              onPress={() => onToggle(o.value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={o.label}
              style={[styles.row, { borderColor: theme.line }]}>
              <View style={[styles.box, { borderColor: on ? theme.accent : theme.text.muted, backgroundColor: on ? theme.accent : 'transparent' }]}>
                {on ? <Ionicons name="checkmark" size={16} color={theme.accentFillInk} /> : null}
              </View>
              <T face={on ? 'semibold' : 'body'} style={{ color: theme.text.primary, fontSize: 16, flex: 1 }}>
                {o.label}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ marginTop: space.md }}>
        <PrimaryButton label={t.pickers.done} onPress={onClose} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  box: { width: 22, height: 22, borderRadius: radius.input / 3, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
