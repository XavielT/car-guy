import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { EmptyState } from '@/components/ui';
import { space } from '@/constants/theme';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Placeholder for the feature this whole app exists for. PROMPT-05 builds the
 * runner, the templates and the streak; this phase only claims the tab so the
 * navigation is final and nothing has to move again.
 */
export default function ChequeoScreen() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg.base }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.title, { color: theme.text.primary }]}>
          {es.check.title}
        </T>
        <EmptyState icon="clipboard-outline" message={es.check.comingSoon} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pad: { padding: space.gutter },
  title: { fontSize: 34, marginBottom: space.xl },
});
