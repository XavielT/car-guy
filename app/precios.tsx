import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { PriceBoard } from '@/components/PriceBoard';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton } from '@/components/ui';
import { space } from '@/constants/theme';
import { parseDecimal } from '@/lib/domain/economy';
import { DEFAULT_PRICE_WEEK, DEFAULT_REFERENCE_PRICES, FUEL_CATALOG, FUEL_ORDER } from '@/lib/fuel';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import type { FuelType, ReferencePrices } from '@/lib/types';

export default function PreciosScreen() {
  const router = useRouter();
  const { theme } = useTheme();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.prices.title}
        </T>
        <T face="body" style={[styles.p, { color: theme.text.secondary }]}>
          {es.prices.intro}
        </T>

        {/* The board used to be the home screen's hero. It belongs here: it is
            reference information about fuel prices, not a fact about your car. */}
        <View style={{ marginBottom: space.lg }}>
          <PriceBoard
            eyebrow={es.prices.boardEyebrow}
            amount={data.settings.priceWeekLabel}
            caption={es.prices.boardCaption}
            prices={data.settings.referencePrices}
          />
        </View>

        <Field label={es.prices.week} value={week} onChangeText={setWeek} />
        {FUEL_ORDER.map((t) => (
          <Field
            key={t}
            label={`${FUEL_CATALOG[t].label} (${FUEL_CATALOG[t].perUnitLabel})`}
            keyboardType="decimal-pad"
            value={prices[t]}
            onChangeText={(v) => setPrices((p) => ({ ...p, [t]: v }))}
          />
        ))}
        <PrimaryButton label={es.prices.save} onPress={save} />
        <GhostButton
          label={es.prices.reset}
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
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 34 },
  p: { marginVertical: space.md, lineHeight: 22 },
});
