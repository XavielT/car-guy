import { T } from '@/components/T';
import { colors } from '@/constants/theme';
import { FUEL_CATALOG, FUEL_ORDER } from '@/lib/fuel';
import { money } from '@/lib/format';
import type { ReferencePrices } from '@/lib/types';
import { StyleSheet, View } from 'react-native';

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
        {eyebrow}
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
    backgroundColor: colors.canopy,
    borderRadius: 24,
    padding: 20,
    paddingTop: 18,
  },
  screws: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  screw: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(34, 211, 238, 0.35)',
  },
  eyebrow: {
    color: colors.led,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  led: {
    color: colors.led,
    fontSize: 34,
    marginTop: 8,
    letterSpacing: -0.5,
  },
  caption: { color: colors.muted, marginTop: 6, fontSize: 13 },
  rule: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  grade: { color: colors.ink, fontSize: 13, width: 88 },
  dots: {
    flex: 1,
    borderBottomWidth: 1,
    borderStyle: 'dotted',
    borderColor: colors.line,
    marginHorizontal: 8,
    marginTop: 8,
  },
  price: { color: colors.led, fontSize: 13 },
});
