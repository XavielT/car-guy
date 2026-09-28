import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContactForm } from '@/components/diy/ContactPieces';
import { useTheme } from '@/lib/theme/useTheme';

/** New contact. */
export default function NewContactScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ContactForm onDone={() => router.back()} />
    </SafeAreaView>
  );
}
