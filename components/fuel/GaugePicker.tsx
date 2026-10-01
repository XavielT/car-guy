import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { T } from '@/components/T';
import { Chip } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { hitTestSegment, PERCENT_STEP, snapPercent, stepsFor, type GaugeCfg } from '@/lib/domain/gauge';
import { t } from '@/lib/i18n';
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

/** One haptic tick per step (native only — the web build must not reach for haptics). */
function tick() {
  if (Platform.OS === 'web') return;
  void import('expo-haptics')
    .then((H) => H.selectionAsync())
    .catch(() => {});
}

type ReserveToggle = { on: boolean; onToggle: (on: boolean) => void };

/**
 * The fill-up form's gauge (IMP 01102026 Phase 3, research 03 §5): the car's own dash — a needle in eighths,
 * N squares, or a percent — over one value, the reading as a fraction 0..1 (null = not read). "Solo la luz
 * de reserva" is there for every type.
 */
export function GaugePicker({
  label,
  cfg,
  value,
  onChange,
  reserve,
}: {
  label: string;
  cfg: GaugeCfg;
  value: number | null;
  onChange: (frac: number | null) => void;
  reserve?: ReserveToggle;
}) {
  if (cfg.type === 'segments' && cfg.segments) {
    return <SegmentsPicker label={label} n={cfg.segments} value={value} onChange={onChange} reserve={reserve} />;
  }
  if (cfg.type === 'percent') return <PercentPicker label={label} value={value} onChange={onChange} reserve={reserve} />;
  return (
    <NeedlePicker
      label={label}
      value={value == null ? null : Math.round(value * 8)}
      onChange={(n) => onChange(n == null ? null : n / 8)}
      reserve={reserve}
    />
  );
}

function Head({ label, reserve }: { label: string; reserve?: ReserveToggle }) {
  const { theme } = useTheme();
  return (
    <>
      <View style={styles.head}>
        <T face="eyebrow" style={{ color: theme.text.secondary, fontSize: 12 }}>
          {label}
        </T>
        {reserve ? <Chip label={t.gauge.reserveOnly} selected={reserve.on} onPress={() => reserve.onToggle(!reserve.on)} /> : null}
      </View>
      {reserve?.on ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17, marginBottom: space.xs }}>
          {t.gauge.reserveOnlyHint}
        </T>
      ) : null}
    </>
  );
}

const GAP = 4;
const MAX_SQUARE = 28;

/** The squares row alone (also the vehicle form's live preview). Lowest square always red, like the dash. */
export function SegmentsRow({ n, lit, dim, width }: { n: number; lit: number | null; dim?: boolean; width: number }) {
  const { theme } = useTheme();
  const size = Math.max(6, Math.min(MAX_SQUARE, (width - GAP * (n - 1)) / n));
  return (
    <View style={{ flexDirection: 'row', gap: GAP, opacity: dim ? 0.4 : 1 }} pointerEvents="none">
      {Array.from({ length: n }, (_, i) => {
        const on = lit != null && i < lit;
        const color = i === 0 ? theme.danger : theme.accent;
        return (
          <View
            key={i}
            style={{ width: size, height: Math.max(18, size * 1.25), borderRadius: 4, borderWidth: 2, borderColor: color, backgroundColor: on ? color : 'transparent' }}
          />
        );
      })}
    </View>
  );
}

/**
 * N squares you tap or drag (research §5): tap square i → i lit; tapping the top lit one again → i − 1 (so 0
 * is reachable); a drag sets k = round(x/W·N). The whole row is the hit area, so 20 squares stay usable.
 */
export function SegmentsPicker({
  label,
  n,
  value,
  onChange,
  reserve,
}: {
  label: string;
  n: number;
  value: number | null;
  onChange: (frac: number | null) => void;
  reserve?: ReserveToggle;
}) {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const disabled = Boolean(reserve?.on);
  const k = value == null ? null : Math.round(value * n);
  const startX = useRef(0);
  const moved = useRef(false);
  const lastK = useRef<number | null>(k);

  const rowWidth = Math.min(width, n * MAX_SQUARE + GAP * (n - 1));
  const set = (next: number) => {
    if (next !== lastK.current) tick();
    lastK.current = next;
    onChange(next / n);
  };
  const xOf = (e: GestureResponderEvent) => e.nativeEvent.locationX;
  const caption = disabled ? t.gauge.reserveShort : k == null ? t.gauge.unset : t.gauge.ofSegments(k, n);

  return (
    <View style={styles.wrap}>
      <Head label={label} reserve={reserve} />
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={styles.segmentsWrap}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        accessibilityValue={{ min: 0, max: n, now: k ?? 0, text: k == null ? t.gauge.unset : t.gauge.ofSegmentsA11y(k, n) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (disabled) return;
          const cur = k ?? 0;
          if (e.nativeEvent.actionName === 'increment') set(Math.min(n, cur + 1));
          if (e.nativeEvent.actionName === 'decrement') set(Math.max(0, cur - 1));
        }}>
        <View
          style={{ width: rowWidth || undefined, paddingVertical: space.sm }}
          onStartShouldSetResponder={() => !disabled}
          onMoveShouldSetResponder={() => !disabled}
          onResponderGrant={(e) => {
            startX.current = xOf(e);
            moved.current = false;
            lastK.current = k;
          }}
          onResponderMove={(e) => {
            if (Math.abs(xOf(e) - startX.current) < 6 && !moved.current) return;
            moved.current = true;
            const next = hitTestSegment(xOf(e), rowWidth, n);
            if (next != null && next !== lastK.current) set(next);
          }}
          onResponderRelease={(e) => {
            if (moved.current || !(rowWidth > 0)) return;
            const square = Math.min(n, Math.max(1, Math.floor((xOf(e) / rowWidth) * n) + 1));
            set(square === k ? square - 1 : square);
          }}>
          {rowWidth > 0 ? <SegmentsRow n={n} lit={disabled ? 0 : k} dim={disabled} width={rowWidth} /> : null}
        </View>
        <View style={styles.segmentsEnds} pointerEvents="none">
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
            E
          </T>
          <T face="mono" style={{ color: k == null && !disabled ? theme.text.muted : theme.text.primary, fontSize: 18 }}>
            {caption}
          </T>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
            F
          </T>
        </View>
      </View>
    </View>
  );
}

