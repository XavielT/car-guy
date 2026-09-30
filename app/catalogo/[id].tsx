import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { PrimaryButton } from '@/components/ui';
import { space } from '@/constants/theme';
import { saveServiceTypeInterval } from '@/lib/db/catalogOps';
import { serviceTypes as serviceTypeRepo } from '@/lib/db/repos';
import type { ServiceType } from '@/lib/db/types';
import { t } from '@/lib/i18n';
import { catalogLabel } from '@/lib/i18n/catalog';
import { Alert } from '@/lib/alert';
import { isInvalidNumber, parseDecimal } from '@/lib/math';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

const toInt = (text: string) => {
  const value = text.trim() ? parseDecimal(text) : null;
  return value == null || !Number.isFinite(value) || value <= 0 ? null : Math.round(value);
};

/** One catalog item's default interval. */
export default function CatalogoItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh } = useStore();

  const [type, setType] = useState<ServiceType | null>(null);
  const [km, setKm] = useState('');
  const [months, setMonths] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    serviceTypeRepo
      .getById(id)
      .then((row) => {
        if (cancelled || !row) return;
        setType(row);
        setKm(row.defaultIntervalKm != null ? String(row.defaultIntervalKm) : '');
        setMonths(row.defaultIntervalMonths != null ? String(row.defaultIntervalMonths) : '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!type) return null;

  function save() {
    // A typo must not quietly remove the interval (toInt maps it to null).
    const bad = ([[km, t.catalog.intervalKm], [months, t.catalog.intervalMonths]] as const).find(
      ([text]) => isInvalidNumber(text) || (text.trim() !== '' && (parseDecimal(text) ?? 0) <= 0),
    );
    if (bad) return Alert.alert(t.catalog.title, t.common.invalidNumber(bad[1]));
    void (async () => {
      const { updated } = await saveServiceTypeInterval(type!.id, { km: toInt(km), months: toInt(months) });
      await refresh();
      Alert.alert(t.catalog.saved, t.catalog.updated(updated));
      router.back();
    })();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {catalogLabel('serviceType', type)}
        </T>
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {t.catalog.hint}
        </T>
        <Field label={t.catalog.intervalKm} keyboardType="number-pad" value={km} onChangeText={setKm} />
        <Field
          label={t.catalog.intervalMonths}
          keyboardType="number-pad"
          value={months}
          onChangeText={setMonths}
        />
        <PrimaryButton label={t.catalog.save} onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 26, lineHeight: 28, textTransform: 'uppercase', letterSpacing: 0.3 },
  sub: { fontSize: 13, marginTop: 4, marginBottom: space.lg, lineHeight: 19 },
});
