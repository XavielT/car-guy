import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FillUpReviewBody } from '@/components/FillUpReviewSheet';
import { gaugeLabel } from '@/components/fuel/GaugePicker';
import { MissingRecord } from '@/components/MissingRecord';
import { T } from '@/components/T';
import { GhostButton, KeyValueRow, PrimaryButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { reviewFillUp } from '@/lib/domain/economy';
import { fuelCfgFor, partialEconomy } from '@/lib/domain/partialEconomy';
import { perFillEconomyOf } from '@/lib/domain/perFillEconomy';
import { dateLabel, economyNumber, economyValue, km, money, volume as fmtVol } from '@/lib/format';
import { economyLabel, FUEL_CATALOG, perUnitLabelFor, unitLabelFor } from '@/lib/fuel';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * One fill-up (IMP 30092026 note 8): what a saved echada is, before any
 * editing — Historial rows, Inicio's last tank and "Listo" after a save land
 * here; the editor is behind Editar (`./editar.tsx`).
 */
export default function CargaDetail() {
  const { id, saved } = useLocalSearchParams<{ id: string; saved?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { data, deleteFillUp } = useStore();
  const fill = data.fillups.find((f) => f.id === id);
  const vehicle = data.vehicles.find((v) => v.id === fill?.vehicleId);
  const [notice, setNotice] = useState(saved === '1' ? es.fuel.savedNotice : null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const computed = useMemo(() => {
    if (!fill) return null;
    const mine = data.fillups.filter((f) => f.vehicleId === fill.vehicleId);
    const review = reviewFillUp(fill, mine.filter((f) => f.id !== fill.id));
    const partial = partialEconomy(mine, fuelCfgFor(vehicle?.detail));
    const estimate = partial.segments.find((s) => s.fillUpId === fill.id) ?? null;
    // Note 9: every log with a previous one gets its "≈ por echada", full or partial.
    const perFill = perFillEconomyOf(fill.id, mine);
    return { review, estimate, perFill };
  }, [fill, data.fillups, vehicle?.detail]);

  if (!fill || !computed) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: es.fuel.detailTitle }} />
        <MissingRecord />
      </>
    );
  }

  const volumeUnit = vehicle?.detail?.volumeUnit ?? 'gal';
  const { review, estimate, perFill } = computed;
  const economyUnit = fill.fuelType === 'gnv' ? null : vehicle?.detail?.economyUnit;
  // Only where there is no measured number (a partial): on a full tank it would repeat it.
  const perFillLine = perFill && review.kmPerUnit == null
    ? es.perFill.line(economyNumber(economyValue(perFill.kmPerUnit, volumeUnit, economyUnit)), economyLabel(fill.fuelType, volumeUnit, economyUnit))
    : null;
  const title = [es.fuel.detailTitle, dateLabel(fill.occurredAt), fill.station || null].filter(Boolean).join(' · ');
  const tile = (value: string, label: string) => (
    <View key={label} style={[styles.tile, { backgroundColor: theme.bg.raised, borderColor: theme.line }]}>
      <T face="monoBold" style={{ color: theme.text.primary, fontSize: 18 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10, marginTop: 2 }}>
        {label.toUpperCase()}
      </T>
    </View>
  );
  const gauge = (n: number | null | undefined) => (n == null ? es.gauge.unset : gaugeLabel(n));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: es.fuel.detailTitle }} />
      <ScrollView contentContainerStyle={styles.pad}>
        {notice ? (
          <View style={[styles.notice, { backgroundColor: theme.bg.raised, borderColor: theme.statusText.ok }]}>
            <T face="semibold" accessibilityLiveRegion="polite" style={{ color: theme.statusText.ok, fontSize: 14 }}>
              {notice}
            </T>
          </View>
        ) : null}
        <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
          {[vehicle?.name, FUEL_CATALOG[fill.fuelType]?.label, fill.isFullTank ? es.fuel.fullTankShort : es.fuel.partialShort].filter(Boolean).join(' · ').toUpperCase()}
        </T>
        <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 24, textTransform: 'uppercase', marginBottom: space.md }}>
          {title}
        </T>

        <View style={styles.tiles}>
          {tile(fmtVol(fill.volume, fill.fuelType, volumeUnit), es.fuel.volume(unitLabelFor(fill.fuelType, volumeUnit)))}
          {tile(money(fill.totalDop), es.fuel.total)}
          {tile(money(fill.pricePerUnit), perUnitLabelFor(fill.fuelType, volumeUnit))}
          {tile(km(fill.odometerKm), es.fuel.odometer)}
        </View>

        <Surface padded style={{ marginTop: space.md }}>
          <T face="title" style={{ color: theme.text.primary, fontSize: 17, textTransform: 'uppercase', marginBottom: space.sm }}>
            {fill.missedPrevious ? es.fuelReview.chainBrokenTitle : es.fuelReview.titles[review.status]}
          </T>
          <FillUpReviewBody
            review={review}
            fuelType={fill.fuelType}
            volumeUnit={volumeUnit}
            economyUnit={vehicle?.detail?.economyUnit}
            missedPrevious={Boolean(fill.missedPrevious)}
            estimate={estimate}
            perFillLine={perFillLine}
          />
        </Surface>

        {fill.inReserve || fill.gaugeBefore8 != null || fill.gaugeAfter8 != null ? (
          <Surface padded style={{ marginTop: space.md }}>
            <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.xs }}>
              {es.gauge.title.toUpperCase()}
            </T>
            <KeyValueRow label={es.gauge.before} value={fill.inReserve ? es.gauge.reserveOnly : gauge(fill.gaugeBefore8)} />
            <KeyValueRow label={es.gauge.after} value={gauge(fill.gaugeAfter8)} />
          </Surface>
        ) : null}

        {fill.notes ? (
          <Surface padded style={{ marginTop: space.md }}>
            <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.xs }}>
              {es.fuel.notes.toUpperCase()}
            </T>
            <T face="body" style={{ color: theme.text.primary, fontSize: 15, lineHeight: 21 }}>
              {fill.notes}
            </T>
          </Surface>
        ) : null}

        <View style={{ marginTop: space.lg, gap: space.sm }}>
          <PrimaryButton label={es.fuel.edit} onPress={() => router.push({ pathname: '/carga/[id]/editar', params: { id: fill.id } })} />
          <GhostButton
            label={es.common.delete}
            onPress={() =>
              Alert.alert(es.fuel.deleteTitle, es.fuel.deleteBody, [
                { text: es.common.cancel, style: 'cancel' },
                {
                  text: es.common.delete,
                  style: 'destructive',
                  onPress: () => {
                    deleteFillUp(fill.id);
                    router.back();
                  },
                },
              ])
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 12, padding: space.md },
  notice: { borderWidth: 1, borderRadius: 10, padding: space.md, marginBottom: space.md },
});
