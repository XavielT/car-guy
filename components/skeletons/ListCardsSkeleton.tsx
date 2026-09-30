import type { ReactNode } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The list twins (ADR-40) for screens whose header is real text and whose
 * list is what loads: documentos, recordatorios, tareas, compartidos,
 * contactos, pista, obd, exportar, the report summary, the catalogue. They
 * render inline (`padded={false}`), in the slot the list will fill, so the
 * header never moves and the first card lands where its outline was.
 */

/** A bordered card outline with the real card's padding and radius. */
export function OutlineCard({ children, pad = space.lg, r = radius.card, spacing = space.sm, style }: { children: ReactNode; pad?: number; r?: number; spacing?: number; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return <View style={[styles.card, { borderColor: theme.line, backgroundColor: theme.bg.surface, padding: pad, borderRadius: r, marginBottom: spacing }, style]}>{children}</View>;
}

type CardsProps = {
  /** How many cards. */
  n?: number;
  /** A small eyebrow bar above the title (event cards, run rows). */
  eyebrow?: boolean;
  /** A status pill at the end of the title row. */
  pill?: boolean;
  /** Caption lines under the title. */
  lines?: number;
  /** Buttons along the bottom (1 = a full-width button, 2 = a pair). */
  buttons?: number;
  /** Card padding: Surface is space.lg, the smaller list rows space.md. */
  pad?: number;
  r?: number;
  /** The space between cards (marginBottom, or the parent's gap). */
  spacing?: number;
  /** A section eyebrow above the cards (recordatorios' groups, contactos' kinds). */
  section?: boolean;
  titleWidth?: DimensionValue;
  style?: StyleProp<ViewStyle>;
};

export function ListCardsSkeleton({ n = 4, eyebrow, pill, lines = 1, buttons = 0, pad, r, spacing = space.sm, section, titleWidth = '60%', style }: CardsProps) {
  return (
    <Skeleton padded={false} style={style}>
      {section ? <Skeleton.Rect h={10} w={110} style={styles.section} /> : null}
      {Array.from({ length: n }, (_, i) => (
        <OutlineCard key={i} pad={pad} r={r} spacing={spacing}>
          {eyebrow ? <Skeleton.Rect h={10} w="45%" style={{ marginBottom: 8 }} /> : null}
          <View style={styles.head}>
            <Skeleton.Rect h={16} w={titleWidth} />
            {pill ? <Skeleton.Rect h={24} w={84} r={radius.chip} /> : null}
          </View>
          {lines > 0 ? <Skeleton.Lines n={lines} lineHeight={12} gap={6} lastWidth="40%" style={{ marginTop: 8 }} /> : null}
          {buttons > 0 ? (
            <View style={styles.buttons}>
              {Array.from({ length: buttons }, (_, b) => (
                <Skeleton.Rect key={b} h={buttons > 1 ? 44 : 52} r={radius.button} style={{ flex: 1 }} />
              ))}
            </View>
          ) : null}
        </OutlineCard>
      ))}
    </Skeleton>
  );
}

/** NavRow outlines: label + caption rows, the NavRow's radius and height. */
export function ListNavSkeleton({ n = 8, style }: { n?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Skeleton padded={false} style={style}>
      {Array.from({ length: n }, (_, i) => (
        <OutlineCard key={i} pad={space.md + 2} r={radius.input} spacing={space.sm} style={{ paddingHorizontal: space.lg, minHeight: 56 }}>
          <Skeleton.Rect h={15} w="55%" />
          <Skeleton.Rect h={12} w="35%" style={{ marginTop: 6 }} />
        </OutlineCard>
      ))}
    </Skeleton>
  );
}

/** A summary Surface of key–value rows (the report card): eyebrow, range, rule, rows. */
export function ListKeyValueSkeleton({ rows = 4, style }: { rows?: number; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return (
    <Skeleton padded={false} style={style}>
      <OutlineCard spacing={0}>
        <Skeleton.Rect h={10} w="40%" />
        <Skeleton.Rect h={12} w="60%" style={{ marginTop: 6 }} />
        <View style={[styles.rule, { backgroundColor: theme.line }]} />
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} style={styles.kv}>
            <Skeleton.Rect h={13} w="35%" />
            <Skeleton.Rect h={i === 0 ? 20 : 14} w={i === 0 ? 110 : 72} />
          </View>
        ))}
      </OutlineCard>
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  buttons: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  section: { marginTop: space.xl, marginBottom: space.sm },
  rule: { height: 1, marginVertical: space.md },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
});
