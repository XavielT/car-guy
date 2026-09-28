import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip, GhostButton, PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { contactLinks, listContacts, saveContact, type ContactLink } from '@/lib/db/diyQueries';
import { contacts as contactRepo } from '@/lib/db/repos';
import type { Contact } from '@/lib/db/types';
import { CONTACT_KINDS, formatPhone, telLink, whatsappLink } from '@/lib/domain/contacts';
import { dateLabel } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';

/** Call and WhatsApp buttons, shown only when the number is dialable. */
export function ContactButtons({ contact }: { contact: Pick<Contact, 'phone' | 'whatsapp' | 'name'> }) {
  const tel = telLink(contact.phone);
  const wa = whatsappLink(contact.whatsapp || contact.phone);
  if (!tel && !wa) return null;
  return (
    <View style={styles.buttons}>
      {tel ? <IconButton icon="call-outline" label={es.contacts.call} onPress={() => void Linking.openURL(tel)} /> : null}
      {wa ? <IconButton icon="logo-whatsapp" label={es.contacts.chat} onPress={() => void Linking.openURL(wa)} /> : null}
    </View>
  );
}

function IconButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.icon, { borderColor: theme.lineStrong, backgroundColor: theme.bg.raised }]}>
      <Ionicons name={icon} size={18} color={theme.text.primary} />
      <T face="title" style={{ color: theme.text.primary, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' }}>
        {label}
      </T>
    </Pressable>
  );
}

/** The contact form, with what the contact has done for the garage underneath. */
export function ContactForm({ contactId, onDone }: { contactId?: string; onDone: () => void }) {
  const router = useRouter();
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Contact['kind']>('mecanico');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [address, setAddress] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [links, setLinks] = useState<ContactLink[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contactId) return;
    void (async () => {
      const [c, l] = await Promise.all([contactRepo.getById(contactId), contactLinks(contactId)]);
      if (c) {
        setName(c.name);
        setKind(c.kind);
        setPhone(c.phone ?? '');
        setWhatsapp(c.whatsapp ?? '');
        setAddress(c.address ?? '');
        setRating(c.rating);
        setNotes(c.notes);
      }
      setLinks(l);
    })();
  }, [contactId]);

  async function save() {
    if (!name.trim()) return setError(es.contacts.nameRequired);
    await saveContact({ id: contactId, name: name.trim(), kind, phone: phone.trim() || null, whatsapp: whatsapp.trim() || null, address: address.trim() || null, rating, notes: notes.trim() });
    onDone();
  }

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="display" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase', marginBottom: space.md }}>
        {contactId ? es.contacts.editTitle : es.contacts.newTitle}
      </T>
      <Field label={es.contacts.name} placeholder={es.contacts.namePlaceholder} value={name} onChangeText={(t) => (setName(t), setError(null))} />
      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.sm }}>
        {es.contacts.kind}
      </T>
      <View style={styles.chips}>
        {CONTACT_KINDS.map((k) => (
          <Chip key={k} label={es.contacts.kinds[k]} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>
      <Field label={es.contacts.phone} keyboardType="phone-pad" value={phone} onChangeText={setPhone} hint={formatPhone(phone) ?? undefined} />
      <Field label={es.contacts.whatsapp} keyboardType="phone-pad" value={whatsapp} onChangeText={setWhatsapp} />
      <ContactButtons contact={{ name, phone, whatsapp }} />
      <Field label={es.contacts.address} value={address} onChangeText={setAddress} />
      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.sm }}>
        {es.contacts.rating}
      </T>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(rating === n ? null : n)} accessibilityRole="button" accessibilityLabel={`${n}`} accessibilityState={{ selected: (rating ?? 0) >= n }} hitSlop={4}>
            <Ionicons name={(rating ?? 0) >= n ? 'star' : 'star-outline'} size={28} color={(rating ?? 0) >= n ? theme.accentFill : theme.text.muted} />
          </Pressable>
        ))}
      </View>
      <Field label={es.contacts.notes} value={notes} onChangeText={setNotes} multiline />
      {error ? (
        <T face="body" style={{ color: theme.dangerText, fontSize: 13, marginBottom: space.sm }}>
          {error}
        </T>
      ) : null}
      <PrimaryButton label={es.contacts.save} onPress={() => void save()} />
      {contactId ? <GhostButton danger label={es.contacts.delete} onPress={() => void contactRepo.softDelete(contactId).then(onDone)} /> : null}

      {contactId ? (
        <>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.lg, marginBottom: space.sm }}>
            {es.contacts.linked}
          </T>
          {!links.length ? (
            <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
              {es.contacts.noLinked}
            </T>
          ) : null}
          {links.map((l) => (
            <Pressable
              key={`${l.kind}:${l.id}`}
              onPress={() => (l.kind === 'mod' ? router.push({ pathname: '/mod/[id]', params: { id: l.id } }) : router.push({ pathname: '/servicio/[id]', params: { id: l.id } }))}
              accessibilityRole="link"
              style={[styles.link, { borderColor: theme.lineStrong, backgroundColor: theme.bg.surface }]}>
              <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
                {l.title}
              </T>
              <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
                {[l.vehicleName, l.date ? dateLabel(l.date) : null, l.kind === 'mod' ? 'MOD' : null].filter(Boolean).join(' · ')}
              </T>
            </Pressable>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

/**
 * "Taller o persona": the saved contacts as chips, plus "Otro (escribir)" for a
 * one-off name that is not worth a contact. The form keeps both values; the
 * contact wins when both are set.
 */
export function ContactPicker({
  contactId,
  text,
  onChange,
  textLabel,
}: {
  contactId: string | null;
  text?: string;
  onChange: (next: { contactId: string | null; text: string }) => void;
  textLabel?: string;
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [other, setOther] = useState(Boolean(text && !contactId));

  useEffect(() => {
    void listContacts().then(setContacts);
  }, []);

  return (
    <View>
      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.sm }}>
        {es.contacts.picker}
      </T>
      <View style={styles.chips}>
        <Chip label={es.contacts.pickerNone} selected={!contactId && !other} onPress={() => (setOther(false), onChange({ contactId: null, text: '' }))} />
        {contacts.map((c) => (
          <Chip key={c.id} label={c.name} selected={contactId === c.id} onPress={() => (setOther(false), onChange({ contactId: c.id, text: c.name }))} />
        ))}
        <Chip label={es.contacts.pickerOther} selected={other && !contactId} onPress={() => (setOther(true), onChange({ contactId: null, text: text ?? '' }))} />
        <Chip label="+" onPress={() => router.push('/contactos/nuevo')} />
      </View>
      {other && !contactId ? <Field label={textLabel ?? es.contacts.name} value={text ?? ''} onChangeText={(t) => onChange({ contactId: null, text: t })} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  buttons: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  icon: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.button, paddingHorizontal: space.md, minHeight: 44 },
  stars: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  link: { borderWidth: 1, borderRadius: radius.input, padding: space.md, marginBottom: space.sm },
});
