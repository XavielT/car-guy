import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { SegmentsRow } from '@/components/fuel/GaugePicker';
import { T } from '@/components/T';
import { Chip } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { MAX_SEGMENTS, MIN_SEGMENTS, type GaugeType } from '@/lib/domain/gauge';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

export type GaugeTypeValue = { type: GaugeType; segments: number; reserveAt: number | null };

/** The default square count when someone picks "cuadritos" (research §5). */
export const DEFAULT_SEGMENTS = 8;

/**
 * "¿Cómo marca la gasolina tu carro?" (IMP 01102026 Phase 3, research 03 §5): three illustrated cards, then
 * for squares a stepper 3–20 with a live preview and "¿Cuándo se prende la luz de reserva?". The reserve
 * answer is in the gauge's own steps (squares; eighths for a needle is not asked — the reserve liters field
 * already covers it).
 */
export function GaugeTypeSection({ value, onChange }: { value: GaugeTypeValue; onChange: (next: GaugeTypeValue) => void }) {
  const { theme } = useTheme();
  const [previewWidth, setPreviewWidth] = useState(0);
  const set = (patch: Partial<GaugeTypeValue>) => onChange({ ...value, ...patch });
  const n = value.segments;

  const card = (type: GaugeType, art: React.ReactNode) => {
    const on = value.type === type;
    return (
      <Pressable
        key={type}
        onPress={() => set({ type, reserveAt: type === value.type ? value.reserveAt : null })}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        accessibilityLabel={t.gauge.types[type]}
        style={[styles.card, { borderColor: on ? theme.accent : theme.line, backgroundColor: on ? theme.bg.raised : 'transparent' }]}>
        <View style={styles.art}>{art}</View>
        <T face="semibold" style={{ color: on ? theme.text.primary : theme.text.secondary, fontSize: 13 }}>
          {t.gauge.types[type]}
        </T>
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap}>
      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: 4 }}>
        {t.gauge.typeTitle}
      </T>
      <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17, marginBottom: space.sm }}>
        {t.gauge.typeHint}
      </T>
      <View style={styles.cards}>
        {card(
          'needle8',
          <Svg width={44} height={26}>
            <Path d="M 4 24 A 18 18 0 0 1 40 24" stroke={theme.text.muted} strokeWidth={3} fill="none" strokeLinecap="round" />
            <Path d="M 22 24 L 33 12" stroke={theme.accent} strokeWidth={3} strokeLinecap="round" />
          </Svg>,
        )}
        {card(
          'segments',
          <Svg width={44} height={26}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Rect key={i} x={2 + i * 8.5} y={8} width={6.5} height={12} rx={1.5} fill={i === 0 ? theme.danger : i < 3 ? theme.accent : 'none'} stroke={i === 0 ? theme.danger : theme.accent} strokeWidth={1.5} />
            ))}
          </Svg>,
        )}
        {card(
          'percent',
          <T face="mono" style={{ color: theme.accent, fontSize: 16 }}>
            45 %
          </T>,
        )}
      </View>

      {value.type === 'segments' ? (
        <View style={{ marginTop: space.md }}>
          <View style={styles.stepRow}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 14, flex: 1 }}>
              {t.gauge.segmentsCount}
            </T>
            <Stepper value={n} min={MIN_SEGMENTS} max={MAX_SEGMENTS} onChange={(segments) => set({ segments, reserveAt: value.reserveAt != null && value.reserveAt >= segments ? null : value.reserveAt })} />
          </View>
          <View onLayout={(e) => setPreviewWidth(e.nativeEvent.layout.width)} style={{ marginVertical: space.sm, alignItems: 'center' }}>
            {previewWidth > 0 ? <SegmentsRow n={n} lit={n} width={previewWidth} /> : null}
          </View>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17 }}>
            {t.gauge.segmentsHint}
          </T>

          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.md, marginBottom: space.xs }}>
            {t.gauge.reserveAtTitle}
          </T>
          <View style={styles.chips}>
            {(
              [
                [2, t.gauge.reserveAt.two],
                [1, t.gauge.reserveAt.one],
                [0, t.gauge.reserveAt.zero],
                [null, t.gauge.reserveAt.unknown],
              ] as [number | null, string][]
            ).map(([k, label]) => (
              <Chip key={String(k)} label={label} selected={value.reserveAt === k} onPress={() => set({ reserveAt: k })} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  const { theme } = useTheme();
  const button = (label: string, next: number, a11y: string) => (
    <Pressable
      onPress={() => onChange(next)}
      disabled={next < min || next > max}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={8}
      style={[styles.stepBtn, { borderColor: theme.line, opacity: next < min || next > max ? 0.35 : 1 }]}>
      <T face="semibold" style={{ color: theme.text.primary, fontSize: 18 }}>
        {label}
      </T>
    </Pressable>
  );
  return (
    <View style={styles.stepper} accessibilityRole="adjustable" accessibilityValue={{ min, max, now: value }}>
      {button('−', value - 1, `${value - 1}`)}
      <T face="mono" style={{ color: theme.text.primary, fontSize: 18, minWidth: 32, textAlign: 'center' }}>
        {value}
      </T>
      {button('+', value + 1, `${value + 1}`)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  cards: { flexDirection: 'row', gap: space.sm },
  card: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: space.sm, borderWidth: 1.5, borderRadius: radius.card, minHeight: 72 },
  art: { height: 28, justifyContent: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
