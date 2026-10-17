import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { T } from '@/components/T';
import { EdgeScroll } from '@/components/ui/EdgeScroll';
import { radius, space } from '@/constants/theme';
import { activeFeatures, featureHref } from '@/lib/features/registry';
import { markFeatureUsed } from '@/lib/features/usage';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The vehicle's quick actions (IMP 16102026 SPEC-C §4): + Reparación, OBD, + Echada, + Evento, + Mod, + Foto — the
 * registry's `shortcut` functions, over the page tabs, scrolling with a fade at the edge that has more.
 */
export function ShortcutRow({ vehicleId }: { vehicleId: string }) {
  const { theme } = useTheme();
  const router = useRouter();
  const items = activeFeatures()
    .filter((f) => f.shortcut != null)
    .sort((a, b) => (a.shortcut ?? 0) - (b.shortcut ?? 0));
  return (
    <EdgeScroll bg={theme.bg.base} contentContainerStyle={styles.row} accessibilityRole="list">
      {items.map((def) => {
        const label = t.features.short[def.id as keyof typeof t.features.short];
        return (
          <Pressable
            key={def.id}
            onPress={() => {
              void markFeatureUsed(def.id);
              router.push(featureHref(def, vehicleId) as never);
            }}
            accessibilityRole="button"
            accessibilityLabel={t.features.items[def.id].title}
            style={[styles.pill, { borderColor: theme.accent, backgroundColor: theme.bg.surface }]}>
            <Ionicons name={def.icon} size={16} color={theme.accent} />
            <T face="title" style={{ color: theme.text.primary, fontSize: 12, letterSpacing: 0.6 }}>
              {label}
            </T>
          </Pressable>
        );
      })}
    </EdgeScroll>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: 2, paddingRight: space.md },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.tag, borderWidth: 1 },
});
