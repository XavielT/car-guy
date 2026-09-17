import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { EmptyState, PrimaryButton, StatusPill, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { documents as documentRepo } from '@/lib/db/repos';
import type { VehicleDocument } from '@/lib/db/types';
import { daysBetween, todayIso } from '@/lib/domain/dates';
import { dateLabel } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

export default function DocumentosScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, data } = useStore();
  const [rows, setRows] = useState<VehicleDocument[]>([]);

  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    documentRepo
      .list(vehicleId, { orderBy: 'expires_at', direction: 'ASC' })
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicleId, data]);

  if (!activeVehicle) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.documents.title}
        </T>
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {es.documents.subtitle}
        </T>

        {rows.length === 0 ? (
          <EmptyState icon="document-text-outline" message={es.documents.empty} />
        ) : (
          rows.map((doc) => {
            const days = doc.expiresAt ? daysBetween(todayIso(), doc.expiresAt) : null;
            return (
              <Pressable
                key={doc.id}
                onPress={() => router.push({ pathname: '/documento/[id]', params: { id: doc.id } })}>
                <Surface style={{ marginBottom: space.sm }}>
                  <View style={styles.headerRow}>
                    <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
                      {doc.title}
                    </T>
                    {days != null ? (
                      <StatusPill
                        status={days < 0 ? 'vencido' : days <= 45 ? 'proximo' : 'ok'}
                        label={es.documents.expiresOn(dateLabel(doc.expiresAt!))}
                      />
                    ) : null}
                  </View>
                  <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 4 }}>
                    {es.documents.kinds[doc.kind]}
                    {doc.expiresAt ? '' : ` · ${es.documents.noExpiry}`}
                  </T>
                </Surface>
              </Pressable>
            );
          })
        )}

        <View style={{ height: space.lg }} />
        <PrimaryButton label={es.documents.new} onPress={() => router.push('/documento/nuevo')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 30 },
  sub: { fontSize: 13, marginTop: 2, marginBottom: space.lg, lineHeight: 19 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
});
