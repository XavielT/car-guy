import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { fonts, radius, space } from '@/constants/theme';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from './T';

/**
 * A date field that opens the platform's own picker (ADR-12).
 *
 * Value in and out is always `YYYY-MM-DD` — the same format the text inputs used
 * before, so swapping this in changes no stored data. The web build gets
 * `DateField.web.tsx` and an `<input type="date">` instead.
 */
export function DateField({
  label,
  value,
  onChange,
  hint,
  noFuture,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  /** For "when did it happen" dates: a fill-up or a reading cannot be tomorrow. */
  noFuture?: boolean;
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);

  // Parsed as local time, not UTC: `new Date('2026-09-17')` is midnight UTC,
  // which is the day before in the Dominican Republic.
  const [y, m, d] = value.split('-').map(Number);
  const date = y && m && d ? new Date(y, m - 1, d, 12) : new Date();

  return (
    <View style={styles.wrap}>
      <T face="semibold" style={[styles.label, { color: theme.text.primary }]}>
        {label}
      </T>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || es.common.pickDate}`}
        style={[styles.input, { backgroundColor: theme.bg.raised, borderColor: theme.line }]}>
        <T
          face="body"
          style={[styles.value, { color: value ? theme.text.primary : theme.text.muted }]}>
          {value || es.common.pickDate}
        </T>
      </Pressable>
      {hint ? (
        <T face="body" style={[styles.hint, { color: theme.text.secondary }]}>
          {hint}
        </T>
      ) : null}
      {open ? (
        <DateTimePicker
          value={date}
          mode="date"
          maximumDate={noFuture ? new Date() : undefined}
          onChange={(event, next) => {
            setOpen(false);
            if (event.type === 'dismissed' || !next) return;
            const pad = (n: number) => String(n).padStart(2, '0');
            onChange(`${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md + 2 },
  label: { fontSize: 13, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md + 2,
    justifyContent: 'center',
    minHeight: 48,
  },
  value: { fontSize: 16, fontFamily: fonts.body },
  hint: { fontSize: 12, marginTop: 6, lineHeight: 17 },
});
