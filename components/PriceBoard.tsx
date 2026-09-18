import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { palette, radius, space } from '@/constants/theme';
import { money } from '@/lib/format';
import { FUEL_CATALOG, FUEL_ORDER } from '@/lib/fuel';
import type { ReferencePrices } from '@/lib/types';

/**
 * The MICM reference board. Dark in both schemes, on purpose: this is a *panel*
 * — the thing bolted to the canopy at the bomba — not a card in the page's
 * surface. The identity spec allows exactly this exception, so it reads from
 * `palette.dark` directly rather than from useTheme(), and every colour inside
 * it is checked against that near-black instead of against the active scheme.
 *
 * Tu Combustible RD's amber LED digits survive here and nowhere else, which is
 * the point: the old identity was about buying fuel, and this is the one surface
 * still about buying fuel.
 */
const board = palette.dark;

export function PriceBoard({
  eyebrow,
  amount,
  caption,
  prices,
}: {
  eyebrow: string;
  amount: string;
  caption: string;
  prices: ReferencePrices;
}) {
  return (
    <View style={styles.board}>
      <View style={styles.screws}>
        <View style={styles.screw} />
        <View style={styles.screw} />
      </View>
      <T face="medium" style={styles.eyebrow}>
        {eyebrow.toUpperCase()}
      </T>
      <T face="monoBold" style={styles.led}>
        {amount}
      </T>
      <T face="body" style={styles.caption}>
        {caption}
      </T>
      <View style={styles.rule} />
      {FUEL_ORDER.map((type) => (
        <View key={type} style={styles.row}>
          <T face="semibold" style={styles.grade}>
            {FUEL_CATALOG[type].shortLabel}
          </T>
          <View style={styles.dots} />
          <T face="mono" style={styles.price}>
            {money(prices[type])}
          </T>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: board.bg.base,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: radius.sheet,
    padding: space.xl,
    paddingTop: 18,
  },
  screws: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  screw: {
    width: 8,
    height: 8,
    borderRadius: 4,
    // The house amber at low alpha, so the two bolts read as metal catching the
    // accent rather than as two lit dots competing with the digits.
    backgroundColor: 'rgba(255, 179, 0, 0.35)',
  },
  eyebrow: {
    color: board.accent,
    fontSize: 12,
    letterSpacing: 1.6,
  },
  led: {
    // The week label, not a price: white so the amber is reserved for the
    // numbers people came to read.
    color: board.text.primary,
    fontSize: 30,
    marginTop: space.sm,
    letterSpacing: -0.5,
  },
  caption: { color: board.text.secondary, marginTop: 6, fontSize: 13, lineHeight: 19 },
  rule: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    marginVertical: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
  grade: { color: board.text.secondary, fontSize: 13, width: 88 },
  dots: {
    flex: 1,
    borderBottomWidth: 1,
    borderStyle: 'dotted',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    marginHorizontal: space.sm,
    marginTop: space.sm,
  },
  price: { color: board.text.primary, fontSize: 14 },
});
