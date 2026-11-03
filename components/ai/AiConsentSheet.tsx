import { View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Sheet } from '@/components/ui';
import { space } from '@/constants/theme';
import { AI_CONSENT_VERSION } from '@/lib/ai/client';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The consent sheet (IMP 03112026 SPEC-A §A5, ADR-66): plain words about what is sent, who processes it, what is kept
 * and how to withdraw. Shown the first time a person turns AI on (Cuenta > Privacidad) or the first time an AI button
 * finds consent off. Accepting records a version-stamped row server-side; the Edge Functions re-check it on every call.
 * Nothing is sent to any AI provider before the person taps "Aceptar y activar".
 */
export function AiConsentSheet({
  visible,
  onAccept,
  onClose,
  busy,
}: {
  visible: boolean;
  onAccept: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const { theme } = useTheme();
  const block = (title: string, body: string | string[]) => (
    <View style={{ marginBottom: space.md }}>
      <T face="semibold" style={{ color: theme.text.primary, fontSize: 14, marginBottom: 2 }}>
        {title}
      </T>
      {(Array.isArray(body) ? body : [body]).map((line) => (
        <T key={line} face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20 }}>
          {Array.isArray(body) ? `• ${line}` : line}
        </T>
      ))}
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title={t.ai.consent.title}>
      <T face="body" style={{ color: theme.text.primary, fontSize: 15, lineHeight: 21, marginBottom: space.md }}>
        {t.ai.consent.intro}
      </T>
      {block(t.ai.consent.sentTitle, t.ai.consent.sent)}
      {block(t.ai.consent.processorsTitle, [...t.ai.consent.processors])}
      {block(t.ai.consent.keptTitle, t.ai.consent.kept)}
      <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 18, marginBottom: space.md }}>
        {t.ai.consent.sensitive}
      </T>
      {block(t.ai.consent.withdrawTitle, t.ai.consent.withdraw)}
      <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.md }}>
        {t.ai.consent.version(AI_CONSENT_VERSION)}
      </T>
      <PrimaryButton label={t.ai.consent.accept} onPress={onAccept} disabled={busy} />
      <View style={{ height: space.sm }} />
      <GhostButton label={t.ai.consent.decline} onPress={onClose} />
    </Sheet>
  );
}
