import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ContactButtons } from '@/components/diy/ContactPieces';
import { T } from '@/components/T';
import { EmptyState, PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { listContacts } from '@/lib/db/diyQueries';
import type { Contact } from '@/lib/db/types';
import { CONTACT_KINDS, formatPhone } from '@/lib/domain/contacts';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/** The garage's people, grouped by what they do, each a tap from a call or a WhatsApp. */
export default function ContactsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [contacts, setContacts] = useState<Contact[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      void listContacts().then(setContacts);
    }, []),
  );

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {t.contacts.eyebrow}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 30, textTransform: 'uppercase', marginBottom: space.md }}>
        {t.contacts.title}
      </T>
      {contacts && !contacts.length ? <EmptyState icon="people-outline" message={t.contacts.empty} /> : null}
      {CONTACT_KINDS.map((k) => {
        const list = (contacts ?? []).filter((c) => c.kind === k);
        if (!list.length) return null;
        return (
          <View key={k} style={{ marginBottom: space.md }}>
            <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.sm }}>
              {t.contacts.kinds[k]}
            </T>
            {list.map((c) => (
              <View key={c.id} style={[styles.row, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
                <Pressable onPress={() => router.push({ pathname: '/contactos/[id]', params: { id: c.id } })} accessibilityRole="button" style={{ gap: 2 }}>
                  <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
                    {c.name}
                    {c.rating ? `  ${'★'.repeat(c.rating)}` : ''}
                  </T>
                  {formatPhone(c.phone) ? (
                    <T face="mono" style={{ color: theme.text.muted, fontSize: 12 }}>
                      {formatPhone(c.phone)}
                    </T>
                  ) : null}
                </Pressable>
                <ContactButtons contact={c} />
              </View>
            ))}
          </View>
        );
      })}
      <PrimaryButton label={t.contacts.add} onPress={() => router.push('/contactos/nuevo')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  row: { borderWidth: 1, borderRadius: radius.button, padding: space.md, gap: space.sm, marginBottom: space.sm },
});
