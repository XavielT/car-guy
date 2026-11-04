import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListCardsSkeleton } from '@/components/skeletons/ListCardsSkeleton';
import { T } from '@/components/T';
import { EmptyState, PrimaryButton, StatusPill, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { Alert } from '@/lib/alert';
import { createDocumentReminder } from '@/lib/db/documentOps';
import { documents as documentRepo } from '@/lib/db/repos';
import type { VehicleDocument } from '@/lib/db/types';
import { daysBetween, todayIso } from '@/lib/domain/dates';
import { suggestExpiryReminders } from '@/lib/domain/documentExpiry';
import { dateLabel, todayIsoDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

export default function DocumentosScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, data, refresh } = useStore();
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
  // C3 (IMP 03112026 SPEC-C): a document with an expiry and no reminder gets a "Crear recordatorio" suggestion.
  const suggestions = suggestExpiryReminders(rows, todayIsoDate()).slice(0, 3);

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

        {suggestions.map((s) => (
          <Surface key={s.documentId} style={{ marginBottom: space.sm }}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
              {t.ai.documents.suggestTitle}
            </T>
            <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
              {s.status === 'expired' ? t.ai.documents.suggestExpired(s.title, dateLabel(s.expiresAt)) : t.ai.documents.suggestBody(s.title, dateLabel(s.expiresAt))}
            </T>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const doc = rows.find((r) => r.id === s.documentId);
                if (!doc) return;
                void createDocumentReminder(doc).then(async (id) => {
                  if (id) {
                    await refresh();
                    Alert.alert(t.documents.title, t.ai.documents.reminderCreated);
                  }
                });
              }}
              style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 4 }}>
              <T face="semibold" style={{ color: theme.accent, fontSize: 14 }}>
                {t.ai.documents.createReminder}
              </T>
            </Pressable>
          </Surface>
        ))}

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
