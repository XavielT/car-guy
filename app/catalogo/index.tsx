import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { NavRow } from '@/components/ui';
import { space } from '@/constants/theme';
import { serviceTypes as serviceTypeRepo } from '@/lib/db/repos';
import type { ServiceType } from '@/lib/db/types';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The maintenance catalog: every item the app knows, with how often it is due.
 *
 * Global, not per vehicle — it is the default a new reminder starts from. The
 * reminders themselves carry their own intervals, which is why a change here
 * only moves the ones that were still on the old default.
 */
export default function CatalogoScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { data } = useStore();
  const [types, setTypes] = useState<ServiceType[]>([]);

  useEffect(() => {
    let cancelled = false;
    serviceTypeRepo
      .list(undefined, { orderBy: 'sort_order', direction: 'ASC' })
      .then((rows) => {
        if (!cancelled) setTypes(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [data]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.catalog.title}
        </T>
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {es.catalog.subtitle}
        </T>
        {types.map((type) => (
          <NavRow
            key={type.id}
            label={type.name}
            caption={es.catalog.every(type.defaultIntervalKm, type.defaultIntervalMonths)}
            onPress={() => router.push({ pathname: '/catalogo/[id]', params: { id: type.id } })}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40, gap: space.sm },
  h: { fontSize: 30 },
  sub: { fontSize: 13, marginTop: 2, marginBottom: space.md, lineHeight: 19 },
});
