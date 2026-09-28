import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContactForm } from '@/components/diy/ContactPieces';
import { useTheme } from '@/lib/theme/useTheme';

/** A contact and what they have done for the garage. */
export default function ContactScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ContactForm contactId={id} onDone={() => router.back()} />
    </SafeAreaView>
  );
}
