import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { fonts } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';

/**
 * A hanko stamp (05-design-jdm.md §8): 2 px redline ring, turned −4°, holding
 * an initial in Michroma or a single kanji (車 / 改) in Noto Sans JP. Used as
 * the avatar and as the "registrado" stamp on finished work.
 */
export function Hanko({
  char,
  size = 44,
  shape = 'circle',
  style,
  accessibilityLabel,
}: {
  /** One character: an initial or one kanji from the ADR-16 list. */
  char: string;
  size?: number;
  shape?: 'circle' | 'square';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { theme } = useTheme();
  const kanji = /[぀-ヿ一-鿿]/.test(char);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? char}
      style={[
        styles.stamp,
        {
          width: size,
          height: size,
          borderRadius: shape === 'circle' ? size / 2 : size * 0.18,
          borderColor: theme.redline,
        },
        style,
      ]}>
      <T
        face="badge"
        style={{
          color: theme.redlineText,
          fontSize: size * (kanji ? 0.5 : 0.42),
          letterSpacing: 0,
          lineHeight: size * 0.7,
          ...(kanji ? { fontFamily: fonts.kanaBold, textTransform: 'none' } : null),
        }}>
        {char.slice(0, 1)}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
  },
});
