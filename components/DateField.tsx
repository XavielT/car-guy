import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, fonts, radius, space } from '@/constants/theme';
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
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);

  // Parsed as local time, not UTC: `new Date('2026-09-17')` is midnight UTC,
  // which is the day before in the Dominican Republic.
  const [y, m, d] = value.split('-').map(Number);
  const date = y && m && d ? new Date(y, m - 1, d, 12) : new Date();

  return (
    <View style={styles.wrap}>
      <T face="semibold" style={styles.label}>
        {label}
      </T>
      <Pressable onPress={() => setOpen(true)} style={styles.input}>
        <T face="body" style={styles.value}>
          {value || 'Elegir fecha'}
        </T>
      </Pressable>
      {hint ? (
        <T face="body" style={styles.hint}>
          {hint}
        </T>
      ) : null}
      {open ? (
        <DateTimePicker
          value={date}
          mode="date"
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
  label: { color: colors.ink, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md + 2,
    justifyContent: 'center',
    minHeight: 48,
  },
  value: { color: colors.ink, fontSize: 16, fontFamily: fonts.body },
  hint: { color: colors.muted, fontSize: 12, marginTop: 6 },
});
