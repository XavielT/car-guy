import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui';
import { space } from '@/constants/theme';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';

/** Reached from QuickActions → Mantenimiento. PROMPT-04 builds the real form. */
export default function NuevoServicioScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg.base }]} edges={['bottom']}>
      <View style={styles.pad}>
        <EmptyState
          icon="construct-outline"
          message={es.placeholder.service}
          actionLabel={es.placeholder.back}
          onAction={() => router.back()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pad: { flex: 1, justifyContent: 'center', padding: space.gutter },
});
