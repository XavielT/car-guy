import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { palette, space } from '@/constants/theme';
import { seedRealGarage } from '@/lib/dev/garage';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Not a product screen: a realistic dataset, one tap.
 *
 * PROMPT-07 asks for the statistics to be verified "with a realistic dataset",
 * and the two ways to get one were importing a backup through a file picker no
 * test harness can drive, or typing forty records by hand. Since IMP 28092026
 * it writes Xaviel's real garage (lib/dev/garage.ts) — AE85, DS3, C3, Jetta —
 * with a year of fill-ups, services, expenses and tasks on the AE85 and DS3,
 * straight through the repositories, so it exercises the real write path
 * including the odometer mirroring.
 *
 * Gated on `__DEV__` and reachable only by typing the route, exactly like
 * `app/dev/tokens.tsx`. It adds rows; it never deletes any.
 */
export default function SeedScreen() {
  const { theme } = useTheme();
  const { refresh } = useStore();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (!__DEV__) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.dark.bg.base }}>
        <T face="body" style={{ color: palette.dark.text.secondary, padding: space.xl }}>
          Solo en desarrollo.
        </T>
      </SafeAreaView>
    );
  }

  async function seed() {
    setBusy(true);
    const lines: string[] = [];
    try {
      lines.push(...(await seedRealGarage()));
      await refresh();
      lines.push('Listo. Abre Cifras.');
    } catch (error) {
      lines.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLog(lines);
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={{ color: theme.text.primary, fontSize: 28 }}>
          Datos de prueba
        </T>
        <T face="body" style={{ color: theme.text.secondary, marginTop: 6, lineHeight: 21 }}>
          Crea el garaje real — Trueno AE85, DS3, C3 (proyecto) y Jetta (vendido) — con un año
          de historial en el AE85 y el DS3. Sin placas ni VIN. Solo agrega; no borra nada.
        </T>

        <Surface style={{ marginTop: space.xl }}>
          <PrimaryButton
            label={busy ? 'Escribiendo…' : 'Sembrar garaje'}
            onPress={seed}
            disabled={busy}
          />
          {log.length ? (
            <>
              {log.map((line) => (
                <T
                  key={line}
                  face="mono"
                  style={{ color: theme.text.secondary, fontSize: 12, marginTop: 8 }}>
                  · {line}
                </T>
              ))}
            </>
          ) : null}
        </Surface>

        <GhostButton label="Recargar" onPress={() => void refresh()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
});
