import { fonts } from '@/constants/theme';
import { Text, type TextProps } from 'react-native';

type Face = 'display' | 'title' | 'body' | 'medium' | 'semibold' | 'bold' | 'mono' | 'monoBold';

const map: Record<Face, string> = {
  display: fonts.display,
  title: fonts.title,
  body: fonts.body,
  medium: fonts.medium,
  semibold: fonts.semibold,
  bold: fonts.bold,
  mono: fonts.mono,
  monoBold: fonts.monoBold,
};

export function T({
  face = 'body',
  style,
  ...rest
}: TextProps & { face?: Face }) {
  return <Text {...rest} style={[{ fontFamily: map[face] }, style]} />;
}
