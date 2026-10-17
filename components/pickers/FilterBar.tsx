import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';
import { SelectSheet, type SelectOption } from './SelectSheet';

/** One filter of a list: its options (the first is "Todos" — the value that means "no filter"), and the value. */
export type FilterDef<V extends string | number | null = string> = {
  key: string;
  /** "Tipo" — the pill reads "Tipo: Gasolina". */
  label: string;
  value: V;
  options: SelectOption<V>[];
  onChange: (value: V) => void;
  /** The option that means "no filter"; default the first one. */
  allValue?: V;
};

/**
 * The filters of a list (IMP 16102026 ADR-60, decision of 16-10): each is a compact pill "Tipo: Todos ▾" that opens
 * the same sheet as every other choice and closes on a pick. With any filter on, a counter and "Limpiar" appear;
 * "Todos" is always the first option. The state lives in the screen, so it survives coming back to the list, and a
 * change is a plain state update — no reload, no flicker.
 */
export function FilterBar({ filters, trailing }: { filters: FilterDef<any>[]; trailing?: React.ReactNode }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState<string | null>(null);
  const active = filters.filter((f) => !Object.is(f.value, f.allValue ?? f.options[0]?.value));
  const openFilter = filters.find((f) => f.key === open) ?? null;
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {filters.map((f) => {
          const on = active.includes(f);
          const current = f.options.find((o) => Object.is(o.value, f.value));
          return (
            <Pressable
              key={f.key}
              onPress={() => setOpen(f.key)}
              accessibilityRole="button"
              accessibilityLabel={`${f.label}: ${current?.label ?? ''}`}
              accessibilityState={{ selected: on }}
              hitSlop={{ top: 4, bottom: 4 }}
              style={[styles.pill, { borderColor: on ? theme.accentFill : theme.line, backgroundColor: on ? theme.accentFill : theme.bg.raised }]}>
              <T face="title" numberOfLines={1} style={{ color: on ? theme.accentFillInk : theme.text.secondary, fontSize: 12, letterSpacing: 0.8 }}>
                {f.label}: {current?.label ?? '—'}
              </T>
              <Ionicons name="chevron-down" size={14} color={on ? theme.accentFillInk : theme.text.muted} />
            </Pressable>
          );
        })}
        {active.length ? (
          <Pressable
            onPress={() => active.forEach((f) => f.onChange(f.allValue ?? f.options[0].value))}
            accessibilityRole="button"
            accessibilityLabel={t.pickers.clearFilters(active.length)}
            hitSlop={{ top: 4, bottom: 4 }}
            style={styles.clear}>
            <T face="semibold" style={{ color: theme.accent, fontSize: 13 }}>
              {t.pickers.clearFilters(active.length)}
            </T>
          </Pressable>
        ) : null}
        {trailing}
      </ScrollView>
      {openFilter ? (
        <SelectSheet
          visible
          title={openFilter.label}
          options={openFilter.options}
          value={openFilter.value}
          onClose={() => setOpen(null)}
          onPick={(v) => openFilter.onChange(v)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  row: { gap: space.sm, alignItems: 'center', paddingRight: space.md },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.input, paddingHorizontal: space.md, minHeight: 44, maxWidth: 260 },
  clear: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm },
});
