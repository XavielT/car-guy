import { usePathname } from 'expo-router';
import { useEffect } from 'react';

import { recordError } from '../diagnostics';
import { FEATURE_FEEDBACK } from '../flags';
import { noteRoute, outbox } from './index';

/** A few seconds after launch: the first sync and the cluster sweep go first. */
const FLUSH_DELAY_MS = 4000;

/**
 * Mounted once in the root shell: sends what the outbox kept from an offline
 * session, and remembers the current route for the form's "pantalla" field.
 */
export function useFeedbackBoot(): void {
  const pathname = usePathname();

  useEffect(() => {
    noteRoute(pathname);
  }, [pathname]);

  useEffect(() => {
    if (!FEATURE_FEEDBACK) return;
    const timer = setTimeout(() => {
      outbox.flush().catch((error) => recordError('feedback-outbox', error));
    }, FLUSH_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
}
