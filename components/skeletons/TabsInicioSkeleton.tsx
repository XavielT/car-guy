import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skeleton } from '@/components/ui/Skeleton';
import { palette, radius, space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Inicio's twins (ADR-40). The cluster is the part of Inicio that loads (the
 * odometer, the reminders behind the needle and the lamps); the title, the
 * vehicle chips, the quick actions and the month strip come from the store,
 * which is in memory before the screen mounts. So Inicio itself only swaps
 * the cluster card for `TabsClusterSkeleton`, and the whole-screen
 * `TabsInicioSkeleton` is for the tab layout's boot, while the store opens.
 */

/** The cluster card's footprint: header line, dial, "next" lines, the lamp row. */
function ClusterOutline({ size }: { size: number }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.cluster, { borderColor: theme.line, backgroundColor: theme.bg.surface }]}>
      <View style={styles.heroHeader}>
        <Skeleton.Rect h={16} w="45%" />
        <Skeleton.Rect h={18} w={56} />
      </View>
      <View style={{ width: size, height: size * 0.9, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }}>
        <Skeleton.Circle size={size * 0.82} />
      </View>
      <View style={styles.nextRow}>
        <Skeleton.Rect h={10} w={60} />
        <Skeleton.Rect h={12} w="70%" />
        <Skeleton.Rect h={12} w="40%" />
      </View>
      <View style={styles.lamps}>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton.Circle key={i} size={32} />
        ))}
      </View>
    </View>
  );
}

function clusterSize(width: number): number {
  return Math.min(340, Math.max(240, width - 72));
}

/** Inline, in the cluster's slot on Inicio. */
export function TabsClusterSkeleton() {
  const { width } = useWindowDimensions();
  return (
    <Skeleton padded={false} style={styles.inline}>
      <ClusterOutline size={clusterSize(width)} />
    </Skeleton>
  );
}

/** The whole of Inicio: title row, vehicle chips, cluster, quick actions, month strip. */
export function TabsInicioSkeleton() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Skeleton style={{ paddingTop: insets.top + space.gutter }}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton.Rect h={12} w={90} />
          <Skeleton.Rect h={34} w="60%" />
        </View>
        <Skeleton.Rect w={42} h={42} r={radius.tag} />
      </View>
      <View style={styles.chips}>
        <Skeleton.Rect w={110} h={44} />
        <Skeleton.Rect w={90} h={44} />
        <Skeleton.Rect w={70} h={44} />
      </View>
      <ClusterOutline size={clusterSize(width)} />
      <View style={styles.tiles}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton.Rect key={i} h={88} r={radius.card} style={styles.tile} />
        ))}
      </View>
      <Skeleton.Rect h={110} r={radius.card} style={{ marginTop: space.lg }} />
    </Skeleton>
  );
}

/**
 * The root layout's boot frame, before the theme, the navigator and the
 * database exist — so no hooks and no shimmer: the Inicio outline as still
 * blocks in the dark palette the boot screen always used. It is also what
 * static rendering paints, so it must be the same on the server and the client.
 */
export function TabsBootSkeleton() {
  const ink = palette.dark;
  const block = (h: number, w: number | `${number}%`, r: number = radius.tag) => ({ height: h, width: w, borderRadius: r, backgroundColor: ink.bg.raised });
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t.common.loading}
      accessibilityState={{ busy: true }}
      aria-busy
      style={{ flex: 1, backgroundColor: ink.bg.base, paddingHorizontal: space.gutter, paddingTop: space.gutter + space.xxxl }}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1, gap: 8 }}>
          <View style={block(12, 90)} />
          <View style={block(34, '60%')} />
        </View>
        <View style={block(42, 42)} />
      </View>
      <View style={styles.chips}>
        <View style={block(44, 110)} />
        <View style={block(44, 90)} />
      </View>
      <View style={[block(360, '100%', radius.card), { marginBottom: space.lg }]} />
      <View style={styles.tiles}>
        {Array.from({ length: 4 }, (_, i) => (
          <View key={i} style={[block(88, '47%', radius.card), styles.tile]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inline: { flex: 0, backgroundColor: 'transparent' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  chips: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  cluster: {
    borderRadius: radius.card,
    borderWidth: 1,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    marginBottom: space.lg,
    overflow: 'hidden',
  },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  nextRow: { alignItems: 'center', marginTop: space.sm, gap: 6 },
  lamps: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { flexBasis: '47%', flexGrow: 1 },
});
