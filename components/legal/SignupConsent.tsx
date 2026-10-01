import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { legalRoute } from '@/lib/legal';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The one thing that needs the terms accepted (ADR-47): creating an account. 18+ and the two texts
 * in one checkbox; the app/cuenta.tsx submit refuses a signup without it and records the acceptance
 * (legal_acceptance) once the account exists.
 */
export function SignupConsent({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  const { theme } = useTheme();
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={t.legalUi.signupConsent}
        hitSlop={4}
        style={styles.row}>
        <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={24} color={checked ? theme.accent : theme.text.secondary} />
        <T face="body" style={[styles.text, { color: theme.text.primary }]}>
          {t.legalUi.signupConsent}
        </T>
      </Pressable>
      <View style={styles.links}>
        <T face="semibold" accessibilityRole="link" onPress={() => router.push(legalRoute('terminos') as never)} style={[styles.link, { color: theme.accent }]}>
          {t.legalUi.terms}
        </T>
        <T face="semibold" accessibilityRole="link" onPress={() => router.push(legalRoute('privacidad') as never)} style={[styles.link, { color: theme.accent }]}>
          {t.legalUi.privacy}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, minHeight: 44, paddingVertical: space.xs },
  text: { flex: 1, fontSize: 14, lineHeight: 20 },
  links: { flexDirection: 'row', gap: space.lg, paddingLeft: 32 },
  link: { fontSize: 14, textDecorationLine: 'underline', paddingVertical: space.xs },
});
