import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { categoryColors, categoryInkLight, radius, space, type CategoryKey } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';

export type RecordKind =
  | 'combustible'
  | 'mantenimiento'
  | 'reparacion'
  | 'mejora'
  | 'gasto'
  | 'chequeo'
  | 'mod'
  | 'hito'
  | 'pista'
  | 'obd'
  | 'viaje';

const ICON: Record<RecordKind, keyof typeof Ionicons.glyphMap> = {
  combustible: 'flash-outline',
  mantenimiento: 'construct-outline',
  reparacion: 'build-outline',
  mejora: 'trending-up-outline',
  gasto: 'cash-outline',
  chequeo: 'clipboard-outline',
  mod: 'trending-up-outline',
  hito: 'flag-outline',
  pista: 'speedometer-outline',
  obd: 'warning-outline',
  viaje: 'navigate-outline',
};

const CATEGORY: Record<RecordKind, CategoryKey> = {
  combustible: 'combustible',
  mantenimiento: 'mantenimiento',
  reparacion: 'reparacion',
  mejora: 'mejora',
  gasto: 'otros',
  chequeo: 'inspeccion',
  mod: 'mejora',
  hito: 'album',
  pista: 'track',
  // Subtle: a code is a note on the car, not money.
  obd: 'otros',
  // A trip costs nothing by itself; it is a note on the car too (v6, FEATURE_TRIPS).
  viaje: 'otros',
};

/**
 * One row for every kind of thing that happens to a car.
 *
 * The whole point of the unified history is that a fill-up, an oil change and a
 * marbete payment sit in one list, so they have to share a shape: a category
 * icon tinted with its own colour, a title, a meta line, and the amount on the
 * right in the mono face so the column lines up whatever the row is.
 */
export function RecordRow({
  kind,
  title,
  meta,
  amount,
  tag,
  onPress,
}: {
  kind: RecordKind;
  title: string;
  meta: string;
  amount: string | null;
  /** A small extra fact, e.g. "37.4 km/gal" on a fill-up. */
  tag?: string | null;
  onPress?: () => void;
}) {
  const { theme, scheme } = useTheme();
  // The badge tint keeps the bright hue; the icon on it needs the darker ink on
  // a light surface to stay legible (see categoryInkLight).
  const hue = categoryColors[CATEGORY[kind]];
  const ink = scheme === 'light' ? categoryInkLight[CATEGORY[kind]] : hue;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.bg.surface, borderColor: theme.line, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={[styles.badge, { backgroundColor: `${hue}24`, borderColor: `${hue}55` }]}>
        <Ionicons name={ICON[kind]} size={17} color={ink} />
      </View>

      <View style={styles.body}>
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }} numberOfLines={1}>
          {title}
        </T>
        <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginTop: 1 }} numberOfLines={1}>
          {meta}
        </T>
        {tag ? (
          <T face="mono" style={{ color: theme.statusText.ok, fontSize: 12, marginTop: 3 }}>
            {tag}
          </T>
        ) : null}
      </View>

      {amount ? (
        <T face="monoBold" style={{ color: theme.text.primary, fontSize: 14 }}>
          {amount}
        </T>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.input,
    padding: space.md,
    marginBottom: space.sm,
  },
  // A lamp, not a coin: rounded square in the category hue (05-design-jdm.md category colours).
  badge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
});
