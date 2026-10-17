import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { radius, space } from '@/constants/theme';

/** The Herramientas hub's twin (ADR-40): title, search, the featured 2×2 and three section cards. */
export function HubSkeleton() {
  return (
    <Skeleton style={{ paddingTop: space.gutter }}>
      <View style={{ gap: 8, marginBottom: space.md }}>
        <Skeleton.Rect h={11} w={110} />
        <Skeleton.Rect h={30} w="50%" />
        <Skeleton.Rect h={13} w="70%" />
      </View>
      <Skeleton.Rect h={56} r={radius.input} style={{ marginBottom: space.md }} />
      <View style={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton.Rect key={i} h={96} r={radius.button} style={styles.tile} />
        ))}
      </View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ gap: space.sm, marginBottom: space.md }}>
          <Skeleton.Rect h={11} w={140} />
          <Skeleton.Rect h={64} r={radius.button} />
          <Skeleton.Rect h={64} r={radius.button} />
        </View>
      ))}
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  tile: { width: '48%', flexGrow: 1 },
});
