import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { PhotoPicker } from '@/components/PhotoPicker';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { saveDocument } from '@/lib/db/documentOps';
import type { DocumentKind, Media } from '@/lib/db/types';
import { isoFromDateInput } from '@/lib/format';
import { pickPdf } from '@/lib/media/pdf';
import { t } from '@/lib/i18n';
import { Alert } from '@/lib/alert';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

const KINDS: DocumentKind[] = ['seguro', 'marbete', 'matricula', 'licencia', 'factura', 'garantia', 'otro'];

export default function NuevoDocumentoScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh } = useStore();

  const [kind, setKind] = useState<DocumentKind>('seguro');
  const [title, setTitle] = useState('');
  const [issued, setIssued] = useState('');
  const [expires, setExpires] = useState('');
  const [notes, setNotes] = useState('');
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [pdf, setPdf] = useState<Media | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documentId] = useState(() => `doc_${Date.now()}`);

  if (!activeVehicle) return null;

  function save() {
    if (!title.trim()) return setError(t.documents.nameRequired);
    setError(null);
    void (async () => {
      const result = await saveDocument({
        id: documentId,
        vehicleId: activeVehicle!.id,
        kind,
        title: title.trim(),
        issuedAt: issued ? isoFromDateInput(issued) : null,
        expiresAt: expires ? isoFromDateInput(expires) : null,
        mediaId,
        notes: notes.trim(),
      });
      await refresh();
      if (result.linked) Alert.alert(t.documents.save, t.documents.linkedReminder);
      router.back();
    })();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {t.documents.new}
        </T>

        <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
          {t.documents.kind}
        </T>
        <View style={styles.row}>
          {KINDS.map((k) => {
            const on = kind === k;
            return (
              <Pressable
                key={k}
                onPress={() => {
                  setKind(k);
                  if (!title.trim()) setTitle(t.documents.kinds[k]);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[
                  styles.chip,
                  { backgroundColor: on ? theme.accentFill : theme.bg.raised, borderColor: on ? theme.accentFill : theme.line },
                ]}>
                <T face="title" style={{ color: on ? theme.accentFillInk : theme.text.secondary, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {t.documents.kinds[k]}
                </T>
              </Pressable>
            );
          })}
        </View>

        <Field label={t.documents.name} value={title} onChangeText={setTitle} />
        <DateField label={t.documents.issued} value={issued} onChange={setIssued} noFuture />
        <DateField
          label={t.documents.expires}
          value={expires}
          onChange={setExpires}
          hint={t.documents.expiresHint}
        />

        <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
          {t.documents.file}
        </T>
        {pdf ? (
          <View style={[styles.pdf, { borderColor: theme.lineStrong, backgroundColor: theme.bg.raised }]}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 14, flex: 1 }} numberOfLines={1}>
              {`PDF · ${pdf.caption || t.documents.pdf}`}
            </T>
            <GhostButton label={t.common.removePhoto} onPress={() => (setPdf(null), setMediaId(null))} />
          </View>
        ) : (
          <>
            <PhotoPicker
              mediaId={mediaId}
              ownerTable="document"
              ownerId={documentId}
              vehicleId={activeVehicle.id}
              onChange={setMediaId}
            />
            {mediaId ? null : (
              <GhostButton
                label={t.documents.attachPdf}
                onPress={() =>
                  void pickPdf({ ownerTable: 'document', ownerId: documentId, vehicleId: activeVehicle.id }).then((r) => {
                    if (r.ok) {
                      setPdf(r.media);
                      setMediaId(r.media.id);
                    } else if (r.reason !== 'cancelled') setError(r.reason === 'too-big' ? t.documents.pdfTooBig : t.documents.pdfFailed);
                  })
                }
              />
            )}
          </>
        )}

        <Field label={t.documents.notes} value={notes} onChangeText={setNotes} multiline />

        {error ? (
          <T face="body" style={{ color: theme.dangerText, fontSize: 13, marginBottom: space.md }}>
            {error}
          </T>
        ) : null}
        <PrimaryButton label={t.documents.save} onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 28, lineHeight: 30, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: space.lg },
  label: { fontSize: 12, marginBottom: 6 },
  pdf: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.input, paddingLeft: space.md, marginBottom: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  chip: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: 6 },
});
