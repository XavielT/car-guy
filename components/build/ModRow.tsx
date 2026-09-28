import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { PhotoThumb } from '@/components/album/PhotoThumb';
import { T } from '@/components/T';
import { Badge } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import type { Mod } from '@/lib/db/types';
import { modBadge, modTotalDop, parseTags } from '@/lib/domain/build';
import { km as fmtKm, money } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

function monthYear(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "RD$ 85,000" without the cents, for the row's mono total. */
function whole(n: number): string {
  return money(Math.round(n)).replace(/\.00$/, '');
}

/**
 * One mod (Build artboard): thumb, name + tag badge, the mono meta line
 * (date · km · who/where · "+ aduana"), the total and a status dot.
 * Tap opens it; long-press is the lifecycle (Quitar / Vender / …).
 */
export function ModRow({
  mod,
  thumb,
  categoryIcon,
  installerName,
  onPress,
  onLongPress,
}: {
  mod: Mod;
  thumb?: string | null;
  categoryIcon?: string | null;
  installerName?: string | null;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { theme } = useTheme();
  const badge = modBadge(parseTags(mod.tags));
  const on = mod.status === 'instalado';
  const status =
    mod.status === 'quitado' ? es.build.removed : mod.status === 'vendido' ? es.build.sold : mod.status === 'danado' ? es.build.damaged : mod.status === 'planeado' ? es.build.planned : mod.status === 'pedido' ? es.build.ordered : null;
  const foreign = mod.priceForeign && mod.currency ? `${mod.currency} ${Math.round(mod.priceForeign).toLocaleString('en-US')}` : null;
  const meta = [
    status,
    monthYear(on ? mod.installedAt : mod.removedAt ?? mod.installedAt),
    mod.installedKm != null ? fmtKm(Math.round(mod.installedKm)) : null,
    installerName ?? mod.vendor,
    foreign,
    mod.costCustomsDop ? es.build.customs(whole(mod.costCustomsDop)) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const dot = on ? theme.statusText.ok : mod.status === 'danado' ? theme.redline : mod.status === 'planeado' || mod.status === 'pedido' ? theme.accentFill : theme.text.disabled;
  const total = modTotalDop(mod);

  const faded = on || mod.status === 'planeado' || mod.status === 'pedido' ? 1 : 0.7;
  return (
    // Two siblings, not nested: a button inside a button is invalid HTML on web.
    <View style={[styles.row, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong, opacity: faded }]}>
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={[mod.name, badge?.label, meta, total ? whole(total) : null].filter(Boolean).join(', ')}
      accessibilityActions={[{ name: 'longpress', label: es.build.actions(mod.name) }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onLongPress()}
      style={styles.main}>
      {thumb ? (
        <PhotoThumb mediaId={thumb} size={48} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: theme.bg.well }]}>
          <Ionicons name={(categoryIcon as keyof typeof Ionicons.glyphMap) ?? 'construct-outline'} size={20} color={theme.text.muted} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.title}>
          <T face="semibold" numberOfLines={2} style={{ color: theme.text.primary, fontSize: 15, flexShrink: 1 }}>
            {mod.name}
          </T>
          {badge ? <Badge label={badge.label} tone={badge.tone} /> : null}
        </View>
        {meta ? (
          <T face="mono" numberOfLines={2} style={{ color: theme.text.muted, fontSize: 11 }}>
            {meta}
          </T>
        ) : null}
      </View>
      <View style={styles.end}>
        {total ? (
          <T face="monoBold" style={{ color: theme.text.primary, fontSize: 13 }}>
            {Math.round(total).toLocaleString('en-US')}
          </T>
        ) : null}
        <View style={[styles.dot, { backgroundColor: dot }]} />
      </View>
    </Pressable>
      {/* A mouse has no long-press: web gets the actions as a button. */}
      {Platform.OS === 'web' ? (
        <Pressable onPress={onLongPress} accessibilityRole="button" accessibilityLabel={es.build.actions(mod.name)} hitSlop={8} style={styles.more}>
          <Ionicons name="ellipsis-vertical" size={18} color={theme.text.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.button, paddingRight: space.sm },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: space.md, paddingRight: space.xs, minHeight: 68 },
  thumb: { width: 48, height: 48, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center' },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  end: { alignItems: 'flex-end', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  more: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
});
