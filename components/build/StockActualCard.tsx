import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { radius, space } from '@/constants/theme';
import { formatSpec, HEADLINE_FIELDS, type CurrentSpec } from '@/lib/domain/build';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The Build artboard's STOCK → ACTUAL card: the four headline fields (motor,
 * HP, aros, ECU), stock in white, the derived value in amber when a mod or an
 * override changed it. Tap → the SPECS tab.
 */
export function StockActualCard({ current, onPress }: { current: Record<string, CurrentSpec>; onPress?: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={HEADLINE_FIELDS.map((f) => `${f.headline}: ${formatSpec(f.key, current[f.key]?.stock ?? null)} a ${formatSpec(f.key, current[f.key]?.value ?? null)}`).join('. ')}
      style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, width: '100%' }}>
        {t.build.stockActual}
      </T>
      {HEADLINE_FIELDS.map((f) => {
        const c = current[f.key];
        const changed = c && c.source && c.source.kind !== 'stock';
        return (
          <View key={f.key} style={styles.cell}>
            <T face="mono" style={{ color: theme.text.muted, fontSize: 12 }}>
              {f.headline}
            </T>
            <T face="mono" numberOfLines={1} style={{ color: theme.text.primary, fontSize: 12, flexShrink: 1, textAlign: 'right' }}>
              {formatSpec(f.key, c?.stock ?? null)}
              {changed ? (
                <T face="mono" style={{ color: theme.accent, fontSize: 12 }}>
                  {` → ${formatSpec(f.key, c.value)}`}
                </T>
              ) : null}
            </T>
          </View>
        );
      })}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: 6, borderWidth: 1, borderRadius: radius.button, paddingVertical: 10, paddingHorizontal: space.md },
  cell: { width: '47%', flexGrow: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
});
