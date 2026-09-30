import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The vehicle screens' twins (ADR-40): the hub and the pages it opens (álbum,
 * estado, build, ficha, compartir, libro, fluidos). Each mirrors its screen's
 * gutter padding and card heights so the content lands where its outline was.
 */

/** A bordered card with the screens' `radius.button` corners. */
function Box({ children, pad = space.md, gap = space.sm, mb = space.md }: { children: ReactNode; pad?: number; gap?: number; mb?: number }) {
  const { theme } = useTheme();
  return <View style={[styles.box, { borderColor: theme.line, backgroundColor: theme.bg.surface, padding: pad, gap, marginBottom: mb }]}>{children}</View>;
}

/** Eyebrow + 30 px display title + an intro line: the sub-pages' header. */
function PageTitle({ intro = true }: { intro?: boolean }) {
  return (
    <View style={{ gap: 8, marginBottom: space.md }}>
      <Skeleton.Rect h={11} w={120} />
      <Skeleton.Rect h={30} w="55%" />
      {intro ? <Skeleton.Lines n={2} lineHeight={13} lastWidth="70%" /> : null}
    </View>
  );
}

/** The hub: cover, name, subtitle, status row, the odometer LCD, the page tabs, two cards. */
export function VehicleHubSkeleton() {
  return (
    <Skeleton style={{ paddingTop: space.gutter }}>
      <Skeleton.Rect h={180} r={radius.card} style={{ marginBottom: space.lg }} />
      <View style={{ gap: 6 }}>
        <Skeleton.Rect h={28} w="60%" />
        <Skeleton.Rect h={13} w="45%" />
      </View>
      <View style={styles.statusRow}>
        <Skeleton.Rect h={26} w={90} r={radius.chip} />
        <Skeleton.Rect h={12} w={120} />
      </View>
      <Skeleton.Rect h={64} w={170} r={radius.button} style={{ marginTop: space.md }} />
      <View style={styles.tabs}>
        {[88, 72, 72, 64, 72].map((w, i) => (
          <Skeleton.Rect key={i} h={40} w={w} />
        ))}
      </View>
      <Skeleton.Card>
        <Skeleton.Rect h={11} w={100} />
        <Skeleton.Lines n={3} />
      </Skeleton.Card>
      <Skeleton.Tiles n={3} h={64} />
      <Skeleton.Card h={120} />
    </Skeleton>
  );
}

/** Álbum (inline, under its real header): a month header and a 3 × 4 grid of `cell` squares. */
export function VehicleAlbumSkeleton({ cell, gap = 6 }: { cell: number; gap?: number }) {
  return (
    <Skeleton padded={false} style={styles.inline}>
      <View style={styles.gridHeader}>
        <Skeleton.Rect h={18} w="35%" />
        <Skeleton.Rect h={11} w={60} />
      </View>
      {Array.from({ length: 4 }, (_, row) => (
        <View key={row} style={{ flexDirection: 'row', gap, marginBottom: gap }}>
          {Array.from({ length: 3 }, (_, col) => (
            <Skeleton.Rect key={col} w={cell} h={cell} r={radius.tag} />
          ))}
        </View>
      ))}
    </Skeleton>
  );
}

/** Estado en el tiempo: title, the month slider, the LCD, mods and specs cards, the photo grid. */
export function VehicleEstadoSkeleton({ cell }: { cell: number }) {
  return (
    <Skeleton style={{ paddingTop: space.gutter }}>
      <PageTitle intro={false} />
      <View style={styles.slider}>
        <Skeleton.Rect h={44} w={44} r={radius.button} />
        <Skeleton.Rect h={4} style={{ flex: 1 }} />
        <Skeleton.Rect h={44} w={44} r={radius.button} />
      </View>
      <Skeleton.Rect h={64} w={170} r={radius.button} style={styles.lcd} />
      <Skeleton.Card>
        <Skeleton.Rect h={11} w={80} />
        <Skeleton.Lines n={2} />
      </Skeleton.Card>
      <Skeleton.Card>
        <Skeleton.Rect h={11} w={80} />
        <Skeleton.Lines n={4} />
      </Skeleton.Card>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: space.md }}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton.Rect key={i} w={cell} h={cell} />
        ))}
      </View>
    </Skeleton>
  );
}

