import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { radius, space } from '@/constants/theme';

/**
 * The twin of a one-record detail screen (gasto, servicio, tarea, documento,
 * recordatorio — ADR-40): the kind pill, the big uppercase title, the mono
 * meta line, an optional photo, the cards and the action buttons, at the
 * screens' own `padding: space.gutter`.
 */
export function RecordSkeleton({
  pill = false,
  stamp = false,
  meta = true,
  photo = false,
  cards = [72],
  chips = 0,
  buttons = 2,
}: {
  /** The coloured kind pill above the title. */
  pill?: boolean;
  /** The 44 px hanko square beside the title. */
  stamp?: boolean;
  meta?: boolean;
  photo?: boolean;
  /** One card outline per entry, at that height. */
  cards?: number[];
  /** A row of status chips (tarea). */
  chips?: number;
  buttons?: number;
}) {
  return (
    <Skeleton style={styles.root}>
      {pill ? <Skeleton.Rect w={112} h={22} r={radius.chip} style={{ marginBottom: space.sm }} /> : null}
      <View style={styles.titleRow}>
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton.Rect h={26} w="75%" />
          {meta ? <Skeleton.Rect h={12} w="50%" /> : null}
        </View>
        {stamp ? <Skeleton.Rect w={44} h={44} r={radius.tag} /> : null}
      </View>
      {photo ? <Skeleton.Rect h={180} r={radius.card} style={{ marginBottom: space.md }} /> : null}
      {cards.map((h, i) => (
        <Skeleton.Card key={i} h={h} />
      ))}
      {chips ? (
        <View style={styles.chips}>
          {Array.from({ length: chips }, (_, i) => (
            <Skeleton.Rect key={i} w={104} h={44} r={radius.chip} />
          ))}
        </View>
      ) : null}
      <View style={{ gap: space.sm }}>
        {Array.from({ length: buttons }, (_, i) => (
          <Skeleton.Rect key={i} h={52} r={radius.button} />
        ))}
      </View>
    </Skeleton>
  );
}

/**
 * The twin of a finished check (inspeccion/[id]): the result ring, the title
 * with its stamp, then a stack of result cards.
 */
export function RecordCheckSkeleton() {
  return (
    <Skeleton style={styles.root}>
      <View style={styles.hero}>
        <Skeleton.Circle size={132} />
      </View>
      <View style={styles.titleRow}>
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton.Rect h={26} w="65%" />
          <Skeleton.Rect h={14} w="45%" />
          <Skeleton.Rect h={12} w="55%" />
        </View>
        <Skeleton.Rect w={44} h={44} r={radius.tag} />
      </View>
      {[88, 88, 64, 64].map((h, i) => (
        <Skeleton.Card key={i} h={h} />
      ))}
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: space.gutter },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.lg },
  hero: { alignItems: 'center', marginBottom: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
});
