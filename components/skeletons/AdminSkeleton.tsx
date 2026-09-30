import { StyleSheet, View } from 'react-native';

import { OutlineCard } from '@/components/skeletons/ListCardsSkeleton';
import { Skeleton } from '@/components/ui/Skeleton';
import { radius, space } from '@/constants/theme';

/**
 * The admin twins (ADR-40). These screens read Supabase, so unlike the local
 * screens their skeleton is really seen; each mirrors the screen's gutter
 * padding, tile grid and row shapes.
 */

function Heading() {
  return (
    <View style={{ gap: 8, marginBottom: space.md }}>
      <Skeleton.Rect h={11} w={90} />
      <Skeleton.Rect h={28} w="55%" />
    </View>
  );
}

/** Panel: three tile sections (4 · 5 · 3 tiles, two per row) and the two links. */
export function AdminPanelSkeleton() {
  return (
    <Skeleton style={styles.screen}>
      <Heading />
      {[4, 5, 3].map((count, s) => (
        <View key={s} style={{ marginBottom: space.lg }}>
          <Skeleton.Rect h={11} w={100} style={{ marginBottom: space.sm }} />
          <View style={styles.grid}>
            {Array.from({ length: count }, (_, i) => (
              <Skeleton.Rect key={i} h={64} w="47%" r={12} style={styles.tile} />
            ))}
          </View>
        </View>
      ))}
      {[0, 1].map((i) => (
        <Skeleton.Rect key={i} h={68} r={radius.input} style={{ marginBottom: space.sm }} />
      ))}
    </Skeleton>
  );
}

/** Usuarios: the count, the search field, user rows (email + badge, counts, dates). */
export function AdminUsersSkeleton() {
  return (
    <Skeleton style={styles.screen}>
      <Skeleton.Rect h={11} w={90} style={{ marginBottom: space.sm }} />
      <View style={{ marginBottom: space.md }}>
        <Skeleton.Fields n={1} />
      </View>
      {Array.from({ length: 7 }, (_, i) => (
        <OutlineCard key={i} pad={space.md} r={12}>
          <View style={styles.rowTop}>
            <Skeleton.Rect h={14} w="60%" />
            <Skeleton.Rect h={22} w={64} r={radius.chip} />
          </View>
          <Skeleton.Rect h={12} w="50%" style={{ marginTop: 6 }} />
          <Skeleton.Rect h={12} w="65%" style={{ marginTop: 6 }} />
        </OutlineCard>
      ))}
    </Skeleton>
  );
}

/** Comentarios recibidos: the count, the status chips, comment cards. */
export function AdminFeedbackListSkeleton() {
  return (
    <Skeleton style={styles.screen}>
      <Skeleton.Rect h={11} w={110} />
      <View style={styles.chips}>
        {[64, 84, 96, 80].map((w, i) => (
          <Skeleton.Rect key={i} h={44} w={w} r={radius.chip} />
        ))}
      </View>
      {Array.from({ length: 6 }, (_, i) => (
        <OutlineCard key={i} pad={space.md}>
          <View style={styles.rowTop}>
            <Skeleton.Rect h={15} w="35%" />
            <Skeleton.Rect h={24} w={84} r={radius.chip} />
          </View>
          <Skeleton.Lines n={2} lineHeight={13} gap={7} style={{ marginTop: 8 }} />
          <Skeleton.Rect h={12} w="55%" style={{ marginTop: 8 }} />
        </OutlineCard>
      ))}
    </Skeleton>
  );
}

/** One comment: kind + status, date, the message, the status bar, the details card. */
export function AdminFeedbackDetailSkeleton() {
  return (
    <Skeleton style={styles.screen}>
      <View style={styles.rowTop}>
        <Skeleton.Rect h={26} w="45%" />
        <Skeleton.Rect h={24} w={84} r={radius.chip} />
      </View>
      <Skeleton.Rect h={12} w={120} style={{ marginTop: 6, marginBottom: space.md }} />
      <OutlineCard spacing={space.md}>
        <Skeleton.Lines n={3} lineHeight={16} gap={7} />
      </OutlineCard>
      <Skeleton.Rect h={48} r={radius.input} style={{ marginBottom: space.md }} />
      <OutlineCard spacing={space.md}>
        {Array.from({ length: 5 }, (_, i) => (
          <View key={i} style={styles.kv}>
            <Skeleton.Rect h={13} w="30%" />
            <Skeleton.Rect h={14} w="40%" />
          </View>
        ))}
      </OutlineCard>
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: space.gutter },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '47%', flexGrow: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginVertical: space.md },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
});
