import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MissingRecord } from '@/components/MissingRecord';
import { T } from '@/components/T';
import { GhostButton, StatusPill, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { documents as documentRepo } from '@/lib/db/repos';
import type { VehicleDocument } from '@/lib/db/types';
import { daysBetween, todayIso } from '@/lib/domain/dates';
import { dateLabel } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { Alert } from '@/lib/alert';
import { useMediaUri } from '@/lib/media/useMediaUri';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

export default function DocumentoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh, data } = useStore();
  const [doc, setDoc] = useState<VehicleDocument | null | undefined>(undefined);
  const uri = useMediaUri(doc?.mediaId);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    documentRepo
      .getById(id)
      .then((row) => {
        if (!cancelled) setDoc(row);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, data]);

  // undefined: still loading · null: looked, and it is gone.
  if (doc === null) return <MissingRecord />;
  if (!doc) return null;
  const days = doc.expiresAt ? daysBetween(todayIso(), doc.expiresAt) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {doc.title}
        </T>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: space.md }}>
          {es.documents.kinds[doc.kind]}
          {doc.issuedAt ? ` · ${es.documents.issued} ${dateLabel(doc.issuedAt)}` : ''}
        </T>

        {days != null ? (
          <StatusPill
            status={days < 0 ? 'vencido' : days <= 45 ? 'proximo' : 'ok'}
            label={es.documents.expiresOn(dateLabel(doc.expiresAt!))}
          />
        ) : null}

        {uri ? <Image source={{ uri }} style={[styles.image, { backgroundColor: theme.bg.raised }]} resizeMode="contain" /> : null}

        {doc.notes ? (
          <Surface style={{ marginTop: space.lg }}>
            <T face="body" style={{ color: theme.text.secondary, lineHeight: 20 }}>
              {doc.notes}
            </T>
          </Surface>
        ) : null}

        <GhostButton
          danger
          label={es.common.delete}
          onPress={() =>
            Alert.alert(doc.title, es.documents.deleteConfirm, [
              { text: es.common.cancel, style: 'cancel' },
              {
                text: es.common.delete,
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    await documentRepo.softDelete(doc.id);
                    await refresh();
                    router.back();
                  })();
                },
              },
            ])
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 26 },
  image: { width: '100%', height: 320, borderRadius: radius.card, marginTop: space.lg },
});
