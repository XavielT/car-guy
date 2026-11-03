import { useState } from 'react';
import { View } from 'react-native';

import { T } from '@/components/T';
import { SectionHeader, Surface, ToggleRow } from '@/components/ui';
import { space } from '@/constants/theme';
import { useAiStatus } from '@/lib/ai/useAiStatus';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import { AiConsentSheet } from './AiConsentSheet';

/**
 * Cuenta > Privacidad > "Usar IA" (IMP 03112026 SPEC-A §A5). Shown only to a signed-in account (the gateway needs the
 * JWT). Turning it on opens the consent sheet and records a version-stamped acceptance on the server; turning it off
 * withdraws it at once. When the AI is switched off by the admin, not configured, or offline, the switch still shows
 * the person's choice and the line under it says why nothing can run right now.
 */
export function AiPrivacyCard() {
  const { theme } = useTheme();
  const ai = useAiStatus();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Not asked yet (loading), or the server cannot say who this is: nothing to switch.
  const unknown = ai.consent === null;
  const on = ai.consent === true;
  const reachable = ai.state !== 'offline' && ai.state !== 'not_configured' && ai.state !== 'loading';

  const toggle = async (next: boolean) => {
    setError(null);
    if (next) {
      setSheet(true);
      return;
    }
    setBusy(true);
    const ok = await ai.setConsent(false);
    setBusy(false);
    if (!ok) setError(t.ai.privacy.saveFailed);
  };

  const accept = async () => {
    setBusy(true);
    const ok = await ai.setConsent(true);
    setBusy(false);
    if (ok) setSheet(false);
    else setError(t.ai.privacy.saveFailed);
  };

  return (
    <View style={{ marginBottom: space.md }}>
      <SectionHeader title={t.ai.privacy.title} />
      <Surface padded>
        <ToggleRow label={t.ai.privacy.toggle} hint={t.ai.privacy.hint} value={on} onChange={(v) => void toggle(v)} disabled={busy || unknown || !reachable} />
        {/* When the switch is on but AI cannot run now (off, capped, offline), say why. */}
        {ai.state !== 'available' && ai.state !== 'needs_consent' ? (
          <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.text.secondary, fontSize: 13, marginTop: space.sm }}>
            {ai.message}
          </T>
        ) : null}
        {error ? (
          <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.dangerText, fontSize: 13, marginTop: space.sm }}>
            {error}
          </T>
        ) : null}
      </Surface>
      <AiConsentSheet visible={sheet} onAccept={() => void accept()} onClose={() => setSheet(false)} busy={busy} />
    </View>
  );
}
