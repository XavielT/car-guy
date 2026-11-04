import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContactForm } from '@/components/diy/ContactPieces';
import { CONTACT_KINDS } from '@/lib/domain/contacts';
import { useTheme } from '@/lib/theme/useTheme';

/** New contact. */
export default function NewContactScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const p = useLocalSearchParams<{ name?: string; kind?: string; phone?: string; address?: string; notes?: string }>();
  // Pre-filled by "Agregar como contacto" in the nearby-places list; every value is validated, none is trusted.
  const kind = CONTACT_KINDS.find((k) => k === p.kind);
  const prefill = { ...(p.name ? { name: p.name.slice(0, 80) } : {}), ...(kind ? { kind } : {}), ...(p.phone ? { phone: p.phone.slice(0, 30) } : {}), ...(p.address ? { address: p.address.slice(0, 120) } : {}), ...(p.notes ? { notes: p.notes.slice(0, 200) } : {}) };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ContactForm onDone={() => router.back()} prefill={prefill} />
    </SafeAreaView>
  );
}
