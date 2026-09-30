import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The tab screens' twins (ADR-40): Garaje, Historial and Cifras keep their
 * real header (title, filters, search, period switch — none of it waits on a
 * query) and render these inline, in the slot the loaded content fills.
 */

const inline = { flex: 0, backgroundColor: 'transparent' } as const;

/** Garaje: three cover cards — a 180 px cover over the name, the line and the stats row. */
export function TabsGarajeSkeleton() {
  const { theme } = useTheme();
  return (
    <Skeleton padded={false} style={inline}>
      {Array.from({ length: 3 }, (_, i) => (
        <View key={i} style={[styles.hero, { borderColor: theme.line, backgroundColor: theme.bg.surface }]}>
          <Skeleton.Rect h={180} r={0} />
          <View style={styles.heroBody}>
            <Skeleton.Rect h={24} w="55%" />
            <Skeleton.Rect h={13} w="70%" />
            <View style={styles.stats}>
              <Skeleton.Rect h={30} style={{ flex: 1 }} />
              <Skeleton.Rect h={30} style={{ flex: 1 }} />
              <Skeleton.Rect h={30} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      ))}
    </Skeleton>
  );
}

/** Historial: a month header and eight record rows. */
export function TabsHistorialSkeleton() {
  const { theme } = useTheme();
  return (
    <Skeleton padded={false} style={inline}>
      <View style={[styles.monthHeader, { borderColor: theme.line }]}>
        <Skeleton.Rect h={20} w="40%" />
        <Skeleton.Rect h={13} w={80} />
      </View>
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton.Row key={i} />
      ))}
    </Skeleton>
  );
}

/** Cifras: the four KPI tiles (two by two) and the first chart's box. */
export function TabsCifrasSkeleton() {
  return (
    <Skeleton padded={false} style={inline}>
      <Skeleton.Tiles n={2} h={88} />
      <Skeleton.Tiles n={2} h={88} />
      <Skeleton.Card>
        <Skeleton.Rect h={11} w={120} />
        <Skeleton.Rect h={180} r={radius.input} />
      </Skeleton.Card>
      <Skeleton.Card h={220} />
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  hero: { borderWidth: 1, borderRadius: radius.card, overflow: 'hidden', marginBottom: space.md },
  heroBody: { padding: space.lg, gap: space.sm },
  stats: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: space.sm,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
});
