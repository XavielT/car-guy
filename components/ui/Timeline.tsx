import type { ReactElement } from 'react';
import { SectionList, StyleSheet, View, type SectionListProps } from 'react-native';

import { space } from '@/constants/theme';
import { monthTitle } from '@/lib/format';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';
import { HazardDivider } from './HazardDivider';

/**
 * The album / history scaffold (05-design-jdm.md §11): items grouped by month,
 * newest first, on a 2 px rail with a coloured dot per record kind. Month
 * headers are Saira 800 with an optional right-hand fact (the odometer then);
 * the current month gets the one hazard divider the screen is allowed.
 *
 * It lays out; it does not know what an item is — `renderItem` draws each one
 * and `dotColor` says which colour its dot is.
 */
export function Timeline<Item>({
  items,
  getDate,
  keyExtractor,
  renderItem,
  dotColor,
  monthAside,
  today = new Date(),
  ListHeaderComponent,
  ListEmptyComponent,
  ...rest
}: {
  items: Item[];
  /** ISO date the item belongs to. */
  getDate: (item: Item) => string;
  keyExtractor: (item: Item) => string;
  renderItem: (item: Item) => ReactElement;
  dotColor: (item: Item) => string;
  /** Right side of a month header, e.g. "52 400 km". */
  monthAside?: (monthKey: string, items: Item[]) => string | null;
  today?: Date;
} & Pick<SectionListProps<Item>, 'ListHeaderComponent' | 'ListEmptyComponent' | 'ListFooterComponent' | 'contentContainerStyle' | 'onEndReached' | 'scrollEnabled'>) {
  const { theme } = useTheme();
  const sections = groupByMonth(items, getDate);
  const currentKey = monthKey(today.toISOString());

  return (
    <SectionList
      {...rest}
      sections={sections}
      keyExtractor={keyExtractor}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      renderSectionHeader={({ section }) => {
        const [y, m] = section.key.split('-').map(Number);
        const aside = monthAside?.(section.key, section.data);
        return (
          <View style={styles.header}>
            {section.key === currentKey ? <HazardDivider style={styles.hazard} /> : null}
            <View style={styles.headerRow}>
              <T face="display" style={{ color: theme.text.primary, fontSize: 20, textTransform: 'uppercase' }}>
                {monthTitle(y, m - 1)}
              </T>
              {aside ? (
                <T face="mono" style={{ color: theme.text.muted, fontSize: 12 }}>
                  {aside}
                </T>
              ) : null}
            </View>
          </View>
        );
      }}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.railCol}>
            <View style={[styles.rail, { backgroundColor: theme.lineStrong }]} />
            <View style={[styles.dot, { backgroundColor: dotColor(item), borderColor: theme.bg.base }]} />
          </View>
          <View style={styles.body}>{renderItem(item)}</View>
        </View>
      )}
    />
  );
}

/** "2026-09" from an ISO string, in local time like the rest of the app. */
export function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function groupByMonth<Item>(items: Item[], getDate: (item: Item) => string): { key: string; data: Item[] }[] {
  const map = new Map<string, Item[]>();
  const sorted = [...items].sort((a, b) => getDate(b).localeCompare(getDate(a)));
  for (const item of sorted) {
    const key = monthKey(getDate(item));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return [...map.entries()].map(([key, data]) => ({ key, data }));
}

const styles = StyleSheet.create({
  header: { marginTop: space.lg, marginBottom: space.sm },
  hazard: { marginBottom: space.sm },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  row: { flexDirection: 'row' },
  railCol: { width: 20, alignItems: 'center' },
  rail: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 16 },
  body: { flex: 1, paddingBottom: space.sm },
});
