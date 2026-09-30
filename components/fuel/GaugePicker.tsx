import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { T } from '@/components/T';
import { Chip } from '@/components/ui';
import { space } from '@/constants/theme';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';

/** E, 1/8 … 7/8, F — what the gauge's eighth reads as. */
export function gaugeLabel(eighths: number): string {
  if (eighths <= 0) return 'E';
  if (eighths >= 8) return 'F';
  const [n, d] = eighths % 4 === 0 ? [eighths / 4, 2] : eighths % 2 === 0 ? [eighths / 2, 4] : [eighths, 8];
  return `${n}/${d}`;
}

const W = 280;
const R = 112;
const CX = W / 2;
const CY = R + 22;
const HIT = 44;

/** Stop i of 0…8 on the arc, left (E) to right (F). */
function stop(i: number, r = R) {
  const a = Math.PI - (i / 8) * Math.PI;
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
}

/**
 * A fuel gauge you tap (note 4): nine stops from E to F on an arc, the needle
 * on the chosen one, its reading under it. Tapping the chosen stop clears it —
 * both readings are optional. With `reserve`, the "En reserva" chip replaces
 * the reading: the arc greys out and the label says RESERVA (in_reserve wins
 * over gauge_before, research 02 §1.7).
 */
export function GaugePicker({
  label,
  value,
  onChange,
  reserve,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  reserve?: { on: boolean; onToggle: (on: boolean) => void };
}) {
  const { theme } = useTheme();
  const disabled = Boolean(reserve?.on);
  // Note 12: with only the reserve light on, the needle rests at E (the estimate uses the reserve volume).
  const needle = disabled ? stop(0, R - 26) : value != null ? stop(value, R - 26) : null;
  const arc = `M ${stop(0).x} ${stop(0).y} A ${R} ${R} 0 0 1 ${stop(8).x} ${stop(8).y}`;
  const reading = disabled ? es.gauge.reserveShort : value == null ? es.gauge.unset : gaugeLabel(value);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <T face="eyebrow" style={{ color: theme.text.secondary, fontSize: 12 }}>
          {label}
        </T>
        {reserve ? <Chip label={es.gauge.reserveOnly} selected={reserve.on} onPress={() => reserve.onToggle(!reserve.on)} /> : null}
      </View>
      {reserve?.on ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17, marginBottom: space.xs }}>
          {es.gauge.reserveOnlyHint}
        </T>
      ) : null}
      <View style={[styles.dial, { opacity: disabled ? 0.4 : 1 }]} accessibilityRole="adjustable" accessibilityLabel={`${label}: ${reading}`}>
        <Svg width={W} height={CY + 8}>
          <Path d={arc} stroke={theme.line} strokeWidth={6} fill="none" strokeLinecap="round" />
          {/* The first quarter in the warning colour, like the car's own gauge. */}
          <Path
            d={`M ${stop(0).x} ${stop(0).y} A ${R} ${R} 0 0 1 ${stop(1).x} ${stop(1).y}`}
            stroke={theme.danger}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
          />
          {Array.from({ length: 9 }, (_, i) => {
            const a = stop(i, R - 10);
            const b = stop(i, R + 2);
            return <Line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={theme.text.muted} strokeWidth={i % 4 === 0 ? 3 : 1.5} />;
          })}
          {needle ? <Line x1={CX} y1={CY} x2={needle.x} y2={needle.y} stroke={theme.accent} strokeWidth={4} strokeLinecap="round" /> : null}
        </Svg>
        {Array.from({ length: 9 }, (_, i) => {
          const p = stop(i);
          const on = value === i && !disabled;
          return (
            <Pressable
              key={i}
              disabled={disabled}
              onPress={() => onChange(on ? null : i)}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${gaugeLabel(i)}`}
              accessibilityState={{ selected: on, disabled }}
              style={[styles.hit, { left: p.x - HIT / 2, top: p.y - HIT / 2 }]}>
              <View style={[styles.dot, { backgroundColor: on ? theme.accent : theme.bg.raised, borderColor: on ? theme.accent : theme.lineStrong }]} />
            </Pressable>
          );
        })}
        <View style={styles.readout} pointerEvents="none">
          <T face="mono" style={{ color: value == null && !disabled ? theme.text.muted : theme.text.primary, fontSize: 18 }}>
            {reading}
          </T>
        </View>
        <T face="eyebrow" style={[styles.end, { left: stop(0).x - 16, color: theme.text.muted }]}>
          E
        </T>
        <T face="eyebrow" style={[styles.end, { left: stop(8).x + 4, color: theme.text.muted }]}>
          F
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 },
  dial: { width: W, height: CY + 8, alignSelf: 'center' },
  hit: { position: 'absolute', width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  readout: { position: 'absolute', left: 0, right: 0, top: CY - 34, alignItems: 'center' },
  end: { position: 'absolute', top: CY - 6, fontSize: 11 },
});