/** A 0–100 % track in 5 % steps with an LCD readout (research §5); tap or drag anywhere on it. */
export function PercentPicker({
  label,
  value,
  onChange,
  reserve,
}: {
  label: string;
  value: number | null;
  onChange: (frac: number | null) => void;
  reserve?: ReserveToggle;
}) {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const disabled = Boolean(reserve?.on);
  const pct = value == null ? null : snapPercent(value * 100);
  const last = useRef<number | null>(pct);
  const at = (e: GestureResponderEvent) => {
    if (!(width > 0)) return;
    const p = snapPercent((e.nativeEvent.locationX / width) * 100);
    if (p == null || p === last.current) return;
    tick();
    last.current = p;
    onChange(p / 100);
  };
  const step = (d: number) => {
    const p = snapPercent((pct ?? 0) + d * PERCENT_STEP);
    if (p != null) onChange(p / 100);
  };

  return (
    <View style={styles.wrap}>
      <Head label={label} reserve={reserve} />
      <View
        style={{ opacity: disabled ? 0.4 : 1 }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        accessibilityValue={{ min: 0, max: 100, now: pct ?? 0, text: pct == null ? t.gauge.unset : t.gauge.percentA11y(pct) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => !disabled && step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}>
        <View style={[styles.lcd, { backgroundColor: theme.bg.raised, borderColor: theme.line }]}>
          <T face="mono" style={{ color: pct == null && !disabled ? theme.text.muted : theme.accent, fontSize: 22 }}>
            {disabled ? t.gauge.reserveShort : pct == null ? t.gauge.unset : `${pct} %`}
          </T>
        </View>
        <View
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          style={styles.track}
          onStartShouldSetResponder={() => !disabled}
          onMoveShouldSetResponder={() => !disabled}
          onResponderGrant={(e) => {
            last.current = pct;
            at(e);
          }}
          onResponderMove={at}>
          <View style={[styles.rail, { backgroundColor: theme.line }]} pointerEvents="none">
            <View style={{ width: `${pct ?? 0}%`, height: '100%', backgroundColor: (pct ?? 0) <= 20 ? theme.danger : theme.accent, borderRadius: 3 }} />
          </View>
          {pct != null && !disabled ? (
            <View pointerEvents="none" style={[styles.thumb, { left: `${pct}%`, backgroundColor: theme.accent, borderColor: theme.bg.base }]} />
          ) : null}
        </View>
        <View style={styles.segmentsEnds} pointerEvents="none">
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
            0 %
          </T>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
            100 %
          </T>
        </View>
      </View>
    </View>
  );
}

/** The number of steps on this car's gauge (the needle's 8 when unset or invalid). */
export function gaugeSteps(cfg: GaugeCfg): number {
  return stepsFor(cfg) ?? 8;
}

/**
 * The needle (note 4): nine stops from E to F on an arc, the needle
 * on the chosen one, its reading under it. Tapping the chosen stop clears it —
 * both readings are optional. With `reserve`, the "En reserva" chip replaces
 * the reading: the arc greys out and the label says RESERVA (in_reserve wins
 * over gauge_before, research 02 §1.7).
 */
function NeedlePicker({
  label,
  value,
  onChange,
  reserve,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  reserve?: ReserveToggle;
}) {
  const { theme } = useTheme();
  const disabled = Boolean(reserve?.on);
  // Note 12: with only the reserve light on, the needle rests at E (the estimate uses the reserve volume).
  const needle = disabled ? stop(0, R - 26) : value != null ? stop(value, R - 26) : null;
  const arc = `M ${stop(0).x} ${stop(0).y} A ${R} ${R} 0 0 1 ${stop(8).x} ${stop(8).y}`;
  const reading = disabled ? t.gauge.reserveShort : value == null ? t.gauge.unset : gaugeLabel(value);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <T face="eyebrow" style={{ color: theme.text.secondary, fontSize: 12 }}>
          {label}
        </T>
        {reserve ? <Chip label={t.gauge.reserveOnly} selected={reserve.on} onPress={() => reserve.onToggle(!reserve.on)} /> : null}
      </View>
      {reserve?.on ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17, marginBottom: space.xs }}>
          {t.gauge.reserveOnlyHint}
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
  segmentsWrap: { alignItems: 'center', paddingVertical: space.xs },
  segmentsEnds: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch', marginTop: 2 },
  lcd: { alignSelf: 'center', minWidth: 120, alignItems: 'center', paddingVertical: space.xs, paddingHorizontal: space.md, borderRadius: radius.input, borderWidth: 1, marginBottom: space.sm },
  track: { height: 44, justifyContent: 'center' },
  rail: { height: 6, borderRadius: 3, overflow: 'hidden' },
  thumb: { position: 'absolute', width: 22, height: 22, marginLeft: -11, borderRadius: 11, borderWidth: 3 },
  end: { position: 'absolute', top: CY - 6, fontSize: 11 },
});
