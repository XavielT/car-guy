import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { PhotoPicker } from '@/components/PhotoPicker';
import { T } from '@/components/T';
import { PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { saveDocument } from '@/lib/db/documentOps';
import type { DocumentKind } from '@/lib/db/types';
import { isoFromDateInput } from '@/lib/format';
import { es } from '@/lib/i18n/es';
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
  const [error, setError] = useState<string | null>(null);
  const [documentId] = useState(() => `doc_${Date.now()}`);

  if (!activeVehicle) return null;

  function save() {
    if (!title.trim()) return setError(es.documents.nameRequired);
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
      if (result.linked) Alert.alert(es.documents.save, es.documents.linkedReminder);
      router.back();
    })();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.documents.new}
        </T>

        <T face="semibold" style={[styles.label, { color: theme.text.primary }]}>
          {es.documents.kind}
        </T>
        <View style={styles.row}>
          {KINDS.map((k) => {
            const on = kind === k;
            return (
              <Pressable
                key={k}
                onPress={() => {
                  setKind(k);
                  if (!title.trim()) setTitle(es.documents.kinds[k]);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[
                  styles.chip,
                  { backgroundColor: on ? theme.accent : theme.bg.raised, borderColor: on ? theme.accent : theme.line },
                ]}>
                <T face="semibold" style={{ color: on ? theme.accentInk : theme.text.secondary, fontSize: 12 }}>
                  {es.documents.kinds[k]}
                </T>
              </Pressable>
            );
          })}
        </View>

        <Field label={es.documents.name} value={title} onChangeText={setTitle} />
        <DateField label={es.documents.issued} value={issued} onChange={setIssued} noFuture />
        <DateField
          label={es.documents.expires}
          value={expires}
          onChange={setExpires}
          hint={es.documents.expiresHint}
        />

        <T face="semibold" style={[styles.label, { color: theme.text.primary }]}>
          {es.documents.file}
        </T>
        <PhotoPicker
          mediaId={mediaId}
          ownerTable="document"
          ownerId={documentId}
          vehicleId={activeVehicle.id}
          onChange={setMediaId}
        />

        <Field label={es.documents.notes} value={notes} onChangeText={setNotes} multiline />

        {error ? (
          <T face="body" style={{ color: theme.danger, fontSize: 13, marginBottom: space.md }}>
            {error}
          </T>
        ) : null}
        <PrimaryButton label={es.documents.save} onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 28, marginBottom: space.lg },
  label: { fontSize: 13, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  chip: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: 6 },
});
