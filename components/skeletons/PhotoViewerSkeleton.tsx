import { View, useWindowDimensions } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { space } from '@/constants/theme';

/**
 * The photo viewer's twin (ADR-40): the photo's frame and the panel under it
 * (date, caption, the three actions), on the viewer's own black — the root is
 * transparent so the screen's background shows through.
 */
export function PhotoViewerSkeleton() {
  const { width, height } = useWindowDimensions();
  return (
    <Skeleton padded={false} style={{ backgroundColor: 'transparent' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Skeleton.Rect w={width} h={Math.max(200, height - 260) * 0.7} r={0} />
      </View>
      <View style={{ paddingHorizontal: space.gutter, paddingTop: space.md, paddingBottom: space.sm, gap: 6 }}>
        <Skeleton.Rect h={13} w={120} />
        <Skeleton.Rect h={14} w="60%" />
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: space.md }}>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton.Rect key={i} h={48} w={72} />
          ))}
        </View>
      </View>
    </Skeleton>
  );
}
