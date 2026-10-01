import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { CarbonFrame } from '@/components/ui/CarbonFrame';
import { palette, radius, space } from '@/constants/theme';
import { boardSourceLabel, type BoardEntry } from '@/lib/domain/fuelPrices';
import { money } from '@/lib/format';
import { FUEL_CATALOG, FUEL_ORDER } from '@/lib/fuel';
import type { ReferencePrices } from '@/lib/types';

/**
 * The MICM reference board — an *instrument*, dark in both schemes (05-design-jdm.md:
 * "PriceBoard and the cluster hero stay dark panels in light mode"). It reads
 * from `palette.dark` directly rather than from useTheme(), and every colour
 * inside it is checked against that near-black instead of the active scheme.
 *
 * Built like a cluster pod: a carbon bezel strip with the two bolts (trim only,
 * no text on it), the eyebrow in Saira tracked amber, the week in Saira 800,
 * then each grade on its own LCD well with the price in JetBrains Mono amber —
 * Tu Combustible RD's LED digits, the one surface still about buying fuel.
 *
 * Phase 5 (ADR-46): with `entries` (the board, lib/domain/fuelPrices.ts),
 * each grade carries where its price came from and since when —
 * "MICM · semana del 26 sep", "Manual · 3 oct" — amber-outlined when the MICM
 * week is the last good one (`stale`).
 */
const board = palette.dark;

export function PriceBoard({
  eyebrow,
  amount,
  caption,
  prices,
  entries,
}: {
  eyebrow: string;
  amount: string;
  caption: string;
  prices: ReferencePrices;
  entries?: readonly BoardEntry[];
}) {
  return (
    <View style={styles.board}>
      <CarbonFrame style={styles.bezel} opacity={board.carbonOpacity * 2}>
        <View style={styles.screw} />
        <View style={styles.screw} />
      </CarbonFrame>

      <View style={styles.body}>
        <T face="eyebrow" style={styles.eyebrow}>
          {eyebrow}
          <T face="kana" style={styles.kana}>
            {' 給油'}
          </T>
        </T>
        <T face="display" style={styles.week}>
          {amount}
        </T>
        <T face="body" style={styles.caption}>
          {caption}
        </T>

        <View style={styles.grid}>
          {FUEL_ORDER.map((type) => {
            const entry = entries?.find((e) => e.fuelType === type);
            return (
              <View key={type} style={styles.row}>
                <View style={styles.gradeCol}>
                  <T face="title" style={styles.grade} numberOfLines={1}>
                    {FUEL_CATALOG[type].shortLabel}
                  </T>
                  {entry ? (
                    <View style={[styles.chip, entry.stale && styles.chipStale]}>
                      <T face="body" style={[styles.chipText, entry.stale && { color: board.accent }]} numberOfLines={1}>
                        {boardSourceLabel(entry)}
                      </T>
                    </View>
                  ) : null}
                </View>
                <View style={styles.well}>
                  <T face="monoBold" style={styles.price} numberOfLines={1}>
                    {money(entry?.price ?? prices[type])}
                  </T>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: board.bg.surface,
    borderWidth: 1,
    borderColor: board.lineStrong,
    borderRadius: radius.card + 2,
    overflow: 'hidden',
  },
  bezel: {
    height: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    backgroundColor: board.bg.base,
    borderBottomWidth: 1,
    borderBottomColor: board.lineStrong,
  },
  screw: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: board.bg.raised,
    borderWidth: 1,
    borderColor: board.lineStrong,
  },
  body: { padding: space.lg, paddingTop: space.md },
  eyebrow: { color: board.accent, fontSize: 11 },
  kana: { color: board.text.muted, fontSize: 10, letterSpacing: 0, textTransform: 'none' },
  week: {
    color: board.text.primary,
    fontSize: 26,
    lineHeight: 28,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  caption: { color: board.text.secondary, marginTop: 4, fontSize: 13, lineHeight: 18 },
  grid: { marginTop: space.md, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  gradeCol: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 3 },
  grade: {
    color: board.text.secondary,
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  chip: {
    borderWidth: 1,
    borderColor: board.lineStrong,
    borderRadius: radius.lamp,
    paddingHorizontal: 6,
    paddingVertical: 1,
    maxWidth: '100%',
  },
  chipStale: { borderColor: board.accent },
  chipText: { color: board.text.muted, fontSize: 11, lineHeight: 15 },
  // The LCD inset each price sits in.
  well: {
    backgroundColor: board.bg.well,
    borderWidth: 1,
    borderColor: board.lineStrong,
    borderRadius: radius.lamp,
    paddingHorizontal: space.md,
    paddingVertical: 5,
    minWidth: 128,
    alignItems: 'flex-end',
  },
  price: { color: board.accent, fontSize: 16, letterSpacing: 0.3 },
});
