import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { PrimaryButton } from '@/components/ui';
import { space } from '@/constants/theme';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * What a detail screen shows when its record is gone — deleted here, deleted
 * on another device and synced, or reached through an old notification.
 * Returning nothing left a header over an empty page and no way forward.
 */
export function MissingRecord() {
  const router = useRouter();
  const { theme } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <View style={styles.wrap}>
        <T face="title" style={{ color: theme.text.primary, fontSize: 20, textAlign: 'center' }}>
          {es.common.missingTitle}
        </T>
        <T face="body" style={[styles.body, { color: theme.text.secondary }]}>
          {es.common.missingBody}
        </T>
        <PrimaryButton label={es.common.missingAction} onPress={() => router.replace('/(tabs)')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: space.gutter, gap: space.md },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: space.md },
});
