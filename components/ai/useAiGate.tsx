import { useCallback, useState, type ReactNode } from 'react';

import { Alert } from '@/lib/alert';
import { t } from '@/lib/i18n';
import { useAiStatus, type AiStatus } from '@/lib/ai/useAiStatus';
import { AiConsentSheet } from './AiConsentSheet';

/**
 * The same three steps in front of every AI button (IMP 03112026 SPEC-A §A5): no consent yet → the consent sheet; any other
 * state that is not "available" → say why in plain words; otherwise the call may go ahead. `ready()` answers that, and `sheet`
 * is the consent sheet to render once in the component. The manual path underneath is never touched.
 */
export function useAiGate(): { ai: AiStatus; ready: () => boolean; sheet: ReactNode; featureOff: (id: string) => boolean } {
  const ai = useAiStatus();
  const [open, setOpen] = useState(false);
  const ready = useCallback((): boolean => {
    if (ai.state === 'needs_consent') {
      setOpen(true);
      return false;
    }
    if (ai.state !== 'available') {
      Alert.alert(t.ai.consent.title, ai.message);
      return false;
    }
    return true;
  }, [ai.state, ai.message]);
  const sheet = (
    <AiConsentSheet
      visible={open}
      onClose={() => setOpen(false)}
      onAccept={() => {
        void ai.setConsent(true).then((ok) => {
          if (ok) setOpen(false);
        });
      }}
    />
  );
  return { ai, ready, sheet, featureOff: ai.featureOff };
}
