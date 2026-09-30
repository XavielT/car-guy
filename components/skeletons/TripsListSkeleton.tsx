import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Viajes' list twin (ADR-40), inline under the real title and chips: the
 * month strip, the filter bar, and trip rows (sparkline + three lines) with
 * TripRow's padding, radius and gap.
 */
export function TripsListSkeleton({ rows = 6 }: { rows?: number }) {
  const { theme } = useTheme();
  const box = { borderColor: theme.lineStrong, backgroundColor: theme.bg.surface };
  return (
    <Skeleton padded={false}>
      <View style={[styles.strip, { borderColor: theme.lineStrong, backgroundColor: theme.bg.well }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, gap: 6 }}>
            <Skeleton.Rect h={18} w="70%" />
            <Skeleton.Rect h={10} w="50%" />
          </View>
        ))}
      </View>
      <Skeleton.Rect h={48} r={radius.input} style={{ marginBottom: space.md }} />
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.row, box]}>
          <Skeleton.Rect h={40} w={64} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton.Rect h={11} w="55%" />
            <Skeleton.Rect h={14} w="75%" />
            <Skeleton.Rect h={13} w="45%" />
          </View>
        </View>
      ))}
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: space.md, borderWidth: 1, borderRadius: radius.button, padding: space.md, marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.button, padding: space.md, marginBottom: space.sm },
});
