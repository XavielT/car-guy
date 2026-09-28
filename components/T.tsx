import { fonts } from '@/constants/theme';
import { StyleSheet, Text, type TextProps } from 'react-native';

/**
 * Every face in the identity (05-design-jdm.md "Typography"). Legacy call
 * sites keep compiling: display/title/body/medium/semibold/mono/monoBold keep
 * their names and moved to Saira Condensed / Rajdhani.
 *
 * - `eyebrow`: Saira Condensed 400, uppercase, tracked +0.16em — section labels.
 * - `badge`: Michroma, uppercase, tracked +0.12em — the wordmark and badges only.
 * - `kana`: Noto Sans JP (subset) — the few kanji accents, small and muted.
 */
export type Face =
  | 'display'
  | 'title'
  | 'eyebrow'
  | 'body'
  | 'medium'
  | 'semibold'
  | 'mono'
  | 'monoBold'
  | 'badge'
  | 'kana';

const map: Record<Face, string> = {
  display: fonts.display,
  title: fonts.title,
  eyebrow: fonts.eyebrow,
  body: fonts.body,
  medium: fonts.medium,
  semibold: fonts.semibold,
  mono: fonts.mono,
  monoBold: fonts.monoBold,
  badge: fonts.badge,
  kana: fonts.kana,
};

/** Tracking is in em in the spec; RN wants points, so it scales with the size. */
const TRACKED: Partial<Record<Face, number>> = { eyebrow: 0.16, badge: 0.12 };

export function T({
  face = 'body',
  style,
  ...rest
}: TextProps & { face?: Face }) {
  const tracking = TRACKED[face];
  if (tracking == null) return <Text {...rest} style={[{ fontFamily: map[face] }, style]} />;

  const size = StyleSheet.flatten(style)?.fontSize ?? 11;
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: map[face], fontSize: size, textTransform: 'uppercase', letterSpacing: size * tracking },
        style,
      ]}
    />
  );
}

