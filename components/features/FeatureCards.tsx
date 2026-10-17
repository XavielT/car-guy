import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { radius, space } from '@/constants/theme';
import type { FeatureDef } from '@/lib/features/registry';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

export const featureCopy = (def: FeatureDef) => t.features.items[def.id];

/** A small pill on a card: "2 códigos", "Falta un permiso". */
function Badge({ text, warn }: { text: string; warn?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.badge, { borderColor: warn ? theme.statusText.proximo : theme.line }]}>
      <T face="title" style={{ color: warn ? theme.statusText.proximo : theme.text.secondary, fontSize: 10, letterSpacing: 0.6 }}>
        {text}
      </T>
    </View>
  );
}

/** A row of the hub and of the search results: icon, title, the one-line "what it is for", a state badge. */
export function FeatureCard({ def, badge, warn, onPress }: { def: FeatureDef; badge?: string; warn?: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const copy = featureCopy(def);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${copy.title}. ${copy.desc} ${badge}` : `${copy.title}. ${copy.desc}`}
      style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.line }]}>
      <View style={[styles.icon, { backgroundColor: theme.bg.raised }]}>
        <Ionicons name={def.icon} size={22} color={theme.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
          {copy.title}
        </T>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 12, lineHeight: 16 }}>
          {copy.desc}
        </T>
      </View>
      {badge ? <Badge text={badge} warn={warn} /> : null}
      <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
    </Pressable>
  );
}

/** The big tiles of the hub's featured row. */
export function FeatureTile({ def, badge, warn, onPress }: { def: FeatureDef; badge?: string; warn?: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const copy = featureCopy(def);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${copy.title}. ${copy.desc} ${badge}` : `${copy.title}. ${copy.desc}`}
      style={[styles.tile, { backgroundColor: theme.bg.surface, borderColor: theme.accent }]}>
      <Ionicons name={def.icon} size={26} color={theme.accent} />
      <T face="semibold" numberOfLines={2} style={{ color: theme.text.primary, fontSize: 14 }}>
        {copy.title}
      </T>
      {badge ? <Badge text={badge} warn={warn} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, padding: space.md, borderRadius: radius.button, borderWidth: 1, marginBottom: space.sm },
  icon: { width: 40, height: 40, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center' },
  badge: { borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  tile: { width: '48%', flexGrow: 1, minHeight: 96, padding: space.md, borderRadius: radius.button, borderWidth: 1, gap: space.sm, justifyContent: 'space-between' },
});
