import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PriceBoard } from '@/components/PriceBoard';
import { ListCardsSkeleton } from '@/components/skeletons/ListCardsSkeleton';
import { T } from '@/components/T';
import { Badge, Chip, GhostButton, PrimaryButton, SectionHeader, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { usePriceData } from '@/hooks/usePriceData';
import { importMicmNow } from '@/lib/cloud/fuelPriceRef';
import {
  boardSourceLabel,
  importMessage,
  priceHistory,
  referencePricesFromBoard,
  weekRangeLabel,
} from '@/lib/domain/fuelPrices';
import { money } from '@/lib/format';
import { FUEL_CATALOG, FUEL_ORDER } from '@/lib/fuel';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import type { FuelType } from '@/lib/types';

/**
 * Precios (IMP 30092026 note 1, ADR-46, 03-screens.md Phase 5): the board —
 * per fuel the newest of the person's rows and the MICM weeks, each with its
 * source and date — then "Agregar precio" / "Importar MICM ahora", then one
 * fuel's history grouped by MICM week. A row of the person's opens its editor.
 */
export default function PreciosScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { data, refresh } = useStore();
  const { own, refs, board, loaded, reload } = usePriceData();
  const showSkeleton = useDelayedLoading(!loaded);

  const activeFuel = data.vehicles.find((v) => v.id === data.settings.activeVehicleId)?.defaultFuelType;
  const [fuel, setFuel] = useState<FuelType>(activeFuel ?? 'regular');
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const history = useMemo(() => priceHistory(fuel, own, refs), [fuel, own, refs]);
  const label = board.length ? referencePricesFromBoard(board).priceWeekLabel : t.fuelPricesUi.boardEmpty;
  const stale = board.some((e) => e.stale);
  const unit = FUEL_CATALOG[fuel].perUnitLabel;

  async function runImport() {
    setImporting(true);
    setStatus(null);
    try {
      const { answer } = await importMicmNow();
      await reload();
      await refresh();
      setStatus(importMessage(answer));
    } finally {
      setImporting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {t.fuelPricesUi.title}
        </T>
        <T face="body" style={[styles.p, { color: theme.text.secondary }]}>
          {t.fuelPricesUi.intro}
        </T>

        {showSkeleton ? (
          <ListCardsSkeleton n={3} lines={2} />
        ) : !loaded ? null : (
          <>
            <View style={{ marginBottom: space.md }}>
              <PriceBoard
                eyebrow={t.fuelPricesUi.boardEyebrow}
                amount={label}
                caption={t.fuelPricesUi.boardCaption}
                prices={data.settings.referencePrices}
                entries={board}
              />
            </View>
            {stale ? (
              <View style={[styles.banner, { borderColor: theme.accent, backgroundColor: theme.bg.raised }]}>
                <T face="body" style={{ color: theme.text.primary, fontSize: 14, lineHeight: 20 }}>
                  {t.fuelPricesUi.stale}
                </T>
              </View>
            ) : null}

            <PrimaryButton label={t.fuelPricesUi.add} onPress={() => router.push({ pathname: '/precios/nuevo', params: { fuel } })} />
            <GhostButton label={importing ? t.fuelPricesUi.importing : t.fuelPricesUi.importNow} onPress={() => void runImport()} disabled={importing} />
            {status ? (
              <T face="body" accessibilityLiveRegion="polite" style={[styles.status, { color: theme.text.secondary }]}>
                {status}
              </T>
            ) : null}

            <SectionHeader title={t.fuelPricesUi.historyTitle} caption={t.fuelPricesUi.historyCaption} />
            <View style={styles.chips}>
              {FUEL_ORDER.map((f) => (
                <Chip key={f} label={FUEL_CATALOG[f].shortLabel} selected={f === fuel} onPress={() => setFuel(f)} />
              ))}
            </View>

            {history.length === 0 ? (
              <T face="body" style={[styles.empty, { color: theme.text.muted }]}>
                {t.fuelPricesUi.historyEmpty}
              </T>
            ) : (
              history.map((week) => (
                <View key={week.weekStart} style={styles.week}>
                  <T face="eyebrow" style={[styles.weekLabel, { color: theme.text.muted }]}>
                    {weekRangeLabel(week.weekStart, week.weekEnd)}
                  </T>
                  <Surface padded={false}>
                    {week.items.map((item, i) => {
                      const body = (
                        <View style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line }]}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <T face="monoBold" style={{ color: theme.text.primary, fontSize: 16 }}>
                              {money(item.price)} <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>{unit}</T>
                            </T>
                            <T face="body" numberOfLines={2} style={{ color: theme.text.secondary, fontSize: 13, marginTop: 2 }}>
                              {[boardSourceLabel(item), item.station, item.note].filter(Boolean).join(' · ')}
                            </T>
                          </View>
                          {item.current ? <Badge tone="amber" label={t.fuelPricesUi.current} /> : null}
                          {item.stale ? <Badge tone="outline" label={t.fuelPricesUi.staleTag} /> : null}
                        </View>
                      );
                      return item.origin === 'user' ? (
                        <Pressable
                          key={item.key}
                          accessibilityRole="button"
                          accessibilityLabel={`${t.fuelPricesUi.editTitle}: ${money(item.price)} ${unit}`}
                          onPress={() => router.push({ pathname: '/precios/nuevo', params: { id: item.key } })}
                          style={({ pressed }) => pressed && { opacity: 0.7 }}>
                          {body}
                        </Pressable>
                      ) : (
                        <View key={item.key}>{body}</View>
                      );
                    })}
                  </Surface>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  h: { fontSize: 32, lineHeight: 35, textTransform: 'uppercase', letterSpacing: 0.3 },
  p: { marginVertical: space.md, lineHeight: 22 },
  banner: { borderWidth: 1, borderRadius: radius.card, padding: space.md, marginBottom: space.md },
  status: { fontSize: 14, lineHeight: 20, marginBottom: space.md, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  empty: { fontSize: 14, lineHeight: 20, paddingVertical: space.md },
  week: { marginBottom: space.md },
  weekLabel: { fontSize: 11, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56 },
});
