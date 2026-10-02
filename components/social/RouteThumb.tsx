import Svg, { Path } from 'react-native-svg';

import { decodeShareRoute, routePaths } from '@/lib/social/route';
import { useTheme } from '@/lib/theme/useTheme';

/** A shared route drawn on its own (no map tiles): the trimmed pieces only, never joined. */
export function RouteThumb({ route, width, height, color }: { route: string; width: number; height: number; color?: string }) {
  const { theme } = useTheme();
  const paths = routePaths(decodeShareRoute(route), width, height);
  return (
    <Svg width={width} height={height} accessible={false}>
      {paths.map((d, i) => (
        <Path key={i} d={d} stroke={color ?? theme.accentFill} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}
