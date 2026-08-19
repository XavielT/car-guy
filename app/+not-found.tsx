import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { colors } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Nada aquí' }} />
      <View style={styles.container}>
        <T face="title" style={styles.title}>
          Esa pantalla no existe.
        </T>
        <Link href="/" style={styles.link}>
          <T face="bold" style={styles.linkText}>
            Volver al tablero
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
    padding: 20,
    backgroundColor: colors.receipt,
  },
  title: { fontSize: 20, color: colors.ink },
  link: { marginTop: 16, paddingVertical: 12 },
  linkText: { color: colors.nozzle },
});
