import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { FuelPicker } from '@/components/FuelPicker';
import { PickerField, SearchSheet, type SearchItem } from '@/components/pickers';
import { RecordSkeleton } from '@/components/skeletons/RecordSkeleton';
import { T } from '@/components/T';
import { Chip, GhostButton, PrimaryButton } from '@/components/ui';
import { space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { Alert } from '@/lib/alert';
import { deleteFuelPrice, getFuelPrice, saveFuelPrice } from '@/lib/db/priceOps';
import { parseDecimal } from '@/lib/domain/economy';
import { fuelPriceSourceLabel, type FuelPriceSource } from '@/lib/domain/fuelPrices';
import { brandsForFuel, normaliseStation, recentStations } from '@/lib/domain/stations';
import { foldText } from '@/lib/domain/text';
import { todayIsoDate } from '@/lib/format';
import { FUEL_CATALOG, FUEL_ORDER } from '@/lib/fuel';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import type { FuelType } from '@/lib/types';

/** What a person can say they saw; `manual` is only 2.3's migrated settings rows. */
const SOURCES: FuelPriceSource[] = ['micm', 'estacion', 'recibo', 'app', 'otro'];

/**
 * Precios → Nuevo precio / Editar (03-screens.md Phase 5): fuel, price, the
 * date it is valid from (DateField), where it came from, the station when it
 * was a pump or a receipt, a note. `?id=` edits one of the person's rows;
 * `?fuel=` preselects the fuel.
 */
export default function NuevoPrecioScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { data, refresh } = useStore();
  const params = useLocalSearchParams<{ id?: string; fuel?: string }>();
  const editing = typeof params.id === 'string' && params.id.length > 0 ? params.id : null;
  const initialFuel = FUEL_ORDER.includes(params.fuel as FuelType) ? (params.fuel as FuelType) : 'regular';

  const [loaded, setLoaded] = useState(!editing);
  const showSkeleton = useDelayedLoading(!loaded);
  const [fuel, setFuel] = useState<FuelType>(initialFuel);
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(todayIsoDate());
  const [source, setSource] = useState<FuelPriceSource>('estacion');
  const [station, setStation] = useState('');
  const [stationOpen, setStationOpen] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!editing) return;
    let live = true;
    void getFuelPrice(editing).then((row) => {
      if (!live) return;
      if (row) {
        if (FUEL_ORDER.includes(row.fuelType as FuelType)) setFuel(row.fuelType as FuelType);
        setPrice(String(row.price));
        setDate(row.validFrom.slice(0, 10));
        setSource(row.source);
        setStation(row.station ?? '');
        setNote(row.note ?? '');
      }
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [editing]);

  const needsStation = source === 'estacion' || source === 'recibo';
  const stationItems = useMemo<SearchItem[]>(() => {
    const recent = recentStations(data.fillups.filter((f) => f.fuelType === fuel));
    const brands = brandsForFuel(FUEL_CATALOG[fuel].group).filter((b) => !recent.some((r) => foldText(r) === foldText(b.name)));
    return [
      ...recent.map((name) => ({ key: `recent:${name}`, label: name, section: t.fuel.stationRecent })),
      ...brands.map((b) => ({ key: b.id, label: b.name, keywords: (b.aliases ?? []).join(' '), section: t.fuel.stationBrands })),
    ];
  }, [data.fillups, fuel]);

  async function save() {
    const n = parseDecimal(price);
    if (n == null || n <= 0) {
      Alert.alert(t.fuelPricesUi.price(FUEL_CATALOG[fuel].perUnitLabel), t.fuelPricesUi.priceRequired);
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await saveFuelPrice({ fuelType: fuel, price: n, validFrom: date, source, station: needsStation ? station : '', note }, editing ?? undefined);
      await refresh();
      router.back();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!editing) return;
    Alert.alert(t.fuelPricesUi.delete, t.fuelPricesUi.deleteConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteFuelPrice(editing);
            await refresh();
            router.back();
          })();
        },
      },
    ]);
  }

  if (!loaded) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }}>{showSkeleton ? <RecordSkeleton /> : null}</SafeAreaView>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {editing ? t.fuelPricesUi.editTitle : t.fuelPricesUi.newTitle}
        </T>

        <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
          {t.fuelPricesUi.fuel}
        </T>
        <FuelPicker value={fuel} onChange={setFuel} />

        <Field
          label={t.fuelPricesUi.price(FUEL_CATALOG[fuel].perUnitLabel)}
          keyboardType="decimal-pad"
          value={price}
          onChangeText={setPrice}
          placeholder={String(data.settings.referencePrices[fuel])}
        />

        <DateField label={t.fuelPricesUi.date} value={date} onChange={setDate} hint={t.fuelPricesUi.dateHint} />

        <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
          {t.fuelPricesUi.source}
        </T>
        <View style={styles.chips}>
          {SOURCES.map((s) => (
            <Chip key={s} label={fuelPriceSourceLabel(s)} selected={s === source} onPress={() => setSource(s)} />
          ))}
        </View>

        {needsStation ? (
          <>
            <PickerField label={t.fuelPricesUi.station} value={station || null} placeholder={t.fuelPricesUi.stationPick} onPress={() => setStationOpen(true)} />
            <SearchSheet
              visible={stationOpen}
              title={t.fuelPricesUi.station}
              items={stationItems}
              selectedKey={station || null}
              otherLabel={t.fuel.stationOther}
              onPick={(pick) => {
                setStation('other' in pick ? normaliseStation(pick.other) : pick.label);
                setStationOpen(false);
              }}
              onClose={() => setStationOpen(false)}
            />
          </>
        ) : null}

        <Field label={t.fuelPricesUi.note} value={note} onChangeText={setNote} placeholder={t.fuelPricesUi.notePlaceholder} />

        <PrimaryButton label={t.fuelPricesUi.save} onPress={() => void save()} disabled={saving} />
        {editing ? <GhostButton danger label={t.fuelPricesUi.delete} onPress={confirmDelete} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 56 },
  h: { fontSize: 26, lineHeight: 28, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: space.md },
  label: { fontSize: 12, marginBottom: space.sm, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
});
