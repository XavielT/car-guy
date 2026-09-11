import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import { DEFAULT_PRICE_WEEK, DEFAULT_REFERENCE_PRICES, FUEL_CATALOG, FUEL_ORDER } from '@/lib/fuel';
import { parseDecimal } from '@/lib/math';
import { useStore } from '@/lib/store';
import type { FuelType, ReferencePrices } from '@/lib/types';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PreciosScreen() {
  const router = useRouter();
  const { data, updateSettings } = useStore();
  const [week, setWeek] = useState(data.settings.priceWeekLabel);
  const [prices, setPrices] = useState<Record<FuelType, string>>(
    Object.fromEntries(FUEL_ORDER.map((t) => [t, String(data.settings.referencePrices[t])])) as Record<
      FuelType,
      string
    >,
  );

  function save() {
    const next = { ...data.settings.referencePrices } as ReferencePrices;
    for (const t of FUEL_ORDER) {
      const n = parseDecimal(prices[t]);
      if (n != null) next[t] = n;
    }
    updateSettings({ referencePrices: next, priceWeekLabel: week.trim() || DEFAULT_PRICE_WEEK });
    router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.receipt }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={styles.h}>
          Precios MICM
        </T>
        <T face="body" style={styles.p}>
          Semilla: semana del 15–21 ago 2026. Actualízalos cuando salga el aviso nuevo. No se descargan solos.
        </T>
        <Field label="Semana / fuente" value={week} onChangeText={setWeek} />
        {FUEL_ORDER.map((t) => (
          <Field
            key={t}
            label={`${FUEL_CATALOG[t].label} (${FUEL_CATALOG[t].perUnitLabel})`}
            keyboardType="decimal-pad"
            value={prices[t]}
            onChangeText={(v) => setPrices((p) => ({ ...p, [t]: v }))}
          />
        ))}
        <PrimaryButton label="Guardar referencia" onPress={save} />
        <GhostButton
          label="Volver a precios semilla"
          onPress={() => {
            setWeek(DEFAULT_PRICE_WEEK);
            setPrices(
              Object.fromEntries(FUEL_ORDER.map((t) => [t, String(DEFAULT_REFERENCE_PRICES[t])])) as Record<
                FuelType,
                string
              >,
            );
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 40 },
  h: { fontSize: 36, color: colors.ink },
  p: { color: colors.muted, marginVertical: 12, lineHeight: 22 },
});
