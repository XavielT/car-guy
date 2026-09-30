import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MissingRecord } from '@/components/MissingRecord';
import { RecordSkeleton } from '@/components/skeletons/RecordSkeleton';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton, StatusPill, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { documents as documentRepo, media as mediaRepo } from '@/lib/db/repos';
import type { Media, VehicleDocument } from '@/lib/db/types';
import { openPdf } from '@/lib/media/pdf';
import { daysBetween, todayIso } from '@/lib/domain/dates';
import { dateLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
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
  const [file, setFile] = useState<Media | null>(null);
  // A PDF is opened, not drawn: no <Image> for it (mediaUri would hand one a PDF blob).
  const uri = useMediaUri(file?.kind === 'pdf' ? null : doc?.mediaId);

  useEffect(() => {
    let cancelled = false;
    void (doc?.mediaId ? mediaRepo.getById(doc.mediaId) : Promise.resolve(null)).then((m) => !cancelled && setFile(m));
    return () => {
      cancelled = true;
    };
  }, [doc?.mediaId]);

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

  // undefined: still loading · null: looked, and it is gone. A refresh keeps the
  // row on screen, so the skeleton only ever covers the first read.
  const showSkeleton = useDelayedLoading(doc === undefined);
  if (doc === null) return <MissingRecord />;
  if (!doc) return showSkeleton ? <RecordSkeleton cards={[28, 320]} buttons={1} /> : null;
  const days = doc.expiresAt ? daysBetween(todayIso(), doc.expiresAt) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {doc.title}
        </T>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: space.md }}>
          {t.documents.kinds[doc.kind]}
          {doc.issuedAt ? ` · ${t.documents.issued} ${dateLabel(doc.issuedAt)}` : ''}
        </T>

        {days != null ? (
          <StatusPill
            status={days < 0 ? 'vencido' : days <= 45 ? 'proximo' : 'ok'}
            label={t.documents.expiresOn(dateLabel(doc.expiresAt!))}
          />
        ) : null}

        {file?.kind === 'pdf' ? (
          <PrimaryButton label={t.documents.openPdf(file.caption || t.documents.pdf)} onPress={() => void openPdf(file)} />
        ) : uri ? (
          <Image source={{ uri }} style={[styles.image, { backgroundColor: theme.bg.raised }]} resizeMode="contain" />
        ) : null}

        {doc.notes ? (
          <Surface style={{ marginTop: space.lg }}>
            <T face="body" style={{ color: theme.text.secondary, lineHeight: 20 }}>
              {doc.notes}
            </T>
          </Surface>
        ) : null}

        <GhostButton
          danger
          label={t.common.delete}
          onPress={() =>
            Alert.alert(doc.title, t.documents.deleteConfirm, [
              { text: t.common.cancel, style: 'cancel' },
              {
                text: t.common.delete,
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
  h: { fontSize: 26, lineHeight: 28, textTransform: 'uppercase', letterSpacing: 0.3 },
  image: { width: '100%', height: 320, borderRadius: radius.card, marginTop: space.lg },
});
