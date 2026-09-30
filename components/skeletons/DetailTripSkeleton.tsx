import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { radius, space } from '@/constants/theme';

/**
 * The twin of one trip (viaje/[id], ADR-40): the eyebrow, the dark share card
 * (its header line, the map box at the card's 0.62 ratio, its four stats),
 * the two tiles, the speed distribution bar and the action buttons.
 */
export function DetailTripSkeleton() {
  const { width: winW } = useWindowDimensions();
  // The same width the screen gives TripShareCard, and its map box inside it.
  const cardW = Math.min(winW, 560) - 2 * space.gutter;
  const mapH = Math.round(cardW * 0.62);
  return (
    <Skeleton style={styles.root}>
      <Skeleton.Rect h={10} w={80} style={{ marginBottom: space.sm }} />
      <Skeleton.Card>
        <Skeleton.Rect h={10} w="60%" />
        <Skeleton.Rect h={mapH} r={radius.card} />
        <View style={styles.row}>
          {Array.from({ length: 4 }, (_, i) => (
            <View key={i} style={{ flex: 1, gap: 4 }}>
              <Skeleton.Rect h={18} w="80%" />
              <Skeleton.Rect h={9} w="60%" />
            </View>
          ))}
        </View>
      </Skeleton.Card>
      <Skeleton.Tiles n={2} h={64} />
      <Skeleton.Rect h={10} w={120} style={{ marginTop: space.sm, marginBottom: space.sm }} />
      <Skeleton.Rect h={14} r={7} style={{ marginBottom: space.lg }} />
      <View style={styles.row}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton.Rect key={i} h={48} r={radius.button} style={{ flex: 1 }} />
        ))}
      </View>
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: space.gutter },
  row: { flexDirection: 'row', gap: space.sm },
});
