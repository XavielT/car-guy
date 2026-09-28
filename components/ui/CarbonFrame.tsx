import { Asset } from 'expo-asset';
import type { ReactNode } from 'react';
import { Image, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/lib/theme/useTheme';

const CARBON = require('../../assets/images/carbon.png');

/**
 * Carbon twill as trim (05-design-jdm.md §7): behind a card header, a gauge
 * bezel or an avatar frame — the *frame* only. Never put text straight on it;
 * give the content its own panel (the anti-pattern list: "texture under text").
 *
 * One tiled PNG (tools/make-icons.mjs, 1× and 2×) on every platform, rather
 * than an SVG `<Pattern>`: react-native-web renders patterns with a transform
 * differently. Native repeats it with `resizeMode="repeat"`; on web that draws
 * a single tile, so it is a plain CSS background there.
 */
export function CarbonFrame({
  children,
  style,
  opacity,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Defaults to the theme's carbonOpacity (8 % dark, 6 % light). */
  opacity?: number;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.frame, style]}>
      {Platform.OS === 'web' ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: opacity ?? theme.carbonOpacity,
              backgroundImage: `url(${Asset.fromModule(CARBON).uri})`,
              backgroundRepeat: 'repeat',
              backgroundSize: '8px 8px',
            } as ViewStyle,
          ]}
        />
      ) : (
        <Image
          source={CARBON}
          resizeMode="repeat"
          style={[StyleSheet.absoluteFill, { opacity: opacity ?? theme.carbonOpacity, width: '100%', height: '100%' }]}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
});
