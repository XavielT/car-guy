import { useState } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Polygon, Rect } from 'react-native-svg';

import { useTheme } from '@/lib/theme/useTheme';

/**
 * 4 px of 45° hazard stripes (05-design-jdm.md §6): amber/black for urgente,
 * red/black for vencido. At most one per screen.
 *
 * Drawn as explicit parallelograms from the measured width, not an SVG
 * `<Pattern>`: patterns with a transform render differently on react-native-web
 * (the prompt's "watch for"), and a few dozen polygons are nothing to draw.
 */
export function HazardDivider({
  tone = 'urgente',
  height = 4,
  style,
}: {
  tone?: 'urgente' | 'vencido';
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const color = tone === 'vencido' ? theme.redline : theme.accentFill;
  const stripe = height * 2;

  const stripes = [];
  for (let x = -height; x < width + height; x += stripe * 2) {
    stripes.push(
      <Polygon
        key={x}
        points={`${x},${height} ${x + height},0 ${x + height + stripe},0 ${x + stripe},${height}`}
        fill={color}
      />,
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={[{ height, borderRadius: 1, overflow: 'hidden' }, style]}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Rect x={0} y={0} width={width} height={height} fill="#121212" />
          {stripes}
        </Svg>
      ) : null}
    </View>
  );
}
