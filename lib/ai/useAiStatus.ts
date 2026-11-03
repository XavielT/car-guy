import { useCallback, useEffect, useRef, useState } from 'react';

import { useSession } from '../cloud/auth';
import { isCloudConfigured } from '../cloud/supabase';
import { t } from '../i18n';
import { fetchAiStatus, setAiConsent } from './client';
import { AiError } from './codes';
import { deriveAiStatus, voiceAvailable, type AiState, type StatusResponse } from './status';

/**
 * The one hook every AI button uses (IMP 03112026 SPEC-A §A5): `available | needs_account | needs_consent | offline |
 * capped | disabled | not_configured | loading`, each with a ready human message in the current language. The button
 * does not disappear: it shows `message` and the manual form stays one tap away.
 */
export type AiStatus = {
  state: AiState;
  message: string;
  /** True / false once signed in and the server answered; null otherwise. Drives the Cuenta switch. */
  consent: boolean | null;
  /** Voice also needs the speech-to-text key on the server. */
  voice: boolean;
  remainingToday: StatusResponse['remainingToday'] | null;
  refresh: () => Promise<void>;
  /** Accept (true) or withdraw (false) consent, then re-read the status. Returns false when it could not be saved. */
  setConsent: (on: boolean) => Promise<boolean>;
};

export function useAiStatus(): AiStatus {
  const { session } = useSession();
  const signedIn = !!session;
  const [response, setResponse] = useState<StatusResponse | null>(null);
  const [failure, setFailure] = useState<'offline' | 'error' | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (!isCloudConfigured) return;
    try {
      const r = await fetchAiStatus();
      if (!alive.current) return;
      setResponse(r);
      setFailure(null);
    } catch (e) {
      const code = e instanceof AiError ? e.code : 'offline';
      if (alive.current) setFailure(code === 'offline' || code === 'timeout' ? 'offline' : 'error');
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    setResponse(null);
    void refresh();
    return () => {
      alive.current = false;
    };
    // Signing in or out changes consent and limits: read again.
  }, [refresh, signedIn]);

  const setConsent = useCallback(
    async (on: boolean) => {
      const stored = await setAiConsent(on);
      if (stored === null) return false;
      await refresh();
      return true;
    },
    [refresh],
  );

  const state = deriveAiStatus({ cloudConfigured: isCloudConfigured, signedIn, response, failure });
  return {
    state,
    message: t.ai.status[state],
    consent: response?.signed_in ? (response.consent ?? false) : null,
    voice: voiceAvailable(state, response),
    remainingToday: response?.remainingToday ?? null,
    refresh,
    setConsent,
  };
}
