import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { space } from '@/constants/theme';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';

export default function NotFoundScreen() {
  const { theme } = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: es.notFound.title }} />
      <View style={[styles.container, { backgroundColor: theme.bg.base }]}>
        <T face="display" style={[styles.title, { color: theme.text.primary }]}>
          {es.notFound.title}
        </T>
        <T face="body" style={[styles.body, { color: theme.text.secondary }]}>
          {es.notFound.body}
        </T>
        <Link href="/" style={styles.link}>
          <T face="title" style={{ color: theme.accent, fontSize: 15, letterSpacing: 1, textTransform: 'uppercase' }}>
            {es.notFound.back}
          </T>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.gutter,
  },
  title: { fontSize: 30, lineHeight: 32, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },
  body: { fontSize: 14, textAlign: 'center', marginTop: space.sm, lineHeight: 21 },
  link: { marginTop: space.lg, paddingVertical: space.md, minHeight: 44 },
});
