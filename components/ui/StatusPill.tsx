import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';

/**
 * The four urgency states, in order. They mean the same thing on every screen —
 * reminders, inspections, history, documents — which is the point: a driver
 * learns one colour language, not seven.
 */
export type Status = 'ok' | 'proximo' | 'urgente' | 'vencido';

/**
 * `neutral` is not one of the four states — it is the absence of one, for a
 * reading that is simply unremarkable ("en tu promedio") or not yet
 * comparable. It gets the raised surface and secondary text rather than a
 * colour, so it cannot be mistaken for a verdict.
 */
export type Tone = Status | 'neutral';

/**
 * Dot plus label. The **only** way status is shown anywhere in Car Guy.
 *
 * The dot carries the colour and the label carries the meaning, so the pill
 * still reads for someone who cannot tell the four hues apart.
 */
export function StatusPill({
  status,
  label,
  style,
}: {
  status: Tone;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();

  // Vencido is the one lit-red lamp: a solid redline fill with white text
  // (4.97:1). Every other state is its hue at 16 % with the hue as text.
  const solid = status === 'vencido';
  const background =
    status === 'neutral' ? theme.bg.raised : solid ? theme.redline : theme.statusBg[status];
  const foreground =
    status === 'neutral' ? theme.text.secondary : solid ? '#FFFFFF' : theme.statusText[status];

  return (
    <View style={[styles.pill, { backgroundColor: background }, style]}>
      <View style={[styles.dot, { backgroundColor: foreground }]} />
      <T face="semibold" style={[styles.label, { color: foreground }]}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.chip,
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 999 },
  label: { fontSize: 13, letterSpacing: 0.3 },
});
