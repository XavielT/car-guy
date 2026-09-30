import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';

/** Miembros del garaje (ADR-40): title and intro, three member cards, the invite box. */
export function GarageMembersSkeleton() {
  const { theme } = useTheme();
  const card = [styles.card, { borderColor: theme.line, backgroundColor: theme.bg.surface }];
  return (
    <Skeleton style={{ paddingTop: space.gutter }}>
      <View style={{ gap: 8, marginBottom: space.md }}>
        <Skeleton.Rect h={11} w={120} />
        <Skeleton.Rect h={30} w="50%" />
        <Skeleton.Lines n={2} lineHeight={13} lastWidth="70%" />
      </View>
      {Array.from({ length: 3 }, (_, i) => (
        <View key={i} style={card}>
          <View style={styles.top}>
            <Skeleton.Rect h={15} w="50%" />
            <Skeleton.Rect h={20} w={64} r={radius.chip} />
          </View>
          <Skeleton.Rect h={12} w="35%" />
        </View>
      ))}
      <View style={[card, { marginTop: space.lg }]}>
        <Skeleton.Rect h={11} w={90} />
        <Skeleton.Rect h={48} r={radius.input} />
        <Skeleton.Rect h={48} r={radius.button} />
      </View>
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.button, padding: space.md, gap: space.sm, marginBottom: space.sm },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
});
