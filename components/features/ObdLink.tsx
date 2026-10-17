import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { T } from '@/components/T';
import { space } from '@/constants/theme';
import { FEATURE_DIY } from '@/lib/flags';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/** "¿Es una luz del tablero? Búscala en el Diagnóstico OBD" — under an empty list where that is the next step (N6a). */
export function ObdLink({ vehicleId }: { vehicleId?: string | null }) {
  const { theme } = useTheme();
  const router = useRouter();
  if (!FEATURE_DIY) return null;
  return (
    <Pressable
      onPress={() => router.push((vehicleId ? `/obd?vehicleId=${vehicleId}` : '/obd') as never)}
      accessibilityRole="link"
      style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: space.sm }}>
      <T face="semibold" style={{ color: theme.accent, fontSize: 13, textAlign: 'center' }}>
        {t.features.obdLink}
      </T>
    </Pressable>
  );
}
