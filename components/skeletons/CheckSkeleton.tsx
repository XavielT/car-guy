import { StyleSheet, View } from 'react-native';

import { OutlineCard } from '@/components/skeletons/ListCardsSkeleton';
import { Skeleton } from '@/components/ui/Skeleton';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The Chequeo twins (ADR-40). Each mirrors its screen's padding (space.gutter
 * all round, no in-page title under the stack header) so the real content
 * lands where the outline was.
 */

/** Chequeo: "Para hoy" + the streak ring, one due card, the templates list. */
export function CheckSkeleton() {
  const { theme } = useTheme();
  return (
    <Skeleton style={styles.screen}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton.Rect h={12} w={110} />
          <Skeleton.Rect h={14} w="70%" />
        </View>
        <Skeleton.Circle size={84} />
      </View>
      <OutlineCard spacing={space.md}>
        <Skeleton.Rect h={22} w="55%" />
        <Skeleton.Rect h={12} w="45%" style={{ marginTop: 6, marginBottom: space.md }} />
        <Skeleton.Rect h={52} r={radius.button} />
      </OutlineCard>
      <Skeleton.Rect h={10} w={100} style={styles.section} />
      {Array.from({ length: 3 }, (_, i) => (
        <View key={i} style={[styles.templateRow, { borderColor: theme.line }]}>
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton.Rect h={14} w="60%" />
            <Skeleton.Rect h={12} w="30%" />
          </View>
          <Skeleton.Rect h={13} w={56} />
          <Skeleton.Rect h={13} w={48} />
        </View>
      ))}
    </Skeleton>
  );
}

/** The template editor: note, name field, cadence chips, switch, item cards. */
export function CheckTemplateSkeleton() {
  return (
    <Skeleton style={styles.screen}>
      <Skeleton.Lines n={2} lineHeight={13} gap={6} style={{ marginBottom: space.lg }} />
      <Skeleton.Fields n={1} />
      <Skeleton.Rect h={10} w={80} style={{ marginTop: space.md, marginBottom: space.sm }} />
      <View style={styles.chips}>
        {[80, 90, 76].map((w) => (
          <Skeleton.Rect key={w} h={44} w={w} r={radius.chip} />
        ))}
      </View>
      <View style={styles.switchRow}>
        <Skeleton.Rect h={14} w="40%" />
        <Skeleton.Rect h={28} w={48} r={radius.chip} />
      </View>
      <Skeleton.Rect h={10} w={90} style={{ marginTop: space.xl, marginBottom: space.sm }} />
      {Array.from({ length: 4 }, (_, i) => (
        <OutlineCard key={i}>
          <View style={styles.itemHeader}>
            <Skeleton.Rect h={28} w={48} r={radius.chip} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton.Rect h={14} w="70%" />
              <Skeleton.Rect h={12} w="40%" />
            </View>
            <Skeleton.Rect h={34} w={34} r={8} />
            <Skeleton.Rect h={34} w={34} r={8} />
          </View>
          <Skeleton.Rect h={12} w={90} style={{ marginTop: space.md, marginBottom: 6 }} />
          <Skeleton.Rect h={48} r={radius.input} />
        </OutlineCard>
      ))}
    </Skeleton>
  );
}

/** A check run: cadence, title, the counter and the boost ring, then item cards with their verdict row. */
export function CheckRunSkeleton() {
  return (
    <Skeleton style={styles.screen}>
      <View style={[styles.headerRow, { marginBottom: space.lg }]}>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton.Rect h={11} w={70} />
          <Skeleton.Rect h={28} w="75%" />
          <Skeleton.Rect h={13} w={120} />
        </View>
        <Skeleton.Circle size={104} />
      </View>
      {[3, 2].map((count, g) => (
        <View key={g}>
          <Skeleton.Rect h={10} w={100} style={{ marginTop: space.lg, marginBottom: space.sm }} />
          {Array.from({ length: count }, (_, i) => (
            <OutlineCard key={i}>
              <Skeleton.Rect h={15} w="65%" />
              <View style={styles.verdicts}>
                {Array.from({ length: 4 }, (_, v) => (
                  <Skeleton.Rect key={v} h={44} r={radius.input} style={{ flex: 1 }} />
                ))}
              </View>
            </OutlineCard>
          ))}
        </View>
      ))}
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: space.gutter },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  section: { marginTop: space.xxl, marginBottom: space.xs },
  templateRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, marginBottom: space.md },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  verdicts: { flexDirection: 'row', gap: 6, marginTop: space.md },
});
