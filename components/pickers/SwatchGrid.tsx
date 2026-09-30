import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { radius, space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';

export type Swatch = { id: string; label: string; hex?: string | null; light?: boolean };

/**
 * Colour circles with their name under each and a check on the chosen one,
 * then "Otro…" for a colour the list does not have (free text, stored as the
 * label with no id). Tapping the chosen swatch again clears it.
 */
export function SwatchGrid({
  swatches,
  value,
  otherText,
  onChange,
  label,
}: {
  swatches: Swatch[];
  /** The chosen swatch id, or null (none / "Otro"). */
  value: string | null;
  /** The free text when "Otro" was used. */
  otherText?: string | null;
  onChange: (next: { id: string | null; label: string | null }) => void;
  label?: string;
}) {
  const { theme } = useTheme();
  const [typing, setTyping] = useState(Boolean(!value && otherText));

  return (
    <View style={styles.wrap}>
      {label ? (
        <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
          {label}
        </T>
      ) : null}
      <View style={styles.grid} accessibilityRole="radiogroup">
        {swatches
          .filter((s) => s.hex)
          .map((s) => {
            const on = s.id === value;
            return (
              <Pressable
                key={s.id}
                onPress={() => {
                  setTyping(false);
                  onChange(on ? { id: null, label: null } : { id: s.id, label: s.label });
                }}
                accessibilityRole="radio"
                accessibilityLabel={s.label}
                accessibilityState={{ checked: on }}
                style={styles.cell}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: s.hex ?? 'transparent', borderColor: on ? theme.accent : s.light ? theme.line : 'transparent' },
                    on && styles.dotOn,
                  ]}>
                  {on ? <Ionicons name="checkmark" size={18} color={s.light ? '#111' : '#fff'} /> : null}
                </View>
                <T face="body" numberOfLines={1} style={[styles.name, { color: on ? theme.text.primary : theme.text.muted }]}>
                  {s.label}
                </T>
              </Pressable>
            );
          })}
        <Pressable
          onPress={() => {
            setTyping(true);
            onChange({ id: null, label: otherText ?? null });
          }}
          accessibilityRole="radio"
          accessibilityLabel={t.pickers.other}
          accessibilityState={{ checked: typing }}
          style={styles.cell}>
          <View style={[styles.dot, styles.otherDot, { borderColor: typing ? theme.accent : theme.line }]}>
            <Ionicons name="add" size={18} color={theme.text.muted} />
          </View>
          <T face="body" numberOfLines={1} style={[styles.name, { color: theme.text.muted }]}>
            {t.pickers.otherShort}
          </T>
        </Pressable>
      </View>
      {typing ? (
        <TextInput
          value={otherText ?? ''}
          onChangeText={(text) => onChange({ id: null, label: text })}
          placeholder={t.pickers.colorOther}
          placeholderTextColor={theme.text.muted}
          accessibilityLabel={t.pickers.colorOther}
          style={[styles.input, { backgroundColor: theme.bg.raised, borderColor: theme.line, color: theme.text.primary }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md + 2 },
  label: { fontSize: 12, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { width: 60, alignItems: 'center', minHeight: 64 },
  dot: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotOn: { transform: [{ scale: 1.08 }] },
  otherDot: { borderStyle: 'dashed' },
  name: { fontSize: 11, marginTop: 4, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: radius.input, paddingHorizontal: space.md, minHeight: 48, fontSize: 16, marginTop: space.sm },
});
