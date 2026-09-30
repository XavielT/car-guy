import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListCardsSkeleton } from '@/components/skeletons/ListCardsSkeleton';
import { T } from '@/components/T';
import { EmptyState, PrimaryButton, StatusPill, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { documents as documentRepo } from '@/lib/db/repos';
import type { VehicleDocument } from '@/lib/db/types';
import { daysBetween, todayIso } from '@/lib/domain/dates';
import { dateLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

export default function DocumentosScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, data } = useStore();
  const [rows, setRows] = useState<VehicleDocument[]>([]);
  // The empty state waits for the first read instead of flashing (ADR-40).
  const [loaded, setLoaded] = useState(false);

  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    documentRepo
      .list(vehicleId, { orderBy: 'expires_at', direction: 'ASC' })
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, data]);

  const showSkeleton = useDelayedLoading(!loaded);

  if (!activeVehicle) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {t.documents.title}
        </T>
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {t.documents.subtitle}
        </T>

        {showSkeleton ? (
          <ListCardsSkeleton n={4} pill />
        ) : !loaded ? null : rows.length === 0 ? (
          <EmptyState icon="document-text-outline" message={t.documents.empty} />
        ) : (
          rows.map((doc) => {
            const days = doc.expiresAt ? daysBetween(todayIso(), doc.expiresAt) : null;
            return (
              <Pressable
                key={doc.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/documento/[id]', params: { id: doc.id } })}>
                <Surface style={{ marginBottom: space.sm }}>
                  <View style={styles.headerRow}>
                    <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
                      {doc.title}
                    </T>
                    {days != null ? (
                      <StatusPill
                        status={days < 0 ? 'vencido' : days <= 45 ? 'proximo' : 'ok'}
                        label={t.documents.expiresOn(dateLabel(doc.expiresAt!))}
                      />
                    ) : null}
                  </View>
                  <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 4 }}>
                    {t.documents.kinds[doc.kind]}
                    {doc.expiresAt ? '' : ` · ${t.documents.noExpiry}`}
                  </T>
                </Surface>
              </Pressable>
            );
          })
        )}

        <View style={{ height: space.lg }} />
        <PrimaryButton label={t.documents.new} onPress={() => router.push('/documento/nuevo')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 30, lineHeight: 32, textTransform: 'uppercase', letterSpacing: 0.3 },
  sub: { fontSize: 13, marginTop: 2, marginBottom: space.lg, lineHeight: 19 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
});