/** Build: title with the invested total, the four tab chips, the stock/actual card, mod rows. */
export function VehicleBuildSkeleton() {
  return (
    <Skeleton style={{ paddingTop: space.gutter }}>
      <View style={styles.buildHeader}>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton.Rect h={11} w={120} />
          <Skeleton.Rect h={34} w="50%" />
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Skeleton.Rect h={16} w={90} />
          <Skeleton.Rect h={11} w={110} />
        </View>
      </View>
      <View style={[styles.chips, { marginVertical: space.md }]}>
        {[64, 72, 84, 88].map((w, i) => (
          <Skeleton.Rect key={i} h={36} w={w} r={radius.chip} />
        ))}
      </View>
      <Skeleton.Card h={132} />
      <Skeleton.Rect h={11} w={110} style={{ marginVertical: space.sm }} />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton.Row key={i} leading={false} />
      ))}
    </Skeleton>
  );
}

/** Ficha técnica: title and caveat, the two buttons, then section cards of 48 px field rows. */
export function VehicleFichaSkeleton() {
  return (
    <Skeleton style={{ paddingTop: space.gutter }}>
      <PageTitle intro={false} />
      <View style={[styles.pair, { marginBottom: space.md }]}>
        <Skeleton.Rect h={44} r={radius.button} style={{ flex: 1 }} />
        <Skeleton.Rect h={44} r={radius.button} style={{ flex: 1 }} />
      </View>
      {[4, 3].map((n, i) => (
        <Box key={i} pad={space.md} gap={0}>
          <Skeleton.Rect h={11} w={100} style={{ marginVertical: 6 }} />
          {Array.from({ length: n }, (_, j) => (
            <View key={j} style={styles.fieldRow}>
              <Skeleton.Rect h={13} w="40%" />
              <Skeleton.Rect h={13} w={70} />
            </View>
          ))}
        </Box>
      ))}
    </Skeleton>
  );
}

/**
 * Compartir and Libro: title and intro, a three-way switch, then a card of
 * switch rows (`rows`, one per section flag).
 */
export function VehicleSwitchesSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Skeleton style={{ paddingTop: space.gutter }}>
      <PageTitle />
      <Skeleton.Rect h={44} r={radius.input} style={{ marginBottom: space.lg }} />
      <Skeleton.Rect h={11} w={90} style={{ marginBottom: space.sm }} />
      <Box pad={space.md} gap={0}>
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} style={styles.switchRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Skeleton.Rect h={14} w="55%" />
              <Skeleton.Rect h={11} w="75%" />
            </View>
            <Skeleton.Rect h={26} w={44} r={radius.chip} />
          </View>
        ))}
      </Box>
    </Skeleton>
  );
}

/** Fluidos: title and hint, then fluid cards (label, 160 px photo, how-to lines, notes field). */
export function VehicleFluidsSkeleton() {
  return (
    <Skeleton style={{ paddingTop: space.gutter }}>
      <PageTitle />
      {Array.from({ length: 2 }, (_, i) => (
        <Box key={i}>
          <Skeleton.Rect h={17} w="40%" />
          <Skeleton.Rect h={160} r={radius.input} />
          <Skeleton.Lines n={2} lineHeight={13} />
          <Skeleton.Rect h={48} r={radius.input} />
        </Box>
      ))}
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  inline: { flex: 0, backgroundColor: 'transparent' },
  box: { borderWidth: 1, borderRadius: radius.button },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  tabs: { flexDirection: 'row', gap: space.sm, paddingVertical: space.sm, marginTop: space.lg, marginBottom: space.sm, overflow: 'hidden' },
  gridHeader: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slider: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  lcd: { alignSelf: 'center', marginVertical: space.lg },
  buildHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pair: { flexDirection: 'row', gap: space.sm },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 8 },
});
