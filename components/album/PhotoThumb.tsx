import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius } from '@/constants/theme';
import { useMediaUri } from '@/lib/media/useMediaUri';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * One album cell: the 400 px thumb (never the full copy — egress is the tight
 * cloud limit), its blurhash while that loads, and `recyclingKey` so a recycled
 * cell never flashes the previous photo (research §6).
 */
export function PhotoThumb({
  mediaId,
  blurhash,
  size,
  height,
  onPress,
  onLongPress,
  accessibilityLabel,
  style,
  children,
  full,
}: {
  mediaId: string;
  blurhash?: string | null;
  size?: number;
  height?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** The full copy — for the hero and the viewer only. */
  full?: boolean;
}) {
  const { theme } = useTheme();
  const uri = useMediaUri(mediaId, { thumb: !full });
  const box = { width: size ?? '100%', height: height ?? size, backgroundColor: theme.bg.well } as const;

  const image = (
    <View style={[styles.cell, box, style]}>
      {uri || blurhash ? (
        <Image
          source={uri ? { uri } : undefined}
          placeholder={blurhash ? { blurhash } : undefined}
          placeholderContentFit="cover"
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={mediaId}
          transition={150}
          style={StyleSheet.absoluteFill}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {children}
    </View>
  );

  if (!onPress && !onLongPress) return image;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityRole="imagebutton" accessibilityLabel={accessibilityLabel}>
      {image}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: { borderRadius: radius.input, overflow: 'hidden' },
});
