import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiFieldMark } from '@/components/ai/AiFieldMark';
import { CaptureButton } from '@/components/ai/CaptureButton';
import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { PhotoPicker } from '@/components/PhotoPicker';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { documentPrefillFrom, guardDocument, type DocumentMarks, type GuardVehicle } from '@/lib/ai/docMap';
import { withoutMark } from '@/lib/ai/draft';
import type { ReadResult } from '@/lib/ai/read';
import { saveDocument } from '@/lib/db/documentOps';
import { vehicles as vehicleRepo } from '@/lib/db/repos';
import { recordReportable } from '@/lib/diagnostics';
import { storePhoto } from '@/lib/media';
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
  const { activeVehicle, refresh, data, setActiveVehicle } = useStore();

  const [kind, setKind] = useState<DocumentKind>('seguro');
  const [title, setTitle] = useState('');
  const [issued, setIssued] = useState('');
  const [expires, setExpires] = useState('');
  const [notes, setNotes] = useState('');
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [pdf, setPdf] = useState<Media | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documentId] = useState(() => `doc_${Date.now()}`);
  // IMP 03112026 (ADR-67): a photo of the paper fills the kind, title, dates and notes; the person saves as always.
  const [marks, setMarks] = useState<DocumentMarks>({});
  const unmark = (k: keyof DocumentMarks) => setMarks((m) => withoutMark(m as Record<string, number>, k) as DocumentMarks);

  if (!activeVehicle) return null;

  /** Fills what the paper carries (never a field it did not read), keeps each confidence, keeps the photo as the document's file. */
  function applyDocument(result: ReadResult, photo: { uri: string }, vehicleId: string) {
    const { prefill: p, marks: m } = documentPrefillFrom(result);
    if (p.kind) setKind(p.kind);
    const kindName = p.isRevision ? t.ai.documents.revisionTitle : p.kind ? t.documents.kinds[p.kind] : null;
    const autoTitles = new Set<string>(Object.values(t.documents.kinds));
    autoTitles.add(t.ai.documents.revisionTitle);
    if (kindName && (!title.trim() || autoTitles.has(title.trim()))) {
      setTitle(p.titleDetail && !p.isRevision ? `${kindName} · ${p.titleDetail}` : p.isRevision && p.titleDetail ? `${kindName} · ${p.titleDetail}` : kindName);
    }
    if (p.issuedAt) setIssued(p.issuedAt);
    if (p.expiresAt) setExpires(p.expiresAt);
    if (p.notes && !notes.trim()) setNotes(p.notes);
    setMarks((cur) => ({ ...cur, ...m }));
    if (!p.kind) Alert.alert(t.ai.consent.title, t.ai.documents.unsureKind);
    if (!mediaId) {
      void storePhoto({ uri: photo.uri, width: null, takenAt: new Date().toISOString() }, { ownerTable: 'document', ownerId: documentId, vehicleId })
        .then((media) => media && setMediaId(media.id))
        .catch((e) => recordReportable('ai-photo-attach', e));
    }
  }

  /** The wrong-car guard runs BEFORE anything is applied: switch car, use it here anyway, or drop the read. */
  async function onRead(result: ReadResult, photo: { uri: string }) {
    const { prefill } = documentPrefillFrom(result);
    if (!prefill.kind && !prefill.issuedAt && !prefill.expiresAt && !prefill.notes && !prefill.vehicle.plate && !prefill.vehicle.vin) {
      Alert.alert(t.ai.consent.title, t.ai.capture.nothingRead);
      return;
    }
    const rows = await Promise.all(data.vehicles.map((v) => vehicleRepo.getById(v.id).catch(() => null)));
    const all: GuardVehicle[] = rows.filter((r): r is NonNullable<typeof r> => !!r).map((r) => ({ id: r.id, name: r.name, plate: r.plate ?? null, vin: r.vin ?? null }));
    const here: GuardVehicle = all.find((v) => v.id === activeVehicle!.id) ?? { id: activeVehicle!.id, name: activeVehicle!.name, plate: activeVehicle!.plate || null, vin: null };
    const guard = guardDocument(prefill.vehicle, here, all);
    if (guard.status !== 'mismatch') {
      applyDocument(result, photo, here.id);
      return;
    }
    const other = guard.belongsTo;
    Alert.alert(t.ai.documents.wrongCarTitle, guard.docPlate ? t.ai.documents.wrongCar(guard.docPlate) : t.ai.documents.wrongCarNoPlate, [
      ...(other
        ? [
            {
              text: t.ai.documents.switchTo(other.name),
              onPress: () => {
                setActiveVehicle(other.id);
                applyDocument(result, photo, other.id);
              },
            },
          ]
        : []),
      { text: t.ai.documents.saveAnyway, onPress: () => applyDocument(result, photo, here.id) },
      { text: t.common.cancel, style: 'cancel' as const },
    ]);
  }

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

        <CaptureButton kind="document" icon="document-text-outline" label={t.ai.documents.scan} onRead={(r, ph) => void onRead(r, ph)} style={{ marginBottom: space.xs }} />
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17, marginBottom: space.md }}>
          {t.ai.documents.privacyNote}
        </T>

        <AiFieldMark confidence={marks.kind} />
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
                  unmark('kind');
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

        <AiFieldMark confidence={marks.title} />
        <Field label={t.documents.name} value={title} onChangeText={(v) => (setTitle(v), unmark('title'))} />
        <AiFieldMark confidence={marks.issued} />
        <DateField label={t.documents.issued} value={issued} onChange={(v) => (setIssued(v), unmark('issued'))} noFuture />
        <AiFieldMark confidence={marks.expires} />
        <DateField
          label={t.documents.expires}
          value={expires}
          onChange={(v) => (setExpires(v), unmark('expires'))}
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

        <AiFieldMark confidence={marks.notes} />
        <Field label={t.documents.notes} value={notes} onChangeText={(v) => (setNotes(v), unmark('notes'))} multiline />

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
