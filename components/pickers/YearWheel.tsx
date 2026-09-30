import { useEffect, useMemo, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/theme';
import { FIRST_YEAR, yearList } from '@/lib/domain/vehicleForm';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import { Chip, Sheet } from '../ui';
import { T } from '../T';

export { FIRST_YEAR, isYearInRange, yearList } from '@/lib/domain/vehicleForm';

const ROW = 48;

/**
 * The year picker: a list from next year down to 1950, the model's known years
 * highlighted, and decade chips to jump (a 1985 AE86 is a long scroll away).
 */
export function YearWheel({
  visible,
  value,
  range,
  onPick,
  onClose,
}: {
  visible: boolean;
  value: number | null;
  /** The model's known production years, when there is one. */
  range?: { from: number | null; to: number | null } | null;
  onPick: (year: number) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const years = useMemo(() => yearList(), []);
  const list = useRef<FlatList<number>>(null);
  const decades = useMemo(() => [...new Set(years.map((y) => Math.floor(y / 10) * 10))], [years]);
  const inRange = (y: number) =>
    range != null && (range.from != null || range.to != null) && y >= (range.from ?? FIRST_YEAR) && y <= (range.to ?? years[0]);

  const jump = (year: number) => {
    const index = years.findIndex((y) => y <= year);
    if (index >= 0) list.current?.scrollToIndex({ index, animated: true });
  };

  // Open on the chosen year, or on the model's newest year.
  useEffect(() => {
    if (!visible) return;
    // A model still built (no end year) opens at the newest years, not at its first one.
    const target = value ?? (range && (range.from != null || range.to != null) ? (range.to ?? years[0]) : null);
    if (target) setTimeout(() => jump(target), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={onClose} title={t.pickers.year}>
      <View style={styles.decades}>
        {decades.map((d) => (
          <Chip key={d} label={`${String(d).slice(2)}s`} onPress={() => jump(d + 9)} />
        ))}
      </View>
      {range && (range.from || range.to) ? (
        <T face="body" style={[styles.caption, { color: theme.text.secondary }]}>
          {t.pickers.modelYears(range.from, range.to)}
        </T>
      ) : null}
      <FlatList
        ref={list}
        data={years}
        style={{ maxHeight: ROW * 6 }}
        keyExtractor={(y) => String(y)}
        getItemLayout={(_, index) => ({ length: ROW, offset: ROW * index, index })}
        initialNumToRender={20}
        renderItem={({ item }) => {
          const on = item === value;
          const hot = inRange(item);
          return (
            <Pressable
              onPress={() => {
                onPick(item);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[
                styles.row,
                { backgroundColor: on ? theme.accentFill : hot ? theme.bg.raised : 'transparent' },
              ]}>
              <T
                face="mono"
                style={[styles.year, { color: on ? theme.accentFillInk : hot ? theme.text.primary : theme.text.muted }]}>
                {item}
              </T>
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  decades: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.md },
  caption: { fontSize: 13, marginBottom: space.sm },
  row: { height: ROW, justifyContent: 'center', alignItems: 'center', borderRadius: radius.input },
  year: { fontSize: 18 },
});
